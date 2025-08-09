'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTheme, ConditionalFeature } from './ThemeProvider';

interface BrandedHeaderProps {
  className?: string;
  showNavigation?: boolean;
  showUserMenu?: boolean;
  children?: React.ReactNode;
}

export function BrandedHeader({ 
  className = '', 
  showNavigation = true, 
  showUserMenu = true,
  children 
}: BrandedHeaderProps) {
  const { 
    theme, 
    companyName, 
    logoPath, 
    showPoweredBy, 
    isFeatureEnabled,
    getColor 
  } = useTheme();

  const headerStyle = {
    backgroundColor: getColor('background'),
    borderBottomColor: getColor('border'),
    color: getColor('foreground')
  };

  return (
    <header 
      className={`border-b sticky top-0 z-50 backdrop-blur-sm bg-opacity-95 ${className}`}
      style={headerStyle}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Company Name */}
          <Link href="/" className="flex items-center space-x-3">
            <Image
              src={logoPath}
              alt={`${companyName} Logo`}
              width={32}
              height={32}
              className="h-8 w-auto"
              style={{ filter: theme.theme === 'dark' ? 'brightness(0) invert(1)' : 'none' }}
            />
            <span 
              className="text-xl font-bold"
              style={{ 
                fontFamily: theme.fonts.heading,
                color: getColor('primary')
              }}
            >
              {companyName}
            </span>
          </Link>

          {/* Navigation */}
          {showNavigation && (
            <nav className="hidden md:flex items-center space-x-6">
              <ConditionalFeature feature="chat_interface">
                <NavLink href="/assistant">Assistant</NavLink>
              </ConditionalFeature>
              
              <ConditionalFeature feature="document_upload">
                <NavLink href="/documents">Documents</NavLink>
              </ConditionalFeature>
              
              <ConditionalFeature feature="analytics">
                <NavLink href="/analytics">Analytics</NavLink>
              </ConditionalFeature>
              
              <ConditionalFeature feature="admin_panel">
                <NavLink href="/admin">Administration</NavLink>
              </ConditionalFeature>
            </nav>
          )}

          {/* Right Side Content */}
          <div className="flex items-center space-x-4">
            {children}
            
            {showUserMenu && <UserMenu />}
          </div>
        </div>
      </div>

      {/* Powered By Notice */}
      {showPoweredBy && (
        <div 
          className="text-xs text-center py-1 border-t"
          style={{ 
            backgroundColor: getColor('muted'),
            borderTopColor: getColor('border'),
            color: getColor('secondary')
          }}
        >
          Powered by RAG Platform
        </div>
      )}
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const { getColor, theme } = useTheme();
  
  const linkStyle = {
    color: getColor('foreground'),
    fontFamily: theme.fonts.body,
  };

  return (
    <Link 
      href={href}
      className="px-3 py-2 rounded-md text-sm font-medium hover:opacity-75 transition-opacity"
      style={linkStyle}
    >
      {children}
    </Link>
  );
}

function UserMenu() {
  const { getColor, theme } = useTheme();
  
  // This would typically integrate with your auth system
  return (
    <div className="relative">
      <button
        className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium hover:opacity-75 transition-opacity"
        style={{ 
          color: getColor('foreground'),
          fontFamily: theme.fonts.body 
        }}
      >
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
          <span className="text-sm font-semibold">U</span>
        </div>
        <span>User</span>
      </button>
    </div>
  );
}

// Specialized header variants
export function ChatHeader() {
  const { companyName, showLogoInChat, logoPath } = useTheme();
  
  if (!showLogoInChat) return null;
  
  return (
    <div className="flex items-center space-x-3 p-4 border-b">
      <Image
        src={logoPath}
        alt={`${companyName} Logo`}
        width={24}
        height={24}
        className="h-6 w-auto"
      />
      <span className="font-semibold text-sm">{companyName} Assistant</span>
    </div>
  );
}

export function AdminHeader() {
  const { companyName, getColor } = useTheme();
  
  return (
    <BrandedHeader>
      <div 
        className="px-3 py-1 rounded-full text-xs font-medium"
        style={{
          backgroundColor: getColor('accent'),
          color: getColor('background')
        }}
      >
        Admin
      </div>
    </BrandedHeader>
  );
}

export function MinimalHeader({ title }: { title?: string }) {
  const { companyName, logoPath, getColor, theme } = useTheme();
  
  return (
    <header 
      className="border-b"
      style={{
        backgroundColor: getColor('background'),
        borderBottomColor: getColor('border')
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center space-x-3">
            <Image
              src={logoPath}
              alt={`${companyName} Logo`}
              width={24}
              height={24}
              className="h-6 w-auto"
            />
            <div>
              <span 
                className="font-semibold text-sm"
                style={{ 
                  fontFamily: theme.fonts.heading,
                  color: getColor('primary')
                }}
              >
                {companyName}
              </span>
              {title && (
                <span 
                  className="text-sm ml-2"
                  style={{ color: getColor('secondary') }}
                >
                  · {title}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}