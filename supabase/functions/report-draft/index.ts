import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/client.ts";
import { requireUser } from "../_shared/auth.ts";

type ReportDraftRequest = {
  companyId: string;
  reportId: string;
  persist?: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const authorization = req.headers.get("Authorization");
    const user = await requireUser(authorization);
    const payload = (await req.json()) as ReportDraftRequest;

    if (!payload.companyId || !payload.reportId) {
      return new Response(JSON.stringify({ error: "companyId and reportId are required" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const supabase = createServiceClient();

    const { data: membership, error: membershipError } = await supabase
      .from("user_company_memberships")
      .select("id")
      .eq("company_id", payload.companyId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("id,status,project_id,site_id,report_type")
      .eq("id", payload.reportId)
      .eq("company_id", payload.companyId)
      .maybeSingle();

    if (reportError) throw reportError;
    if (!report) {
      return new Response(JSON.stringify({ error: "Report not found" }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    const { data: sections, error: sectionsError } = await supabase
      .from("report_sections")
      .select("id,section_key,title,prefill_json,final_text,order_no")
      .eq("report_id", payload.reportId)
      .eq("company_id", payload.companyId)
      .order("order_no", { ascending: true });

    if (sectionsError) throw sectionsError;

    const draftedSections = (sections ?? []).map((section) => {
      const prefill = section.prefill_json ?? {};
      const generatedText =
        section.final_text?.trim() ||
        `Draft for ${section.title}: ${JSON.stringify(prefill)}. Review and finalize with engineering approvals.`;

      return {
        id: section.id,
        sectionKey: section.section_key,
        title: section.title,
        generatedText,
      };
    });

    if (payload.persist) {
      for (const section of draftedSections) {
        const { error: updateError } = await supabase
          .from("report_sections")
          .update({ final_text: section.generatedText })
          .eq("id", section.id)
          .eq("company_id", payload.companyId);

        if (updateError) throw updateError;
      }
    }

    return new Response(
      JSON.stringify({
        reportId: payload.reportId,
        reportStatus: report.status,
        draftedSections,
      }),
      { headers: jsonHeaders },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
