const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://fliphfrxuhmhnxtmettd.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsaXBoZnJ4dWhtaG54dG1ldHRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODUyNTUsImV4cCI6MjA5MjI2MTI1NX0.-5q6bBebbWoBU0uDIAQGyDFb-BbvghuMdl3T0Uil6qc";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Calling get_all_session_logs RPC...");
  const { data, error } = await supabase.rpc("get_all_session_logs", { _limit: 5 });
  if (error) {
    console.error("RPC Error:", error);
  } else {
    console.log("RPC Data:", data);
  }
}

run();
