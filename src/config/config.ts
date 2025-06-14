import Constants from 'expo-constants';

const getEnvVar = (key: string, fallback: string): string => {
  const fromExtra = Constants.expoConfig?.extra?.[key] || Constants.manifest?.extra?.[key];
  return fromExtra || fallback;
};

export const supabaseUrl = getEnvVar(
  'SUPABASE_URL',
  'https://gpaigfioahcpzixczdjj.supabase.co'
);

export const supabaseAnonKey = getEnvVar(
  'SUPABASE_ANON_KEY', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwYWlnZmlvYWhjcHppeGN6ZGpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNzA3MjMsImV4cCI6MjA2NDg0NjcyM30.Tb9QRetXx4CLkoH9xZylovvDuzIphKl8_xKnO2tCFTg'
);