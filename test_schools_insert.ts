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
  const { data, error } = await supabase.from('schools').insert({
    id: '00000000-0000-0000-0000-000000000000',
    name: 'Test',
    code: 'TEST',
    email: 'test@test.com',
    phone: '123',
    address_street: '123 Test',
    address_city: 'Test',
    address_state: 'Test'
  }).select('id').single();
  console.log("Schools insert error:", error);
}
check();
