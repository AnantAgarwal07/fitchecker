import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TRENDING_CATEGORIES } from '../data/mockTrending';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import TrendingReelCard from '../components/TrendingReelCard';
import TryOnModal from '../components/TryOnModal';
import OutfitDetailModal from '../components/OutfitDetailModal';
import './TrendingPage.css';

export default function TrendingPage() {
  const { searchQuery, setSearchQuery } = useApp();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [looks, setLooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTryOnModalOpen, setIsTryOnModalOpen] = useState(false);
  const [selectedGarment, setSelectedGarment] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedLookForDetail, setSelectedLookForDetail] = useState(null);
  const latestRequestIdRef = useRef(0);

  const loadTrending = useCallback(async () => {
    const requestId = ++latestRequestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTrending({
        category: selectedCategory,
        q: searchQuery ? searchQuery.trim() : '',
      });

      if (requestId === latestRequestIdRef.current) {
        setLooks(data || []);
        setLoading(false);
      }
    } catch (err) {
      if (requestId === latestRequestIdRef.current) {
        console.error('Failed to load trending looks:', err);
        setError(err?.message || 'Unable to connect to runway servers');
        setLoading(false);
      }
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTrending();
    }, searchQuery ? 300 : 0);

    return () => clearTimeout(timer);
  }, [loadTrending, searchQuery]);

  const handleOpenDetail = (look) => {
    const itemUrl = look.shoppingUrl || look.shopUrl || look.defaultGarment?.shopUrl || look.garments?.[0]?.shopUrl || 'https://www.myntra.com';
    setSelectedLookForDetail({
      id: look.id,
      name: look.title,
      category: look.category,
      price: look.price || 380,
      rating: look.rating || 4.9,
      reviewCount: look.reviewCount || 140,
      availableSizes: look.availableSizes || ['S', 'M', 'L'],
      shoppingUrl: itemUrl,
      shopUrl: itemUrl,
      image: look.image,
      fallbackImage: look.fallbackImage,
      source: {
        name: look.creator?.name || 'Creator',
        handle: look.creator?.handle || '@creator',
        avatar: look.creator?.avatar,
        isRetailer: look.creator?.isRetailer,
      },
      garments: (look.garments || []).map((g) => ({
        ...g,
        shopUrl: g.shopUrl || g.shoppingUrl || itemUrl,
        shoppingUrl: g.shopUrl || g.shoppingUrl || itemUrl,
      })),
    });
    setIsDetailModalOpen(true);
  };

  const handleOpenTryOn = (look) => {
    const itemUrl = look.shoppingUrl || look.shopUrl || look.defaultGarment?.shopUrl || look.garments?.[0]?.shopUrl || 'https://www.myntra.com';
    const garment = look.defaultGarment ? {
      ...look.defaultGarment,
      shopUrl: look.defaultGarment.shopUrl || itemUrl,
      shoppingUrl: look.defaultGarment.shoppingUrl || itemUrl,
    } : {
      id: look.id,
      name: look.title,
      brand: look.creator?.name || 'Brand',
      price: look.price || 250,
      image: look.image,
      shopUrl: itemUrl,
      shoppingUrl: itemUrl,
      collection: `${look.category ? look.category.toUpperCase() : 'TRENDING'} Runway Look`,
    };
    setSelectedGarment(garment);
    setIsTryOnModalOpen(true);
  };

  return (
    <div className="trending-page">
      {/* Category Filter Chips */}
      <div className="trending-categories-bar">
        {TRENDING_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`category-chip ${selectedCategory === cat.id ? 'active' : 'inactive'}`}
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.icon && (
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                {cat.icon}
              </span>
            )}
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Full-Screen Vertical Reels Container */}
      <div className="trending-reels-feed" id="trending-reels-feed">
        {loading && looks.length === 0 ? (
          // Loading Skeleton
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {[1, 2].map((idx) => (
              <div
                key={idx}
                className="skeleton"
                style={{
                  width: '100%',
                  height: '75vh',
                  borderRadius: 'var(--radius-xl)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              />
            ))}
          </div>
        ) : error && looks.length === 0 ? (
          // Error State with Retry
          <div style={{ textAlign: 'center', padding: '80px 16px', color: 'var(--on-surface-variant)' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--error-container)',
                color: 'var(--error)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>
                cloud_off
              </span>
            </div>
            <p style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--on-surface)' }}>
              Unable to load trending looks
            </p>
            <p style={{ fontSize: '0.8125rem', marginTop: '4px', marginBottom: '16px', maxWidth: '300px', marginInline: 'auto' }}>
              {error}
            </p>
            <button
              onClick={loadTrending}
              style={{
                padding: '8px 22px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--primary)',
                color: '#fff',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.875rem',
                boxShadow: 'var(--shadow-level-1)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>refresh</span>
              <span>Retry</span>
            </button>
          </div>
        ) : looks.length > 0 ? (
          <>
            {looks.map((look, index) => (
              <TrendingReelCard
                key={look.id}
                look={look}
                index={index}
                onOpenDetail={handleOpenDetail}
                onOpenTryOn={handleOpenTryOn}
              />
            ))}

            {/* Feed footer notice */}
            <div className="trending-end-card">
              <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--primary)' }}>
                auto_awesome
              </span>
              <p style={{ fontWeight: 700, marginTop: '8px', color: 'var(--on-surface)' }}>
                You've explored all trending runway looks
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                Check back for hourly creator updates and virtual drops.
              </p>
            </div>
          </>
        ) : (
          // Empty State
          <div style={{ textAlign: 'center', padding: '60px 16px', color: 'var(--on-surface-variant)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--outline)' }}>
              {searchQuery ? 'search_off' : 'auto_awesome'}
            </span>
            <p style={{ marginTop: '12px', fontWeight: '600', color: 'var(--on-surface)' }}>
              {searchQuery ? `No trending looks found for "${searchQuery}"` : 'No trending looks in this category'}
            </p>
            <p style={{ fontSize: '0.8125rem', marginTop: '4px' }}>
              {searchQuery
                ? 'Try searching for different keywords or clear your query.'
                : 'Try selecting another category or check back soon for fresh rankings.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  marginTop: '16px',
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--surface-container-high)',
                  border: '1px solid var(--outline-variant)',
                  color: 'var(--primary)',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Clear Search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Press & Hold Outfit Detail Modal Sheet */}
      <OutfitDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        outfit={selectedLookForDetail}
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
