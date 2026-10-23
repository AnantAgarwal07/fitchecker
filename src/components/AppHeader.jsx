import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import APP_CONFIG from '../data/appConfig';
import { useApp } from '../context/AppContext';
import './AppHeader.css';

export default function AppHeader({ title, backButton = false }) {
  const { currentUser, isSearchOpen, setIsSearchOpen, searchQuery, setSearchQuery, showToast } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadNotifications, setUnreadNotifications] = useState(true);

  const getSubTitle = () => {
    if (location.pathname === '/trending') return 'Trending';
    if (location.pathname === '/for-you') return 'For You';
    if (location.pathname === '/profile') return 'Profile';
    if (location.pathname === '/try-on') return 'Fitting Room';
    return 'Home Feed';
  };

  const handleNotificationClick = () => {
    setUnreadNotifications(false);
    showToast('You have 3 new styling suggestions!', 'notifications_active');
  };

  return (
    <>
      <header className="app-header">
        <div className="app-header-left">
          {backButton ? (
            <button
              className="icon-btn"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              style={{ marginLeft: -8 }}
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          ) : null}

          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <img src={APP_CONFIG.logoUrl} alt={`${APP_CONFIG.name} Logo`} className="app-header-logo" />
            <span className="app-header-title">{APP_CONFIG.name}</span>
          </Link>
          <span className="app-header-tag">• {title || getSubTitle()}</span>
        </div>

        <div className="app-header-actions">
          <button
            className="icon-btn"
            aria-label="Search outfits"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
              search
            </span>
          </button>

          <button
            className="icon-btn"
            aria-label="Notifications"
            onClick={handleNotificationClick}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
              notifications
            </span>
            {unreadNotifications && <span className="unread-dot"></span>}
          </button>

          <Link to="/profile" aria-label="Go to profile">
            <img
              src={currentUser.avatar}
              alt="Profile"
              className="header-avatar"
            />
          </Link>
        </div>
      </header>

      {/* Interactive Quick Search Bar */}
      {isSearchOpen && (
        <div className="search-overlay">
          <div className="search-input-wrap">
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>
              search
            </span>
            <input
              type="text"
              placeholder="Search garments, styles, designers (e.g., COS, Trench)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--outline)' }}>
                  close
                </span>
              </button>
            )}
          </div>
          <button className="search-close-btn" onClick={() => setIsSearchOpen(false)}>
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
