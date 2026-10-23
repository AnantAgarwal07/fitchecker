import React from 'react';
import { NavLink } from 'react-router-dom';
import './BottomNav.css';

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: 'cottage' },
  { path: '/trending', label: 'Trending', icon: 'local_fire_department' },
  { path: '/for-you', label: 'For You', icon: 'auto_awesome' },
  { path: '/profile', label: 'Profile', icon: 'person' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          {({ isActive }) => (
            <>
              <span className={`material-symbols-outlined bottom-nav-icon ${isActive ? 'fill-1' : ''}`}>
                {item.icon}
              </span>
              <span className="bottom-nav-label">{item.label}</span>
              {isActive && <span className="bottom-nav-indicator" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
