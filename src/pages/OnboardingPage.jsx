import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { estimateMeasurementsFromAnthropometry } from '../services/measurementEstimator';
import './OnboardingPage.css';

const GENDER_OPTIONS = [
  { id: 'women', label: 'Women', icon: 'female' },
  { id: 'men', label: 'Men', icon: 'male' },
  { id: 'unisex', label: 'Unisex', icon: 'person' },
];

const BODY_TYPE_OPTIONS = [
  { id: 'hourglass', label: 'Hourglass', desc: 'Balanced bust & hips with defined waist' },
  { id: 'athletic', label: 'Athletic', desc: 'Toned silhouette with muscular definition' },
  { id: 'rectangle', label: 'Rectangle', desc: 'Straight, balanced proportions throughout' },
  { id: 'inverted_triangle', label: 'Inverted Triangle', desc: 'Broader shoulders tapering down' },
  { id: 'round', label: 'Round / Oval', desc: 'Curvier torso with softer lines' },
];

const FIT_PREFERENCES = [
  { id: 'tight', label: 'Tight' },
  { id: 'fitted', label: 'Fitted' },
  { id: 'regular', label: 'Regular' },
  { id: 'relaxed', label: 'Relaxed' },
  { id: 'oversized', label: 'Oversized' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { refreshCurrentUser, showToast } = useApp();

  const [gender, setGender] = useState('women');
  const [heightCm, setHeightCm] = useState(168);
  const [bodyType, setBodyType] = useState('hourglass');
  const [fitPreference, setFitPreference] = useState('regular');

  // Detailed measurements (optional)
  const [chestCm, setChestCm] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [hipsCm, setHipsCm] = useState('');
  const [shoulderCm, setShoulderCm] = useState('');
  const [inseamCm, setInseamCm] = useState('');

  // Photo & Consent
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [hasPhotoConsent, setHasPhotoConsent] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type?.toLowerCase())) {
        setErrorMsg(`Unsupported file type "${file.type || 'unknown'}". Please select a JPEG, PNG, or WebP photo.`);
        e.target.value = '';
        return;
      }

      const MAX_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        setErrorMsg(`Photo size (${sizeMB} MB) exceeds maximum allowed limit of 10 MB.`);
        e.target.value = '';
        return;
      }

      setErrorMsg(null);
      setPhotoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);
    }
  };

  const handleRemovePhoto = (e) => {
    e.stopPropagation();
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
  };

  const handleAutoEstimate = () => {
    const est = estimateMeasurementsFromAnthropometry({
      heightCm: Number(heightCm) || 168,
      gender,
      bodyType,
    });
    setChestCm(est.chestCm);
    setWaistCm(est.waistCm);
    setHipsCm(est.hipsCm);
    setShoulderCm(est.shoulderCm);
    setInseamCm(est.inseamCm);
    showToast('Measurements estimated from anthropometric standards', 'magic_button');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation
    const numHeight = Number(heightCm);
    if (!numHeight || numHeight < 50 || numHeight > 250) {
      setErrorMsg('Please enter a valid height between 50 cm and 250 cm.');
      return;
    }

    if (photoFile && !hasPhotoConsent) {
      setErrorMsg('Please check the consent box to authorize processing of your calibration photo.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Record photo processing consent if checked
      if (hasPhotoConsent) {
        await api.giveConsent('photo_processing');
      }

      // 2. Upload photo if selected
      let uploadedPhotoUrl = null;
      if (photoFile) {
        showToast('Uploading full-body photo...', 'cloud_upload');
        const uploadResult = await api.uploadPhoto(photoFile);
        uploadedPhotoUrl = uploadResult?.photoUrl;
      }

      // 3. Upsert body profile via PUT /api/v1/users/:id/body-profile
      const profilePayload = {
        heightCm: numHeight,
        gender,
        bodyType,
        fitPreference,
        chestCm: chestCm ? Number(chestCm) : undefined,
        bustChestCm: chestCm ? Number(chestCm) : undefined,
        waistCm: waistCm ? Number(waistCm) : undefined,
        hipsCm: hipsCm ? Number(hipsCm) : undefined,
        shoulderCm: shoulderCm ? Number(shoulderCm) : undefined,
        inseamCm: inseamCm ? Number(inseamCm) : undefined,
        fullBodyPhotoUrl: uploadedPhotoUrl || undefined,
        source: photoFile ? 'PHOTO' : 'MANUAL',
      };

      await api.updateBodyProfile(profilePayload, 'me');

      // 4. Refresh current user state in context
      await refreshCurrentUser();

      showToast('Profile calibrated successfully! Welcome to FitsYou.', 'check_circle');

      // 5. Redirect to For You feed
      navigate('/for-you', { replace: true });
    } catch (err) {
      console.error('Onboarding submission failed:', err);
      setErrorMsg(err?.message || 'Failed to complete profile calibration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <div className="onboarding-badge">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>straighten</span>
            <span>FitsYou Studio Calibration</span>
          </div>
          <h1 className="onboarding-title">Create Your Body Profile</h1>
          <p className="onboarding-subtitle">
            Configure your silhouette and sizing so our recommender and virtual try-on engine fit you flawlessly.
          </p>
        </div>

        {errorMsg && (
          <div className="onboarding-error-banner">
            <span className="material-symbols-outlined">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Gender Section */}
          <div className="onboarding-section">
            <div className="section-label">
              <span className="material-symbols-outlined">wc</span>
              <span>1. Gender Silhouette</span>
            </div>
            <div className="pill-grid">
              {GENDER_OPTIONS.map((g) => (
                <button
                  type="button"
                  key={g.id}
                  className={`pill-choice ${gender === g.id ? 'active' : ''}`}
                  onClick={() => setGender(g.id)}
                >
                  <span className="material-symbols-outlined">{g.icon}</span>
                  <span>{g.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Height Section */}
          <div className="onboarding-section">
            <div className="section-label">
              <span className="material-symbols-outlined">height</span>
              <span>2. Height</span>
            </div>
            <div className="input-with-unit">
              <input
                type="number"
                min="50"
                max="250"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="168"
                required
              />
              <span className="input-unit">cm</span>
            </div>
          </div>

          {/* Body Type Section */}
          <div className="onboarding-section">
            <div className="section-label">
              <span className="material-symbols-outlined">accessibility_new</span>
              <span>3. Body Type</span>
            </div>
            <div className="pill-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
              {BODY_TYPE_OPTIONS.map((bt) => (
                <button
                  type="button"
                  key={bt.id}
                  className={`pill-choice ${bodyType === bt.id ? 'active' : ''}`}
                  onClick={() => setBodyType(bt.id)}
                  title={bt.desc}
                >
                  <span style={{ fontWeight: 600 }}>{bt.label}</span>
                  <span style={{ fontSize: '0.72rem', color: '#a1a1aa', textAlign: 'center', lineHeight: 1.2 }}>
                    {bt.desc.split(' ')[0]} shape
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Fit Preference Section */}
          <div className="onboarding-section">
            <div className="section-label">
              <span className="material-symbols-outlined">tune</span>
              <span>4. Fit Preference</span>
            </div>
            <div className="pill-grid">
              {FIT_PREFERENCES.map((fp) => (
                <button
                  type="button"
                  key={fp.id}
                  className={`pill-choice ${fitPreference === fp.id ? 'active' : ''}`}
                  onClick={() => setFitPreference(fp.id)}
                >
                  <span>{fp.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Detailed Measurements (Optional) */}
          <div className="onboarding-section">
            <div className="section-label">
              <span className="material-symbols-outlined">square_foot</span>
              <span>5. Detailed Measurements (Optional)</span>
            </div>

            <button
              type="button"
              className="auto-estimate-btn"
              onClick={handleAutoEstimate}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>auto_fix_high</span>
              <span>Auto-Estimate from Height & Body Type</span>
            </button>

            <div className="measurements-grid">
              <div className="input-group">
                <label>Chest / Bust</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    min="30"
                    max="200"
                    placeholder="88"
                    value={chestCm}
                    onChange={(e) => setChestCm(e.target.value)}
                  />
                  <span className="input-unit">cm</span>
                </div>
              </div>

              <div className="input-group">
                <label>Waist</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    min="30"
                    max="200"
                    placeholder="68"
                    value={waistCm}
                    onChange={(e) => setWaistCm(e.target.value)}
                  />
                  <span className="input-unit">cm</span>
                </div>
              </div>

              <div className="input-group">
                <label>Hips</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    min="30"
                    max="200"
                    placeholder="94"
                    value={hipsCm}
                    onChange={(e) => setHipsCm(e.target.value)}
                  />
                  <span className="input-unit">cm</span>
                </div>
              </div>

              <div className="input-group">
                <label>Shoulder</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    min="20"
                    max="100"
                    placeholder="41"
                    value={shoulderCm}
                    onChange={(e) => setShoulderCm(e.target.value)}
                  />
                  <span className="input-unit">cm</span>
                </div>
              </div>

              <div className="input-group" style={{ gridColumn: 'span 2' }}>
                <label>Inseam</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    min="30"
                    max="150"
                    placeholder="76"
                    value={inseamCm}
                    onChange={(e) => setInseamCm(e.target.value)}
                  />
                  <span className="input-unit">cm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Photo Upload & Consent Gate */}
          <div className="onboarding-section">
            <div className="section-label">
              <span className="material-symbols-outlined">add_a_photo</span>
              <span>6. Full-Body Calibration Photo (Optional)</span>
            </div>

            <label className="photo-uploader">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handlePhotoSelect}
              />
              {photoPreview ? (
                <div className="photo-preview-wrap">
                  <img src={photoPreview} alt="Preview" className="photo-preview-img" />
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: '#fef08a' }}>Photo Selected</p>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#a1a1aa' }}>
                      {photoFile?.name} ({(photoFile?.size / 1024).toFixed(0)} KB)
                    </p>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid #ef4444',
                        color: '#fca5a5',
                        borderRadius: '0.375rem',
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Remove Photo
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#d4af37', marginBottom: '0.5rem' }}>
                    cloud_upload
                  </span>
                  <p style={{ margin: '0 0 0.25rem', fontWeight: 600 }}>Click to upload full-body photo</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#71717a' }}>
                    Supports JPG, PNG, WEBP (Max 15MB)
                  </p>
                </div>
              )}
            </label>

            {/* Consent Gate */}
            <label className="consent-box">
              <input
                type="checkbox"
                className="consent-checkbox"
                checked={hasPhotoConsent}
                onChange={(e) => setHasPhotoConsent(e.target.checked)}
              />
              <p className="consent-text">
                <strong>Explicit AI Photo Processing Consent:</strong> I authorize FitsYou to process my photos
                using AI algorithms solely for virtual try-on renders, anthropometric sizing, and personalized styling.
                I can delete my uploaded photos at any time in Profile Settings.
              </p>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="onboarding-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite' }}>
                  sync
                </span>
                <span>Calibrating Sizing Profile...</span>
              </>
            ) : (
              <>
                <span>Complete Calibration & Enter Studio</span>
                <span className="material-symbols-outlined">arrow_forward</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
