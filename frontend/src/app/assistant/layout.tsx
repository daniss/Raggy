'use client';

import React from 'react';
import { 
  Home,
  LogOut,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import { organizationApi, type OrganizationInfo } from '@/utils/api';

interface AssistantLayoutProps {
  children: React.ReactNode;
}

export default function AssistantLayout({ children }: AssistantLayoutProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
  const { user, signOut } = useAuth();
  
  useEffect(() => {
    loadOrganization();
  }, []);

  const loadOrganization = async () => {
    try {
      const org = await organizationApi.getCurrentOrganization();
      setOrganization(org);
    } catch (err) {
      console.error('Failed to load organization:', err);
    }
  };
  
  const handleSignOut = async () => {
    setIsSigningOut(true);
    setError(null);
    
    try {
      await signOut();
      window.location.href = '/auth/login';
    } catch (err) {
      setError('Erreur lors de la déconnexion');
      setIsSigningOut(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
        {/* Error Alert */}
        {error && (
          <div className="fixed top-4 right-4 z-50 max-w-md">
            <ErrorAlert 
              title="Erreur"
              message={error}
              onDismiss={() => setError(null)}
            />
          </div>
        )}
        
        {/* Main content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Top bar */}
          <div className="flex-shrink-0 bg-white shadow-sm border-b border-gray-200">
            <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
              <Link href="/admin">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Home className="h-4 w-4" />
                  <span>Tableau de bord</span>
                </Button>
              </Link>
              
              <div className="flex-1 flex items-center justify-center">
                <h1 className="text-xl font-semibold text-gray-900">
                  Assistant IA Privé
                </h1>
              </div>
              
              <div className="flex items-center space-x-4">
                {organization && (
                  <Badge variant="secondary" className="hidden sm:flex">
                    <Building2 className="w-3 h-3 mr-1" />
                    {organization.name}
                  </Badge>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                >
                  {isSigningOut ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Déconnexion...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Déconnexion</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Page content */}
          <main className="flex-1 overflow-hidden flex flex-col">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}