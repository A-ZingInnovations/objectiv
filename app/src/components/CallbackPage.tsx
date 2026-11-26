/**
 * Callback page — receives OAuth2 authorization code from Keycloak.
 * Route: /auth/callback
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ssoExchangeCode, ssoStoreTokens } from '../auth';

export default function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const err = params.get('error');

    if (err) {
      setError(err);
      return;
    }

    if (code) {
      ssoExchangeCode(code)
        .then((tokens) => ssoStoreTokens(tokens))
        .then(() => navigate('/'))
        .catch((e) => {
          setError(e instanceof Error ? e.message : String(e));
        });
    } else {
      setError('No authorization code received');
    }
  }, [navigate]);

  if (error) {
    return (
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#333'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: 24, fontWeight: 600, marginBottom: 16}}>
          <span style={{fontSize: 32}}>⚠️</span>
          <span>Sign in failed</span>
        </div>
        <p style={{color: '#d32f2f', marginBottom: 24}}>{error}</p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          style={{padding: '8px 16px', border: 'none', background: '#1976d2', color: '#fff', borderRadius: 4, cursor: 'pointer'}}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#333'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: 24, fontWeight: 600, marginBottom: 16}}>
        <span style={{fontSize: 32}}>🔄</span>
        <span>Signing in…</span>
      </div>
    </div>
  );
}
