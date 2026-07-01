import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // TODO: CORS — replace with marketing site's exact domain once finalized
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders });
    }

    const { schoolName, schoolCode, adminName, adminEmail, phone, address, plan } = body ?? {};

    if (!schoolName || !schoolCode || !adminName || !adminEmail) {
      return Response.json(
        { error: "schoolName, schoolCode, adminName, and adminEmail are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
      return Response.json({ error: "Invalid email address" }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: existingRequest } = await serviceClient
      .from("school_requests")
      .select("id")
      .eq("admin_email", adminEmail.toLowerCase())
      .in("status", ["pending", "approved"])
      .maybeSingle();

    if (existingRequest) {
      return Response.json(
        { error: "A request with this email is already pending or approved." },
        { status: 409, headers: corsHeaders }
      );
    }

    const { data: codeTaken } = await serviceClient
      .from("schools")
      .select("id")
      .eq("code", schoolCode.toUpperCase())
      .maybeSingle();

    if (codeTaken) {
      return Response.json({ error: "School code already in use" }, { status: 409, headers: corsHeaders });
    }

    const { error: insertError } = await serviceClient
      .from("school_requests")
      .insert({
        school_name: schoolName,
        school_code: schoolCode.toUpperCase(),
        admin_name: adminName,
        admin_email: adminEmail.toLowerCase(),
        phone: phone ?? null,
        address_street: address?.street ?? null,
        address_city: address?.city ?? null,
        address_state: address?.state ?? null,
        plan: plan ?? "starter",
      });

    if (insertError) throw insertError;

    return Response.json(
      { success: true, message: "Your request has been submitted for review." },
      { status: 201, headers: corsHeaders }
    );
  } catch (err) {
    console.error("register-school error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
});
