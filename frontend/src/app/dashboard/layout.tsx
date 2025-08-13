'use client';

import React, { ReactNode, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import DashboardSidebar from './components/DashboardSidebar';
import DashboardTopBar from './components/DashboardTopBar';

interface DashboardLayoutProps {
  children: ReactNode;
}

function DashboardLayoutInner({ children }: DashboardLayoutProps) {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  return (
    <OrganizationProvider user={user}>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Sidebar */}
        <div className="bg-white border-r border-gray-200 fixed inset-y-0 left-0 z-30">
          <DashboardSidebar 
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Main content */}
        <div className={`flex-1 transition-all duration-300 ${
          sidebarCollapsed ? 'ml-20' : 'ml-[280px]'
        }`}>
          {/* Top bar */}
          <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
            <DashboardTopBar />
          </div>

          {/* Page content */}
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </OrganizationProvider>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <ProtectedRoute requireAuth={true} redirectTo="/login">
      <DashboardLayoutInner>
        {children}
      </DashboardLayoutInner>
    </ProtectedRoute>
  );
}