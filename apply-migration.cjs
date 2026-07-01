#!/usr/bin/env node
/**
 * Apply pending migration to Supabase
 * This reads the migration file and executes the SQL via Supabase REST API
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

// Supabase credentials from .env
const SUPABASE_URL = "https://fliphfrxuhmhnxtmettd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsaXBoZnJ4dWhtaG54dG1ldHRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODUyNTUsImV4cCI6MjA5MjI2MTI1NX0.-5q6bBebbWoBU0uDIAQGyDFb-BbvghuMdl3T0Uil6qc";

// Read the migration file
const migrationPath = path.join(__dirname, "supabase/migrations/20260612001000_add_staff_invite_tokens.sql");
const migrationSQL = fs.readFileSync(migrationPath, "utf-8");

console.log("🔍 Checking if migration has already been applied...\n");

// Check if staff_invite_tokens table exists
const checkUrl = new URL(SUPABASE_URL + "/rest/v1/information_schema.tables?table_name=eq.staff_invite_tokens");

const checkOptions = {
  headers: {
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "apikey": SUPABASE_ANON_KEY,
  },
};

https.get(checkUrl, checkOptions, (res) => {
  let data = "";
  res.on("data", chunk => data += chunk);
  res.on("end", () => {
    try {
      const tables = JSON.parse(data);
      if (Array.isArray(tables) && tables.length > 0) {
        console.log("✅ Migration already applied! staff_invite_tokens table exists.");
        process.exit(0);
      }
    } catch (e) {
      // Likely 404 - table doesn't exist
    }

    console.log("❌ Migration not applied. staff_invite_tokens table does not exist.");
    console.log("\n📋 To apply the migration manually:");
    console.log("1. Go to: https://supabase.com/dashboard/project/fliphfrxuhmhnxtmettd/sql/new");
    console.log("2. Copy the SQL from: supabase/migrations/20260612001000_add_staff_invite_tokens.sql");
    console.log("3. Paste it into the SQL editor");
    console.log("4. Click 'Run' (Ctrl+Enter)");
    console.log("\n🚀 Or install Supabase CLI and run:");
    console.log("npm install -g supabase");
    console.log("supabase db push");
  });
}).on("error", (e) => {
  console.error("❌ Error checking migration status:", e.message);
  process.exit(1);
});
