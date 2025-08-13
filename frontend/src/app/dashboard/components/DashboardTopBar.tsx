'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Bell,
  Plus,
  Upload,
  MessageCircle,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Moon,
  Sun,
  Globe,
  AlertCircle,
  CheckCircle,
  Info,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  onClick?: () => void;
  color: string;
}

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

const quickActions: QuickAction[] = [
  {
    id: 'upload',
    label: 'Upload document',
    icon: Upload,
    href: '/dashboard/documents',
    color: 'text-blue-600 bg-blue-50 hover:bg-blue-100'
  },
  {
    id: 'chat',
    label: 'Assistant',
    icon: MessageCircle,
    href: '/demo-assistant',
    color: 'text-green-600 bg-green-50 hover:bg-green-100'
  }
];

// Mock notifications - replace with real data
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'warning',
    title: 'Quota documents à 85%',
    message: 'Vous approchez de votre limite de documents (425/500)',
    timestamp: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
    read: false
  },
  {
    id: '2',
    type: 'success',
    title: 'Index optimisé',
    message: 'L\'index principal a été optimisé avec succès',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
    read: true
  },
  {
    id: '3',
    type: 'info',
    title: 'Nouvel utilisateur',
    message: 'Marie Dubois a rejoint votre organisation',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4h ago
    read: true
  }
];

export default function DashboardTopBar() {
  const { user, profile, signOut } = useAuth();
  const { organization } = useOrganization();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState(mockNotifications);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'info': return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  };

  const removeNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowUserMenu(false);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <div className="flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200">
      {/* Left section - Search */}
      <div className="flex items-center flex-1 max-w-md">
        <div className={cn(
          "relative flex-1 transition-all duration-200",
          isSearchFocused && "ring-2 ring-blue-500 ring-opacity-50 rounded-lg"
        )}>
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Rechercher documents, conversations, utilisateurs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="pl-10 pr-4 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
          />
          {isSearchFocused && searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              <div className="p-2 text-sm text-gray-500">
                Recherche en cours...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center section - Quick actions */}
      <div className="flex items-center gap-2 mx-6">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.id}
              variant="ghost"
              size="sm"
              className={cn("flex items-center gap-2", action.color)}
              onClick={action.onClick}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden lg:inline">{action.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Right section - Environment, notifications, user */}
      <div className="flex items-center gap-4">
        {/* Environment badge */}
        <Badge variant="outline" className="text-xs">
          <Globe className="w-3 h-3 mr-1" />
          Production
        </Badge>

        {/* Data residency indicator */}
        {organization?.settings && (
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs",
              organization.settings.dataResidency === 'france' && "border-blue-500 text-blue-700",
              organization.settings.hdsCompliant && "border-green-500 text-green-700"
            )}
          >
            {organization.settings.dataResidency === 'france' ? '🇫🇷 France' : '🇪🇺 UE'}
            {organization.settings.hdsCompliant && ' • HDS'}
          </Badge>
        )}

        {/* Notifications */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 text-xs p-0 flex items-center justify-center bg-red-500">
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
              >
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Notifications</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNotifications(false)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      Aucune notification
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          "p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer",
                          !notification.read && "bg-blue-50 border-l-4 border-l-blue-500"
                        )}
                        onClick={() => markAsRead(notification.id)}
                      >
                        <div className="flex items-start gap-3">
                          {getNotificationIcon(notification.type)}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900">
                              {notification.title}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {notification.message}
                            </div>
                            <div className="text-xs text-gray-500 mt-2">
                              {notification.timestamp.toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNotification(notification.id);
                            }}
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {notifications.length > 0 && (
                  <div className="p-4 border-t border-gray-200">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-center text-sm"
                      onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                    >
                      Marquer tout comme lu
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User menu */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2"
          >
            <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.full_name || 'User'} 
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <User className="w-4 h-4 text-blue-600" />
              )}
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </Button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
              >
                <div className="p-4 border-b border-gray-200">
                  <div className="text-sm font-medium text-gray-900">
                    {profile?.full_name || user?.email?.split('@')[0] || 'User'}
                  </div>
                  <div className="text-xs text-gray-500">{user?.email}</div>
                </div>

                <div className="py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start px-4 py-2"
                  >
                    <Settings className="w-4 h-4 mr-3" />
                    Paramètres du compte
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start px-4 py-2"
                  >
                    <Moon className="w-4 h-4 mr-3" />
                    Mode sombre
                  </Button>
                </div>

                <div className="border-t border-gray-200 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Se déconnecter
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}