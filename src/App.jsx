import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import AppHeader from './components/AppHeader';
import BottomNav from './components/BottomNav';
import Toast from './components/Toast';
import HomePage from './pages/HomePage';
import TrendingPage from './pages/TrendingPage';
import ForYouPage from './pages/ForYouPage';
import ProfilePage from './pages/ProfilePage';
import TryOnPage from './pages/TryOnPage';
import './App.css';

function MainLayout() {
  const location = useLocation();
  const isTryOn = location.pathname === '/try-on';

  return (
    <div className="app-container">
      <div className="app-viewport">
        <AppHeader backButton={isTryOn} />

        <main className="main-scroll-area">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/trending" element={<TrendingPage />} />
            <Route path="/for-you" element={<ForYouPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/try-on" element={<TryOnPage />} />
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
    <AppProvider>
      <BrowserRouter>
        <MainLayout />
      </BrowserRouter>
    </AppProvider>
  );
}
