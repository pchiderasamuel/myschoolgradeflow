import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

serve(async (req) => {
  try {
    const payload = await req.json();
    // Support both Supabase Webhook format (payload.record) and raw pg_net format (payload)
    const record = payload.record || payload;

    // 1. Validate payload
    if (!record || !record.ip_address || !record.id || !record.user_id) {
      return new Response(JSON.stringify({ error: "Missing required fields or IP address" }), { status: 400 });
    }

    let locationStr = "Unknown Location";

    // 2. Handle Private / Local IPs
    const ip = record.ip_address.trim();
    if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("10.") || ip.startsWith("192.168.")) {
      locationStr = "Local Network";
    } else {
      // 3. Fetch Geo-IP Data using ipapi.co
      const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`);
      const geoData = await geoResponse.json();

      if (geoData.error) {
        console.error("GeoIP lookup failed:", geoData.reason);
        locationStr = "Unknown Location";
      } else if (geoData.city && geoData.country_name) {
        // Format location string (e.g., "Lagos, Nigeria")
        locationStr = `${geoData.city}, ${geoData.country_name}`;
      }
    }

    // 4. Update the database using Service Role key to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    if (!supabaseUrl || !supabaseKey) {
       console.error("Missing Supabase environment variables");
       return new Response(JSON.stringify({ error: "Configuration Error" }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Call the Postgres RPC to handle the anomaly logic and update the row
    const { error } = await supabase.rpc("update_session_location", {
      _session_id: record.id,
      _user_id: record.user_id,
      _location: locationStr
    });

    if (error) {
      console.error("RPC Error:", error);
      throw error;
    }

    return new Response(JSON.stringify({ success: true, location: locationStr }), { status: 200 });
  } catch (err) {
    console.error("Edge Function Error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
});
