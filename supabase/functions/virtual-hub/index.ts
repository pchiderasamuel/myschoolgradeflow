import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action, school_code, admission_no, class_name, class_id, student_name } = body;

    // 1. Resolve school code to tenant_id (supports UUID, tenants.school_code, schools.code)
    if (!school_code) throw new Error("Missing school code");
    
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = UUID_RE.test(school_code);

    let tenantId: string | null = null;

    if (isUuid) {
      // Check if school_code is a tenant_id UUID
      const { data: t } = await admin
        .from("tenants")
        .select("id")
        .eq("id", school_code)
        .maybeSingle();
      if (t) tenantId = t.id;
    }

    if (!tenantId) {
      // Check tenants table by school_code
      const { data: t } = await admin
        .from("tenants")
        .select("id")
        .ilike("school_code", school_code)
        .maybeSingle();
      if (t) tenantId = t.id;
    }

    if (!tenantId) {
      // Check schools table by code
      const { data: s } = await admin
        .from("schools")
        .select("tenant_id")
        .eq("code", school_code.toUpperCase())
        .maybeSingle();
      if (s?.tenant_id) tenantId = s.tenant_id;
    }

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "Invalid school code." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // 2. Fetch App State / Tenant Data
    const { data: stateRow, error: stateErr } = await admin
      .from("tenant_data")
      .select("data")
      .eq("tenant_id", tenantId)
      .single();
      
    if (stateErr || !stateRow) {
      return new Response(JSON.stringify({ error: "School data not initialized." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const appData = stateRow.data as any;

    if (action === "fetch") {
      // Find the student based on admission number and class
      if (!class_name || !admission_no) {
        return new Response(JSON.stringify({ error: "Missing class or admission number." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const roll = appData.classRolls?.[class_name] || [];
      const student = roll.find((s: any) => 
        s.admNo?.trim().toLowerCase() === admission_no.trim().toLowerCase()
      );

      if (!student) {
        return new Response(JSON.stringify({ error: "Admission number not found in this class." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }

      // Get relevant virtual classes
      const allVirtual = appData.virtualClasses || [];
      const myVirtual = allVirtual.filter((vc: any) => 
        vc.targetClass === class_name || vc.targetClass === "All"
      );
      
      const attendance = appData.virtualAttendance || {};

      return new Response(JSON.stringify({ 
        student, 
        virtualClasses: myVirtual,
        attendance
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } else if (action === "join") {
      // Log attendance
      if (!class_id || !student_name) {
        return new Response(JSON.stringify({ error: "Missing required fields to log attendance." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const currentAtt = appData.virtualAttendance || {};
      if (!currentAtt[class_id]) currentAtt[class_id] = [];
      
      if (!currentAtt[class_id].includes(student_name)) {
        currentAtt[class_id].push(student_name);
        
        // Update database
        await admin
          .from("tenant_data")
          .update({ data: { ...appData, virtualAttendance: currentAtt } })
          .eq("tenant_id", tenantId);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });

  } catch (err: any) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
