'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrandingConfig, ClientConfig, themeManager, generateThemeCSS } from '@/lib/theme-config';

interface ThemeContextType {
  theme: BrandingConfig;
  clientConfig: ClientConfig | null;
  updateTheme: (updates: Partial<BrandingConfig>) => void;
  getColor: (colorName: string) => string;
  getFont: (fontName: string) => string;
  isFeatureEnabled: (featureName: string) => boolean;
  companyName: string;
  logoPath: string;
  showPoweredBy: boolean;
  showLogoInChat: boolean;
  sidebarPosition: 'left' | 'right';
  layout: 'modern' | 'classic' | 'compact';
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: Partial<BrandingConfig>;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setTheme] = useState<BrandingConfig>(themeManager.getTheme());
  const [clientConfig, setClientConfig] = useState<ClientConfig | null>(themeManager.getClientConfig());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Apply initial theme if provided
    if (initialTheme) {
      themeManager.updateTheme(initialTheme);
    }

    // Load client configuration
    loadClientConfiguration();
  }, [initialTheme]);

  useEffect(() => {
    // Inject theme CSS into the document
    injectThemeCSS();
  }, [theme]);

  const loadClientConfiguration = async () => {
    try {
      const clientId = process.env.NEXT_PUBLIC_CLIENT_ID || getClientIdFromUrl() || 'template';
      
      const response = await fetch(`/api/v1/config/client/${clientId}`);
      if (response.ok) {
        const config = await response.json();
        setClientConfig(config);
        
        if (config.branding) {
          themeManager.updateTheme(config.branding);
          setTheme(themeManager.getTheme());
        }
      }
    } catch (error) {
      console.warn('Failed to load client configuration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getClientIdFromUrl = (): string | null => {
    if (typeof window === 'undefined') return null;
    
    // Try to extract client ID from subdomain (client.domain.com)
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    if (parts.length > 2) {
      return parts[0];
    }
    
    // Try to extract from URL path (/client/xyz/...)
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length > 2 && pathParts[1] === 'client') {
      return pathParts[2];
    }
    
    return null;
  };

  const injectThemeCSS = () => {
    if (typeof document === 'undefined') return;
    
    let styleElement = document.getElementById('dynamic-theme-css') as HTMLStyleElement;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'dynamic-theme-css';
      document.head.appendChild(styleElement);
    }
    
    styleElement.textContent = generateThemeCSS();
  };

  const updateTheme = (updates: Partial<BrandingConfig>) => {
    themeManager.updateTheme(updates);
    setTheme(themeManager.getTheme());
  };

  const contextValue: ThemeContextType = {
    theme,
    clientConfig,
    updateTheme,
    getColor: (colorName: string) => themeManager.getColorValue(colorName),
    getFont: (fontName: string) => themeManager.getFontValue(fontName),
    isFeatureEnabled: (featureName: string) => themeManager.isFeatureEnabled(featureName),
    companyName: themeManager.getCompanyName(),
    logoPath: themeManager.getLogoPath(),
    showPoweredBy: themeManager.shouldShowPoweredBy(),
    showLogoInChat: themeManager.shouldShowLogoInChat(),
    sidebarPosition: themeManager.getSidebarPosition(),
    layout: themeManager.getLayout(),
    isLoading
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      <div 
        className={`theme-${theme.theme} layout-${theme.layout}`}
        style={{
          '--font-family-heading': theme.fonts.heading,
          '--font-family-body': theme.fonts.body,
          '--font-family-mono': theme.fonts.mono,
        } as React.CSSProperties}
      >
        {children}
      </div>
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

// Higher-order component for theme-aware components
export function withTheme<P extends object>(
  Component: React.ComponentType<P & { theme: ThemeContextType }>
) {
  return function ThemedComponent(props: P) {
    const theme = useTheme();
    return <Component {...props} theme={theme} />;
  };
}

// Theme-aware styled component helper
export function createThemedComponent(
  element: keyof JSX.IntrinsicElements,
  baseClassName: string = '',
  getThemeClasses?: (theme: ThemeContextType) => string
) {
  return React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
    function ThemedComponent({ className, style, ...props }, ref) {
      const theme = useTheme();
      
      const themeClasses = getThemeClasses ? getThemeClasses(theme) : '';
      const combinedClassName = [baseClassName, themeClasses, className]
        .filter(Boolean)
        .join(' ');
      
      const themeAwareStyle = {
        ...style,
        '--primary-color': theme.getColor('primary'),
        '--secondary-color': theme.getColor('secondary'),
        '--accent-color': theme.getColor('accent'),
      } as React.CSSProperties;

      return React.createElement(element, {
        ...props,
        ref,
        className: combinedClassName,
        style: themeAwareStyle
      });
    }
  );
}

// Conditional rendering based on feature flags
export function ConditionalFeature({ 
  feature, 
  children, 
  fallback = null 
}: { 
  feature: string; 
  children: React.ReactNode; 
  fallback?: React.ReactNode; 
}) {
  const { isFeatureEnabled } = useTheme();
  
  return isFeatureEnabled(feature) ? <>{children}</> : <>{fallback}</>;
}

// Loading screen with theme awareness
export function ThemeAwareLoading() {
  const { theme, companyName } = useTheme();
  
  return (
    <div 
      className="fixed inset-0 flex items-center justify-center"
      style={{
        backgroundColor: theme.colors.background,
        color: theme.colors.foreground
      }}
    >
      <div className="text-center">
        <div 
          className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
          style={{
            borderColor: theme.colors.muted,
            borderTopColor: 'transparent'
          }}
        />
        <div 
          className="text-lg font-semibold"
          style={{ fontFamily: theme.fonts.heading }}
        >
          Chargement de {companyName}...
        </div>
      </div>
    </div>
  );
}