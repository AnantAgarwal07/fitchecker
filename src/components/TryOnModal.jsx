import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function TryOnModal({ isOpen, onClose, garment }) {
  const navigate = useNavigate();
  const { setGarmentForTryOn } = useApp();

  if (!isOpen) return null;

  const handleOpenFittingRoom = () => {
    if (garment) {
      setGarmentForTryOn(garment);
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
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: 'var(--surface-container-low)',
              padding: '12px',
              borderRadius: 'var(--radius-xl)',
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
                ${garment.price}
              </span>
            </div>
          </div>
        )}

        {/* Action Button to launch full screen virtual try-on */}
        <button
          onClick={handleOpenFittingRoom}
          style={{
            width: '100%',
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
          <span>Open in Virtual Fitting Room</span>
        </button>
      </div>
    </div>
  );
}
