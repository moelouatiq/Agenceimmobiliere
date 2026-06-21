import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const supabase = createClient<Database>(
  'https://uetqevnstmnigxvjpcut.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldHFldm5zdG1uaWd4dmpwY3V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjAwODIsImV4cCI6MjA5NzUzNjA4Mn0.QKvM-DVeerse0yBcsC75a-c6QqMLTd5LAVGiutjFuhM',
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
