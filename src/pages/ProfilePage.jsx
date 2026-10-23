import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import {
  estimateMeasurementsFromAnthropometry,
  cmToInches,
  inchesToCm,
} from '../services/measurementEstimator';
import './ProfilePage.css';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { currentUser: defaultUser, showToast, setActiveTryOn } = useApp();
  const [currentUser, setCurrentUser] = useState(defaultUser);
  const [savedTryOns, setSavedTryOns] = useState([]);
  const [activeTab, setActiveTab] = useState('tryons'); // 'posts' | 'tryons'
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'private' | 'public'
  const [userPosts, setUserPosts] = useState([]);
  const [isEditingBody, setIsEditingBody] = useState(false);
  const [unit, setUnit] = useState('cm'); // 'cm' | 'in'
  const [bodyForm, setBodyForm] = useState({
    heightCm: 165,
    gender: 'women',
    bodyType: 'hourglass',
    fitPreference: 'regular',
    styleVibe: 'streetwear',
    chestCm: 88,
    waistCm: 68,
    hipsCm: 94,
    shoulderCm: 41,
    inseamCm: 76,
  });

  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      const [profileData, sessions, postsData] = await Promise.all([
        api.getUserProfile('user-self'),
        api.getTryOnSessions({ userId: 'user-self' }),
        api.getPosts({ userId: 'u-ananya-sharma-001' }),
      ]);

      if (isMounted) {
        if (profileData) {
          setCurrentUser(profileData);
          if (profileData.bodyProfile) {
            const bp = profileData.bodyProfile;
            setBodyForm({
              heightCm: bp.heightCm || 165,
              gender: bp.gender || 'women',
              bodyType: bp.bodyType || 'hourglass',
              fitPreference: bp.fitPreference || 'regular',
              styleVibe: bp.styleVibe || 'streetwear',
              chestCm: bp.chestCm || bp.bustChestCm || 88,
              waistCm: bp.waistCm || 68,
              hipsCm: bp.hipsCm || 94,
              shoulderCm: bp.shoulderCm || 41,
              inseamCm: bp.inseamCm || 76,
            });
          }
        }
        if (sessions) {
          setSavedTryOns(sessions);
        }

        if (postsData?.posts) {
          setUserPosts(postsData.posts);
        }
      }
    }
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredTryOns = savedTryOns.filter((item) => {
    if (filterMode === 'private') return item.isPrivate;
    if (filterMode === 'public') return !item.isPrivate;
    return true;
  });

  const handleTogglePrivacy = async (id, currentPrivate) => {
    const nextPrivate = !currentPrivate;
    setSavedTryOns((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isPrivate: nextPrivate } : item))
    );
    showToast(nextPrivate ? 'Look set to Private' : 'Look is now Public on Feed', nextPrivate ? 'lock' : 'public');
    await api.updateTryOnSession(id, { isPrivate: nextPrivate });
  };

  const handleDeleteTryOn = async (id) => {
    setSavedTryOns((prev) => prev.filter((item) => item.id !== id));
    showToast('Look removed from saved collection', 'delete');
    await api.updateTryOnSession(id, { isSaved: false });
  };

  const handleSaveBodyProfile = async () => {
    setIsEditingBody(false);
    showToast('Body Profile updated & calibrated!', 'straighten');
    const payload = {
      heightCm: Number(bodyForm.heightCm) || 165,
      gender: bodyForm.gender,
      bodyType: bodyForm.bodyType,
      fitPreference: bodyForm.fitPreference,
      styleVibe: bodyForm.styleVibe,
      chestCm: Number(bodyForm.chestCm) || null,
      bustChestCm: Number(bodyForm.chestCm) || null,
      waistCm: Number(bodyForm.waistCm) || null,
      hipsCm: Number(bodyForm.hipsCm) || null,
      shoulderCm: Number(bodyForm.shoulderCm) || null,
      inseamCm: Number(bodyForm.inseamCm) || null,
    };
    await api.updateBodyProfile('user-self', payload);
    const updated = await api.getUserProfile('user-self');
    if (updated) setCurrentUser(updated);
  };

  const handleAutoEstimate = () => {
    const est = estimateMeasurementsFromAnthropometry({
      heightCm: Number(bodyForm.heightCm) || 165,
      gender: bodyForm.gender || 'women',
      bodyType: bodyForm.bodyType || 'hourglass',
    });
    setBodyForm((prev) => ({
      ...prev,
      chestCm: est.chestCm,
      waistCm: est.waistCm,
      hipsCm: est.hipsCm,
      shoulderCm: est.shoulderCm,
      inseamCm: est.inseamCm,
    }));
    showToast('Measurements calibrated from height & body shape!', 'auto_fix_high');
  };

  const displayVal = (cmVal) => {
    if (cmVal === undefined || cmVal === null || isNaN(cmVal)) return '';
    return unit === 'in' ? (Math.round((cmVal / 2.54) * 10) / 10).toString() : cmVal.toString();
  };

  const updateFromInput = (field, valStr) => {
    const val = parseFloat(valStr);
    if (isNaN(val)) {
      setBodyForm((prev) => ({ ...prev, [field]: '' }));
      return;
    }
    const cmVal = unit === 'in' ? Math.round(val * 2.54 * 10) / 10 : val;
    setBodyForm((prev) => ({ ...prev, [field]: cmVal }));
  };


  const handleOpenInFittingRoom = (item) => {
    setActiveTryOn({
      id: item.id,
      garment: {
        id: item.garmentId || item.garment?.id || 'prod-10',
        name: item.title,
        brand: item.brand,
        price: item.price,
        image: item.image,
      },
      aiRenderedImage: item.image,
      originalPhoto: item.originalPhoto,
      fitNote: item.fitNote || `${item.brand} Tailored Fit`,
      matchScore: item.fitScore || '94%',
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
              <span>{currentUser.tier || 'Virtual Stylist Tier I'}</span>
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
            <span className="stat-val">{currentUser.stats?.posts ?? userPosts.length}</span>
            <span className="stat-lbl">Posts</span>
          </div>
          <div className="stat-cell">
            <span className="stat-val">{currentUser.stats?.followers ?? '1.2k'}</span>
            <span className="stat-lbl">Followers</span>
          </div>
          <div className="stat-cell">
            <span className="stat-val">{currentUser.stats?.following ?? 12}</span>
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
            onClick={() => setIsEditingBody(!isEditingBody)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
              straighten
            </span>
            <span>Body Profile</span>
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

        {/* Inline Body Profile Editor Modal/Drawer */}
        {isEditingBody && (
          <div
            style={{
              marginTop: '16px',
              padding: '16px',
              backgroundColor: 'var(--surface-container-low)',
              borderRadius: '16px',
              border: '1px solid var(--outline-variant)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Body Measurements & Sizing</span>
                <p style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)', marginTop: '2px' }}>
                  Calibrated to Ramanujan body ellipse geometry for exact ease recommendations
                </p>
              </div>

              {/* Unit Toggle Pill (cm vs in) */}
              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--surface-container-high)', borderRadius: '20px', padding: '2px' }}>
                <button
                  type="button"
                  onClick={() => setUnit('cm')}
                  style={{
                    border: 'none',
                    borderRadius: '16px',
                    padding: '3px 10px',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: unit === 'cm' ? 'var(--primary)' : 'transparent',
                    color: unit === 'cm' ? '#fff' : 'var(--on-surface-variant)',
                  }}
                >
                  cm
                </button>
                <button
                  type="button"
                  onClick={() => setUnit('in')}
                  style={{
                    border: 'none',
                    borderRadius: '16px',
                    padding: '3px 10px',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: unit === 'in' ? 'var(--primary)' : 'transparent',
                    color: unit === 'in' ? '#fff' : 'var(--on-surface-variant)',
                  }}
                >
                  in
                </button>
              </div>
            </div>

            {/* Quick Estimate / Recalibration Banner */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: '10px',
                backgroundColor: 'var(--surface-container-high)',
                border: '1px dashed var(--outline-variant)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--secondary-fixed-dim)' }}>
                  auto_awesome
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--on-surface)' }}>Need quick measurements?</span>
              </div>
              <button
                type="button"
                onClick={handleAutoEstimate}
                style={{
                  background: 'none',
                  border: '1px solid var(--primary)',
                  borderRadius: '6px',
                  color: 'var(--primary)',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                Auto-Estimate from Shape
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>
                  Height ({unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={displayVal(bodyForm.heightCm)}
                  onChange={(e) => updateFromInput('heightCm', e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--outline)', backgroundColor: 'var(--surface)', color: 'var(--on-surface)', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>Gender</label>
                <select
                  value={bodyForm.gender || 'women'}
                  onChange={(e) => setBodyForm({ ...bodyForm, gender: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--outline)', backgroundColor: 'var(--surface)', color: 'var(--on-surface)', marginTop: '4px' }}
                >
                  <option value="women">Women</option>
                  <option value="men">Men</option>
                  <option value="unisex">Unisex</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>Body Shape</label>
                <select
                  value={bodyForm.bodyType}
                  onChange={(e) => setBodyForm({ ...bodyForm, bodyType: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--outline)', backgroundColor: 'var(--surface)', color: 'var(--on-surface)', marginTop: '4px' }}
                >
                  <option value="hourglass">Hourglass</option>
                  <option value="athletic">Athletic</option>
                  <option value="rectangle">Rectangle</option>
                  <option value="inverted_triangle">Inverted Triangle</option>
                  <option value="round">Round</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>Fit Preference</label>
                <select
                  value={bodyForm.fitPreference}
                  onChange={(e) => setBodyForm({ ...bodyForm, fitPreference: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--outline)', backgroundColor: 'var(--surface)', color: 'var(--on-surface)', marginTop: '4px' }}
                >
                  <option value="tight">Tight</option>
                  <option value="fitted">Fitted</option>
                  <option value="regular">Regular</option>
                  <option value="relaxed">Relaxed</option>
                  <option value="oversized">Oversized</option>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>
                    Chest / Bust ({unit})
                  </label>
                </div>
                <input
                  type="number"
                  step="0.1"
                  placeholder={unit === 'cm' ? '88' : '34.6'}
                  value={displayVal(bodyForm.chestCm)}
                  onChange={(e) => updateFromInput('chestCm', e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--outline)', backgroundColor: 'var(--surface)', color: 'var(--on-surface)', marginTop: '4px' }}
                />
                <span style={{ fontSize: '0.5625rem', color: 'var(--on-surface-variant)', display: 'block', marginTop: '2px' }}>
                  Fullest tape level around chest
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>
                  Waist ({unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder={unit === 'cm' ? '68' : '26.8'}
                  value={displayVal(bodyForm.waistCm)}
                  onChange={(e) => updateFromInput('waistCm', e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--outline)', backgroundColor: 'var(--surface)', color: 'var(--on-surface)', marginTop: '4px' }}
                />
                <span style={{ fontSize: '0.5625rem', color: 'var(--on-surface-variant)', display: 'block', marginTop: '2px' }}>
                  Natural waistline above navel
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>
                  Hips ({unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder={unit === 'cm' ? '94' : '37.0'}
                  value={displayVal(bodyForm.hipsCm)}
                  onChange={(e) => updateFromInput('hipsCm', e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--outline)', backgroundColor: 'var(--surface)', color: 'var(--on-surface)', marginTop: '4px' }}
                />
                <span style={{ fontSize: '0.5625rem', color: 'var(--on-surface-variant)', display: 'block', marginTop: '2px' }}>
                  Fullest point around hips
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>
                  Shoulder ({unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder={unit === 'cm' ? '41' : '16.1'}
                  value={displayVal(bodyForm.shoulderCm)}
                  onChange={(e) => updateFromInput('shoulderCm', e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--outline)', backgroundColor: 'var(--surface)', color: 'var(--on-surface)', marginTop: '4px' }}
                />
                <span style={{ fontSize: '0.5625rem', color: 'var(--on-surface-variant)', display: 'block', marginTop: '2px' }}>
                  Across back seam-to-seam
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>
                  Inseam ({unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder={unit === 'cm' ? '76' : '29.9'}
                  value={displayVal(bodyForm.inseamCm)}
                  onChange={(e) => updateFromInput('inseamCm', e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--outline)', backgroundColor: 'var(--surface)', color: 'var(--on-surface)', marginTop: '4px' }}
                />
                <span style={{ fontSize: '0.5625rem', color: 'var(--on-surface-variant)', display: 'block', marginTop: '2px' }}>
                  Crotch seam down to ankle
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>Style Vibe</label>
                <input
                  type="text"
                  value={bodyForm.styleVibe}
                  onChange={(e) => setBodyForm({ ...bodyForm, styleVibe: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--outline)', backgroundColor: 'var(--surface)', color: 'var(--on-surface)', marginTop: '4px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={handleSaveBodyProfile}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check</span>
                <span>Save & Recalculate Fit Scores</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditingBody(false)}
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'transparent',
                  color: 'var(--on-surface-variant)',
                  border: '1px solid var(--outline)',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

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
                      handleTogglePrivacy(item.id, item.isPrivate);
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
                    <span className="tryon-price">₹{item.price}</span>
                    <button
                      className="tryon-del-btn"
                      onClick={() => handleDeleteTryOn(item.id)}
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
          {(userPosts.length > 0 ? userPosts : []).map((post, idx) => (
            <div
              key={post.id || idx}
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
