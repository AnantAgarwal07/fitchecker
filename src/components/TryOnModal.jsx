import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatINR } from '../utils/currency';

export default function TryOnModal({ isOpen, onClose, garment }) {
  const navigate = useNavigate();
  const { setGarmentForTryOn } = useApp();

  if (!isOpen) return null;

  const getGarmentShopUrl = () => {
    return (
      garment?.shopUrl ||
      garment?.shoppingUrl ||
      garment?.productUrl ||
      'https://www.myntra.com'
    );
  };

  const handleOpenStore = () => {
    const url = getGarmentShopUrl();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleOpenFittingRoom = () => {
    if (garment) {
      setGarmentForTryOn({
        ...garment,
        shopUrl: getGarmentShopUrl(),
      });
    }
    onClose();
    navigate('/try-on');
  };

  return (
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
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          backgroundColor: 'var(--surface)',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: 'var(--shadow-level-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--secondary-fixed)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="material-symbols-outlined fill-1" style={{ fontSize: '22px' }}>
                magic_button
              </span>
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.25rem', color: 'var(--on-surface)' }}>
                Instant AR Fitting Room
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>
                Synthesizing garment on your 3D calibrated avatar...
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--surface-container)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--on-surface-variant)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              close
            </span>
          </button>
        </div>

        {garment && (
          <div
            onClick={handleOpenStore}
            title={`View ${garment.name} on store`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: 'var(--surface-container-low)',
              padding: '12px',
              borderRadius: 'var(--radius-xl)',
              cursor: 'pointer',
              border: '1px solid rgba(232, 229, 223, 0.5)',
              transition: 'background-color 0.15s ease',
            }}
          >
            {garment.image && (
              <img
                src={garment.image}
                alt={garment.name}
                style={{ width: '48px', height: '54px', objectFit: 'cover', borderRadius: '8px' }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: '700',
                  color: 'var(--primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {garment.brand || 'Featured Designer'}
              </span>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.9375rem',
                  fontWeight: '600',
                  color: 'var(--on-surface)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {garment.name}
              </p>
              <span style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--on-surface)' }}>
                {formatINR(garment.price)}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenStore();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--surface-container-high)',
                border: '1px solid var(--outline-variant)',
                color: 'var(--primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>Store</span>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                open_in_new
              </span>
            </button>
          </div>
        )}

        {/* Action Buttons: Try On and Shop Item */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleOpenFittingRoom}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--primary)',
              color: 'var(--on-primary)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9375rem',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 8px 24px rgba(99, 14, 212, 0.35)',
              transition: 'transform 0.15s ease',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              auto_awesome
            </span>
            <span>Virtual Fitting</span>
          </button>

          <button
            onClick={handleOpenStore}
            style={{
              padding: '14px 20px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--surface-container-highest)',
              color: 'var(--on-surface)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9375rem',
              fontWeight: '600',
              border: '1px solid var(--outline-variant)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>
              local_mall
            </span>
            <span>Buy / Store</span>
          </button>
        </div>
      </div>
    </div>
  );
}
