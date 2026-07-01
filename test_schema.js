import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fliphfrxuhmhnxtmettd.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// Need to read from .env if possible
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('session_logs').select('*').limit(1);
  console.log("Error:", error);
  if (data && data.length > 0) {
    console.log("Keys:", Object.keys(data[0]));
  }
}
check();
