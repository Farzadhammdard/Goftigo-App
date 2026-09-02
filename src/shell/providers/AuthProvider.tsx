import React, {createContext, useContext, useEffect, useState} from 'react';
import {useAuthStore} from '../../store/authStore';
import {wsService} from '../../core/services/WebSocketService';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
});

export function AuthProvider({children}: {children: React.ReactNode}) {
  const {isAuthenticated, isLoading, isInitialized, tokens, restoreSession} =
    useAuthStore();
  const [ready, setReady] = useState(false);

  // Connect/disconnect WebSocket based on auth state
  useEffect(() => {
    if (isAuthenticated && tokens?.accessToken) {
      wsService.connect(tokens.accessToken);
    } else {
      wsService.disconnect();
    }

    return () => {
      wsService.disconnect();
    };
  }, [isAuthenticated, tokens?.accessToken]);

  useEffect(() => {
    async function init() {
      try {
        await restoreSession();
      } catch (error) {
        console.error('Auth initialization failed:', error);
        useAuthStore.getState().setInitialized(true);
      } finally {
        setReady(true);
      }
    }
    init();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        isInitialized: ready && isInitialized,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  return useContext(AuthContext);
}
