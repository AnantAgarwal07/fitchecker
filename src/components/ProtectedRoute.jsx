import React from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import '../pages/AuthPages.css';

/**
 * Route protection gate:
 * 1. Checks Clerk authentication; unauthenticated users redirect to /sign-in.
 * 2. Checks if user has completed onboarding (has a BodyProfile with heightCm).
 *    If not, redirects them to /onboarding until calibration is completed.
 */
export default function ProtectedRoute({ children, allowWithoutProfile = false }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { currentUser, isUserLoading } = useApp();
  const location = useLocation();

  if (!isLoaded || isUserLoading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-spinner"></div>
        <p style={{ fontSize: '0.95rem', letterSpacing: '0.02em', color: '#e6c687' }}>
          Calibrating styling studio...
        </p>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  const hasBodyProfile = Boolean(currentUser?.bodyProfile && currentUser.bodyProfile.heightCm);

  // If user has not completed onboarding and is not already on /onboarding
  if (!hasBodyProfile && !allowWithoutProfile && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // If user already has a body profile and visits /onboarding, redirect to /for-you
  if (hasBodyProfile && location.pathname === '/onboarding') {
    return <Navigate to="/for-you" replace />;
  }

  return children;
}
