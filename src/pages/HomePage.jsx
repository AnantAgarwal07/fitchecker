import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import PostCard from '../components/PostCard';
import './HomePage.css';

export default function HomePage() {
  const { searchQuery } = useApp();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadFeed() {
      setLoading(true);
      const res = await api.getPosts({ tab: 'all' });
      if (isMounted) {
        setPosts(res.posts || []);
        setLoading(false);
      }
    }
    loadFeed();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredPosts = posts.filter((post) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      post.user?.name?.toLowerCase().includes(q) ||
      post.user?.handle?.toLowerCase().includes(q) ||
      (post.caption && post.caption.toLowerCase().includes(q)) ||
      (post.tags && post.tags.some((t) => t.toLowerCase().includes(q))) ||
      (post.category && post.category.toLowerCase().includes(q)) ||
      (post.products && post.products.some((p) => p.name?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q)))
    );
  });

  return (
    <div className="home-page">
      {/* Main Fashion Feed - Pure Instagram-style scrolling feed without Stories */}
      <div className="feed-container">
        {loading && posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--on-surface-variant)' }}>
            <span className="material-symbols-outlined spin" style={{ fontSize: '32px', color: 'var(--primary)' }}>
              progress_activity
            </span>
            <p style={{ marginTop: '12px', fontSize: '0.875rem' }}>Loading trending looks from runway...</p>
          </div>
        ) : filteredPosts.length > 0 ? (
          filteredPosts.map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--on-surface-variant)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--outline)' }}>
              search_off
            </span>
            <p style={{ marginTop: '8px', fontSize: '0.9375rem', fontWeight: '600' }}>
              No looks matching "{searchQuery}"
            </p>
            <p style={{ fontSize: '0.8125rem' }}>Try searching for "Streetwear", "Ethnic", "Formal", or "Dresses"</p>
          </div>
        )}

        {/* Feed End Delight Note */}
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
      </div>
    </div>
  );
}
