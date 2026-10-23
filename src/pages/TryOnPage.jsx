import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MOCK_PRODUCTS } from '../data/mockProducts';
import './TryOnPage.css';

export default function TryOnPage() {
  const {
    activeTryOn,
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

  const garment = activeTryOn.garment;

  const handleSaveLook = () => {
    saveTryOnToCollection(activeTryOn);
  };

  const handleShopItem = () => {
    showToast(`Redirecting to ${garment.brand} official boutique...`, 'shopping_bag');
  };

  const handleShareLook = () => {
    navigator.clipboard?.writeText?.(window.location.href);
    showToast('Look link copied to clipboard!', 'share');
  };

  const handleSelectGarment = (prod) => {
    setGarmentForTryOn(prod);
    setIsGarmentPickerOpen(false);
    showToast(`Styling ${prod.name} on model...`, 'auto_awesome');
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
                showToast('Upload photo from gallery or file', 'add_photo_alternate');
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
                <span style={{ color: 'var(--on-surface-variant)' }}>${garment.price}</span>
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

          {/* Top Controls Overlay */}
          <div className="stage-top-controls">
            <div className="mock-preview-pill">
              <span className="material-symbols-outlined fill-1" style={{ fontSize: '14px', color: 'var(--secondary-fixed-dim)' }}>
                auto_fix_high
              </span>
              <span>Mock Preview • AI Generated</span>
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
            <span>Shop Item · ${garment.price}</span>
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
                Select Garment to Try On
              </h3>
              <button
                onClick={() => setIsGarmentPickerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
              {MOCK_PRODUCTS.filter((p) => p.image).map((prod) => (
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
                      ${prod.price}
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
