'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useWallet } from './WalletContext';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const { accountAddress } = useWallet();

  const logout = useCallback(async () => {
    console.log('AuthContext: logout called');
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
  }, []);
  
  useEffect(() => {
    // If we have a logged-in user session, but the wallet changed to something else
    if (user?.walletAddress && accountAddress && user.walletAddress !== accountAddress) {
      console.warn('AuthContext: Wallet mismatch detected. Clearing stale session...');
      logout(); // This should call your logout API and clear the cookie
    }
  }, [accountAddress, user, logout]);

  // Check session on mount
  useEffect(() => {
    console.log('AuthContext: Initial mount - checking session');
    checkSession();
  }, []);

const checkSession = async () => {
  try {
    console.log('AuthContext: checkSession called');
    const response = await fetch('/api/auth/session');
    
    console.log('AuthContext: Response status:', response.status, response.ok);
    
    if (response.ok) {
      const data = await response.json();
      console.log('AuthContext: Full session response:', JSON.stringify(data, null, 2));
      console.log('AuthContext: data.user exists?', !!data.user);
      
      if (data.user) {
        console.log('AuthContext: ✅ Setting user:', data.user);
        setUser(data.user);
        setToken(data.token);
        console.log('AuthContext: ✅ User state updated');
      } else {
        console.log('AuthContext: ❌ No user in session response');
        console.log('AuthContext: Response keys:', Object.keys(data));
      }
    } else {
      console.log('AuthContext: ❌ Session check failed with status:', response.status);
    }
  } catch (error) {
    console.error('AuthContext: Session check error:', error);
  } finally {
    setLoading(false);
    console.log('AuthContext: Loading complete');
  }
};



  const login = useCallback(async (authToken, userData) => {
    console.log('AuthContext: login called');
    setToken(authToken);
    setUser(userData);
    localStorage.setItem('auth_token', authToken);
  }, []);

  const updateUser = useCallback((userData) => {
    console.log('AuthContext: updateUser called');
    setUser(prev => ({ ...prev, ...userData }));
  }, []);

  const getAuthHeader = useCallback(() => {
    const storedToken = token || localStorage.getItem('auth_token');
    return storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
  }, [token]);

  const value = {
    user,
    loading,
    token,
    isAuthenticated: !!user,
    login,
    logout,
    updateUser,
    getAuthHeader,
    checkSession
  };

  console.log('AuthContext: Current state -', { 
    hasUser: !!user, 
    loading, 
    isAuthenticated: !!user 
  });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
