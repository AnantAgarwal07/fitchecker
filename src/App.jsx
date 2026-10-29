import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AppHeader from './components/AppHeader';
import BottomNav from './components/BottomNav';
import Toast from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import TrendingPage from './pages/TrendingPage';
import ForYouPage from './pages/ForYouPage';
import ProfilePage from './pages/ProfilePage';
import TryOnPage from './pages/TryOnPage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import OnboardingPage from './pages/OnboardingPage';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function MainLayout() {
  const location = useLocation();
  const isTryOn = location.pathname === '/try-on';
  const isAuthOrOnboarding =
    location.pathname.startsWith('/sign-in') ||
    location.pathname.startsWith('/sign-up') ||
    location.pathname === '/onboarding';

  if (isAuthOrOnboarding) {
    return (
      <div className="app-container">
        <main style={{ minHeight: '100vh', width: '100%' }}>
          <Routes>
            <Route path="/sign-in/*" element={<SignInPage />} />
            <Route path="/sign-up/*" element={<SignUpPage />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute allowWithoutProfile={true}>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/sign-in" replace />} />
          </Routes>
          <Toast />
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="app-viewport">
        <AppHeader backButton={isTryOn} />

        <main className="main-scroll-area">
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trending"
              element={
                <ProtectedRoute>
                  <TrendingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/for-you"
              element={
                <ProtectedRoute>
                  <ForYouPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/try-on"
              element={
                <ProtectedRoute>
                  <TryOnPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <BottomNav />
        <Toast />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <MainLayout />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
