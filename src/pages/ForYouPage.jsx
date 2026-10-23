import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import ForYouCard from '../components/ForYouCard';
import TryOnModal from '../components/TryOnModal';
import OutfitDetailModal from '../components/OutfitDetailModal';
import './ForYouPage.css';

export default function ForYouPage() {
  const navigate = useNavigate();
  const { searchQuery, showToast, setGarmentForTryOn } = useApp();

  const [forYouData, setForYouData] = useState({
    styleProfile: { matchScore: 96, traits: ['Hourglass Silhouette', 'Streetwear & Indie', 'Petite Proportion'] },
    curatedGarments: [],
    forYouFeed: [],
  });
  const [loading, setLoading] = useState(true);

  const [isTryOnModalOpen, setIsTryOnModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOutfitForDetail, setSelectedOutfitForDetail] = useState(null);
  const [selectedGarment, setSelectedGarment] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadForYou() {
      setLoading(true);
      const data = await api.getForYou({ userId: 'u-ananya-sharma-001' });
      if (isMounted && data) {
        setForYouData(data);
        if (data.curatedGarments?.[0]) {
          setSelectedGarment(data.curatedGarments[0]);
        }
        setLoading(false);
      }
    }
    loadForYou();
    return () => {
      isMounted = false;
    };
  }, []);

  const { styleProfile, curatedGarments, forYouFeed } = forYouData;

  // Filter feed if user types in search bar
  const filteredFeed = forYouFeed.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name?.toLowerCase().includes(q) ||
      item.creator?.name?.toLowerCase().includes(q) ||
      item.creator?.handle?.toLowerCase().includes(q) ||
      (item.category && item.category.toLowerCase().includes(q)) ||
      (item.caption && item.caption.toLowerCase().includes(q)) ||
      (item.tags && item.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });

  const handleOpenDetailModal = (outfit) => {
    setSelectedOutfitForDetail({
      id: outfit.id,
      name: outfit.name,
      category: outfit.category,
      price: outfit.price,
      rating: outfit.rating || 4.8,
      reviewCount: outfit.reviewCount || 120,
      availableSizes: outfit.availableSizes || ['S', 'M', 'L'],
      shoppingUrl: outfit.shoppingUrl,
      image: outfit.image,
      fallbackImage: outfit.fallbackImage,
      source: {
        name: outfit.creator?.name || 'Stylist',
        handle: outfit.creator?.handle || '@stylist',
        avatar: outfit.creator?.avatar,
        isRetailer: outfit.creator?.isRetailer,
      },
      caption: outfit.caption,
      garments: outfit.garments,
    });
    setIsDetailModalOpen(true);
  };

  const handleOpenTryOn = (outfit) => {
    const garment = outfit.defaultGarment || {
      id: outfit.id,
      name: outfit.name,
      brand: outfit.creator?.name || 'Fashion Curator',
      price: outfit.price || 190,
      image: outfit.image,
      collection: `${outfit.category ? outfit.category.toUpperCase() : 'FOR YOU'} Curation`,
    };
    setSelectedGarment(garment);
    setIsTryOnModalOpen(true);
  };

  const handleCuratedGarmentClick = (garment) => {
    setSelectedOutfitForDetail({
      id: garment.id,
      name: garment.name,
      category: garment.category || 'Curated Garment',
      price: garment.price,
      rating: garment.rating || 4.7,
      reviewCount: garment.reviewCount || 95,
      availableSizes: garment.availableSizes || ['S', 'M', 'L'],
      shoppingUrl: garment.shoppingUrl,
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
    setSelectedGarment(garment);
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
              {Array.isArray(styleProfile?.traits) ? styleProfile.traits.join(' · ') : `${styleProfile?.bodyType || 'Hourglass'} · ${styleProfile?.styleVibe || 'Streetwear'} (${styleProfile?.heightCm || 165}cm)`}
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

      {/* Curated Garments Carousel */}
      {curatedGarments && curatedGarments.length > 0 && (
        <div className="curated-section">
          <div className="section-title-row">
            <h3 className="section-heading">Curated Garments</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>
              Matched to Your Palette
            </span>
          </div>

          <div className="garments-carousel">
            {curatedGarments.map((garment) => (
              <div
                key={garment.id}
                className="garment-card"
                onClick={() => handleCuratedGarmentClick(garment)}
                title="Click for garment details"
              >
                <div className="garment-img-wrap">
                  <img
                    src={garment.image}
                    alt={garment.name}
                    className="garment-img"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=300&auto=format&fit=crop&q=80';
                    }}
                  />
                  <span className="match-tag">{garment.fitScore || garment.tryOnMatch || '95% Fit'}</span>
                </div>
                <div className="garment-info">
                  <span className="garment-brand">{garment.brand}</span>
                  <span className="garment-name">{garment.name}</span>
                  <div className="garment-price-row">
                    <span className="garment-price">₹{garment.price}</span>
                    <button
                      className="garment-try-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTryCuratedGarment(garment);
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                        auto_awesome
                      </span>
                      <span>Try</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Continuous Vertical Feed */}
      <div className="foryou-feed-container">
        <div className="foryou-feed-header">
          <h2 className="feed-title">Personalized Lookbook</h2>
          <span className="feed-subtitle">{filteredFeed.length} Curated Fits</span>
        </div>

        {loading && forYouFeed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--on-surface-variant)' }}>
            <span className="material-symbols-outlined spin" style={{ fontSize: '32px', color: 'var(--primary)' }}>
              progress_activity
            </span>
            <p style={{ marginTop: '12px', fontSize: '0.875rem' }}>Personalizing cuts to your measurements...</p>
          </div>
        ) : (
          filteredFeed.map((outfit) => (
            <ForYouCard
              key={outfit.id}
              outfit={outfit}
              onOpenDetail={handleOpenDetailModal}
              onOpenTryOn={handleOpenTryOn}
            />
          ))
        )}

        {/* End of feed note */}
        <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--on-surface-variant)' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'var(--secondary-fixed)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 8px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              auto_awesome
            </span>
          </div>
          <p style={{ fontFamily: 'var(--font-headline)', fontSize: '1.125rem', color: 'var(--on-surface)', fontWeight: 600 }}>
            You're all caught up with your recommendations
          </p>
          <p style={{ fontSize: '0.8125rem', marginTop: '4px' }}>
            Check back soon or explore Trending for new runway arrivals.
          </p>
        </div>
      </div>

      {/* Press & Hold Outfit Detail Modal Sheet */}
      <OutfitDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        outfit={selectedOutfitForDetail}
      />

      {/* AR Fitting Room Modal */}
      <TryOnModal
        isOpen={isTryOnModalOpen}
        onClose={() => setIsTryOnModalOpen(false)}
        garment={selectedGarment}
      />
    </div>
  );
}
