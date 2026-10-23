import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useLongPress } from '../hooks/useLongPress';

export default function TrendingReelCard({ look, onOpenDetail, onOpenTryOn, index }) {
  const { likes, toggleLike, follows, toggleFollow, showToast } = useApp();
  const [imgSrc, setImgSrc] = useState(look.image);

  const lookLikes = likes[look.id] || {
    liked: false,
    count: look.likesNumber || 42800,
  };
  const isFollowing = !!follows[look.creator.id || look.creator.handle];

  // Press & hold hook for outfit details
  const longPressProps = useLongPress(
    () => {
      onOpenDetail(look);
    },
    {
      threshold: 450,
      moveTolerance: 10,
      onClick: () => {
        // Normal click doesn't trigger modal immediately
      },
    }
  );

  const handleImageError = () => {
    if (look.fallbackImage && imgSrc !== look.fallbackImage) {
      setImgSrc(look.fallbackImage);
    } else {
      setImgSrc('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&auto=format&fit=crop&q=80');
    }
  };

  const handleShare = (e) => {
    e?.stopPropagation?.();
    navigator.clipboard?.writeText?.(window.location.href);
    showToast(`Shared "${look.title}"!`, 'share');
  };

  return (
    <div
      className="trending-frame"
      {...longPressProps}
      title="Press & hold to view outfit details"
    >
      <img
        src={imgSrc || look.image}
        alt={look.alt}
        className="trending-bg-img"
        onError={handleImageError}
      />

      {/* Contrast Scrims */}
      <div className="scrim-top" />
      <div className="scrim-bottom" />

      {/* Top Indicators (No Next/Previous buttons) */}
      <div className="trending-top-bar">
        <div className="trending-rank-pill">
          <span className="rank-pulse-dot" />
          <span>{look.rankingBadge || `TRENDING #${index + 1} WORLDWIDE`}</span>
        </div>

        <div className="trending-sound-pill">
          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--secondary-fixed)' }}>
            graphic_eq
          </span>
          <span>Original Runway Audio</span>
        </div>
      </div>

      {/* Hold-to-view hint badge */}
      <div className="trending-hold-hint">
        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
          touch_app
        </span>
        <span>Hold for details</span>
      </div>

      {/* Right Floating Action Stack */}
      <div className="trending-action-stack">
        {/* Try On Button */}
        <button
          className="stack-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpenTryOn(look);
          }}
          aria-label="Try On Outfit"
        >
          <div className="try-on-stack-pill">
            <div className="try-on-stack-inner">
              <span className="material-symbols-outlined fill-1" style={{ fontSize: '22px' }}>
                auto_awesome
              </span>
            </div>
          </div>
          <span className="stack-label" style={{ color: 'var(--secondary-fixed)', textTransform: 'uppercase' }}>
            Try On
          </span>
        </button>

        {/* Like Button */}
        <button
          className={`stack-btn ${lookLikes.liked ? 'liked' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleLike(look.id, look.likesNumber || 42800);
          }}
          aria-label="Like Outfit"
        >
          <div className="stack-icon-wrap">
            <span
              className={`material-symbols-outlined ${lookLikes.liked ? 'fill-1' : ''}`}
              style={{ fontSize: '22px' }}
            >
              favorite
            </span>
          </div>
          <span className="stack-label">{lookLikes.count.toLocaleString()}</span>
        </button>

        {/* Share Button */}
        <button
          className="stack-btn"
          onClick={handleShare}
          aria-label="Share Outfit"
        >
          <div className="stack-icon-wrap">
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
              share
            </span>
          </div>
          <span className="stack-label">{look.shares || '1.2k'}</span>
        </button>

        {/* Spinning Music Vinyl */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="spinning-vinyl animate-spin-slow">
            <div className="vinyl-inner-dot">
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#fff' }} />
            </div>
          </div>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '13px', color: 'var(--secondary-fixed-dim)', marginTop: '-8px', marginLeft: '16px' }}
          >
            music_note
          </span>
        </div>
      </div>

      {/* Bottom Details & Quick Virtual Try-On Banner */}
      <div className="trending-bottom-box">
        <h2 className="trending-title">{look.title}</h2>

        <button
          className="capsule-badge-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(look);
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--secondary-fixed)' }}>
            local_mall
          </span>
          <span>{look.capsuleName}</span>
          <span style={{ color: 'var(--secondary-fixed-dim)', fontWeight: 700 }}>• {look.priceRange}</span>
        </button>

        <div className="trending-creator-row">
          <div className="creator-left">
            <div className="creator-avatar-wrap">
              <img
                src={look.creator.avatar}
                alt={look.creator.name}
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
                }}
              />
            </div>
            <div className="creator-text">
              <span className="creator-name">{look.creator.handle}</span>
              <span className="creator-badge">{look.creator.role}</span>
            </div>
          </div>

          {/* Show Follow ONLY for user-uploaded outfits, NOT retailer brands */}
          {!look.creator.isRetailer ? (
            <button
              className={`follow-pill-btn ${isFollowing ? 'following' : 'unfollowed'}`}
              style={{ padding: '6px 14px', borderRadius: 'var(--radius-full)' }}
              onClick={(e) => {
                e.stopPropagation();
                toggleFollow(look.creator.id || look.creator.handle, look.creator.name);
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                {isFollowing ? 'check' : 'add'}
              </span>
              <span>{isFollowing ? 'Following' : 'Follow'}</span>
            </button>
          ) : (
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'var(--inverse-on-surface)',
                textTransform: 'uppercase',
              }}
            >
              Official Brand
            </span>
          )}
        </div>

        {/* Quick Virtual Fitting Bar Banner */}
        <button
          className="quick-tryon-banner"
          onClick={(e) => {
            e.stopPropagation();
            onOpenTryOn(look);
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--secondary-fixed)' }}>
                view_in_ar
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: '700' }}>Virtual Try-On Ready</span>
              <span style={{ fontSize: '0.6875rem', opacity: 0.9 }}>
                Calibrated for your saved 3D avatar • 2.4s preview
              </span>
            </div>
          </div>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              arrow_forward
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
