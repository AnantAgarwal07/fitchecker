import React from 'react';
import { useApp } from '../context/AppContext';

export default function Toast() {
  const { toast } = useApp();

  if (!toast.visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 18px',
        borderRadius: 'var(--radius-full)',
        backgroundColor: 'rgba(48, 48, 51, 0.95)',
        color: 'var(--inverse-on-surface)',
        boxShadow: '0 12px 28px rgba(0,0,0,0.22)',
        backdropFilter: 'blur(12px)',
        fontSize: '0.8125rem',
        fontWeight: '600',
        letterSpacing: '0.02em',
        pointerEvents: 'none',
        animation: 'slideDownToast 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      }}
    >
      <style>{`
        @keyframes slideDownToast {
          from {
            opacity: 0;
            transform: translate(-50%, -15px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
        }
      `}</style>
      <span
        className="material-symbols-outlined"
        style={{ fontSize: '18px', color: 'var(--secondary-fixed-dim)' }}
      >
        {toast.icon || 'check_circle'}
      </span>
      <span>{toast.message}</span>
    </div>
  );
}
