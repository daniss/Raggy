export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      chat_logs: {
        Row: {
          id: string
          created_at: string
          user_id: string
          question: string
          answer: string
          sources: Json
          response_time: number
          conversation_id?: string
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          question: string
          answer: string
          sources: Json
          response_time: number
          conversation_id?: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          question?: string
          answer?: string
          sources?: Json
          response_time?: number
          conversation_id?: string
        }
      }
      documents: {
        Row: {
          id: string
          created_at: string
          filename: string
          content_type: string
          size_bytes: number
          uploaded_by: string
          chunks_count: number
          status: 'processing' | 'completed' | 'error'
        }
        Insert: {
          id?: string
          created_at?: string
          filename: string
          content_type: string
          size_bytes: number
          uploaded_by: string
          chunks_count?: number
          status?: 'processing' | 'completed' | 'error'
        }
        Update: {
          id?: string
          created_at?: string
          filename?: string
          content_type?: string
          size_bytes?: number
          uploaded_by?: string
          chunks_count?: number
          status?: 'processing' | 'completed' | 'error'
        }
      }
      user_profiles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          email: string
          full_name?: string
          avatar_url?: string
          role: 'user' | 'admin'
          settings: Json
        }
        Insert: {
          id: string
          created_at?: string
          updated_at?: string
          email: string
          full_name?: string
          avatar_url?: string
          role?: 'user' | 'admin'
          settings?: Json
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          email?: string
          full_name?: string
          avatar_url?: string
          role?: 'user' | 'admin'
          settings?: Json
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types
export type ChatLog = Database['public']['Tables']['chat_logs']['Row']
export type DocumentRecord = Database['public']['Tables']['documents']['Row']
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']

export type InsertChatLog = Database['public']['Tables']['chat_logs']['Insert']
export type InsertDocument = Database['public']['Tables']['documents']['Insert']
export type InsertUserProfile = Database['public']['Tables']['user_profiles']['Insert']

export type UpdateChatLog = Database['public']['Tables']['chat_logs']['Update']
export type UpdateDocument = Database['public']['Tables']['documents']['Update']
export type UpdateUserProfile = Database['public']['Tables']['user_profiles']['Update']