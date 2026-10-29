import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import './SearchResultsView.css';

const SUGGESTIONS = ['Streetwear', 'Casual', 'Formal', 'Ethnic wear', 'Dresses', 'Party wear', 'Sneakers', 'Blazer'];

export default function SearchResultsView({ onClose, onSelectLook, onSelectProduct }) {
  const { searchQuery, setSearchQuery, showToast } = useApp();
  const [activeTab, setActiveTab] = useState('looks'); // 'looks' | 'products' | 'creators'
  const [results, setResults] = useState({ looks: [], products: [], creators: [] });
  const [loading, setLoading] = useState(false);
  const [followingMap, setFollowingMap] = useState({});

  // Race condition guard: ignore stale responses
  const latestRequestIdRef = useRef(0);

  useEffect(() => {
    if (!searchQuery || !searchQuery.trim()) {
      setResults({ looks: [], products: [], creators: [] });
      setLoading(false);
      return;
    }

    const trimmed = searchQuery.trim();
    const requestId = ++latestRequestIdRef.current;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const [postsRes, productsRes, usersRes] = await Promise.all([
          api.getPosts({ q: trimmed, limit: 20 }),
          api.getProducts({ q: trimmed, limit: 20 }),
          api.searchUsers(trimmed, 20),
        ]);

        // Guard against race conditions: ignore if another request started
        if (requestId !== latestRequestIdRef.current) return;

        setResults({
          looks: postsRes?.posts || [],
          products: productsRes?.products || [],
          creators: usersRes?.users || [],
        });
      } catch (err) {
        if (requestId === latestRequestIdRef.current) {
          console.error('[Search] Failed to fetch search results:', err);
        }
      } finally {
        if (requestId === latestRequestIdRef.current) {
          setLoading(false);
        }
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleToggleFollow = async (userId, e) => {
    e.stopPropagation();
    const isCurrentlyFollowing = followingMap[userId];
    setFollowingMap((prev) => ({ ...prev, [userId]: !isCurrentlyFollowing }));

    try {
      if (isCurrentlyFollowing) {
        await api.unfollowUser(userId);
        showToast('Unfollowed creator', 'person_remove');
      } else {
        await api.followUser(userId);
        showToast('Following creator!', 'person_add');
      }
    } catch (err) {
      // Revert on error
      setFollowingMap((prev) => ({ ...prev, [userId]: isCurrentlyFollowing }));
      showToast(err?.message || 'Action failed', 'error');
    }
  };

  const hasQuery = searchQuery && searchQuery.trim().length > 0;
  const currentItems = results[activeTab] || [];
  const isEmpty = !loading && hasQuery && currentItems.length === 0;

  return (
    <div className="search-results-overlay">
      {/* Search Result Category Tabs */}
      {hasQuery && (
        <div className="search-tabs-bar">
          <button
            className={`search-tab-btn ${activeTab === 'looks' ? 'active' : ''}`}
            onClick={() => setActiveTab('looks')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              photo_library
            </span>
            <span>Looks</span>
            <span className="search-tab-count">{results.looks.length}</span>
          </button>
          <button
            className={`search-tab-btn ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              checkroom
            </span>
            <span>Products</span>
            <span className="search-tab-count">{results.products.length}</span>
          </button>
          <button
            className={`search-tab-btn ${activeTab === 'creators' ? 'active' : ''}`}
            onClick={() => setActiveTab('creators')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              person
            </span>
            <span>Creators</span>
            <span className="search-tab-count">{results.creators.length}</span>
          </button>
        </div>
      )}

      {/* Main Results Container */}
      <div className="search-results-content">
        {!hasQuery ? (
          // Suggestions State when query is empty
          <div className="search-suggestions-panel">
            <p className="search-section-title">Popular Searches</p>
            <div className="search-chips-cloud">
              {SUGGESTIONS.map((tag) => (
                <button
                  key={tag}
                  className="search-chip"
                  onClick={() => setSearchQuery(tag)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--primary)' }}>
                    trending_up
                  </span>
                  <span>{tag}</span>
                </button>
              ))}
            </div>
          </div>
        ) : loading ? (
          // Loading Skeleton
          <div className="search-loading-list">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="search-skeleton-row">
                <div className="skeleton search-skeleton-thumb" />
                <div className="search-skeleton-text">
                  <div className="skeleton" style={{ width: '60%', height: '14px', marginBottom: '6px' }} />
                  <div className="skeleton" style={{ width: '40%', height: '12px' }} />
                </div>
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          // Empty State
          <div className="search-empty-state">
            <span className="material-symbols-outlined" style={{ fontSize: '42px', color: 'var(--outline)' }}>
              search_off
            </span>
            <p className="search-empty-title">No {activeTab} found for "{searchQuery}"</p>
            <p className="search-empty-desc">
              Try checking your spelling or explore one of these popular aesthetics:
            </p>
            <div className="search-chips-cloud" style={{ justifyContent: 'center', marginTop: '14px' }}>
              {SUGGESTIONS.slice(0, 4).map((tag) => (
                <button
                  key={tag}
                  className="search-chip"
                  onClick={() => setSearchQuery(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <button
              className="search-clear-action-btn"
              onClick={() => setSearchQuery('')}
            >
              Clear Query
            </button>
          </div>
        ) : (
          // Results Content per Tab
          <div className="search-items-list">
            {activeTab === 'looks' && (
              <div className="search-looks-grid">
                {results.looks.map((look) => (
                  <div
                    key={look.id}
                    className="search-look-card"
                    onClick={() => {
                      if (onSelectLook) onSelectLook(look);
                      if (onClose) onClose();
                    }}
                  >
                    <div className="search-look-img-wrap">
                      <img src={look.image} alt={look.caption || 'Look'} loading="lazy" />
                      <div className="search-look-likes">
                        <span className="material-symbols-outlined fill-1" style={{ fontSize: '13px', color: '#ff4d4f' }}>
                          favorite
                        </span>
                        <span>{look.likes}</span>
                      </div>
                    </div>
                    <div className="search-look-info">
                      <p className="search-look-caption">{look.caption || look.category || 'Curated Look'}</p>
                      <div className="search-look-creator">
                        <img src={look.user?.avatar} alt={look.user?.name} className="search-look-avatar" />
                        <span>{look.user?.name}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'products' && (
              <div className="search-products-list">
                {results.products.map((product) => (
                  <div
                    key={product.id}
                    className="search-product-item"
                    onClick={() => {
                      if (onSelectProduct) onSelectProduct(product);
                      if (onClose) onClose();
                    }}
                  >
                    <img src={product.image} alt={product.name} className="search-product-thumb" />
                    <div className="search-product-meta">
                      <span className="search-product-brand">{product.brand}</span>
                      <p className="search-product-name">{product.name}</p>
                      <div className="search-product-pricing">
                        <span className="search-product-price">₹{product.price}</span>
                        {product.rating && (
                          <span className="search-product-rating">
                            <span className="material-symbols-outlined fill-1" style={{ fontSize: '13px', color: '#f59e0b' }}>
                              star
                            </span>
                            {product.rating}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        className="search-tryon-btn"
                        style={{ backgroundColor: 'var(--surface-container-highest)', color: 'var(--on-surface)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = product.shopUrl || product.shoppingUrl || product.productUrl || 'https://www.myntra.com';
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                        title={`Open link to ${product.name}`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--primary)' }}>
                          open_in_new
                        </span>
                        <span>Shop</span>
                      </button>
                      <button
                        className="search-tryon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectProduct) onSelectProduct(product);
                          if (onClose) onClose();
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                          checkroom
                        </span>
                        <span>Try On</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'creators' && (
              <div className="search-creators-list">
                {results.creators.map((creator) => (
                  <div key={creator.id} className="search-creator-item">
                    <img src={creator.avatar || creator.avatarUrl} alt={creator.name} className="search-creator-avatar" />
                    <div className="search-creator-info">
                      <div className="search-creator-name-row">
                        <span className="search-creator-name">{creator.name}</span>
                        {creator.verified && (
                          <span className="material-symbols-outlined fill-1" style={{ fontSize: '15px', color: 'var(--primary)' }}>
                            verified
                          </span>
                        )}
                      </div>
                      <span className="search-creator-handle">{creator.handle}</span>
                      {creator.bio && <p className="search-creator-bio">{creator.bio}</p>}
                      <span className="search-creator-followers">
                        {creator.followersCount || 0} followers · {creator.postsCount || 0} looks
                      </span>
                    </div>
                    <button
                      className={`search-follow-btn ${followingMap[creator.id] ? 'following' : ''}`}
                      onClick={(e) => handleToggleFollow(creator.id, e)}
                    >
                      {followingMap[creator.id] ? 'Following' : 'Follow'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
