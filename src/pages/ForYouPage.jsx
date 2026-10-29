import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import ForYouCard from '../components/ForYouCard';
import TryOnModal from '../components/TryOnModal';
import OutfitDetailModal from '../components/OutfitDetailModal';
import './ForYouPage.css';

const CATEGORY_CHIPS = [
  { id: 'all', label: 'All', category: 'all' },
  { id: 'streetwear', label: 'Streetwear', category: 'streetwear' },
  { id: 'casual', label: 'Casual', category: 'casual' },
  { id: 'formal', label: 'Office wear', category: 'formal' }, // Maps to formal
  { id: 'ethnic wear', label: 'Ethnic wear', category: 'ethnic wear' },
  { id: 'party wear', label: 'Party wear', category: 'party wear' },
  { id: 'dresses', label: 'Dresses', category: 'dresses' },
  { id: 'college outfits', label: 'College outfits', category: 'college outfits' },
];

export default function ForYouPage() {
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery, showToast, currentUser } = useApp();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categoryCache, setCategoryCache] = useState({});
  const [forYouData, setForYouData] = useState({
    styleProfile: { matchScore: 96, traits: ['Calibrating Silhouette...', 'AI Style Vibe'] },
    curatedGarments: [],
    forYouFeed: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New picks available floating pill
  const [pendingPicks, setPendingPicks] = useState(null);

  const [isTryOnModalOpen, setIsTryOnModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOutfitForDetail, setSelectedOutfitForDetail] = useState(null);
  const [selectedGarment, setSelectedGarment] = useState(null);

  // Request ID ref to guard against race condition when typing quickly
  const latestRequestIdRef = useRef(0);

  // Reference to current feed IDs to avoid layout shifts / reordering under the user
  const currentFeedIdsRef = useRef('');
  currentFeedIdsRef.current = (forYouData.forYouFeed || []).map((o) => o.id).join(',');

  const loadFeedForCategory = useCallback(
    async (categoryKey, query = '', isBackgroundRefresh = false) => {
      const requestId = ++latestRequestIdRef.current;
      const cacheKey = `${categoryKey}__${query}`;

      if (!isBackgroundRefresh) {
        if (!query && categoryCache[categoryKey]) {
          setForYouData(categoryCache[categoryKey]);
          setLoading(false);
        } else {
          setLoading(true);
        }
      }

      setError(null);

      try {
        const data = await api.getForYou({
          category: categoryKey,
          q: query ? query.trim() : '',
          refresh: isBackgroundRefresh,
        });

        // Guard against race conditions: ignore stale responses
        if (requestId !== latestRequestIdRef.current) return;

        if (data && data.forYouFeed) {
          const newIds = data.forYouFeed.map((o) => o.id).join(',');
          const hasCurrentData = currentFeedIdsRef.current.length > 0;

          // If background refresh produced different order or new picks, show pill
          if (hasCurrentData && !query && newIds !== currentFeedIdsRef.current) {
            setPendingPicks(data);
          } else {
            setForYouData(data);
            if (!query) {
              setCategoryCache((prev) => ({ ...prev, [categoryKey]: data }));
            }
            if (data.curatedGarments?.[0]) {
              setSelectedGarment(data.curatedGarments[0]);
            }
          }

          // If the server reported the feed was stale or starter feed, trigger fresh recompute
          if (!query && !isBackgroundRefresh && (data.isStale || data.isStarter)) {
            setTimeout(() => {
              loadFeedForCategory(categoryKey, '', true);
            }, 1200);
          }
        }
      } catch (err) {
        if (requestId === latestRequestIdRef.current) {
          console.error('Failed to load recommendations:', err);
          setError(err?.message || 'Unable to connect to recommendation service');
        }
      } finally {
        if (requestId === latestRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [categoryCache]
  );

  // Debounce search query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      loadFeedForCategory(selectedCategory, searchQuery, false);
    }, searchQuery ? 300 : 0);

    return () => clearTimeout(timer);
  }, [selectedCategory, searchQuery, loadFeedForCategory]);

  const handleCategorySelect = (chipCategory) => {
    if (chipCategory === selectedCategory) return;
    setPendingPicks(null);
    setSelectedCategory(chipCategory);
  };

  const handleApplyNewPicks = () => {
    if (!pendingPicks) return;
    setForYouData(pendingPicks);
    setCategoryCache((prev) => ({ ...prev, [selectedCategory]: pendingPicks }));
    setPendingPicks(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Feed updated with fresh personalized picks!', 'auto_awesome');
  };

  const { styleProfile, curatedGarments, forYouFeed } = forYouData;

  const handleOpenDetailModal = (outfit) => {
    const itemUrl = outfit.shoppingUrl || outfit.shopUrl || outfit.defaultGarment?.shopUrl || outfit.garments?.[0]?.shopUrl || 'https://www.myntra.com';
    setSelectedOutfitForDetail({
      id: outfit.id,
      name: outfit.name,
      category: outfit.category,
      price: outfit.price,
      rating: outfit.rating || 4.8,
      reviewCount: outfit.reviewCount || 120,
      availableSizes: outfit.availableSizes || ['S', 'M', 'L'],
      shoppingUrl: itemUrl,
      shopUrl: itemUrl,
      image: outfit.image,
      fallbackImage: outfit.fallbackImage,
      source: {
        name: outfit.creator?.name || 'Stylist',
        handle: outfit.creator?.handle || '@stylist',
        avatar: outfit.creator?.avatar,
        isRetailer: outfit.creator?.isRetailer,
      },
      caption: outfit.caption,
      garments: (outfit.garments || []).map((g) => ({
        ...g,
        shopUrl: g.shopUrl || g.shoppingUrl || itemUrl,
        shoppingUrl: g.shopUrl || g.shoppingUrl || itemUrl,
      })),
    });
    setIsDetailModalOpen(true);
  };

  const handleOpenTryOn = (outfit) => {
    const itemUrl = outfit.shoppingUrl || outfit.shopUrl || outfit.defaultGarment?.shopUrl || outfit.garments?.[0]?.shopUrl || 'https://www.myntra.com';
    const garment = outfit.defaultGarment ? {
      ...outfit.defaultGarment,
      shopUrl: outfit.defaultGarment.shopUrl || itemUrl,
      shoppingUrl: outfit.defaultGarment.shoppingUrl || itemUrl,
    } : {
      id: outfit.id,
      name: outfit.name,
      brand: outfit.creator?.name || 'Fashion Curator',
      price: outfit.price || 190,
      image: outfit.image,
      shopUrl: itemUrl,
      shoppingUrl: itemUrl,
      collection: `${outfit.category ? outfit.category.toUpperCase() : 'FOR YOU'} Curation`,
    };
    setSelectedGarment(garment);
    setIsTryOnModalOpen(true);
  };

  const handleCuratedGarmentClick = (garment) => {
    const itemUrl = garment.shoppingUrl || garment.shopUrl || 'https://www.myntra.com';
    setSelectedOutfitForDetail({
      id: garment.id,
      name: garment.name,
      category: garment.category || 'Curated Garment',
      price: garment.price,
      rating: garment.rating || 4.7,
      reviewCount: garment.reviewCount || 95,
      availableSizes: garment.availableSizes || ['S', 'M', 'L'],
      shoppingUrl: itemUrl,
      shopUrl: itemUrl,
      image: garment.image,
      source: {
        name: garment.brand || 'Boutique',
        handle: `@${(garment.brand || 'brand').toLowerCase().replace(/\s+/g, '')}`,
        isRetailer: true,
      },
    });
    setIsDetailModalOpen(true);
  };

  const handleTryCuratedGarment = (garment) => {
    const itemUrl = garment.shoppingUrl || garment.shopUrl || 'https://www.myntra.com';
    setSelectedGarment({
      ...garment,
      shopUrl: garment.shopUrl || itemUrl,
      shoppingUrl: garment.shoppingUrl || itemUrl,
    });
    setIsTryOnModalOpen(true);
  };

  return (
    <div className="foryou-page">
      {/* Top Header Match Score Strip */}
      <div className="foryou-header-strip">
        <div className="match-score-row">
          <div className="recommended-pill">
            <span className="material-symbols-outlined fill-1" style={{ fontSize: '15px', color: 'var(--primary)' }}>
              auto_awesome
            </span>
            <span>Recommended for You</span>
          </div>

          <div className="match-badge">
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                animation: 'pulseGlow 1.5s infinite',
              }}
            />
            <span>{styleProfile?.matchScore || 96}% Match</span>
          </div>
        </div>

        {/* Algorithm Match Insight Banner */}
        <div className="style-profile-banner">
          <div className="profile-banner-left">
            <span
              className="material-symbols-outlined fill-1"
              style={{ fontSize: '18px', color: 'var(--primary)', flexShrink: 0 }}
            >
              tune
            </span>
            <p className="profile-banner-text">
              <strong style={{ color: 'var(--on-surface)' }}>Style Profile:</strong>{' '}
              {Array.isArray(styleProfile?.traits)
                ? styleProfile.traits.join(' · ')
                : `${styleProfile?.bodyType || 'Hourglass'} · ${styleProfile?.styleVibe || 'Streetwear'} (${styleProfile?.heightCm || 165}cm)`}
            </p>
          </div>
          <button
            className="edit-profile-btn"
            onClick={() => {
              navigate('/profile');
              showToast('Edit your measurements in Body Profile', 'straighten');
            }}
          >
            Edit
          </button>
        </div>
      </div>

      {/* Category Chips Row (Phase 4) */}
      <div className="category-chips-scroll" role="tablist" aria-label="Occasion Categories">
        {CATEGORY_CHIPS.map((chip) => {
          const isActive = selectedCategory === chip.category;
          return (
            <button
              key={chip.id}
              role="tab"
              aria-selected={isActive}
              className={`category-chip ${isActive ? 'active' : ''}`}
              onClick={() => handleCategorySelect(chip.category)}
            >
              {isActive && (
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#d4af37' }}>
                  check
                </span>
              )}
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>

      {/* Floating "New Picks" Pill (shown if background refresh changed order) */}
      {pendingPicks && (
        <div className="new-picks-pill-container">
          <button className="new-picks-pill" onClick={handleApplyNewPicks}>
            <span className="material-symbols-outlined fill-1" style={{ fontSize: '16px', color: '#fef08a' }}>
              auto_awesome
            </span>
            <span>New picks available</span>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              arrow_upward
            </span>
          </button>
        </div>
      )}

      {/* Curated Garments Carousel */}
      {loading && curatedGarments.length === 0 ? (
        <div className="curated-section" style={{ padding: '0 16px' }}>
          <div className="skeleton" style={{ width: '140px', height: '18px', marginBottom: '12px' }} />
          <div style={{ display: 'flex', gap: '12px', overflow: 'hidden' }}>
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="skeleton" style={{ width: '130px', height: '180px', flexShrink: 0, borderRadius: 'var(--radius-lg)' }} />
            ))}
          </div>
        </div>
      ) : (
        curatedGarments && curatedGarments.length > 0 && (
          <div className="curated-section">
            <div className="section-title-row">
              <h3 className="section-heading">Curated Garments</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>
                Matched to Your Palette
              </span>
            </div>

            <div className="curated-scroll-container">
              {curatedGarments.map((garment, idx) => (
                <div
                  key={garment.id || idx}
                  className="curated-item-card"
                  onClick={() => handleCuratedGarmentClick(garment)}
                >
                  <div className="curated-image-box">
                    <img src={garment.image} alt={garment.name} loading="lazy" />
                    <button
                      className="curated-try-overlay"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTryCuratedGarment(garment);
                      }}
                      title="Try this on"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        checkroom
                      </span>
                    </button>
                  </div>
                  <div className="curated-meta">
                    <span className="curated-brand">{garment.brand}</span>
                    <span className="curated-name">{garment.name}</span>
                    <span className="curated-price">₹{garment.price}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Main For-You Feed */}
      <div className="foryou-feed-container">
        {loading && forYouFeed.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '16px' }}>
            {[1, 2].map((idx) => (
              <div key={idx} className="skeleton" style={{ width: '100%', height: '420px', borderRadius: 'var(--radius-xl)' }} />
            ))}
          </div>
        ) : error ? (
          <div className="foryou-empty">
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--error)' }}>
              cloud_off
            </span>
            <p>{error}</p>
            <button className="edit-profile-btn" onClick={() => loadFeedForCategory(selectedCategory, true)}>
              Retry Connection
            </button>
          </div>
        ) : forYouFeed.length === 0 ? (
          <div className="foryou-empty">
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--outline)' }}>
              {searchQuery ? 'search_off' : 'checkroom'}
            </span>
            <p>No outfits match "{searchQuery || selectedCategory}"</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '12px' }}>
              {searchQuery && (
                <button
                  className="edit-profile-btn"
                  onClick={() => setSearchQuery('')}
                >
                  Clear Search
                </button>
              )}
              {selectedCategory !== 'all' && (
                <button
                  className="edit-profile-btn"
                  onClick={() => handleCategorySelect('all')}
                >
                  Reset to All
                </button>
              )}
            </div>
          </div>
        ) : (
          forYouFeed.map((outfit) => (
            <ForYouCard
              key={outfit.id}
              outfit={outfit}
              onCardClick={() => handleOpenDetailModal(outfit)}
              onTryOnClick={() => handleOpenTryOn(outfit)}
            />
          ))
        )}
      </div>

      {/* Interactive Modals */}
      {isDetailModalOpen && (
        <OutfitDetailModal
          outfit={selectedOutfitForDetail}
          onClose={() => setIsDetailModalOpen(false)}
          onTryOnOpen={(garment) => {
            setIsDetailModalOpen(false);
            setSelectedGarment(garment);
            setIsTryOnModalOpen(true);
          }}
        />
      )}

      {isTryOnModalOpen && (
        <TryOnModal
          garment={selectedGarment}
          onClose={() => setIsTryOnModalOpen(false)}
        />
      )}
    </div>
  );
}
