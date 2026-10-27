import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://akpwmnwobtklairoguem.supabase.co';

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrcHdtbndvYnRrbGFpcm9ndWVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0ODExMjgsImV4cCI6MjEwODA1NzEyOH0.KIqEDziBCRVqY5W56UiQAKA_mePwYjUFxYvRTDh1194';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
