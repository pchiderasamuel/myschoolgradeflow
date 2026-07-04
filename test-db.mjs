import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fliphfrxuhmhnxtmettd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsaXBoZnJ4dWhtaG54dG1ldHRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODUyNTUsImV4cCI6MjA5MjI2MTI1NX0.-5q6bBebbWoBU0uDIAQGyDFb-BbvghuMdl3T0Uil6qc'
);

async function test() {
  const { data, error } = await supabase.rpc('has_role', { 
    _user_id: '66f4d30e-8a01-4be7-9cb2-e70c69669ca4', 
    _role: 'super_admin' 
  });
  console.log('has_role result:', data, error);
}

test();
