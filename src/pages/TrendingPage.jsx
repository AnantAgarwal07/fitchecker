import React, { useState } from 'react';
import { TRENDING_CATEGORIES, MOCK_TRENDING_LOOKS } from '../data/mockTrending';
import TrendingReelCard from '../components/TrendingReelCard';
import TryOnModal from '../components/TryOnModal';
import OutfitDetailModal from '../components/OutfitDetailModal';
import './TrendingPage.css';

export default function TrendingPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isTryOnModalOpen, setIsTryOnModalOpen] = useState(false);
  const [selectedGarment, setSelectedGarment] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedLookForDetail, setSelectedLookForDetail] = useState(null);

  const filteredLooks = MOCK_TRENDING_LOOKS.filter((look) => {
    if (selectedCategory === 'all') return true;
    return (
      look.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
      selectedCategory.toLowerCase().includes(look.category.toLowerCase())
    );
  });

  const lookList = filteredLooks.length > 0 ? filteredLooks : MOCK_TRENDING_LOOKS;

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
        name: look.creator.name,
        handle: look.creator.handle,
        avatar: look.creator.avatar,
        isRetailer: look.creator.isRetailer,
      },
      garments: look.garments,
    });
    setIsDetailModalOpen(true);
  };

  const handleOpenTryOn = (look) => {
    const garment = look.defaultGarment || {
      id: look.id,
      name: look.title,
      brand: look.creator.name,
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

      {/* Full-Screen Vertical Reels Container (Natural Swipe/Scroll between looks) */}
      <div className="trending-reels-feed" id="trending-reels-feed">
        {lookList.map((look, index) => (
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
