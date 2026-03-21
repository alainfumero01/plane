import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatDate, formatNumber } from "@/app/lib/format";
import { supabase } from "@/app/lib/supabase";

type TurbineRecord = {
  id: string;
  site_id: string;
  turbine_code: string;
  model: string | null;
  manufacturer: string | null;
  status: string;
};

type BladeRecord = {
  id: string;
  blade_position: string;
  serial_number: string | null;
  status: string;
};

type ScopeRecord = {
  id: string;
  severity: string;
  scope_type: string;
  status: string;
  notes: string;
};

type EvidenceRecord = {
  id: string;
  captured_at: string;
  ai_summary: string | null;
  storage_path: string;
};

type InspectionRecord = {
  id: string;
  inspection_type: string;
  status: string;
  inspected_at: string | null;
};

type WorkOrderRecord = {
  id: string;
  wo_number: string;
  status: string;
};

export default function TurbineBladeDetailPage() {
  const { turbineId, bladeId } = useParams();
  const { activeCompanyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [turbine, setTurbine] = useState<TurbineRecord | null>(null);
  const [blade, setBlade] = useState<BladeRecord | null>(null);
  const [scopeItems, setScopeItems] = useState<ScopeRecord[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);

  useEffect(() => {
    const run = async () => {
      if (!supabase || !activeCompanyId || !turbineId || !bladeId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const [turbineRes, bladeRes] = await Promise.all([
        supabase
          .from("turbines")
          .select("id,site_id,turbine_code,model,manufacturer,status")
          .eq("company_id", activeCompanyId)
          .eq("id", turbineId)
          .maybeSingle<TurbineRecord>(),
        supabase
          .from("blades")
          .select("id,blade_position,serial_number,status")
          .eq("company_id", activeCompanyId)
          .eq("id", bladeId)
          .eq("turbine_id", turbineId)
          .maybeSingle<BladeRecord>(),
      ]);

      const firstError = [turbineRes.error, bladeRes.error].find(Boolean);
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setTurbine(turbineRes.data ?? null);
      setBlade(bladeRes.data ?? null);

      const [scopeRes, evidenceRes, inspectionsRes, workOrdersRes] = await Promise.all([
        supabase
          .from("repair_scope_items")
          .select("id,severity,scope_type,status,notes")
          .eq("company_id", activeCompanyId)
          .eq("turbine_id", turbineId)
          .eq("blade_id", bladeId)
          .order("updated_at", { ascending: false })
          .limit(80),
        supabase
          .from("evidence_items")
          .select("id,captured_at,ai_summary,storage_path")
          .eq("company_id", activeCompanyId)
          .eq("turbine_id", turbineId)
          .eq("blade_id", bladeId)
          .order("captured_at", { ascending: false })
          .limit(120),
        supabase
          .from("inspections")
          .select("id,inspection_type,status,inspected_at")
          .eq("company_id", activeCompanyId)
          .eq("turbine_id", turbineId)
          .eq("blade_id", bladeId)
          .order("created_at", { ascending: false })
          .limit(80),
        supabase
          .from("work_orders")
          .select("id,wo_number,status")
          .eq("company_id", activeCompanyId)
          .eq("turbine_id", turbineId)
          .eq("blade_id", bladeId)
          .order("updated_at", { ascending: false })
          .limit(20),
      ]);

      const detailsError = [scopeRes.error, evidenceRes.error, inspectionsRes.error, workOrdersRes.error].find(Boolean);
      if (detailsError) {
        setError(detailsError.message);
        setLoading(false);
        return;
      }

      setScopeItems((scopeRes.data ?? []) as ScopeRecord[]);
      setEvidence((evidenceRes.data ?? []) as EvidenceRecord[]);
      setInspections((inspectionsRes.data ?? []) as InspectionRecord[]);
      setWorkOrders((workOrdersRes.data ?? []) as WorkOrderRecord[]);
      setLoading(false);
    };

    void run();
  }, [activeCompanyId, bladeId, turbineId]);

  const highestSeverity = useMemo(() => {
    if (scopeItems.some((item) => item.severity === "critical")) return "Critical";
    if (scopeItems.some((item) => item.severity === "high")) return "High";
    if (scopeItems.some((item) => item.severity === "medium")) return "Medium";
    if (scopeItems.some((item) => item.severity === "low")) return "Low";
    return "Not set";
  }, [scopeItems]);

  const latestEvidence = evidence[0];

  return (
    <div className="screen-stack">
      <ScreenFrame
        title={`Turbine ${turbine?.turbine_code ?? turbineId ?? "?"} / Blade ${blade?.blade_position ?? bladeId ?? "?"}`}
        description="Asset-level repair history, scope, and evidence timeline for engineering decisions."
        highlights={[
          { label: "Blade Status", value: blade?.status.replace("_", " ") ?? "-" },
          { label: "Damage Severity", value: highestSeverity },
          { label: "Evidence Items", value: formatNumber(evidence.length) },
          {
            label: "Open Work Orders",
            value: formatNumber(workOrders.filter((row) => row.status !== "closed").length),
          },
        ]}
        panels={[
          {
            title: "Damage Timeline",
            items: [
              latestEvidence
                ? `Latest evidence captured ${formatDate(latestEvidence.captured_at)}`
                : "No evidence captured yet",
              `${formatNumber(scopeItems.length)} scope item(s) linked to this blade`,
              `${formatNumber(inspections.length)} inspection checkpoint(s) recorded`,
            ],
          },
          {
            title: "QA Control",
            items: [
              `${formatNumber(inspections.filter((row) => row.status === "completed").length)} completed inspection(s)`,
              `${formatNumber(inspections.filter((row) => row.status !== "completed").length)} pending inspection(s)`,
              "Engineer review and report modules consume this evidence chain",
            ],
          },
        ]}
        actions={["Open linked work order", "Upload new inspection evidence", "Request engineer signoff"]}
      />

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Repair Scope</h3>
          <p>{loading ? "Refreshing..." : `${scopeItems.length} scope item(s)`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {scopeItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.scope_type}</td>
                  <td>{item.severity}</td>
                  <td>
                    <span className="chip">{item.status.replace("_", " ")}</span>
                  </td>
                  <td>{item.notes || "-"}</td>
                </tr>
              ))}
              {!loading && scopeItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No scope items recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="data-panel two-col">
        <article>
          <header className="data-panel__header">
            <h3>Evidence Timeline</h3>
            <p>{`${evidence.length} item(s)`}</p>
          </header>
          <ul className="dense-list">
            {evidence.map((item) => (
              <li key={item.id}>
                <strong>{formatDate(item.captured_at)}</strong> {item.ai_summary || item.storage_path}
              </li>
            ))}
            {!loading && evidence.length === 0 ? <li>No evidence uploaded yet.</li> : null}
          </ul>
        </article>

        <article>
          <header className="data-panel__header">
            <h3>Work Orders</h3>
            <p>{`${workOrders.length} linked`}</p>
          </header>
          <ul className="dense-list">
            {workOrders.map((order) => (
              <li key={order.id}>
                <Link to={`/work-orders/${order.id}`}>{order.wo_number}</Link> ({order.status.replace("_", " ")})
              </li>
            ))}
            {!loading && workOrders.length === 0 ? <li>No linked work orders.</li> : null}
          </ul>
        </article>
      </section>

      {error ? <p className="message message--error">{error}</p> : null}
      {!blade && !loading ? <p className="message">Blade not found or not accessible.</p> : null}
      {!supabase ? <p className="message">Supabase is not configured for this deployment.</p> : null}
    </div>
  );
}
