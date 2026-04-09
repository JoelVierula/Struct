import { createClient } from '@supabase/supabase-js';

// Replace with your Supabase URL and Anon key
const SUPABASE_URL = 'https://omigxszvhmgeorbupspa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9taWd4c3p2aG1nZW9yYnVwc3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMDEwNTksImV4cCI6MjA4MDc3NzA1OX0.uyJDqBcCtoVJuPTeIshhU_D__2PJMKeKTpS9rkJWX6g';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
