'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { createClient } from '@/utils/supabase';
import { useOrganization } from './OrganizationContext';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'security' | 'billing' | 'system' | 'analytics' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  read: boolean;
  action_url?: string;
  action_text?: string;
  metadata?: Record<string, any>;
  created_at: string;
  expires_at?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  
  // Actions
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  
  // Toast helpers
  showToast: {
    success: (message: string, options?: any) => void;
    error: (message: string, options?: any) => void;
    warning: (message: string, options?: any) => void;
    info: (message: string, options?: any) => void;
    loading: (message: string) => string;
    dismiss: (toastId: string) => void;
  };
  
  // Real-time
  subscribe: () => void;
  unsubscribe: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { organization } = useOrganization();
  
  const supabase = createClient();

  // Mock notifications data - in real implementation, this would come from the database
  const mockNotifications: Notification[] = [
    {
      id: '1',
      title: 'Security Alert',
      message: 'Unusual login activity detected from a new location',
      type: 'warning',
      category: 'security',
      priority: 'high',
      read: false,
      action_url: '/dashboard/security',
      action_text: 'Review',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    },
    {
      id: '2',
      title: 'Quota Warning',
      message: 'You have used 85% of your monthly query quota',
      type: 'warning',
      category: 'billing',
      priority: 'medium',
      read: false,
      action_url: '/dashboard/billing',
      action_text: 'Upgrade Plan',
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    },
    {
      id: '3',
      title: 'New Document Processed',
      message: 'Guide_RGPD_2024.pdf has been successfully processed and indexed',
      type: 'success',
      category: 'general',
      priority: 'low',
      read: true,
      action_url: '/dashboard/documents',
      action_text: 'View',
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    },
    {
      id: '4',
      title: 'System Maintenance',
      message: 'Scheduled maintenance will occur tomorrow from 2-4 AM UTC',
      type: 'info',
      category: 'system',
      priority: 'low',
      read: false,
      created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
    },
    {
      id: '5',
      title: 'Analytics Report Ready',
      message: 'Your weekly analytics report is now available',
      type: 'info',
      category: 'analytics',
      priority: 'low',
      read: true,
      action_url: '/dashboard/analytics',
      action_text: 'View Report',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    },
  ];

  // Load notifications
  useEffect(() => {
    if (organization) {
      // In a real implementation, you would fetch from your notifications table
      // For now, using mock data with a delay to simulate loading
      setLoading(true);
      setTimeout(() => {
        setNotifications(mockNotifications);
        setLoading(false);
      }, 500);
    }
  }, [organization?.id]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    
    // In real implementation, update in database
    // await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
  };

  // Mark all as read
  const markAllAsRead = async () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
    
    // In real implementation, update in database
    // await supabase.from('notifications').update({ read: true }).eq('organization_id', organization?.id);
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    setNotifications(prev =>
      prev.filter(n => n.id !== notificationId)
    );
    
    // In real implementation, delete from database
    // await supabase.from('notifications').delete().eq('id', notificationId);
  };

  // Clear all notifications
  const clearAll = async () => {
    setNotifications([]);
    
    // In real implementation, delete from database
    // await supabase.from('notifications').delete().eq('organization_id', organization?.id);
  };

  // Toast helpers
  const showToast = {
    success: (message: string, options?: any) => {
      toast.success(message, {
        duration: 4000,
        position: 'top-right',
        ...options,
      });
    },
    error: (message: string, options?: any) => {
      toast.error(message, {
        duration: 6000,
        position: 'top-right',
        ...options,
      });
    },
    warning: (message: string, options?: any) => {
      toast(message, {
        icon: '⚠️',
        duration: 5000,
        position: 'top-right',
        style: {
          background: '#f59e0b',
          color: 'white',
        },
        ...options,
      });
    },
    info: (message: string, options?: any) => {
      toast(message, {
        icon: 'ℹ️',
        duration: 4000,
        position: 'top-right',
        style: {
          background: '#3b82f6',
          color: 'white',
        },
        ...options,
      });
    },
    loading: (message: string) => {
      return toast.loading(message, {
        position: 'top-right',
      });
    },
    dismiss: (toastId: string) => {
      toast.dismiss(toastId);
    },
  };

  // Real-time subscription (mock implementation)
  const subscribe = () => {
    if (!organization) return;

    // In real implementation, you would subscribe to real-time changes
    // const channel = supabase
    //   .channel('notifications')
    //   .on('postgres_changes', 
    //     { 
    //       event: 'INSERT', 
    //       schema: 'public', 
    //       table: 'notifications',
    //       filter: `organization_id=eq.${organization.id}` 
    //     }, 
    //     (payload) => {
    //       const newNotification = payload.new as Notification;
    //       setNotifications(prev => [newNotification, ...prev]);
          
    //       // Show toast for urgent notifications
    //       if (newNotification.priority === 'urgent') {
    //         showToast.warning(newNotification.title);
    //       }
    //     }
    //   )
    //   .subscribe();
    
    console.log('Subscribed to real-time notifications');
  };

  const unsubscribe = () => {
    // supabase.removeAllChannels();
    console.log('Unsubscribed from real-time notifications');
  };

  // Subscribe on mount, unsubscribe on unmount
  useEffect(() => {
    subscribe();
    return () => unsubscribe();
  }, [organization?.id]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    showToast,
    subscribe,
    unsubscribe,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Toaster />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

// Custom hook for showing API operation toasts
export function useApiToasts() {
  const { showToast } = useNotifications();

  const handleApiOperation = async <T,>(
    operation: () => Promise<T>,
    messages: {
      loading: string;
      success: string;
      error?: string;
    }
  ): Promise<T> => {
    const toastId = showToast.loading(messages.loading);
    
    try {
      const result = await operation();
      showToast.dismiss(toastId);
      showToast.success(messages.success);
      return result;
    } catch (error: any) {
      showToast.dismiss(toastId);
      const errorMessage = messages.error || error.message || 'Operation failed';
      showToast.error(errorMessage);
      throw error;
    }
  };

  return {
    handleApiOperation,
  };
}