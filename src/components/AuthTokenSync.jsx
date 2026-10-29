import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setAuthTokenGetter } from '../services/api';

/**
 * Headless bridge component that registers Clerk's getToken with the API client.
 */
export default function AuthTokenSync() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn && typeof getToken === 'function') {
      setAuthTokenGetter(() => getToken());
    } else {
      setAuthTokenGetter(null);
    }
  }, [getToken, isSignedIn]);

  return null;
}
