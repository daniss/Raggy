'use client';

import React from 'react';
import { 
  MessageSquare,
  Home,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
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
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
  const { user, signOut } = useAuth();
  const router = useRouter();
  
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
      router.push('/auth/login');
    } catch (err) {
      setError('Erreur lors de la déconnexion');
      setIsSigningOut(false);
    }
  };

  const navigation = [
    {
      name: 'Assistant IA',
      href: '/assistant',
      icon: MessageSquare,
      current: pathname === '/assistant',
      badge: 'Nouveau'
    },
    {
      name: 'Tableau de bord',
      href: '/admin',
      icon: Home,
      current: pathname === '/admin'
    },
    {
      name: 'Documents',
      href: '/admin/documents',
      icon: FileText,
      current: pathname === '/admin/documents'
    },
    {
      name: 'Paramètres',
      href: '/admin/settings', 
      icon: Settings,
      current: pathname === '/admin/settings'
    }
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
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
        
        {/* Mobile sidebar */}
        <div className={cn(
          "fixed inset-0 flex z-40 lg:hidden",
          sidebarOpen ? "block" : "hidden"
        )}>
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-6 w-6 text-white" />
              </Button>
            </div>
            
            <Sidebar navigation={navigation} organization={organization} />
          </div>
        </div>

        {/* Static sidebar for desktop */}
        <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
          <Sidebar navigation={navigation} organization={organization} />
        </div>

        {/* Main content */}
        <div className="lg:pl-64 flex flex-col flex-1">
          {/* Top bar */}
          <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
            <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-6 w-6" />
              </Button>
              
              <div className="flex-1 flex items-center justify-center lg:justify-start">
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
          <main className="flex-1 flex overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function Sidebar({ navigation, organization }: { navigation: any[], organization: OrganizationInfo | null }) {
  const { user } = useAuth();
  
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white border-r border-gray-200">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <h1 className="text-xl font-semibold text-gray-900">
            Raggy
          </h1>
        </div>
        
        <nav className="mt-8 flex-1 px-2 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                item.current
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors'
              )}
            >
              <item.icon
                className={cn(
                  item.current ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-500',
                  'mr-3 flex-shrink-0 h-6 w-6'
                )}
              />
              {item.name}
              {item.badge && (
                <Badge variant="secondary" className="ml-auto">
                  {item.badge}
                </Badge>
              )}
            </Link>
          ))}
        </nav>
      </div>
      
      <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
        <div className="flex-shrink-0 group block w-full">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-gray-600" />
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-700 truncate">
                {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Utilisateur'}
              </p>
              <p className="text-xs font-medium text-gray-500 truncate">
                {user?.email || 'user@example.com'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}