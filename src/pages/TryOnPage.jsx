import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import './TryOnPage.css';

export default function TryOnPage() {
  const [searchParams] = useSearchParams();
  const queryProductId = searchParams.get('productId');

  const {
    activeTryOn,
    setActiveTryOn,
    saveTryOnToCollection,
    showToast,
    currentUser,
  } = useApp();

  const [activeView, setActiveView] = useState('ai'); // 'ai' | 'original'
  const [isGarmentPickerOpen, setIsGarmentPickerOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [isRendering, setIsRendering] = useState(false);
  const [jobStatus, setJobStatus] = useState('IDLE'); // 'IDLE' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderError, setRenderError] = useState(null);
  const [selectedGarment, setSelectedGarment] = useState(null);
  const [productFitData, setProductFitData] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  const hasAutoStartedRef = useRef(false);

  const garment = activeTryOn?.garment || selectedGarment;

  // Load authenticated user profile for real photo and height
  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      try {
        const profile = await api.getCurrentUser();
        if (isMounted && profile) {
          setUserProfile(profile.user || profile);
        }
      } catch (err) {
        console.warn('Failed to load profile in TryOnPage:', err);
      }
    }
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load fit report data for current garment (Phase B5)
  useEffect(() => {
    let isMounted = true;
    async function loadFit() {
      if (garment?.id) {
        const numId = typeof garment.id === 'string' ? parseInt(garment.id.replace(/\D/g, ''), 10) || 392 : garment.id;
        const fitRes = await api.getProductFit(numId);
        if (isMounted && fitRes) {
          setProductFitData(fitRes);
        }
      }
    }
    loadFit();
    return () => {
      isMounted = false;
    };
  }, [garment?.id]);

  // Load catalog products for garment picker modal
  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      const data = await api.getProducts({ wearableOnly: true, limit: 30 });
      if (isMounted && data.products) {
        setCatalogProducts(
          data.products.map((p) => {
            const itemUrl = p.shopUrl || p.productUrl || p.shoppingUrl || 'https://www.myntra.com';
            return {
              ...p,
              shopUrl: itemUrl,
              shoppingUrl: itemUrl,
              productUrl: itemUrl,
            };
          })
        );
      }
    }
    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-load product if productId query parameter exists
  useEffect(() => {
    let isMounted = true;
    async function loadQueryGarment() {
      if (!queryProductId) return;
      try {
        const prodData = await api.getProductById(queryProductId);
        const p = prodData?.product || prodData;
        if (isMounted && p && p.id) {
          const itemUrl = p.shopUrl || p.productUrl || p.shoppingUrl || 'https://www.myntra.com';
          const primaryImg = p.image || p.ProductImage?.[0]?.imageUrl || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600';
          const formatted = {
            id: p.id,
            name: p.name,
            brand: p.brand || 'Brand',
            price: Number(p.currentPrice || p.price || 0),
            image: primaryImg,
            shopUrl: itemUrl,
            shoppingUrl: itemUrl,
            productUrl: itemUrl,
            sizes: p.sizes || ['S', 'M', 'L'],
          };
          setSelectedGarment(formatted);
          handleSelectGarment(formatted);
        }
      } catch (err) {
        console.warn('Failed to load product from query param:', err);
      }
    }
    loadQueryGarment();
    return () => {
      isMounted = false;
    };
  }, [queryProductId]);

  // Auto-start try-on if user navigated with a garment selected but no render yet
  useEffect(() => {
    if (activeTryOn?.garment && !activeTryOn.aiRenderedImage && !isRendering && !renderError && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      handleSelectGarment(activeTryOn.garment);
    }
  }, [activeTryOn?.garment]);

  const handleSaveLook = () => {
    if (!activeTryOn?.aiRenderedImage || !garment) return;
    saveTryOnToCollection(activeTryOn);
    showToast('Look saved to your wardrobe collection!', 'bookmark_added');
  };

  const handleShopItem = () => {
    const url = garment?.shopUrl || garment?.shoppingUrl || garment?.productUrl || 'https://www.myntra.com';
    window.open(url, '_blank', 'noopener,noreferrer');
    showToast(`Opening ${garment?.brand || 'storefront'}...`, 'shopping_bag');
  };

  const handleShareLook = () => {
    navigator.clipboard?.writeText?.(window.location.href);
    showToast('Look link copied to clipboard!', 'share');
  };

  const handleSelectGarment = async (prod) => {
    setSelectedGarment(prod);
    setIsGarmentPickerOpen(false);
    setIsRendering(true);
    setRenderError(null);
    setJobStatus('QUEUED');
    setRenderProgress(10);
    showToast(`Queuing try-on for ${prod.name}...`, 'auto_awesome');

    try {
      // Real authenticated user photo and height
      const effHeight = userProfile?.bodyProfile?.heightCm || currentUser?.bodyProfile?.heightCm || 165;
      const effPhoto = userProfile?.bodyProfile?.fullBodyPhotoUrl || currentUser?.bodyProfile?.fullBodyPhotoUrl || userProfile?.avatarUrl || userProfile?.avatar || '';

      // 1. Submit try-on request to backend
      const res = await api.submitTryOn({
        productId: prod.id,
        userPhotoUrl: effPhoto,
        userHeightCm: effHeight,
        sizeSelected: prod.sizes?.[0] || 'M',
      });

      if (!res || !res.jobId) {
        throw new Error(res?.error?.message || res?.message || 'Failed to queue virtual try-on job.');
      }

      // 2. Poll using waitForJob until COMPLETED or throw on FAILED/timeout
      const statusRes = await api.waitForJob(res.jobId, {
        intervalMs: 2000,
        timeoutMs: 120000,
        onProgress: (job) => {
          setJobStatus(job.status);
          setRenderProgress(job.progressPercent || (job.status === 'PROCESSING' ? 50 : 10));
        },
      });

      // 3. COMPLETED!
      setIsRendering(false);
      setJobStatus('COMPLETED');
      setRenderProgress(100);

      setActiveTryOn({
        id: statusRes.tryOnSessionId || `tryon-${Date.now()}`,
        garment: {
          id: prod.id,
          name: prod.name,
          brand: prod.brand,
          price: prod.price,
          image: prod.image,
          shopUrl: prod.shopUrl,
        },
        aiRenderedImage: statusRes.renderedImageUrl,
        originalPhoto: effPhoto,
        fitNote: statusRes.fitNote || `${prod.brand} Custom Tailoring`,
        matchScore: statusRes.fitScore ? `${statusRes.fitScore}%` : '94%',
        mode: statusRes.mode || 'demo',
      });

      showToast(`Virtual try-on completed! Fit Score: ${statusRes.fitScore || 94}%`, 'check_circle');
    } catch (err) {
      console.error('[FitsYou Try-On Exception]', err);
      setIsRendering(false);
      setJobStatus('FAILED');

      // Separate programming errors from API errors
      const isProgrammingError =
        err instanceof ReferenceError ||
        err instanceof TypeError ||
        err instanceof RangeError ||
        err instanceof SyntaxError;

      if (isProgrammingError) {
        setRenderError({
          isProgrammingError: true,
          message: 'Something went wrong while setting up your fitting. Please refresh or try again.',
        });
        showToast('Something went wrong. Please try again.', 'error');
      } else {
        const errorMsg = err.message || 'Virtual try-on generation failed.';
        setRenderError({
          isProgrammingError: false,
          message: errorMsg,
        });
        showToast(`Try-on failed: ${errorMsg}`, 'error');
      }
      // Never fall back to catalog image as a "result"!
    }
  };

  const handleRetry = () => {
    const target = garment || selectedGarment;
    if (target) {
      handleSelectGarment(target);
    } else {
      setIsGarmentPickerOpen(true);
    }
  };

  // TODO (Phase 3): replace with auth user
  const userPhoto = userProfile?.bodyProfile?.fullBodyPhotoUrl || userProfile?.avatar;
  const userHeight = userProfile?.bodyProfile?.heightCm || userProfile?.heightCm;

  return (
    <div className="tryon-page">
      <div className="tryon-content">
        {/* 1. Source Persona: Single elevated card with photo, height, and Update in Profile link */}
        <section className="persona-selector-section">
          <div className="persona-header-row">
            <span className="persona-title-lbl">Source Persona</span>
            <Link to="/profile" className="persona-update-link">
              <span>Update in Profile</span>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                arrow_forward
              </span>
            </Link>
          </div>

          <div className="persona-single-card">
            {userPhoto ? (
              <div className="persona-card-content">
                <div className="persona-avatar-wrap ringed">
                  <img src={userPhoto} alt={userProfile?.name || 'Your Persona'} />
                </div>
                <div className="persona-info-col">
                  <span className="persona-name">{userProfile?.name || 'Your Profile Persona'}</span>
                  <div className="persona-meta-row">
                    {userHeight ? (
                      <span className="persona-height-badge">
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                          straighten
                        </span>
                        <span>{userHeight} cm</span>
                      </span>
                    ) : (
                      <span className="persona-sub">Height not set</span>
                    )}
                    <span style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)' }}>
                      Calibrated for Drape
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="persona-no-photo-prompt">
                <div className="persona-icon-circle">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    add_a_photo
                  </span>
                </div>
                <div className="persona-info-col">
                  <span className="persona-no-photo-title">No reference photo added</span>
                  <span className="persona-no-photo-desc">
                    Add a full-body photo in your profile to enable personalized fitting
                  </span>
                </div>
                <Link to="/profile" className="persona-add-photo-btn">
                  Add in Profile
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* 2. Garment Selection Preview Strip (shown when garment is selected) */}
        {garment && (
          <section className="garment-strip">
            <div
              className="garment-strip-left"
              onClick={handleShopItem}
              title="Click to view product on retailer storefront"
              style={{ cursor: 'pointer' }}
            >
              {garment.image && (
                <img src={garment.image} alt={garment.name} className="garment-strip-thumb" />
              )}
              <div className="garment-strip-info">
                <div className="garment-strip-tag-row">
                  <span>Trying On</span>
                  <span>•</span>
                  <span style={{ color: 'var(--on-surface-variant)' }}>₹{garment.price}</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--primary)' }}>
                    open_in_new
                  </span>
                </div>
                <h2 className="garment-strip-title">{garment.name}</h2>
                <p className="garment-strip-sub">
                  {garment.brand} {garment.collection ? `· ${garment.collection}` : ''}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="garment-change-btn"
                onClick={handleShopItem}
                title="Open product on retailer storefront"
                style={{ backgroundColor: 'var(--primary-container)', color: 'var(--primary)' }}
              >
                <span>Shop</span>
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                  open_in_new
                </span>
              </button>
              <button className="garment-change-btn" onClick={() => setIsGarmentPickerOpen(true)}>
                <span>Change</span>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  swap_horiz
                </span>
              </button>
            </div>
          </section>
        )}

        {/* 3. Realistic AI Try-On Canvas Stage (3:4) */}
        <section className="tryon-stage">
          {/* State A: Skeleton Loading State (while QUEUED or PROCESSING) */}
          {isRendering ? (
            <div className="tryon-stage-skeleton">
              <div className="skeleton-canvas-shimmer" />
              <div className="skeleton-status-box">
                <span className="material-symbols-outlined spin" style={{ fontSize: '38px', color: 'var(--primary)' }}>
                  progress_activity
                </span>
                <p className="skeleton-status-title">
                  {jobStatus === 'QUEUED' ? 'Queued for Virtual Fitting...' : 'AI Fitting & Calibration in Progress...'}
                </p>
                <div className="skeleton-progress-bar-bg">
                  <div className="skeleton-progress-bar-fill" style={{ width: `${renderProgress}%` }} />
                </div>
                <span className="skeleton-progress-sub">
                  {jobStatus === 'QUEUED'
                    ? 'Job queued in background (10%)'
                    : `Calibrating drape, seams & lighting (${renderProgress}%)`}
                </span>
              </div>
            </div>
          ) : renderError ? (
            /* State B: Error State with Retry Button (Never fallback to catalog image!) */
            <div className="tryon-stage-error">
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ff6b6b' }}>
                error_outline
              </span>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--on-surface)' }}>
                {renderError?.isProgrammingError ? 'Something Went Wrong' : 'Virtual Fitting Failed'}
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', maxWidth: '280px', lineHeight: 1.4 }}>
                {renderError?.message || renderError}
              </p>
              <button className="tryon-retry-btn" onClick={handleRetry}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  replay
                </span>
                <span>Retry Fitting</span>
              </button>
              <button
                className="garment-change-btn"
                style={{ marginTop: '4px' }}
                onClick={() => setIsGarmentPickerOpen(true)}
              >
                Choose Different Garment
              </button>
            </div>
          ) : !activeTryOn?.aiRenderedImage ? (
            /* State C: Empty State ("Pick a garment to try on") */
            <div className="tryon-stage-empty">
              <div className="empty-icon-wrap">
                <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--primary)' }}>
                  checkroom
                </span>
              </div>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--on-surface)' }}>
                Pick a garment to try on
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', maxWidth: '260px' }}>
                Browse runway catalog items to simulate realistic virtual try-ons with anthropometric drape
              </p>
              <button className="tryon-pick-garment-btn" onClick={() => setIsGarmentPickerOpen(true)}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  swap_horiz
                </span>
                <span>Select Garment from Catalog</span>
              </button>
            </div>
          ) : (
            /* State D: Completed Try-On Result */
            <>
              {/* AI Rendered Layer */}
              <img
                src={activeTryOn.aiRenderedImage}
                alt="AI Rendered Fitting Result"
                className="stage-layer-img"
                style={{
                  opacity: activeView === 'ai' ? 1 : 0,
                  transform: isZoomed ? 'scale(1.25)' : 'scale(1)',
                  transition: 'transform 0.3s ease, opacity 0.3s ease',
                }}
              />

              {/* Original Photo Layer */}
              {activeTryOn.originalPhoto && (
                <img
                  src={activeTryOn.originalPhoto}
                  alt="Original User Reference"
                  className="stage-layer-img"
                  style={{
                    opacity: activeView === 'original' ? 1 : 0,
                    transform: isZoomed ? 'scale(1.25)' : 'scale(1)',
                    transition: 'transform 0.3s ease, opacity 0.3s ease',
                  }}
                />
              )}

              {/* Top Controls Overlay */}
              <div className="stage-top-controls">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="mock-preview-pill">
                    <span className="material-symbols-outlined fill-1" style={{ fontSize: '14px', color: 'var(--secondary-fixed-dim)' }}>
                      auto_fix_high
                    </span>
                    <span>{activeTryOn.matchScore ? `${activeTryOn.matchScore} Match` : 'AI Generated'}</span>
                  </div>

                  {/* Demo Render Badge */}
                  {activeTryOn.mode === 'demo' && (
                    <div className="demo-render-badge">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px', marginRight: '4px' }}>
                        science
                      </span>
                      <span>Demo render</span>
                    </div>
                  )}
                </div>

                <button
                  className="stage-zoom-btn"
                  onClick={() => setIsZoomed(!isZoomed)}
                  aria-label="Inspect fabric details"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {isZoomed ? 'zoom_out' : 'zoom_in'}
                  </span>
                </button>
              </div>

              {/* Center Dynamic Garment Hotspot Chip */}
              {activeView === 'ai' && (
                <div className="center-hotspot-chip">
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary)',
                      boxShadow: '0 0 8px var(--primary)',
                    }}
                  />
                  <span>{activeTryOn.fitNote || 'Structured Silk Fit'}</span>
                </div>
              )}

              {/* Bottom Floating View Slider Pill (Original vs Virtual Try-On) */}
              {activeTryOn.originalPhoto && (
                <div className="stage-slider-pill">
                  <button
                    className={`slider-toggle-btn ${activeView === 'original' ? 'active' : 'inactive'}`}
                    onClick={() => setActiveView('original')}
                  >
                    Original Photo
                  </button>
                  <button
                    className={`slider-toggle-btn ${activeView === 'ai' ? 'active' : 'inactive'}`}
                    onClick={() => setActiveView('ai')}
                  >
                    <span className="material-symbols-outlined fill-1" style={{ fontSize: '13px', marginRight: '4px' }}>
                      auto_fix_high
                    </span>
                    Virtual Try-On
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Phase B5: Per-Area Fit Report & Ease Breakdown (shown when result available) */}
        {activeTryOn?.aiRenderedImage && productFitData && (
          <section
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--surface-container-low)',
              borderRadius: '16px',
              border: '1px solid var(--outline-variant)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>
                  straighten
                </span>
                <span style={{ fontWeight: 700, fontSize: '0.8125rem' }}>Per-Area Fit & Ease</span>
              </div>
              {productFitData.recommendedSize && (
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--primary-container)',
                    color: 'var(--on-primary-container)',
                  }}
                >
                  Size {productFitData.recommendedSize} Recommended
                </span>
              )}
            </div>

            {productFitData.fitDescriptor && (
              <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
                {productFitData.fitDescriptor}
              </p>
            )}

            {productFitData.isEstimate && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(232, 221, 255, 0.4)',
                  border: '1px solid rgba(124, 58, 237, 0.2)',
                  fontSize: '0.75rem',
                  color: 'var(--on-surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>
                    info
                  </span>
                  <span>Based on height and body type only. Add measurements for a precise fit</span>
                </div>
                <Link
                  to="/profile"
                  style={{
                    color: 'var(--primary)',
                    fontWeight: 700,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    fontSize: '0.6875rem',
                    textTransform: 'uppercase',
                  }}
                >
                  Add
                </Link>
              </div>
            )}

            {productFitData.fitReport && productFitData.fitReport.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '6px' }}>
                {productFitData.fitReport.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--surface-container-high)',
                      border: '1px solid var(--outline)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: 'var(--on-surface-variant)', textTransform: 'capitalize' }}>
                      <span>{item.area}</span>
                      <span
                        style={{
                          fontWeight: 700,
                          color:
                            item.label === 'tight'
                              ? '#ff6b6b'
                              : item.label === 'regular'
                              ? '#51cf66'
                              : '#fab005',
                        }}
                      >
                        {item.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>
                        {item.easeCm >= 0 ? `+${item.easeCm}` : item.easeCm}cm
                      </span>
                      <span style={{ fontSize: '0.5625rem', color: 'var(--on-surface-variant)' }}>ease</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 4. Action Buttons (shown when result available) */}
        {activeTryOn?.aiRenderedImage && garment && (
          <>
            <div className="tryon-actions-row">
              <button className="tryon-action-btn tryon-action-save" onClick={handleSaveLook}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  bookmark_add
                </span>
                <span>Save to Wardrobe</span>
              </button>

              <button className="tryon-action-btn tryon-action-buy" onClick={handleShopItem}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  local_mall
                </span>
                <span>Shop Item · ₹{garment.price}</span>
              </button>
            </div>

            <button
              onClick={handleShareLook}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 0',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                share
              </span>
              <span>Share Virtual Fitting Look</span>
            </button>
          </>
        )}
      </div>

      {/* Garment Change Picker Modal */}
      {isGarmentPickerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(27, 27, 30, 0.65)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '16px',
            maxWidth: '480px',
            margin: '0 auto',
          }}
          onClick={() => setIsGarmentPickerOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: '24px',
              padding: '20px',
              maxHeight: '70vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              animation: 'slideUp 0.3s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.25rem' }}>
                Select Garment from Catalog
              </h3>
              <button
                onClick={() => setIsGarmentPickerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
              {(catalogProducts.length > 0 ? catalogProducts : []).map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => handleSelectGarment(prod)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    backgroundColor: prod.id === garment?.id ? 'var(--secondary-fixed)' : 'var(--surface-container-low)',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <img
                    src={prod.image}
                    alt={prod.name}
                    style={{ width: '40px', height: '48px', objectFit: 'cover', borderRadius: '6px' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                      {prod.brand}
                    </span>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {prod.name}
                    </p>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--on-surface)' }}>
                      ₹{prod.price}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const itemUrl = prod.shopUrl || prod.shoppingUrl || prod.productUrl || 'https://www.myntra.com';
                      window.open(itemUrl, '_blank', 'noopener,noreferrer');
                    }}
                    title={`Open link to ${prod.name} on store`}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      open_in_new
                    </span>
                  </button>
                  {prod.id === garment?.id && (
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '18px' }}>
                      check
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
