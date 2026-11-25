import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { UserProfile } from '../types';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const cached = await api.getUser();
      if (cached) {
        setUser(cached);
      }
      const token = await api.initToken();
      if (token) {
        const res = await api.getProfile();
        if (res.user) {
          setUser(res.user);
          await api.setUser(res.user);
        }
      }
    } catch (err) {
      console.log('[useAuth] Not logged in or session expired');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password?: string) => {
    const res = await api.login(email, password);
    setUser(res.user);
    return res;
  };

  const register = async (fullName: string, email: string, password?: string) => {
    const res = await api.register(fullName, email, password);
    setUser(res.user);
    return res;
  };

  const logout = async () => {
    await api.clearAuth();
    setUser(null);
  };

  return {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    register,
    logout,
    refreshUser: checkAuth,
  };
}

