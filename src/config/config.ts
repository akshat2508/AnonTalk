
// export const supabaseUrl = process.env.SUPABASE_URL!; // Replace with your URL
// export const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

import Constants from 'expo-constants';

export const supabaseUrl = Constants.expoConfig?.extra?.SUPABASE_URL!;
export const supabaseAnonKey = Constants.expoConfig?.extra?.SUPABASE_ANON_KEY!;
