'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface DemoSession {
  token: string;
  email: string;
  company: string;
  documents?: any[];
  sampleQuestions?: string[];
  expiresAt: number;
}

interface DemoContextType {
  demoSession: DemoSession | null;
  loading: boolean;
  error: string | null;
  setDemoSession: (session: DemoSession | null) => void;
  clearDemoSession: () => void;
  isDemoSessionValid: () => boolean;
  refreshDemoSession: () => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [demoSession, setDemoSessionState] = useState<DemoSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load demo session from localStorage on mount
  useEffect(() => {
    loadDemoSession();
  }, []);

  const loadDemoSession = () => {
    try {
      setLoading(true);
      setError(null);
      
      const storedSession = localStorage.getItem('demoSession');
      if (storedSession) {
        const session = JSON.parse(storedSession);
        
        // Check if session is expired
        if (Date.now() > session.expiresAt) {
          console.log('Demo session expired, removing');
          localStorage.removeItem('demoSession');
          setDemoSessionState(null);
        } else {
          console.log('Demo session loaded:', session.email);
          setDemoSessionState(session);
        }
      } else {
        setDemoSessionState(null);
      }
    } catch (error) {
      console.error('Error loading demo session:', error);
      setError('Failed to load demo session');
      localStorage.removeItem('demoSession');
      setDemoSessionState(null);
    } finally {
      setLoading(false);
    }
  };

  const setDemoSession = (session: DemoSession | null) => {
    try {
      setError(null);
      
      if (session) {
        // Store in localStorage
        localStorage.setItem('demoSession', JSON.stringify(session));
        setDemoSessionState(session);
        console.log('Demo session set:', session.email);
      } else {
        // Clear session
        localStorage.removeItem('demoSession');
        setDemoSessionState(null);
        console.log('Demo session cleared');
      }
    } catch (error) {
      console.error('Error setting demo session:', error);
      setError('Failed to save demo session');
    }
  };

  const clearDemoSession = () => {
    try {
      localStorage.removeItem('demoSession');
      setDemoSessionState(null);
      setError(null);
      console.log('Demo session cleared');
    } catch (error) {
      console.error('Error clearing demo session:', error);
      setError('Failed to clear demo session');
    }
  };

  const isDemoSessionValid = (): boolean => {
    if (!demoSession) return false;
    return Date.now() < demoSession.expiresAt;
  };

  const refreshDemoSession = () => {
    loadDemoSession();
  };

  const value = {
    demoSession,
    loading,
    error,
    setDemoSession,
    clearDemoSession,
    isDemoSessionValid,
    refreshDemoSession,
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
}

// Demo-specific API helper
export const callDemoApi = async (endpoint: string, options: RequestInit = {}) => {
  const demoSession = JSON.parse(localStorage.getItem('demoSession') || 'null');
  
  if (!demoSession || Date.now() > demoSession.expiresAt) {
    throw new Error('Demo session expired');
  }

  // Prepare headers - don't set Content-Type for FormData (let browser handle it)
  const headers: Record<string, string> = {
    'X-Demo-Session': demoSession.token,
    ...(options.headers as Record<string, string> || {}),
  };

  // Only set Content-Type for non-FormData requests
  const isFormData = options.body instanceof FormData;
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/v1/demo${endpoint}`,
    {
      ...options,
      headers,
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      // Demo session expired
      localStorage.removeItem('demoSession');
      throw new Error('Demo session expired');
    }
    throw new Error(`Demo API error: ${response.status} ${response.statusText}`);
  }

  return response;
};