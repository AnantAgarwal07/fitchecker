import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[FitsYou ErrorBoundary caught error]:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '70vh',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-full, 9999px)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>
              error_outline
            </span>
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-headline, sans-serif)',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--on-surface, #1b1b1e)',
              marginBottom: '8px',
            }}
          >
            Something went wrong
          </h2>

          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--on-surface-variant, #77757f)',
              maxWidth: '320px',
              lineHeight: 1.5,
              marginBottom: '24px',
            }}
          >
            An unexpected error occurred while loading this view. You can reload or return to the feed.
          </p>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: '10px 24px',
                borderRadius: 'var(--radius-full, 9999px)',
                backgroundColor: 'var(--primary, #630ed4)',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: 'var(--shadow-level-1)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                refresh
              </span>
              <span>Reload Page</span>
            </button>

            <button
              onClick={this.handleGoHome}
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--radius-full, 9999px)',
                backgroundColor: 'var(--surface-container-high, #e4e2e6)',
                color: 'var(--on-surface, #1b1b1e)',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Feed
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
