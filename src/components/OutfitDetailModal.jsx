import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatINR } from '../utils/currency';
import './OutfitDetailModal.css';

export default function OutfitDetailModal({ isOpen, onClose, outfit }) {
  const navigate = useNavigate();
  const { setGarmentForTryOn, showToast } = useApp();
  const [imgSrc, setImgSrc] = useState(outfit?.image);

  if (!isOpen || !outfit) return null;

  const handleImageError = () => {
    if (outfit.fallbackImage && imgSrc !== outfit.fallbackImage) {
      setImgSrc(outfit.fallbackImage);
    } else {
      // Clean SVG fallback placeholder
      setImgSrc('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&auto=format&fit=crop&q=80');
    }
  };

  const getOutfitShopUrl = () => {
    return (
      outfit.shoppingUrl ||
      outfit.shopUrl ||
      outfit.productUrl ||
      outfit.products?.[0]?.shopUrl ||
      outfit.products?.[0]?.shoppingUrl ||
      outfit.products?.[0]?.productUrl ||
      outfit.garments?.[0]?.shopUrl ||
      outfit.garments?.[0]?.shoppingUrl ||
      outfit.garments?.[0]?.productUrl ||
      outfit.defaultGarment?.shopUrl ||
      'https://www.myntra.com'
    );
  };

  const handleBuy = (targetUrl, label) => {
    const url = targetUrl || getOutfitShopUrl();
    window.open(url, '_blank', 'noopener,noreferrer');
    showToast(`Opening ${label || outfit.source?.name || 'storefront'}...`, 'shopping_bag');
  };

  const handleTryOn = (piece) => {
    const targetGarment = piece ? {
      id: piece.id || `prod-${Date.now()}`,
      name: piece.name,
      brand: piece.brand || outfit.source?.name || 'Curated Garment',
      price: piece.price || outfit.price || 190,
      image: piece.image || outfit.image,
      shopUrl: piece.shopUrl || piece.shoppingUrl || piece.productUrl || getOutfitShopUrl(),
      collection: outfit.category ? `${outfit.category.toUpperCase()} Piece` : 'Curated Garment',
    } : {
      id: outfit.id || `prod-${Date.now()}`,
      name: outfit.name,
      brand: outfit.source?.name || 'Curated Outfit',
      price: outfit.price || 190,
      image: outfit.image,
      shopUrl: getOutfitShopUrl(),
      collection: outfit.category ? `${outfit.category.toUpperCase()} Collection` : 'Featured Look',
    };
    setGarmentForTryOn(targetGarment);
    onClose();
    navigate('/try-on');
  };

  const sourceName = outfit.source?.name || outfit.user?.name || 'Designer';
  const sourceHandle = outfit.source?.handle || outfit.user?.handle || '@fitsyou';
  const sourceAvatar = outfit.source?.avatar || outfit.user?.avatar;
  const isRetailer = outfit.source?.isRetailer || outfit.user?.isRetailer;

  return (
    <div className="outfit-modal-backdrop" onClick={onClose}>
      <div className="outfit-modal-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="outfit-modal-header">
          <div className="modal-header-left">
            <span className="modal-category-badge">{outfit.category || 'Curated Look'}</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>
              Outfit Details
            </span>
          </div>

          <button className="modal-close-btn" onClick={onClose} aria-label="Close details">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              close
            </span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="outfit-modal-scroll">
          {/* Main Photo Frame */}
          <div className="modal-media-frame">
            <img
              src={imgSrc || outfit.image}
              alt={outfit.name}
              className="modal-media-img"
              onError={handleImageError}
            />
          {outfit.price && <div className="modal-price-pill">{formatINR(outfit.price)}</div>}
          </div>

          {/* Title & Source */}
          <div className="modal-info-block">
            <h2 className="modal-outfit-title">{outfit.name}</h2>

            <div className="modal-source-row">
              {sourceAvatar && (
                <img src={sourceAvatar} alt={sourceName} className="modal-source-avatar" />
              )}
              <span className="modal-source-name">{sourceName}</span>
              <span style={{ color: 'var(--outline)', fontSize: '0.75rem' }}>({sourceHandle})</span>
              {isRetailer ? (
                <span className="modal-source-role">Official Brand</span>
              ) : (
                <span className="modal-source-role">Creator</span>
              )}
            </div>
          </div>

          {/* Rating & Sizes Bar */}
          <div className="modal-meta-grid">
            <div className="modal-rating-box">
              <span className="material-symbols-outlined fill-1" style={{ fontSize: '18px', color: '#f59e0b' }}>
                star
              </span>
              <span>{outfit.rating ? outfit.rating.toFixed(1) : '4.8'}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--outline)', fontWeight: 400 }}>
                ({outfit.reviewCount || 94} reviews)
              </span>
            </div>

            {outfit.availableSizes && outfit.availableSizes.length > 0 && (
              <div className="modal-sizes-box">
                {outfit.availableSizes.slice(0, 4).map((s, idx) => (
                  <span key={idx} className="size-pill">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Curated Individual Pieces (when available) */}
          {outfit.garments && outfit.garments.length > 0 && (
            <div className="curated-pieces-section">
              <span className="curated-pieces-title">
                Included Pieces ({outfit.garments.length})
              </span>

              {outfit.garments.map((g) => {
                const itemShopUrl = g.shopUrl || g.shoppingUrl || g.productUrl || getOutfitShopUrl();
                return (
                  <div
                    key={g.id}
                    className="curated-piece-row"
                    onClick={() => handleBuy(itemShopUrl, g.brand || g.name)}
                    title={`Click to open ${g.name} on storefront`}
                  >
                    <div className="piece-left">
                      {g.image && (
                        <img src={g.image} alt={g.name} className="piece-thumb" onError={handleImageError} />
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="piece-name">{g.name}</span>
                        <span className="piece-brand">{g.brand}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="piece-price">{formatINR(g.price)}</span>
                      <button
                        className="piece-action-icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTryOn(g);
                        }}
                        title={`Virtually try on ${g.name}`}
                        aria-label={`Try on ${g.name}`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          checkroom
                        </span>
                      </button>
                      <button
                        className="piece-action-icon-btn primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBuy(itemShopUrl, g.brand || g.name);
                        }}
                        title={`Open link to ${g.name}`}
                        aria-label={`Open link to ${g.name}`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          open_in_new
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Caption / Description if present */}
          {outfit.caption && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.45 }}>
              {outfit.caption}
            </p>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="outfit-modal-actions">
          <div className="modal-btn-row">
            <button className="modal-main-btn btn-tryon-accent" onClick={() => handleTryOn()}>
              <span className="material-symbols-outlined fill-1" style={{ fontSize: '18px' }}>
                auto_awesome
              </span>
              <span>Try On Look</span>
            </button>

            <button className="modal-main-btn btn-buy-primary" onClick={() => handleBuy()}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                local_mall
              </span>
              <span>Buy / View Product</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
