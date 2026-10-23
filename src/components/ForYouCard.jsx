import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useLongPress } from '../hooks/useLongPress';

export default function ForYouCard({ outfit, onOpenDetail, onOpenTryOn }) {
  const { likes, toggleLike, bookmarks, toggleBookmark, follows, toggleFollow, showToast } = useApp();
  const navigate = useNavigate();
  const [imgSrc, setImgSrc] = useState(outfit.image);

  const outfitLikes = likes[outfit.id] || { liked: false, count: outfit.likes || 3200 };
  const isBookmarked = !!bookmarks[outfit.id];
  const isFollowing = !!follows[outfit.creator.id || outfit.creator.handle];

  // Press & hold long press hook
  const longPressProps = useLongPress(() => {
    onOpenDetail(outfit);
  }, {
    threshold: 450,
    moveTolerance: 10,
    onClick: () => {
      // Ordinary click does not open modal immediately
    },
  });

  const handleImageError = () => {
    if (outfit.fallbackImage && imgSrc !== outfit.fallbackImage) {
      setImgSrc(outfit.fallbackImage);
    } else {
      setImgSrc('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&auto=format&fit=crop&q=80');
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText?.(window.location.href);
    showToast('Look link copied to clipboard', 'ios_share');
  };

  return (
    <article className="foryou-post-card">
      {/* Header */}
      <div className="foryou-card-header">
        <div className="foryou-creator-info">
          <img
            src={outfit.creator.avatar}
            alt={outfit.creator.name}
            className="foryou-creator-avatar"
            onError={(e) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
            }}
          />
          <div className="foryou-creator-name-col">
            <div className="foryou-name-row">
              <span className="foryou-creator-name">{outfit.creator.name}</span>
              {outfit.creator.verified && (
                <span className="material-symbols-outlined fill-1" style={{ fontSize: '15px', color: 'var(--primary)' }}>
                  verified
                </span>
              )}
              <span className="foryou-match-pill">
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                  }}
                />
                {outfit.matchScore}
              </span>
            </div>
            <span className="foryou-creator-handle">{outfit.creator.handle}</span>
          </div>
        </div>

        {/* Show Follow ONLY for user creators, NOT retailer brands */}
        {!outfit.creator.isRetailer ? (
          <button
            className={`follow-pill-btn ${isFollowing ? 'following' : 'unfollowed'}`}
            onClick={() => toggleFollow(outfit.creator.id || outfit.creator.handle, outfit.creator.name)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
              {isFollowing ? 'check' : 'add'}
            </span>
            <span>{isFollowing ? 'Following' : 'Follow'}</span>
          </button>
        ) : (
          <span
            style={{
              fontSize: '0.625rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--surface-container-high)',
              color: 'var(--primary)',
              textTransform: 'uppercase',
            }}
          >
            Brand
          </span>
        )}
      </div>

      {/* 4:5 Media Frame (Clean without hotspots, Press-and-Hold enabled) */}
      <div
        className="foryou-media-frame"
        {...longPressProps}
        title="Press & hold to view outfit details"
      >
        <img
          src={imgSrc || outfit.image}
          alt={outfit.alt}
          className="foryou-media-img"
          onError={handleImageError}
        />

        {/* Discreet Hold-to-view hint overlay */}
        <div className="hold-hint-overlay">
          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
            touch_app
          </span>
          <span>Hold for details</span>
        </div>

        {/* Bottom Tagged & Category Overlay */}
        <div className="foryou-overlay-bar">
          <button
            className="foryou-details-pill"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(outfit);
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--secondary-fixed)' }}>
              local_mall
            </span>
            <span>{outfit.taggedCount || 1} items · Tap details</span>
          </button>

          {outfit.category && (
            <div className="foryou-category-badge">{outfit.category}</div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="foryou-action-bar">
        <div className="foryou-actions-left">
          {/* Like */}
          <button
            className={`action-btn ${outfitLikes.liked ? 'liked' : ''}`}
            onClick={() => toggleLike(outfit.id, outfit.likes)}
            aria-label="Like look"
          >
            <span className={`material-symbols-outlined ${outfitLikes.liked ? 'fill-1' : ''}`} style={{ fontSize: '24px' }}>
              favorite
            </span>
            <span>{outfitLikes.count.toLocaleString()}</span>
          </button>

          {/* Share */}
          <button className="action-btn" onClick={handleShare} aria-label="Share look">
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
              send
            </span>
          </button>
        </div>

        <div className="foryou-actions-right">
          {/* Try On Button */}
          <button
            className="try-on-cta-btn"
            onClick={() => onOpenTryOn(outfit)}
            aria-label="Try On Outfit"
          >
            <span className="material-symbols-outlined fill-1" style={{ fontSize: '17px', color: 'var(--secondary-fixed)' }}>
              auto_awesome
            </span>
            <span>Try On</span>
          </button>

          {/* Bookmark */}
          <button
            className={`action-btn ${isBookmarked ? 'bookmarked' : ''}`}
            onClick={() => toggleBookmark(outfit.id)}
            aria-label="Save look"
          >
            <span className={`material-symbols-outlined ${isBookmarked ? 'fill-1' : ''}`} style={{ fontSize: '24px' }}>
              bookmark
            </span>
          </button>
        </div>
      </div>

      {/* Tagged Products Micro Slider */}
      {outfit.garments && outfit.garments.length > 0 && (
        <div className="tagged-products-slider">
          {outfit.garments.map((g) => (
            <div
              key={g.id}
              className="product-micro-card"
              onClick={() => onOpenDetail(outfit)}
              title={`View ${g.name}`}
            >
              {g.image && (
                <img
                  src={g.image}
                  alt={g.name}
                  className="product-micro-thumb"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=150&auto=format&fit=crop&q=80';
                  }}
                />
              )}
              <span className="product-micro-name">{g.name}</span>
              <span className="product-micro-price">${g.price}</span>
            </div>
          ))}
        </div>
      )}

      {/* Caption & Tags */}
      <div className="foryou-card-details">
        <p className="foryou-caption">
          <strong>{outfit.creator.handle}</strong> {outfit.caption}
        </p>

        {outfit.tags && outfit.tags.length > 0 && (
          <div className="foryou-tags">
            {outfit.tags.map((t) => (
              <span key={t} className="foryou-tag">
                {t}
              </span>
            ))}
          </div>
        )}

        <span className="foryou-time">{outfit.timeAgo}</span>
      </div>
    </article>
  );
}
