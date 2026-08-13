/**
 * Authentication Service
 * 
 * Handles all authentication operations including login, logout, and session management
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/apiClient';
import config from '../../mobile-config';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'USER' | 'CUSTOM';
  customRoleId?: string;
}

export interface AuthSession {
  user: User;
  expires: string;
}

class AuthService {
  /**
   * Login with email and password via NextAuth credentials flow.
   *
   * NextAuth uses cookie-based sessions. The mobile flow:
   *  1. GET /api/auth/csrf  → get a csrfToken
   *  2. POST /api/auth/callback/credentials  with {csrfToken, email, password, json: "true"}
   *  3. Server sets a session cookie; all subsequent requests carry it automatically
   *     via axios's withCredentials setting (handled by the cookie jar on the device).
   *  4. GET /api/auth/session to confirm and fetch the user object.
   */
  async login(email: string, password: string): Promise<AuthSession> {
    try {
      // Step 1 — get CSRF token (required by NextAuth)
      const csrfResponse = await apiClient.get<{ csrfToken: string }>('/api/auth/csrf');
      const csrfToken = csrfResponse?.csrfToken;
      if (!csrfToken) {
        throw new Error('Could not obtain security token from server');
      }

      // Step 2 — submit credentials to NextAuth callback
      // "json=true" tells NextAuth to return JSON instead of redirecting
      await apiClient.post(
        '/api/auth/callback/credentials',
        new URLSearchParams({
          csrfToken,
          email,
          password,
          json: 'true',
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          // Follow the redirect that NextAuth returns after sign-in
          maxRedirects: 5,
          withCredentials: true,
        } as any
      );

      // Step 3 — fetch the now-active session
      const serverSession = await apiClient.get<any>('/api/auth/session');
      if (serverSession?.user) {
        const session: AuthSession = {
          user: serverSession.user,
          expires: serverSession.expires || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
        await AsyncStorage.setItem(config.storageKeys.userSession, JSON.stringify(session));
        return session;
      }

      throw new Error('Invalid email or password');
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Invalid email or password');
      }
      throw new Error(error.message || 'Login failed');
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<AuthSession | null> {
    try {
      // Check local storage first
      const storedSession = await AsyncStorage.getItem(
        config.storageKeys.userSession
      );

      if (storedSession) {
        const session: AuthSession = JSON.parse(storedSession);
        
        // Check if session is expired
        if (new Date(session.expires) > new Date()) {
          // Verify with server
          try {
            const serverSession = await apiClient.get('/api/auth/session');
            if (serverSession?.user) {
              // Update local session
              const updatedSession: AuthSession = {
                user: serverSession.user,
                expires: serverSession.expires || session.expires,
              };
              await AsyncStorage.setItem(
                config.storageKeys.userSession,
                JSON.stringify(updatedSession)
              );
              return updatedSession;
            }
          } catch (error) {
            // Server session invalid, but keep local for offline
            return session;
          }
        }
      }

      // Try to get session from server
      const serverSession = await apiClient.get('/api/auth/session');
      if (serverSession?.user) {
        const session: AuthSession = {
          user: serverSession.user,
          expires: serverSession.expires || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
        await AsyncStorage.setItem(
          config.storageKeys.userSession,
          JSON.stringify(session)
        );
        return session;
      }

      return null;
    } catch (error) {
      // Not authenticated
      return null;
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await apiClient.logout();
    } catch (error) {
      // Continue with local logout even if API call fails
      console.error('Logout API error:', error);
    } finally {
      // Clear local storage
      await AsyncStorage.removeItem(config.storageKeys.authToken);
      await AsyncStorage.removeItem(config.storageKeys.userSession);
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return session !== null;
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    const session = await this.getSession();
    return session?.user || null;
  }

  /**
   * Check if user has admin role
   */
  async isAdmin(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  }

  /**
   * Forgot password
   */
  async forgotPassword(email: string): Promise<void> {
    await apiClient.post('/api/auth/forgot-password', { email });
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    await apiClient.post('/api/auth/reset-password', {
      token,
      password: newPassword,
    });
  }

  /**
   * Change password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    await apiClient.post('/api/auth/change-password', {
      currentPassword,
      newPassword,
    });
  }
}

export default new AuthService();
