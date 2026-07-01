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
  const { data, error } = await supabase.from('session_logs').select('*').limit(1);
  console.log("Error:", error);
  if (data && data.length > 0) {
    console.log("Keys:", Object.keys(data[0]));
  } else if (data && data.length === 0) {
    // try to insert a dummy to see if it fails with 'action' or 'event' missing
    const { error: insErr } = await supabase.from('session_logs').insert({ user_id: '00000000-0000-0000-0000-000000000000', event: 'LOGIN' });
    console.log("Insert with event error:", insErr);
    const { error: insErr2 } = await supabase.from('session_logs').insert({ user_id: '00000000-0000-0000-0000-000000000000', action: 'LOGIN' });
    console.log("Insert with action error:", insErr2);
  }
}
check();
