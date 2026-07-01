import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve('.env');
const envFile = fs.readFileSync(envPath, 'utf8');

const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key) env[key.trim()] = values.join('=').trim().replace(/^"|"$/g, '');
});

const url = env['VITE_SUPABASE_URL'];
const key = env['VITE_SUPABASE_PUBLISHABLE_KEY'];

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('profiles').select('id, first_name, last_name, role, email');
  console.log("Profiles Error:", error);
  console.log("Profiles Data:", data);

  const { data: staffData, error: staffError } = await supabase.from('staff').select('id, first_name, last_name, role, email');
  console.log("Staff Error:", staffError);
  console.log("Staff Data:", staffData);
}
check();
