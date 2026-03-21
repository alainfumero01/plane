import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/client.ts";
import { requireUser } from "../_shared/auth.ts";

type RiskRequest = {
  companyId: string;
  projectId?: string;
  siteId?: string;
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
    const payload = (await req.json()) as RiskRequest;

    if (!payload.companyId) {
      return new Response(JSON.stringify({ error: "companyId is required" }), {
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

    let delayQuery = supabase
      .from("delays")
      .select("id,severity,resolved_at,impact_hours,impact_cost")
      .eq("company_id", payload.companyId);

    if (payload.projectId) delayQuery = delayQuery.eq("project_id", payload.projectId);
    if (payload.siteId) delayQuery = delayQuery.eq("site_id", payload.siteId);

    const { data: delays, error: delaysError } = await delayQuery;
    if (delaysError) throw delaysError;

    let taskQuery = supabase
      .from("tasks")
      .select("id,status,planned_hours,actual_hours")
      .eq("company_id", payload.companyId);

    if (payload.siteId) taskQuery = taskQuery.eq("site_id", payload.siteId);

    const { data: tasks, error: tasksError } = await taskQuery;
    if (tasksError) throw tasksError;

    const openDelays = (delays ?? []).filter((d) => !d.resolved_at).length;
    const severeDelays = (delays ?? []).filter((d) => d.severity === "high" || d.severity === "critical").length;
    const totalImpactHours = (delays ?? []).reduce((sum, d) => sum + Number(d.impact_hours ?? 0), 0);

    const tasksOverPlan = (tasks ?? []).filter((t) => Number(t.actual_hours ?? 0) > Number(t.planned_hours ?? 0)).length;
    const blockedTasks = (tasks ?? []).filter((t) => t.status === "blocked").length;

    const riskScore = Math.min(
      100,
      openDelays * 8 + severeDelays * 14 + totalImpactHours * 0.4 + tasksOverPlan * 5 + blockedTasks * 8,
    );

    const riskLevel = riskScore >= 75 ? "high" : riskScore >= 45 ? "medium" : "low";

    const recommendations = [
      openDelays > 0 ? "Review unresolved delays and assign owners." : "No unresolved delays detected.",
      blockedTasks > 0 ? "Escalate blocked tasks to engineering review queue." : "Task flow is not currently blocked.",
      tasksOverPlan > 0 ? "Rebaseline planned hours for overrun tasks." : "Task-hour variance is within baseline.",
    ];

    return new Response(
      JSON.stringify({
        riskLevel,
        riskScore,
        metrics: {
          openDelays,
          severeDelays,
          totalImpactHours,
          blockedTasks,
          tasksOverPlan,
        },
        recommendations,
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
