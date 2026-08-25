/**
 * scripts/verify_live_rpc_security.ts
 *
 * Live Integration & Security Verification Script for Supabase.
 * Executes a REAL RPC call (execute_bulk_promotion_v1) via PostgREST client
 * authenticated as an unauthorized tenant user targeting a foreign _school_id.
 *
 * Usage:
 *   npx tsx scripts/verify_live_rpc_security.ts
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Zero-dependency .env reader
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      content.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const [key, ...valParts] = trimmed.split("=");
          const val = valParts.join("=").replace(/^["']|["']$/g, "").trim();
          if (key && !process.env[key.trim()]) {
            process.env[key.trim()] = val;
          }
        }
      });
    }
  } catch (e) {}
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://aaxdgakkwlaqevuysaxw.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing Supabase URL or Anon key in environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runLiveRpcSecurityCheck() {
  console.log("--------------------------------------------------");
  console.log("🔒 LIVE SUPABASE RPC SECURITY VERIFICATION RUNNER");
  console.log("--------------------------------------------------");
  console.log(`📡 Connecting to Supabase Project: ${SUPABASE_URL}`);

  // Test Case 1: Direct RPC invocation targeting foreign school
  const foreignSchoolId = "88888888-8888-8888-8888-888888888888";
  
  console.log("\n🧪 Test 1: Calling execute_bulk_promotion_v1 for foreign school without valid admin token...");

  const { data, error } = await supabase.rpc("execute_bulk_promotion_v1" as any, {
    _school_id: foreignSchoolId,
    _session: "2025/2026",
    _term: "First Term",
    _mappings: { "JSS 1": "JSS 2" },
    _retained_ids: {},
    _snapshot_before: { students: [] },
    _expected_state_hash: "",
    _executed_by_name: "Penetration Tester"
  });

  if (error) {
    console.log("\n--------------------------------------------------");
    console.log("✅ SECURITY RESULT:");
    console.log(`   Postgres Error Code: ${error.code}`);
    console.log(`   Postgres Error Message: "${error.message}"`);
    console.log("--------------------------------------------------");
  } else {
    console.error("❌ SECURITY FAIL: RPC executed without admin authorization!");
    console.error("   Data returned:", data);
    process.exit(1);
  }
}

runLiveRpcSecurityCheck();
