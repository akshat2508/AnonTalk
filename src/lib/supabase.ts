import { createClient } from '@supabase/supabase-js';
import { supabaseUrl , supabaseAnonKey } from '../config/config';



export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string;
          mood: 'happy' | 'sad' | 'excited' | 'anxious' | 'calm' | 'angry';
          user1_id: string | null;
          user2_id: string | null;
          status: 'waiting' | 'active' | 'ended';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          mood: 'happy' | 'sad' | 'excited' | 'anxious' | 'calm' | 'angry';
          user1_id?: string | null;
          user2_id?: string | null;
          status?: 'waiting' | 'active' | 'ended';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          mood?: 'happy' | 'sad' | 'excited' | 'anxious' | 'calm' | 'angry';
          user1_id?: string | null;
          user2_id?: string | null;
          status?: 'waiting' | 'active' | 'ended';
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          room_id: string;
          sender_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          sender_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          sender_id?: string;
          content?: string;
          created_at?: string;
        };
      };
    };
  };
};