import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import PostCard from '../components/PostCard';
import './HomePage.css';

export default function HomePage() {
  const { searchQuery, setSearchQuery } = useApp();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const latestRequestIdRef = useRef(0);

  const loadFeed = useCallback(async () => {
    const requestId = ++latestRequestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPosts({
        tab: 'all',
        q: searchQuery ? searchQuery.trim() : '',
      });

      if (requestId === latestRequestIdRef.current) {
        setPosts(res?.posts || []);
        setLoading(false);
      }
    } catch (err) {
      if (requestId === latestRequestIdRef.current) {
        console.error('Failed to load feed:', err);
        setError(err?.message || 'Unable to connect to runway servers');
        setLoading(false);
      }
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadFeed();
    }, searchQuery ? 300 : 0);

    return () => clearTimeout(timer);
  }, [loadFeed, searchQuery]);

  return (
    <div className="home-page">
      {/* Main Fashion Feed */}
      <div className="feed-container">
        {loading && posts.length === 0 ? (
          // Loading Skeleton
          <div className="feed-loading-skeleton">
            {[1, 2].map((idx) => (
              <div
                key={idx}
                className="post-card"
                style={{
                  padding: '16px',
                  marginBottom: '24px',
                  backgroundColor: 'var(--surface-container-lowest)',
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid rgba(232, 229, 223, 0.5)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="skeleton" style={{ width: '120px', height: '14px' }} />
                    <div className="skeleton" style={{ width: '80px', height: '10px' }} />
                  </div>
                </div>
                <div className="skeleton" style={{ width: '100%', aspectRatio: '4/5', borderRadius: 'var(--radius-lg)' }} />
                <div style={{ display: 'flex', gap: '12px', marginTop: '14px' }}>
                  <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                  <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                  <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                </div>
                <div className="skeleton" style={{ width: '75%', height: '12px', marginTop: '12px' }} />
              </div>
            ))}
          </div>
        ) : error && posts.length === 0 ? (
          // Error State with Retry
          <div className="feed-error-state" style={{ textAlign: 'center', padding: '60px 16px', color: 'var(--on-surface-variant)' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--error-container)',
                color: 'var(--error)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>
                cloud_off
              </span>
            </div>
            <p style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--on-surface)' }}>
              Unable to load looks
            </p>
            <p style={{ fontSize: '0.8125rem', marginTop: '4px', marginBottom: '16px', maxWidth: '300px', marginInline: 'auto' }}>
              {error}
            </p>
            <button
              onClick={loadFeed}
              style={{
                padding: '8px 22px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--primary)',
                color: '#fff',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.875rem',
                boxShadow: 'var(--shadow-level-1)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>refresh</span>
              <span>Retry</span>
            </button>
          </div>
        ) : posts.length > 0 ? (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          // Empty State
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--on-surface-variant)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--outline)' }}>
              {searchQuery ? 'search_off' : 'checkroom'}
            </span>
            <p style={{ marginTop: '8px', fontSize: '0.9375rem', fontWeight: '600' }}>
              {searchQuery ? `No looks matching "${searchQuery}"` : 'No looks in this feed yet'}
            </p>
            <p style={{ fontSize: '0.8125rem', marginTop: '4px' }}>
              {searchQuery
                ? 'Try searching for "Streetwear", "Ethnic", "Formal", or "Dresses"'
                : 'Explore Trending or check back soon for fresh runway drops.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  marginTop: '16px',
                  padding: '8px 16px',
                  background: 'var(--surface-container-high)',
                  border: '1px solid var(--outline-variant)',
                  borderRadius: 'var(--radius-full)',
                  color: 'var(--primary)',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Clear Search
              </button>
            )}
          </div>
        )}

        {/* Feed End Delight Note only if items were loaded */}
        {posts.length > 0 && (
          <div className="feed-end-note">
            <div className="feed-end-icon">
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                check_circle
              </span>
            </div>
            <p className="feed-end-title">You're all caught up</p>
            <p className="feed-end-desc">
              Explore curated aesthetic boards or discover emerging designers in Trending.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
