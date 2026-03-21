import { useEffect, useMemo, useState } from "react";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatCurrency, formatNumber } from "@/app/lib/format";
import { supabase } from "@/app/lib/supabase";

type DashboardStats = {
  activeSites: number;
  openWorkOrders: number;
  unresolvedDelays: number;
  pendingEngineerReviews: number;
};

type SiteRecord = {
  id: string;
  name: string;
  site_code: string;
  status: string;
};

type DelayRecord = {
  reason: string;
  severity: string;
  impact_cost: number;
  impact_hours: number;
};

const defaultStats: DashboardStats = {
  activeSites: 0,
  openWorkOrders: 0,
  unresolvedDelays: 0,
  pendingEngineerReviews: 0,
};

export default function DashboardPage() {
  const { activeCompanyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [activeSite, setActiveSite] = useState<SiteRecord | null>(null);
  const [topDelay, setTopDelay] = useState<DelayRecord | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!supabase || !activeCompanyId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const [sitesRes, workOrdersRes, delaysRes, reviewsRes, activeSiteRes, topDelayRes] = await Promise.all([
        supabase
          .from("sites")
          .select("id", { count: "exact", head: true })
          .eq("company_id", activeCompanyId)
          .in("status", ["active", "in_progress", "planned"]),
        supabase
          .from("work_orders")
          .select("id", { count: "exact", head: true })
          .eq("company_id", activeCompanyId)
          .in("status", ["open", "in_progress"]),
        supabase
          .from("delays")
          .select("id", { count: "exact", head: true })
          .eq("company_id", activeCompanyId)
          .is("resolved_at", null),
        supabase
          .from("engineer_reviews")
          .select("id", { count: "exact", head: true })
          .eq("company_id", activeCompanyId)
          .in("review_status", ["pending", "needs_more_evidence"]),
        supabase
          .from("sites")
          .select("id,name,site_code,status")
          .eq("company_id", activeCompanyId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle<SiteRecord>(),
        supabase
          .from("delays")
          .select("reason,severity,impact_cost,impact_hours")
          .eq("company_id", activeCompanyId)
          .is("resolved_at", null)
          .order("impact_cost", { ascending: false })
          .limit(1)
          .maybeSingle<DelayRecord>(),
      ]);

      const firstError = [
        sitesRes.error,
        workOrdersRes.error,
        delaysRes.error,
        reviewsRes.error,
        activeSiteRes.error,
        topDelayRes.error,
      ].find(Boolean);

      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setStats({
        activeSites: sitesRes.count ?? 0,
        openWorkOrders: workOrdersRes.count ?? 0,
        unresolvedDelays: delaysRes.count ?? 0,
        pendingEngineerReviews: reviewsRes.count ?? 0,
      });
      setActiveSite(activeSiteRes.data ?? null);
      setTopDelay(topDelayRes.data ?? null);
      setLoading(false);
    };

    void run();
  }, [activeCompanyId]);

  const highlights = useMemo(
    () => [
      { label: "Active Sites", value: formatNumber(stats.activeSites) },
      { label: "Open Work Orders", value: formatNumber(stats.openWorkOrders) },
      { label: "Unresolved Delays", value: formatNumber(stats.unresolvedDelays) },
      { label: "Pending Engineer Reviews", value: formatNumber(stats.pendingEngineerReviews) },
    ],
    [stats]
  );

  const panels = useMemo(
    () => [
      {
        title: "Live Site Operations",
        items: [
          activeSite
            ? `${activeSite.name} (${activeSite.site_code}) is ${activeSite.status.replace("_", " ")}.`
            : "No active site found for this company.",
          `Company has ${formatNumber(stats.openWorkOrders)} open/in-progress work orders.`,
          `Engineer queue contains ${formatNumber(stats.pendingEngineerReviews)} pending reviews.`,
        ],
      },
      {
        title: "Risk and Cost Pulse",
        items: [
          topDelay
            ? `Top delay: ${topDelay.reason || "Unspecified"} (${topDelay.severity})`
            : "No unresolved delays currently logged.",
          topDelay
            ? `Highest delay cost impact: ${formatCurrency(topDelay.impact_cost)}`
            : "Delay cost impact is currently clear.",
          topDelay
            ? `Estimated hours lost: ${formatNumber(topDelay.impact_hours)}`
            : "No current delay-hour loss recorded.",
        ],
      },
    ],
    [activeSite, stats.openWorkOrders, stats.pendingEngineerReviews, topDelay]
  );

  return (
    <div>
      <ScreenFrame
        title="Operational Dashboard"
        description="Company-wide control tower for active wind repair programs, delay risks, and engineering review queues."
        highlights={highlights}
        panels={panels}
        actions={["Open active site details", "Escalate unresolved delays", "Route pending questions to engineers"]}
      />

      {loading ? <p className="message">Loading live operations data...</p> : null}
      {error ? <p className="message message--error">{error}</p> : null}
      {!activeCompanyId ? <p className="message">No active company selected in your membership context.</p> : null}
      {!supabase ? <p className="message">Supabase is not configured for this deployment.</p> : null}
    </div>
  );
}
