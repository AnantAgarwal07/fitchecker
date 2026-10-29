import React from 'react';
import { SignUp } from '@clerk/clerk-react';
import APP_CONFIG from '../data/appConfig';
import './AuthPages.css';

export default function SignUpPage() {
  return (
    <div className="auth-page-container">
      <div className="auth-brand-header">
        <img src={APP_CONFIG.logoUrl} alt={`${APP_CONFIG.name} Logo`} className="auth-logo" />
        <h1 className="auth-title">{APP_CONFIG.name}</h1>
        <p className="auth-subtitle">Create your account to unlock AI virtual try-ons</p>
      </div>

      <div className="auth-clerk-card">
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/onboarding"
          appearance={{
            variables: {
              colorPrimary: '#D4AF37',
              colorBackground: '#16161a',
              colorText: '#ffffff',
              colorTextSecondary: '#a1a1aa',
              colorInputBackground: '#1e1e24',
              colorInputText: '#ffffff',
              borderRadius: '0.75rem',
            },
            elements: {
              card: {
                backgroundColor: 'rgba(22, 22, 26, 0.95)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(212, 175, 55, 0.22)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.65)',
              },
              headerTitle: {
                color: '#ffffff',
              },
              socialButtonsBlockButton: {
                backgroundColor: '#1f1f24',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
              },
              formButtonPrimary: {
                backgroundColor: '#D4AF37',
                color: '#09090b',
                fontWeight: '700',
              },
            },
          }}
        />
      </div>
    </div>
  );
}
