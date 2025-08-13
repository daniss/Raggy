'use client';

import { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { OrganizationProvider } from './OrganizationContext';

interface OrganizationProviderWrapperProps {
  children: ReactNode;
}

export function OrganizationProviderWrapper({ children }: OrganizationProviderWrapperProps) {
  const { user } = useAuth();
  
  return (
    <OrganizationProvider user={user}>
      {children}
    </OrganizationProvider>
  );
}