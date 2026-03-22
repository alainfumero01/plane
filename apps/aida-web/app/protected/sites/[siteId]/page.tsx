import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatDate, formatNumber } from "@/app/lib/format";
import type { RoleCode } from "@/app/lib/roles";
import { supabase } from "@/app/lib/supabase";

type SiteRecord = {
  id: string;
  name: string;
  site_code: string;
  status: string;
  planned_start: string | null;
  planned_end: string | null;
  project_id: string;
};

type TurbineRecord = {
  id: string;
  turbine_code: string;
  model: string | null;
  manufacturer: string | null;
  status: string;
};

type AssignmentRecord = {
  user_id: string;
  assignment_role: string;
};

type SiteStockRecord = {
  material_id: string;
  qty_on_hand: number;
  qty_allocated: number;
  materials: { sku: string; name: string } | Array<{ sku: string; name: string }> | null;
};

type VehicleAssignmentRecord = {
  vehicle_id: string;
  dispatch_at: string;
  vehicles: { plate_no: string; type: string } | Array<{ plate_no: string; type: string }> | null;
};

type WorkOrderRecord = {
  id: string;
  wo_number: string;
  title: string;
  status: string;
  priority: string;
};

const unwrapMaterial = (value: SiteStockRecord["materials"]) => (Array.isArray(value) ? (value[0] ?? null) : value);

