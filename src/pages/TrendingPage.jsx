import React, { useState, useEffect } from 'react';
import { TRENDING_CATEGORIES } from '../data/mockTrending';
import { api } from '../services/api';
import TrendingReelCard from '../components/TrendingReelCard';
import TryOnModal from '../components/TryOnModal';
import OutfitDetailModal from '../components/OutfitDetailModal';
import './TrendingPage.css';

export default function TrendingPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [looks, setLooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTryOnModalOpen, setIsTryOnModalOpen] = useState(false);
  const [selectedGarment, setSelectedGarment] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedLookForDetail, setSelectedLookForDetail] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadTrending() {
      setLoading(true);
      const data = await api.getTrending({ category: selectedCategory });
      if (isMounted) {
        setLooks(data || []);
        setLoading(false);
      }
    }
    loadTrending();
    return () => {
      isMounted = false;
    };
  }, [selectedCategory]);

  const handleOpenDetail = (look) => {
    setSelectedLookForDetail({
      id: look.id,
      name: look.title,
      category: look.category,
      price: look.price || 380,
      rating: look.rating || 4.9,
      reviewCount: look.reviewCount || 140,
      availableSizes: look.availableSizes || ['S', 'M', 'L'],
      shoppingUrl: look.shoppingUrl,
      image: look.image,
      fallbackImage: look.fallbackImage,
      source: {
        name: look.creator?.name || 'Creator',
        handle: look.creator?.handle || '@creator',
        avatar: look.creator?.avatar,
        isRetailer: look.creator?.isRetailer,
      },
      garments: look.garments,
    });
    setIsDetailModalOpen(true);
  };

  const handleOpenTryOn = (look) => {
    const garment = look.defaultGarment || {
      id: look.id,
      name: look.title,
      brand: look.creator?.name || 'Brand',
      price: look.price || 250,
      image: look.image,
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
          <div style={{ textAlign: 'center', padding: '60px 16px', color: 'var(--on-surface-variant)' }}>
            <span className="material-symbols-outlined spin" style={{ fontSize: '32px', color: 'var(--primary)' }}>
              progress_activity
            </span>
            <p style={{ marginTop: '12px', fontSize: '0.875rem' }}>Computing trending velocities...</p>
          </div>
        ) : (
          looks.map((look, index) => (
            <TrendingReelCard
              key={look.id}
              look={look}
              index={index}
              onOpenDetail={handleOpenDetail}
              onOpenTryOn={handleOpenTryOn}
            />
          ))
        )}

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
