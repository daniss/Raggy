'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: Theme;
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = 'light' }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Load theme from localStorage on mount
    const savedTheme = localStorage.getItem('raggy-theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    // Calculate effective theme based on theme setting and system preference
    const calculateEffectiveTheme = (): 'light' | 'dark' => {
      if (theme === 'auto') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return theme as 'light' | 'dark';
    };

    const updateEffectiveTheme = () => {
      const newEffectiveTheme = calculateEffectiveTheme();
      setEffectiveTheme(newEffectiveTheme);
      
      // Update document class for CSS styling
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(newEffectiveTheme);
      
      // Update meta theme-color for mobile browsers
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', newEffectiveTheme === 'dark' ? '#1a1a1a' : '#ffffff');
      }
    };

    updateEffectiveTheme();

    // Listen for system theme changes when in auto mode
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', updateEffectiveTheme);
      return () => mediaQuery.removeEventListener('change', updateEffectiveTheme);
    }
  }, [theme]);

  useEffect(() => {
    // Save theme to localStorage
    localStorage.setItem('raggy-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(current => {
      if (current === 'light') return 'dark';
      if (current === 'dark') return 'auto';
      return 'light';
    });
  };

  const value: ThemeContextType = {
    theme,
    effectiveTheme,
    setTheme,
    toggleTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}