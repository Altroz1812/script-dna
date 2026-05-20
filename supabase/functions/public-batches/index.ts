import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    let courseId = url.searchParams.get("course_id");
    if (!courseId && req.method === "POST") {
      try {
        const body = await req.json();
        courseId = body?.course_id ?? null;
      } catch {}
    }
    if (!courseId) {
      return new Response(JSON.stringify({ error: "course_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: batches, error } = await supabase
      .from("batches")
      .select("id, name, max_students, teacher_id, course_id")
      .eq("course_id", courseId);
    if (error) throw error;

    const batchIds = (batches ?? []).map((b: any) => b.id);
    const teacherIds = [...new Set((batches ?? []).filter((b: any) => b.teacher_id).map((b: any) => b.teacher_id))];

    const [{ data: enrollRows }, { data: teacherRows }] = await Promise.all([
      batchIds.length
        ? supabase.from("batch_students").select("batch_id").in("batch_id", batchIds)
        : Promise.resolve({ data: [] as any[] }),
      teacherIds.length
        ? supabase.from("profiles").select("user_id, display_name").in("user_id", teacherIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const counts: Record<string, number> = {};
    for (const r of (enrollRows ?? []) as any[]) counts[r.batch_id] = (counts[r.batch_id] ?? 0) + 1;
    const teacherMap: Record<string, string> = {};
    for (const t of (teacherRows ?? []) as any[]) teacherMap[t.user_id] = t.display_name ?? "";

    const result = (batches ?? []).map((b: any) => ({
      id: b.id,
      name: b.name,
      max_students: b.max_students,
      teacher_id: b.teacher_id,
      enrolled_count: counts[b.id] ?? 0,
      teacher_name: b.teacher_id ? teacherMap[b.teacher_id] ?? null : null,
    }));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});