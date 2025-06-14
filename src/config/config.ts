
// export const supabaseUrl = process.env.SUPABASE_URL!; // Replace with your URL
// export const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

// import Constants from 'expo-constants';

// export const supabaseUrl = Constants.expoConfig?.extra?.SUPABASE_URL!;
// export const supabaseAnonKey = Constants.expoConfig?.extra?.SUPABASE_ANON_KEY!;


import Constants from 'expo-constants';

// Add fallback values and error handling
export const supabaseUrl = Constants.expoConfig?.extra?.SUPABASE_URL || 
  Constants.manifest?.extra?.SUPABASE_URL || 
  process.env.SUPABASE_URL || 
  'https://gpaigfioahcpzixczdjj.supabase.co'; // Your actual URL as fallback

export const supabaseAnonKey = Constants.expoConfig?.extra?.SUPABASE_ANON_KEY || 
  Constants.manifest?.extra?.SUPABASE_ANON_KEY || 
  process.env.SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwYWlnZmlvYWhjcHppeGN6ZGpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNzA3MjMsImV4cCI6MjA2NDg0NjcyM30.Tb9QRetXx4CLkoH9xZylovvDuzIphKl8_xKnO2tCFTg'; // Your actual key as fallback

