/**
 * AuthGuard — Wraps app with SSO authentication via Keycloak.
 * Unauthenticated users are redirected to /login.
 */
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { isLocalViteDev, isSsoConfigured, ssoIsTokenValid, ssoLoadTokens } from '../auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLocalViteDev() || !isSsoConfigured()) {
      setIsAuthenticated(true);
      setLoading(false);
      return;
    }
    const tokens = ssoLoadTokens();
    setIsAuthenticated(!!tokens && ssoIsTokenValid(tokens));
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh'}}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
