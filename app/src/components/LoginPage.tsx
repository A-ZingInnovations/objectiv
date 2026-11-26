/**
 * Login page — redirects to Keycloak for SSO authentication.
 * Route: /login
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ssoAuthUrl, isSsoConfigured, isLocalViteDev } from '../auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [ssoMissing] = useState(() => !isSsoConfigured());

  useEffect(() => {
    if (isLocalViteDev()) {
      navigate('/', { replace: true });
      return;
    }
    if (!isSsoConfigured()) {
      return;
    }

    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    try {
      localStorage.setItem('objectiv_sso_state', state);
      localStorage.setItem('objectiv_sso_nonce', nonce);
    } catch {
      /* ignore */
    }
    void window.location.assign(ssoAuthUrl(state, nonce));
  }, [navigate]);

  if (ssoMissing) {
    return (
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#333'}}>
        <p style={{color: '#666', marginBottom: 16}}>SSO is not configured (set VITE_SSO_ISSUER and VITE_SSO_CLIENT_ID).</p>
        <Link to="/" style={{color: '#1976d2'}}>Back to workbench</Link>
      </div>
    );
  }

  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#333'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: 24, fontWeight: 600, marginBottom: 16}}>
        <span style={{fontSize: 32}}>🤖</span>
        <span>Objectiv</span>
      </div>
      <p style={{color: '#666', marginBottom: 24}}>Sign in with A-Zing SSO</p>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 24, border: '1px solid #e0e0e0', borderRadius: 8, background: '#fafafa'}}>
        <span style={{fontSize: 14, color: '#666'}}>Redirecting to SSO…</span>
      </div>
    </div>
  );
}
