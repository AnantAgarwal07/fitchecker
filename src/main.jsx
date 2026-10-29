import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import AuthTokenSync from './components/AuthTokenSync';
import { AppProvider } from './context/AppContext';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const rootElement = document.getElementById('root');

if (rootElement) {
  if (!PUBLISHABLE_KEY) {
    console.error('Missing VITE_CLERK_PUBLISHABLE_KEY. Please specify it in .env');
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY || 'pk_test_placeholder'} afterSignOutUrl="/sign-in">
        <AuthTokenSync />
        <AppProvider>
          <App />
        </AppProvider>
      </ClerkProvider>
    </React.StrictMode>
  );
}
