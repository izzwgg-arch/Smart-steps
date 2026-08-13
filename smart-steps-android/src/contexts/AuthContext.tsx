/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the app
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import authService, { User, AuthSession } from '../services/authService';

interface AuthContextType {
  user: User | null;
  session: AuthSession | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const currentSession = await authService.getSession();
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const newSession = await authService.login(email, password);
    setSession(newSession);
    setUser(newSession.user);
  };

  const logout = async () => {
    await authService.logout();
    setSession(null);
    setUser(null);
  };

  const refreshSession = async () => {
    const currentSession = await authService.getSession();
    if (currentSession) {
      setSession(currentSession);
      setUser(currentSession.user);
    } else {
      setSession(null);
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    isAuthenticated: user !== null,
    isAdmin: user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN',
    login,
    logout,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
