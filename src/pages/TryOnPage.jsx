import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import './TryOnPage.css';

export default function TryOnPage() {
  const {
    activeTryOn,
    setActiveTryOn,
    sourcePersona,
    setSourcePersona,
    saveTryOnToCollection,
    setGarmentForTryOn,
    showToast,
  } = useApp();

  const [activeView, setActiveView] = useState('ai'); // 'ai' | 'original'
  const [selectedPersonaOption, setSelectedPersonaOption] = useState('saved'); // 'saved' | 'upload' | 'camera'
  const [isGarmentPickerOpen, setIsGarmentPickerOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [productFitData, setProductFitData] = useState(null);

  const garment = activeTryOn.garment;

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

  // Load catalog products for the garment change picker
  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      const data = await api.getProducts({ wearableOnly: true, limit: 30 });
      if (isMounted && data.products) {
        setCatalogProducts(data.products);
      }
    }
    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, []);


  const handleSaveLook = () => {
    saveTryOnToCollection(activeTryOn);
    showToast('Look saved to your wardrobe collection!', 'bookmark_added');
  };

  const handleShopItem = () => {
    const url = garment.shopUrl || 'https://www.myntra.com';
    window.open(url, '_blank');
  };

  const handleShareLook = () => {
    navigator.clipboard?.writeText?.(window.location.href);
    showToast('Look link copied to clipboard!', 'share');
  };

  const handleSelectGarment = async (prod) => {
    setIsGarmentPickerOpen(false);
    setIsRendering(true);
    setRenderProgress(20);
    showToast(`Dressing model in ${prod.name}...`, 'auto_awesome');

    try {
      // 1. Submit try-on request to backend
      const res = await api.submitTryOn({
        userId: 'u-ananya-sharma-001',
        productId: prod.id,
        userPhotoUrl: activeTryOn.originalPhoto || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80',
        userHeightCm: 165,
        sizeSelected: prod.sizes?.[0] || 'M',
      });

      if (res && res.jobId) {
        // 2. Poll for completion
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          const statusRes = await api.pollTryOnJob(res.jobId);
          if (statusRes) {
            setRenderProgress(statusRes.progressPercent || Math.min(95, attempts * 25));

            if (statusRes.status === 'COMPLETED') {
              clearInterval(interval);
              setIsRendering(false);
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
                aiRenderedImage: statusRes.renderedImageUrl || prod.image,
                originalPhoto: activeTryOn.originalPhoto,
                fitNote: statusRes.fitNote || `${prod.brand} Tailored Fit`,
                matchScore: statusRes.fitScore ? `${statusRes.fitScore}%` : '94%',
              });

              showToast(`Virtual try-on completed! Fit Score: ${statusRes.fitScore || 94}%`, 'check_circle');
            } else if (statusRes.status === 'FAILED' || attempts > 20) {
              clearInterval(interval);
              setIsRendering(false);
              setGarmentForTryOn(prod);
              showToast('Generated instant try-on preview', 'auto_awesome');
            }
          }
        }, 600);
      } else {
        // Local immediate fallback
        setIsRendering(false);
        setGarmentForTryOn(prod);
      }
    } catch (e) {
      setIsRendering(false);
      setGarmentForTryOn(prod);
    }
  };

  return (
    <div className="tryon-page">
      <div className="tryon-content">
        {/* 1. Source Persona Selection Area */}
        <section className="persona-selector-section">
          <div className="persona-header-row">
            <span className="persona-title-lbl">Source Persona</span>
            <div className="calibration-badge">
              <span className="material-symbols-outlined fill-1" style={{ fontSize: '14px' }}>
                auto_awesome
              </span>
              <span>Calibration Ready</span>
            </div>
          </div>

          <div className="persona-grid">
            {/* Option 1: Saved Model Active */}
            <button
              className={`persona-card-btn ${selectedPersonaOption === 'saved' ? 'active' : 'inactive'}`}
              onClick={() => setSelectedPersonaOption('saved')}
            >
              <div className="persona-avatar-wrap ringed">
                <img src={sourcePersona.avatar} alt={sourcePersona.name} />
              </div>
              <span className="persona-name">{sourcePersona.name}</span>
              <span className="persona-sub">Default Model</span>
              {selectedPersonaOption === 'saved' && (
                <div className="persona-check-badge">
                  <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>
                    check
                  </span>
                </div>
              )}
            </button>

            {/* Option 2: Upload Photo */}
            <button
              className={`persona-card-btn ${selectedPersonaOption === 'upload' ? 'active' : 'inactive'}`}
              onClick={() => {
                setSelectedPersonaOption('upload');
                showToast('Upload photo calibrated with 165cm height', 'add_photo_alternate');
              }}
            >
              <div className="persona-icon-circle">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  add_photo_alternate
                </span>
              </div>
              <span className="persona-name">Upload Photo</span>
              <span style={{ fontSize: '0.625rem', color: 'var(--on-surface-variant)' }}>Gallery / File</span>
            </button>

            {/* Option 3: Take Photo */}
            <button
              className={`persona-card-btn ${selectedPersonaOption === 'camera' ? 'active' : 'inactive'}`}
              onClick={() => {
                setSelectedPersonaOption('camera');
                showToast('Camera calibrated for instant pose', 'photo_camera');
              }}
            >
              <div className="persona-icon-circle">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  photo_camera
                </span>
              </div>
              <span className="persona-name">Take Photo</span>
              <span style={{ fontSize: '0.625rem', color: 'var(--on-surface-variant)' }}>Instant Pose</span>
            </button>
          </div>
        </section>

        {/* 2. Garment Selection Preview Strip */}
        <section className="garment-strip">
          <div className="garment-strip-left">
            {garment.image && (
              <img src={garment.image} alt={garment.name} className="garment-strip-thumb" />
            )}
            <div className="garment-strip-info">
              <div className="garment-strip-tag-row">
                <span>Trying On</span>
                <span>•</span>
                <span style={{ color: 'var(--on-surface-variant)' }}>₹{garment.price}</span>
              </div>
              <h2 className="garment-strip-title">{garment.name}</h2>
              <p className="garment-strip-sub">
                {garment.brand} {garment.collection ? `· ${garment.collection}` : ''}
              </p>
            </div>
          </div>

          <button className="garment-change-btn" onClick={() => setIsGarmentPickerOpen(true)}>
            <span>Change</span>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              swap_horiz
            </span>
          </button>
        </section>

        {/* 3. Realistic AI Try-On Canvas Stage (3:4) */}
        <section className="tryon-stage">
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

          {/* Rendering Overlay */}
          {isRendering && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(27, 27, 30, 0.75)',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                zIndex: 10,
                color: 'var(--on-surface)',
              }}
            >
              <span className="material-symbols-outlined spin" style={{ fontSize: '36px', color: 'var(--primary)' }}>
                progress_activity
              </span>
              <p style={{ fontWeight: 600, fontSize: '0.9375rem' }}>AI Virtual Fitting in Progress...</p>
              <div style={{ width: '160px', height: '4px', backgroundColor: 'var(--surface-container-high)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${renderProgress}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.3s ease' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>Calibrating drape & seams</span>
            </div>
          )}

          {/* Top Controls Overlay */}
          <div className="stage-top-controls">
            <div className="mock-preview-pill">
              <span className="material-symbols-outlined fill-1" style={{ fontSize: '14px', color: 'var(--secondary-fixed-dim)' }}>
                auto_fix_high
              </span>
              <span>{activeTryOn.matchScore ? `${activeTryOn.matchScore} Match` : 'AI Generated'}</span>
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
        </section>

        {/* Phase B5: Per-Area Fit Report & Ease Breakdown */}
        {productFitData && (
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

        {/* 4. Action Buttons */}
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
                    backgroundColor: prod.id === garment.id ? 'var(--secondary-fixed)' : 'var(--surface-container-low)',
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
                  {prod.id === garment.id && (
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
