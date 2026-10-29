import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useLongPress } from '../hooks/useLongPress';
import TryOnModal from './TryOnModal';
import OutfitDetailModal from './OutfitDetailModal';
import { formatINR } from '../utils/currency';
import CommentSheet from './CommentSheet';
import './PostCard.css';

export default function PostCard({ post }) {
  const { likes, toggleLike, bookmarks, toggleBookmark, follows, toggleFollow, showToast, setGarmentForTryOn } = useApp();
  const navigate = useNavigate();

  const [isTryOnModalOpen, setIsTryOnModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedGarment, setSelectedGarment] = useState(post.products?.[0] || null);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [imgSrc, setImgSrc] = useState(post.image);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount || 0);

  const postLikes = likes[post.id] || { liked: false, count: post.likes || 1200 };
  const isBookmarked = !!bookmarks[post.id];
  const isFollowing = !!follows[post.user.id];

  // Press-and-hold long-press handlers
  const longPressProps = useLongPress(() => {
    setIsDetailModalOpen(true);
  }, {
    threshold: 450,
    moveTolerance: 10,
    onClick: () => {
      // Ordinary click does not trigger detail modal; could provide subtle feedback
    },
  });

  const handleImageError = () => {
    if (post.fallbackImage && imgSrc !== post.fallbackImage) {
      setImgSrc(post.fallbackImage);
    } else {
      setImgSrc('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&auto=format&fit=crop&q=80');
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText?.(window.location.href);
    showToast('Look link copied to clipboard', 'ios_share');
  };

  const handleQuickTryOn = (product) => {
    const rawProd = product || post.products?.[0];
    const targetUrl = rawProd?.shopUrl || rawProd?.shoppingUrl || post.shoppingUrl || post.shopUrl || 'https://www.myntra.com';
    setSelectedGarment(rawProd ? { ...rawProd, shopUrl: targetUrl, shoppingUrl: targetUrl } : null);
    setIsTryOnModalOpen(true);
  };

  const handleOpenFittingRoomDirectly = () => {
    const rawTarget = selectedGarment || post.products?.[0];
    const targetUrl = rawTarget?.shopUrl || rawTarget?.shoppingUrl || post.shoppingUrl || post.shopUrl || 'https://www.myntra.com';
    const target = rawTarget ? {
      ...rawTarget,
      shopUrl: targetUrl,
      shoppingUrl: targetUrl,
    } : {
      id: `prod-${post.id}`,
      name: post.alt || 'Featured Outfit',
      brand: post.user.name,
      price: post.price || 190,
      image: post.image,
      shopUrl: targetUrl,
      shoppingUrl: targetUrl,
    };
    setGarmentForTryOn(target);
    navigate('/try-on');
  };

  return (
    <>
      <article className="post-card">
        {/* Post Header */}
        <div className="post-header">
          <div className="post-user-info">
            <div className="avatar-ring">
              <div className="avatar-inner">
                <img
                  src={post.user.avatar}
                  alt={post.user.name}
                  className="avatar-img"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
                  }}
                />
              </div>
            </div>
            <div className="post-user-meta">
              <div className="user-name-row">
                <span className="user-fullname">{post.user.name}</span>
                {post.user.verified && (
                  <span className="material-symbols-outlined fill-1" style={{ fontSize: '15px', color: 'var(--primary)' }}>
                    verified
                  </span>
                )}
                {post.user.isRetailer && <span className="retailer-tag">Brand</span>}
              </div>
              <div className="user-handle-row">
                <span>{post.user.handle}</span>
                {post.user.location && (
                  <>
                    <span>•</span>
                    <span>{post.user.location}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Show Follow ONLY for user creators, NOT retailer catalog brands */}
            {!post.user.isRetailer && (
              <button
                className={`follow-pill-btn ${isFollowing ? 'following' : 'unfollowed'}`}
                onClick={() => toggleFollow(post.user.id, post.user.name)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                  {isFollowing ? 'check' : 'add'}
                </span>
                <span>{isFollowing ? 'Following' : 'Follow'}</span>
              </button>
            )}

            <button
              style={{ background: 'none', border: 'none', color: 'var(--on-surface-variant)', cursor: 'pointer', padding: '4px' }}
              onClick={() => setIsDetailModalOpen(true)}
              aria-label="View look details"
              title="View look details"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                info
              </span>
            </button>
          </div>
        </div>

        {/* 4:5 Media Container with Press-and-Hold (NO CLOTHING HOTSPOTS/DOTS) */}
        <div
          className="post-media-frame"
          {...longPressProps}
          title="Press & hold to view outfit details"
        >
          <img
            src={imgSrc || post.image}
            alt={post.alt}
            className="post-media-img"
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
          <div className="tagged-chip-overlay">
            <button
              className="tagged-pill"
              onClick={(e) => {
                e.stopPropagation();
                setIsDetailModalOpen(true);
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--secondary-fixed)' }}>
                local_mall
              </span>
              <span>{post.taggedCount || post.products?.length || 1} items · Tap details</span>
            </button>
            {post.category && (
              <div className="category-tag-pill">{post.category}</div>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div className="post-action-bar">
          <div className="action-bar-left">
            {/* Like Button */}
            <button
              className={`action-btn ${postLikes.liked ? 'liked' : ''}`}
              onClick={() => toggleLike(post.id, post.likes)}
              aria-label="Like post"
            >
              <span className={`material-symbols-outlined ${postLikes.liked ? 'fill-1' : ''}`} style={{ fontSize: '24px' }}>
                favorite
              </span>
              <span>{postLikes.count.toLocaleString()}</span>
            </button>

            <button className="action-btn" onClick={() => setCommentsOpen(true)} aria-label="View comments">
              <span className="material-symbols-outlined" style={{ fontSize: '23px' }}>chat_bubble</span>
              {commentCount > 0 && <span>{commentCount}</span>}
            </button>

            {/* Share Button */}
            <button className="action-btn" onClick={handleShare} aria-label="Share post">
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                send
              </span>
            </button>
          </div>

          <div className="action-bar-right">
            {/* Try On Button */}
            <button
              className="try-on-cta-btn"
              onClick={() => handleQuickTryOn(post.products?.[0])}
              aria-label="Try On Outfit"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '17px', color: 'var(--secondary-fixed)' }}>
                auto_awesome
              </span>
              <span>Try On</span>
            </button>

            {/* Bookmark Button */}
            <button
              className={`action-btn ${isBookmarked ? 'bookmarked' : ''}`}
              onClick={() => toggleBookmark(post.id)}
              aria-label="Save to bookmarks"
            >
              <span className={`material-symbols-outlined ${isBookmarked ? 'fill-1' : ''}`} style={{ fontSize: '24px' }}>
                bookmark
              </span>
            </button>
          </div>
        </div>

        {/* Tagged Products Micro Slider */}
        {post.products && post.products.length > 0 && (
          <div className="tagged-products-slider">
            {post.products.map((prod) => (
              <div
                key={prod.id}
                className="product-micro-card"
                onClick={() => handleQuickTryOn(prod)}
                title={`Try on ${prod.name}`}
              >
                {prod.image && (
                  <img
                    src={prod.image}
                    alt={prod.name}
                    className="product-micro-thumb"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=150&auto=format&fit=crop&q=80';
                    }}
                  />
                )}
                <span className="product-micro-name">{prod.name}</span>
                {prod.price && <span className="product-micro-price">{formatINR(prod.price)}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Post Caption (Comments UI completely removed) */}
        <div className="post-caption-section">
          <p className="post-caption-text">
            <strong>{post.user.handle}</strong>{' '}
            {showFullCaption ? post.caption : post.caption.slice(0, 95) + (post.caption.length > 95 ? '...' : '')}
            {post.caption.length > 95 && (
              <button
                onClick={() => setShowFullCaption(!showFullCaption)}
                style={{ background: 'none', border: 'none', color: 'var(--outline)', cursor: 'pointer', marginLeft: '6px', fontSize: '0.8125rem' }}
              >
                {showFullCaption ? 'less' : 'more'}
              </button>
            )}
          </p>

          {post.tags && post.tags.length > 0 && (
            <div className="post-tags-row">
              {post.tags.map((tag) => (
                <span key={tag} className="post-tag">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <span className="post-time">{post.timeAgo}</span>
        </div>
      </article>

      {/* Press & Hold Outfit Detail Modal Sheet */}
      <OutfitDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        outfit={{
          id: post.id,
          name: post.alt || post.name,
          category: post.category,
          price: post.price,
          rating: post.rating || 4.8,
          reviewCount: post.reviewCount || 110,
          availableSizes: post.availableSizes || ['S', 'M', 'L'],
          shoppingUrl: post.shoppingUrl || post.shopUrl || post.products?.[0]?.shopUrl || 'https://www.myntra.com',
          shopUrl: post.shopUrl || post.shoppingUrl || post.products?.[0]?.shopUrl || 'https://www.myntra.com',
          image: imgSrc || post.image,
          fallbackImage: post.fallbackImage,
          source: {
            name: post.user.name,
            handle: post.user.handle,
            avatar: post.user.avatar,
            isRetailer: post.user.isRetailer,
          },
          caption: post.caption,
          garments: post.garments || post.products,
          products: post.products,
        }}
      />

      {/* Quick Try-On AR Modal */}
      <TryOnModal
        isOpen={isTryOnModalOpen}
        onClose={() => setIsTryOnModalOpen(false)}
        garment={selectedGarment}
      />
      <CommentSheet postId={post.id} open={commentsOpen} onClose={() => setCommentsOpen(false)} initialCount={commentCount} onCountChange={setCommentCount} />
    </>
  );
}
