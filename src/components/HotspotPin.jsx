import React, { useState } from 'react';

export default function HotspotPin({ top, left, right, bottom, label, price, onSelect }) {
  const [active, setActive] = useState(false);

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        right,
        bottom,
        zIndex: 25,
      }}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      <button
        type="button"
        aria-label={label || 'Garment Hotspot'}
        onClick={(e) => {
          e.stopPropagation();
          setActive(!active);
          if (onSelect) onSelect();
        }}
        style={{
          position: 'relative',
          width: '28px',
          height: '28px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'rgba(251, 248, 252, 0.95)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--primary)',
          transition: 'transform 0.2s ease',
        }}
      >
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--primary)',
          }}
        />
        <span
          style={{
            position: 'absolute',
            inset: '-4px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(99, 14, 212, 0.3)',
            animation: 'pingSoft 2s cubic-bezier(0, 0, 0.2, 1) infinite',
          }}
        />
      </button>

      {/* Popover Tooltip */}
      {active && label && (
        <div
          style={{
            position: 'absolute',
            bottom: '36px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(48, 48, 51, 0.94)',
            backdropFilter: 'blur(12px)',
            color: 'var(--inverse-on-surface)',
            padding: '5px 12px',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.6875rem',
            fontWeight: '600',
            whiteSpace: 'nowrap',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            zIndex: 30,
            animation: 'slideUp 0.15s ease-out',
            pointerEvents: 'none',
          }}
        >
          <span>{label}</span>
          {price && <span style={{ color: 'var(--secondary-fixed-dim)' }}>{price}</span>}
        </div>
      )}
    </div>
  );
}