export default function SiteDetailPage() {
  const { siteId } = useParams();
  const { activeCompanyId, roles } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [site, setSite] = useState<SiteRecord | null>(null);
  const [turbines, setTurbines] = useState<TurbineRecord[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [stocks, setStocks] = useState<SiteStockRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleAssignmentRecord[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);

  const [turbineCode, setTurbineCode] = useState("");
  const [turbineModel, setTurbineModel] = useState("");
  const [turbineManufacturer, setTurbineManufacturer] = useState("");
  const [creatingTurbine, setCreatingTurbine] = useState(false);

  const [woTitle, setWoTitle] = useState("");
  const [woPriority, setWoPriority] = useState("medium");
  const [woDamageSummary, setWoDamageSummary] = useState("");
  const [woTurbineId, setWoTurbineId] = useState("");
  const [creatingWorkOrder, setCreatingWorkOrder] = useState(false);

  const canCreate = useMemo(
    () => roles.some((role: RoleCode) => role === "business_owner_admin" || role === "project_manager"),
    [roles]
  );

  const loadData = useCallback(async () => {
    if (!supabase || !activeCompanyId || !siteId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const siteRes = await supabase
      .from("sites")
      .select("id,name,site_code,status,planned_start,planned_end,project_id")
      .eq("company_id", activeCompanyId)
      .eq("id", siteId)
      .maybeSingle<SiteRecord>();

    if (siteRes.error) {
      setError(siteRes.error.message);
      setLoading(false);
      return;
    }

    if (!siteRes.data) {
      setSite(null);
      setLoading(false);
      return;
    }

    setSite(siteRes.data);

    const [turbinesRes, assignmentsRes, stockRes, vehicleRes, workOrdersRes] = await Promise.all([
      supabase
        .from("turbines")
        .select("id,turbine_code,model,manufacturer,status")
        .eq("company_id", activeCompanyId)
        .eq("site_id", siteId)
        .order("turbine_code", { ascending: true }),
      supabase
        .from("site_assignments")
        .select("user_id,assignment_role")
        .eq("company_id", activeCompanyId)
        .eq("site_id", siteId)
        .eq("is_active", true),
      supabase
        .from("site_stock")
        .select("material_id,qty_on_hand,qty_allocated,materials(sku,name)")
        .eq("company_id", activeCompanyId)
        .eq("site_id", siteId),
      supabase
        .from("vehicle_assignments")
        .select("vehicle_id,dispatch_at,vehicles(plate_no,type)")
        .eq("company_id", activeCompanyId)
        .eq("site_id", siteId)
        .is("return_at", null),
      supabase
        .from("work_orders")
        .select("id,wo_number,title,status,priority")
        .eq("company_id", activeCompanyId)
        .eq("site_id", siteId)
        .order("updated_at", { ascending: false }),
    ]);

    const firstError = [
      turbinesRes.error,
      assignmentsRes.error,
      stockRes.error,
      vehicleRes.error,
      workOrdersRes.error,
    ].find(Boolean);

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const turbineRows = (turbinesRes.data ?? []) as TurbineRecord[];
    setTurbines(turbineRows);
    setAssignments((assignmentsRes.data ?? []) as AssignmentRecord[]);
    setStocks((stockRes.data ?? []) as SiteStockRecord[]);
    setVehicles((vehicleRes.data ?? []) as VehicleAssignmentRecord[]);
    setWorkOrders((workOrdersRes.data ?? []) as WorkOrderRecord[]);

    if (!woTurbineId && turbineRows[0]) {
      setWoTurbineId(turbineRows[0].id);
    }

    setLoading(false);
  }, [activeCompanyId, siteId, woTurbineId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const computedTurbineCode = useMemo(() => {
    if (turbineCode.trim()) return turbineCode.trim().toUpperCase();

    const base = site?.site_code || "TB";
    return `${base}-T${(turbines.length + 1).toString().padStart(2, "0")}`;
  }, [site?.site_code, turbineCode, turbines.length]);

  const computedWoNumber = useMemo(() => {
    const seed = Date.now().toString().slice(-5);
    const prefix = site?.site_code?.slice(0, 6).toUpperCase() || "SITE";
    return `WO-${prefix}-${seed}`;
  }, [site?.site_code]);

  const highlights = useMemo(
    () => [
      { label: "Active Turbines", value: formatNumber(turbines.length) },
      { label: "Assigned Crew", value: formatNumber(assignments.length) },
      { label: "Materials On Site", value: formatNumber(stocks.length) },
      { label: "Vehicles On Site", value: formatNumber(vehicles.length) },
    ],
    [assignments.length, stocks.length, turbines.length, vehicles.length]
  );

  const panels = useMemo(
    () => [
      {
        title: "Execution Overview",
        items: [
          `Site status: ${site?.status.replace("_", " ") ?? "-"}`,
          `Planned window: ${formatDate(site?.planned_start)} to ${formatDate(site?.planned_end)}`,
          `${formatNumber(workOrders.length)} work order(s) currently linked to this site.`,
        ],
      },
      {
        title: "Logistics and Staffing",
        items: [
          `${formatNumber(assignments.length)} active assignment(s) onsite`,
          `${formatNumber(vehicles.length)} active vehicle dispatch(es)`,
          `${formatNumber(stocks.reduce((sum, stock) => sum + Number(stock.qty_on_hand ?? 0), 0))} total material units recorded on site`,
        ],
      },
    ],
    [
      assignments.length,
      site?.planned_end,
      site?.planned_start,
      site?.status,
      stocks,
      vehicles.length,
      workOrders.length,
    ]
  );

  const handleCreateTurbine = async () => {
    if (!supabase || !activeCompanyId || !siteId) return;

    setCreatingTurbine(true);
    setError(null);
    setSuccess(null);

    const payload = {
      company_id: activeCompanyId,
      site_id: siteId,
      turbine_code: computedTurbineCode,
      model: turbineModel.trim() || null,
      manufacturer: turbineManufacturer.trim() || null,
      status: "active",
    };

    const { error: insertError } = await supabase.from("turbines").insert(payload);
    if (insertError) {
      setError(insertError.message);
      setCreatingTurbine(false);
      return;
    }

    setTurbineCode("");
    setTurbineModel("");
    setTurbineManufacturer("");
    setSuccess(`Turbine ${payload.turbine_code} created.`);
    await loadData();
    setCreatingTurbine(false);
  };

  const handleCreateWorkOrder = async () => {
    if (!supabase || !activeCompanyId || !siteId || !site) return;

    setCreatingWorkOrder(true);
    setError(null);
    setSuccess(null);

    const payload = {
      company_id: activeCompanyId,
      project_id: site.project_id,
      site_id: siteId,
      turbine_id: woTurbineId || null,
      wo_number: computedWoNumber,
      title: woTitle.trim(),
      status: "open",
      priority: woPriority,
      damage_summary: woDamageSummary.trim() || "",
    };

    const { error: insertError } = await supabase.from("work_orders").insert(payload);
    if (insertError) {
      setError(insertError.message);
      setCreatingWorkOrder(false);
      return;
    }

    setWoTitle("");
    setWoPriority("medium");
    setWoDamageSummary("");
    setSuccess(`Work order ${payload.wo_number} created.`);
    await loadData();
    setCreatingWorkOrder(false);
  };

  return (
    <div className="screen-stack">
      <ScreenFrame
        title={`Site Detail: ${site?.name ?? siteId ?? "unknown-site"}`}
        description="Execution-focused site view with live turbine, staffing, inventory, vehicle, and work-order data."
        highlights={highlights}
        panels={panels}
        actions={["Open linked project", "Open work order detail", "Review turbine scope and evidence"]}
      />

      {canCreate ? (
        <section className="data-panel two-col">
          <article>
            <header className="data-panel__header">
              <h3>Create Turbine</h3>
              <p>Admin / PM action</p>
            </header>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateTurbine();
              }}
            >
              <label>
                Turbine Code (optional)
                <input
                  value={turbineCode}
                  onChange={(event) => setTurbineCode(event.target.value)}
                  placeholder={computedTurbineCode}
                />
              </label>
              <label>
                Model
                <input
                  value={turbineModel}
                  onChange={(event) => setTurbineModel(event.target.value)}
                  placeholder="GE 1.5sle"
                />
              </label>
              <label>
                Manufacturer
                <input
                  value={turbineManufacturer}
                  onChange={(event) => setTurbineManufacturer(event.target.value)}
                  placeholder="GE"
                />
              </label>
              <button type="submit" disabled={creatingTurbine}>
                {creatingTurbine ? "Creating..." : "Create Turbine"}
              </button>
            </form>
          </article>

          <article>
            <header className="data-panel__header">
              <h3>Create Work Order</h3>
              <p>Admin / PM action</p>
            </header>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateWorkOrder();
              }}
            >
              <label>
                Title
                <input
                  value={woTitle}
                  onChange={(event) => setWoTitle(event.target.value)}
                  required
                  placeholder="Leading edge crack repair"
                />
              </label>
              <label>
                Turbine (optional)
                <select value={woTurbineId} onChange={(event) => setWoTurbineId(event.target.value)}>
                  <option value="">No specific turbine</option>
                  {turbines.map((turbine) => (
                    <option key={turbine.id} value={turbine.id}>
                      {turbine.turbine_code}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select value={woPriority} onChange={(event) => setWoPriority(event.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label>
                Damage Summary
                <textarea
                  value={woDamageSummary}
                  onChange={(event) => setWoDamageSummary(event.target.value)}
                  placeholder="Describe observed damage and scope."
                />
              </label>
              <button type="submit" disabled={creatingWorkOrder || !woTitle.trim()}>
                {creatingWorkOrder ? "Creating..." : "Create Work Order"}
              </button>
            </form>
          </article>
        </section>
      ) : null}

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Active Work Orders</h3>
          <p>{loading ? "Refreshing..." : `${workOrders.length} linked`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>WO Number</th>
                <th>Title</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((row) => (
                <tr key={row.id}>
                  <td>{row.wo_number}</td>
                  <td>{row.title}</td>
                  <td>
                    <span className="chip">{row.status.replace("_", " ")}</span>
                  </td>
                  <td>{row.priority}</td>
                  <td className="row-actions">
                    <Link to={`/work-orders/${row.id}`}>Open</Link>
                    <Link to={`/projects/${site?.project_id}`}>Project</Link>
                  </td>
                </tr>
              ))}
              {!loading && workOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No work orders found for this site.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>On-Site Materials</h3>
          <p>{`${stocks.length} SKU(s)`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>On Hand</th>
                <th>Allocated</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((row) => (
                <tr key={`${row.material_id}:${row.qty_on_hand}:${row.qty_allocated}`}>
                  <td>{unwrapMaterial(row.materials)?.sku ?? "-"}</td>
                  <td>{unwrapMaterial(row.materials)?.name ?? "Unknown material"}</td>
                  <td>{formatNumber(row.qty_on_hand)}</td>
                  <td>{formatNumber(row.qty_allocated)}</td>
                </tr>
              ))}
              {!loading && stocks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No site stock records found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {success ? <p className="message message--success">{success}</p> : null}
      {error ? <p className="message message--error">{error}</p> : null}
      {!site && !loading ? <p className="message">Site not found or you do not have access.</p> : null}
    </div>
  );
}
