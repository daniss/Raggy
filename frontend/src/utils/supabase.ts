import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

// Client-side Supabase client
export const createClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

// Type definitions for auth
export type User = {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
};

export type Session = {
  access_token: string;
  refresh_token: string;
  user: User;
};

// Auth utilities
export const getUser = async () => {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  
  return user;
};

export const getSession = async () => {
  const supabase = createClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  
  return session;
};

export const signOut = async () => {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Error signing out:', error);
    return false;
  }
  
  return true;
};

export const signInWithEmail = async (email: string, password: string) => {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    console.error('Error signing in:', error);
    return { user: null, error: error.message };
  }
  
  return { user: data.user, error: null };
};

export const signUpWithEmail = async (email: string, password: string, metadata?: Record<string, any>) => {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata || {},
    },
  });
  
  if (error) {
    console.error('Error signing up:', error);
    return { user: null, error: error.message };
  }
  
  return { user: data.user, error: null };
};

export const resetPassword = async (email: string) => {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  
  if (error) {
    console.error('Error resetting password:', error);
    return { error: error.message };
  }
  
  return { error: null };
};

export const updatePassword = async (password: string) => {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({
    password,
  });
  
  if (error) {
    console.error('Error updating password:', error);
    return { error: error.message };
  }
  
  return { error: null };
};

// Database utilities
export const logChatInteraction = async (
  userId: string,
  question: string,
  answer: string,
  sources: any[],
  responseTime: number
) => {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('chat_logs')
    .insert({
      user_id: userId,
      question,
      answer,
      sources,
      response_time: responseTime,
    });
  
  if (error) {
    console.error('Error logging chat interaction:', error);
  }
};

export const getChatHistory = async (userId: string, limit: number = 50) => {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('chat_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error getting chat history:', error);
    return [];
  }
  
  return data || [];
};

export const getAnalyticsData = async (userId?: string) => {
  const supabase = createClient();
  
  let query = supabase
    .from('chat_logs')
    .select('*');
  
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error getting analytics data:', error);
    return [];
  }
  
  return data || [];
};