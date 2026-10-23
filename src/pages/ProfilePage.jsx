import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { MOCK_POSTS } from '../data/mockPosts';
import './ProfilePage.css';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { currentUser, savedTryOns, toggleTryOnPrivacy, deleteTryOn, showToast, setActiveTryOn } = useApp();
  const [activeTab, setActiveTab] = useState('tryons'); // 'posts' | 'tryons'
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'private' | 'public'

  const filteredTryOns = savedTryOns.filter((item) => {
    if (filterMode === 'private') return item.isPrivate;
    if (filterMode === 'public') return !item.isPrivate;
    return true;
  });

  const handleOpenInFittingRoom = (item) => {
    setActiveTryOn({
      id: item.id,
      garment: {
        id: item.garmentId || 'prod-10',
        name: item.title,
        brand: item.brand,
        price: item.price,
        image: item.image,
      },
      aiRenderedImage: item.image,
      originalPhoto: item.originalPhoto,
      fitNote: `${item.brand} Tailored Fit`,
      matchScore: item.fitScore || '99%',
    });
    navigate('/try-on');
  };

  return (
    <div className="profile-page">
      {/* Profile Hero Header */}
      <section className="profile-hero">
        <div className="profile-identity-row">
          <div className="profile-avatar-container">
            <img src={currentUser.avatar} alt={currentUser.name} className="profile-avatar-lg" />
            <button
              className="avatar-edit-badge"
              aria-label="Edit avatar"
              onClick={() => showToast('Avatar customization ready', 'camera_enhance')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                edit
              </span>
            </button>
          </div>

          <div className="profile-meta-col">
            <div className="profile-name-row">
              <h1 className="profile-name">{currentUser.name}</h1>
              <span className="explorer-badge">
                <span className="material-symbols-outlined fill-1" style={{ fontSize: '12px' }}>
                  verified
                </span>
                <span>{currentUser.badge}</span>
              </span>
            </div>

            <p className="profile-handle">{currentUser.handle}</p>

            <div className="stylist-tier">
              <span className="material-symbols-outlined fill-1" style={{ fontSize: '14px' }}>
                auto_awesome
              </span>
              <span>{currentUser.tier}</span>
            </div>
          </div>
        </div>

        {/* Editorial Bio */}
        <div className="profile-bio-box">
          <p>{currentUser.bio}</p>
        </div>

        {/* Stats Matrix */}
        <div className="stats-matrix">
          <div className="stat-cell">
            <span className="stat-val">{currentUser.stats.posts}</span>
            <span className="stat-lbl">Posts</span>
          </div>
          <div className="stat-cell">
            <span className="stat-val">{currentUser.stats.followers}</span>
            <span className="stat-lbl">Followers</span>
          </div>
          <div className="stat-cell">
            <span className="stat-val">{currentUser.stats.following}</span>
            <span className="stat-lbl">Following</span>
          </div>
          <div className="stat-cell">
            <span className="stat-val primary">{savedTryOns.length}</span>
            <span className="stat-lbl" style={{ color: 'var(--primary)', fontWeight: 600 }}>
              Try-Ons
            </span>
          </div>
        </div>

        {/* Quick Action Cluster */}
        <div className="profile-actions-cluster">
          <button
            className="profile-btn profile-btn-secondary"
            onClick={() => showToast('Profile editor opened', 'tune')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
              tune
            </span>
            <span>Edit Profile</span>
          </button>

          <button
            className="profile-btn profile-btn-secondary"
            style={{ flex: 'none', width: '42px', padding: 0 }}
            aria-label="Share Profile"
            onClick={() => {
              navigator.clipboard?.writeText?.(window.location.href);
              showToast('Profile link copied!', 'ios_share');
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              ios_share
            </span>
          </button>

          <button
            className="profile-btn profile-btn-primary"
            onClick={() => navigate('/try-on')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              checkroom
            </span>
            <span>Virtual Wardrobe</span>
          </button>
        </div>
      </section>

      {/* Sticky Sub-Tabs */}
      <div className="profile-subtabs">
        <button
          className={`profile-tab ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
            grid_view
          </span>
          <span>My Posts</span>
          {activeTab === 'posts' && <span className="tab-indicator-line" />}
        </button>

        <button
          className={`profile-tab ${activeTab === 'tryons' ? 'active' : ''}`}
          onClick={() => setActiveTab('tryons')}
        >
          <span className={`material-symbols-outlined ${activeTab === 'tryons' ? 'fill-1' : ''}`} style={{ fontSize: '20px' }}>
            auto_fix_high
          </span>
          <span>Saved Try-Ons</span>
          {activeTab === 'tryons' && <span className="tab-indicator-line" />}
        </button>
      </div>

      {/* Tab 1: Saved Try-Ons View */}
      {activeTab === 'tryons' && (
        <section className="tryons-section">
          {/* Vault Privacy Banner */}
          <div className="vault-banner">
            <div className="vault-banner-left">
              <div className="vault-lock-circle">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  lock
                </span>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--on-surface)' }}>
                  {savedTryOns.length} Saved Looks
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
                  AI simulations saved securely to your personal vault
                </p>
              </div>
            </div>

            {/* Filter buttons */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: filterMode === 'all' ? 'var(--primary)' : 'var(--surface-container-high)',
                  color: filterMode === 'all' ? '#fff' : 'var(--on-surface-variant)',
                }}
                onClick={() => setFilterMode('all')}
              >
                All
              </button>
              <button
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: filterMode === 'private' ? 'var(--primary)' : 'var(--surface-container-high)',
                  color: filterMode === 'private' ? '#fff' : 'var(--on-surface-variant)',
                }}
                onClick={() => setFilterMode('private')}
              >
                Private
              </button>
            </div>
          </div>

          {/* Try-On Grid */}
          <div className="tryons-grid">
            {filteredTryOns.map((item) => (
              <div key={item.id} className="tryon-card">
                <div className="tryon-card-media" onClick={() => handleOpenInFittingRoom(item)}>
                  <img src={item.image} alt={item.title} className="tryon-card-img" />

                  {/* Interactive Privacy Toggle Pill */}
                  <button
                    className={`tryon-privacy-pill ${item.isPrivate ? 'private' : 'public'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTryOnPrivacy(item.id);
                    }}
                    title="Click to toggle Privacy"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>
                      {item.isPrivate ? 'lock' : 'public'}
                    </span>
                    <span>{item.isPrivate ? 'Private' : 'Public'}</span>
                  </button>
                </div>

                <div className="tryon-card-info">
                  <span className="tryon-brand-tag">{item.brand}</span>
                  <p className="tryon-title">{item.title}</p>
                  <div className="tryon-footer-row">
                    <span className="tryon-price">${item.price}</span>
                    <button
                      className="tryon-del-btn"
                      onClick={() => deleteTryOn(item.id)}
                      title="Remove from saved collection"
                      aria-label="Delete saved look"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                        delete
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tab 2: My Posts Grid */}
      {activeTab === 'posts' && (
        <div className="my-posts-grid">
          {MOCK_POSTS.concat(MOCK_POSTS).map((post, idx) => (
            <div
              key={idx}
              className="my-post-tile"
              onClick={() => showToast(`Opening post ${idx + 1}...`, 'photo_library')}
            >
              <img src={post.image} alt="User Look" className="my-post-img" />
              <div className="my-post-overlay">
                <span className="material-symbols-outlined fill-1" style={{ fontSize: '16px' }}>
                  favorite
                </span>
                <span>{post.likes}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
