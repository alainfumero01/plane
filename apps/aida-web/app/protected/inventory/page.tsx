import { useCallback, useEffect, useMemo, useState } from "react";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatDate, formatNumber } from "@/app/lib/format";
import type { RoleCode } from "@/app/lib/roles";
import { supabase } from "@/app/lib/supabase";

type SiteStockRecord = {
  id: string;
  site_id: string;
  material_id: string;
  qty_on_hand: number;
  qty_allocated: number;
};

type WarehouseStockRecord = {
  warehouse_id: string;
  material_id: string;
  qty_on_hand: number;
  qty_reserved: number;
};

type TransferRecord = {
  id: string;
  material_id: string;
  from_warehouse_id: string | null;
  to_site_id: string | null;
  quantity: number;
  status: string;
  dispatched_at: string | null;
  received_at: string | null;
  created_at: string;
};

type UsageRecord = {
  id: string;
  material_id: string;
  work_order_id: string | null;
  site_id: string;
  quantity_used: number;
  used_at: string;
};

type MaterialRecord = {
  id: string;
  sku: string;
  name: string;
  uom?: string;
  unit_cost?: number;
  is_hazardous?: boolean;
};
type SiteRecord = { id: string; name: string; site_code: string };
type WarehouseRecord = { id: string; name: string; code: string };
type WorkOrderRecord = { id: string; wo_number: string; site_id: string };

export default function InventoryPage() {
  const { activeCompanyId, roles, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [siteStocks, setSiteStocks] = useState<SiteStockRecord[]>([]);
  const [warehouseStocks, setWarehouseStocks] = useState<WarehouseStockRecord[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [usage, setUsage] = useState<UsageRecord[]>([]);

  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);

  const [materialsById, setMaterialsById] = useState<Record<string, MaterialRecord>>({});
  const [sitesById, setSitesById] = useState<Record<string, SiteRecord>>({});
  const [warehousesById, setWarehousesById] = useState<Record<string, WarehouseRecord>>({});
  const [workOrdersById, setWorkOrdersById] = useState<Record<string, WorkOrderRecord>>({});

  const [materialSku, setMaterialSku] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [materialUom, setMaterialUom] = useState("EA");
  const [materialUnitCost, setMaterialUnitCost] = useState("0");
  const [materialHazardous, setMaterialHazardous] = useState(false);
  const [materialBusy, setMaterialBusy] = useState(false);

  const [transferMaterialId, setTransferMaterialId] = useState("");
  const [transferWarehouseId, setTransferWarehouseId] = useState("");
  const [transferSiteId, setTransferSiteId] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("1");
  const [transferStatus, setTransferStatus] = useState("requested");
  const [transferBusy, setTransferBusy] = useState(false);

  const [usageMaterialId, setUsageMaterialId] = useState("");
  const [usageWorkOrderId, setUsageWorkOrderId] = useState("");
  const [usageSiteId, setUsageSiteId] = useState("");
  const [usageQuantity, setUsageQuantity] = useState("1");
  const [usageUsedAt, setUsageUsedAt] = useState("");
  const [usageBusy, setUsageBusy] = useState(false);

  const canManageInventory = useMemo(
    () =>
      roles.some(
        (role: RoleCode) => role === "business_owner_admin" || role === "warehouse" || role === "project_manager"
      ),
    [roles]
  );
  const canManageCatalog = useMemo(
    () => roles.some((role: RoleCode) => role === "business_owner_admin" || role === "warehouse"),
    [roles]
  );

  const loadData = useCallback(async () => {
    if (!supabase || !activeCompanyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [
      siteStockRes,
      warehouseStockRes,
      transferRes,
      usageRes,
      materialsRes,
      sitesRes,
      warehousesRes,
      workOrdersRes,
    ] = await Promise.all([
      supabase
        .from("site_stock")
        .select("id,site_id,material_id,qty_on_hand,qty_allocated")
        .eq("company_id", activeCompanyId)
        .order("updated_at", { ascending: false })
        .limit(150),
      supabase
        .from("warehouse_stock")
        .select("warehouse_id,material_id,qty_on_hand,qty_reserved")
        .eq("company_id", activeCompanyId)
        .order("updated_at", { ascending: false })
        .limit(150),
      supabase
        .from("inventory_transfers")
        .select("id,material_id,from_warehouse_id,to_site_id,quantity,status,dispatched_at,received_at,created_at")
        .eq("company_id", activeCompanyId)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("material_usage")
        .select("id,material_id,work_order_id,site_id,quantity_used,used_at")
        .eq("company_id", activeCompanyId)
        .order("used_at", { ascending: false })
        .limit(80),
      supabase
        .from("materials")
        .select("id,sku,name,uom,unit_cost,is_hazardous")
        .eq("company_id", activeCompanyId)
        .order("sku", { ascending: true }),
      supabase
        .from("sites")
        .select("id,name,site_code")
        .eq("company_id", activeCompanyId)
        .order("site_code", { ascending: true }),
      supabase
        .from("warehouses")
        .select("id,name,code")
        .eq("company_id", activeCompanyId)
        .order("code", { ascending: true }),
      supabase
        .from("work_orders")
        .select("id,wo_number,site_id")
        .eq("company_id", activeCompanyId)
        .order("wo_number", { ascending: true }),
    ]);

    const firstError = [
      siteStockRes.error,
      warehouseStockRes.error,
      transferRes.error,
      usageRes.error,
      materialsRes.error,
      sitesRes.error,
      warehousesRes.error,
      workOrdersRes.error,
    ].find(Boolean);

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const nextSiteStocks = (siteStockRes.data ?? []) as SiteStockRecord[];
    const nextWarehouseStocks = (warehouseStockRes.data ?? []) as WarehouseStockRecord[];
    const nextTransfers = (transferRes.data ?? []) as TransferRecord[];
    const nextUsage = (usageRes.data ?? []) as UsageRecord[];
    const nextMaterials = (materialsRes.data ?? []) as MaterialRecord[];
    const nextSites = (sitesRes.data ?? []) as SiteRecord[];
    const nextWarehouses = (warehousesRes.data ?? []) as WarehouseRecord[];
    const nextWorkOrders = (workOrdersRes.data ?? []) as WorkOrderRecord[];

    setSiteStocks(nextSiteStocks);
    setWarehouseStocks(nextWarehouseStocks);
    setTransfers(nextTransfers);
    setUsage(nextUsage);
    setMaterials(nextMaterials);
    setSites(nextSites);
    setWarehouses(nextWarehouses);
    setWorkOrders(nextWorkOrders);

    const materialMap: Record<string, MaterialRecord> = {};
    for (const row of nextMaterials) materialMap[row.id] = row;
    setMaterialsById(materialMap);

    const siteMap: Record<string, SiteRecord> = {};
    for (const row of nextSites) siteMap[row.id] = row;
    setSitesById(siteMap);

    const warehouseMap: Record<string, WarehouseRecord> = {};
    for (const row of nextWarehouses) warehouseMap[row.id] = row;
    setWarehousesById(warehouseMap);

    const workOrderMap: Record<string, WorkOrderRecord> = {};
    for (const row of nextWorkOrders) workOrderMap[row.id] = row;
    setWorkOrdersById(workOrderMap);

    if (!transferMaterialId && nextMaterials[0]) setTransferMaterialId(nextMaterials[0].id);
    if (!transferWarehouseId && nextWarehouses[0]) setTransferWarehouseId(nextWarehouses[0].id);
    if (!transferSiteId && nextSites[0]) setTransferSiteId(nextSites[0].id);

    if (!usageMaterialId && nextMaterials[0]) setUsageMaterialId(nextMaterials[0].id);
    if (!usageSiteId && nextSites[0]) setUsageSiteId(nextSites[0].id);

    setLoading(false);
  }, [activeCompanyId, transferMaterialId, transferSiteId, transferWarehouseId, usageMaterialId, usageSiteId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const shortageAlerts = siteStocks.filter(
    (row) => Number(row.qty_on_hand ?? 0) <= Number(row.qty_allocated ?? 0)
  ).length;
  const inTransitCount = transfers.filter((row) => row.status !== "received").length;

  const highlights = useMemo(
    () => [
      { label: "Warehouse SKUs", value: formatNumber(warehouseStocks.length) },
      { label: "Site SKUs", value: formatNumber(siteStocks.length) },
      { label: "Transfers In Transit", value: formatNumber(inTransitCount) },
      { label: "Shortage Alerts", value: formatNumber(shortageAlerts) },
    ],
    [inTransitCount, shortageAlerts, siteStocks.length, warehouseStocks.length]
  );

  const handleCreateMaterial = async () => {
    if (!supabase || !activeCompanyId) return;

    setMaterialBusy(true);
    setError(null);
    setSuccess(null);

    const payload = {
      company_id: activeCompanyId,
      sku: materialSku.trim().toUpperCase(),
      name: materialName.trim(),
      uom: materialUom.trim().toUpperCase() || "EA",
      unit_cost: Number(materialUnitCost || 0),
      is_hazardous: materialHazardous,
    };

    const { error: insertError } = await supabase.from("materials").insert(payload);
    if (insertError) {
      setError(insertError.message);
      setMaterialBusy(false);
      return;
    }

    setMaterialSku("");
    setMaterialName("");
    setMaterialUom("EA");
    setMaterialUnitCost("0");
    setMaterialHazardous(false);
    setSuccess(`Material ${payload.sku} created.`);
    await loadData();
    setMaterialBusy(false);
  };

  const handleCreateTransfer = async () => {
    if (!supabase || !activeCompanyId || !transferMaterialId || !transferWarehouseId || !transferSiteId) return;

    setTransferBusy(true);
    setError(null);
    setSuccess(null);

    const payload = {
      company_id: activeCompanyId,
      material_id: transferMaterialId,
      from_warehouse_id: transferWarehouseId,
      to_site_id: transferSiteId,
      quantity: Number(transferQuantity || 0),
      status: transferStatus,
      requested_by: user?.id ?? null,
    };

    const { error: insertError } = await supabase.from("inventory_transfers").insert(payload);
    if (insertError) {
      setError(insertError.message);
      setTransferBusy(false);
      return;
    }

    setTransferQuantity("1");
    setTransferStatus("requested");
    setSuccess("Transfer request created.");
    await loadData();
    setTransferBusy(false);
  };

  const handleLogUsage = async () => {
    if (!supabase || !activeCompanyId || !usageMaterialId) return;

    const selectedWorkOrder = usageWorkOrderId ? workOrdersById[usageWorkOrderId] : null;
    const resolvedSiteId = selectedWorkOrder?.site_id ?? usageSiteId;
    if (!resolvedSiteId) {
      setError("Select a site (or work order with a site) before logging usage.");
      return;
    }

    setUsageBusy(true);
    setError(null);
    setSuccess(null);

    const payload = {
      company_id: activeCompanyId,
      material_id: usageMaterialId,
      work_order_id: selectedWorkOrder?.id ?? null,
      site_id: resolvedSiteId,
      quantity_used: Number(usageQuantity || 0),
      used_at: usageUsedAt ? new Date(usageUsedAt).toISOString() : new Date().toISOString(),
      recorded_by: user?.id ?? null,
    };

    const { error: insertError } = await supabase.from("material_usage").insert(payload);
    if (insertError) {
      setError(insertError.message);
      setUsageBusy(false);
      return;
    }

    setUsageQuantity("1");
    setUsageUsedAt("");
    setSuccess("Material usage logged.");
    await loadData();
    setUsageBusy(false);
  };

  return (
    <div className="screen-stack">
      <ScreenFrame
        title="Inventory"
        description="Visibility across warehouse stock, site stock, transfers, and material usage tied to active repair work."
        highlights={highlights}
        panels={[
          {
            title: "Site Stock Snapshot",
            items: [
              `${formatNumber(siteStocks.length)} site stock records monitored`,
              `${formatNumber(shortageAlerts)} records currently at or below allocation`,
              "Transfer and usage traceability is available below",
            ],
          },
          {
            title: "Material Usage Trace",
            items: [
              `${formatNumber(usage.length)} usage entries in current view`,
              `${formatNumber(transfers.length)} transfer records in current view`,
              "Every movement remains tied to site and work-order context",
            ],
          },
        ]}
        actions={["Request warehouse transfer", "Review stock reconciliation", "Audit material usage by work order"]}
      />

      {canManageInventory ? (
        <section className="data-panel two-col">
          {canManageCatalog ? (
            <article>
              <header className="data-panel__header">
                <h3>Create Material</h3>
                <p>Warehouse/Admin action</p>
              </header>
              <form
                className="inline-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCreateMaterial();
                }}
              >
                <label>
                  SKU
                  <input
                    value={materialSku}
                    onChange={(event) => setMaterialSku(event.target.value)}
                    required
                    placeholder="RESIN-220"
                  />
                </label>
                <label>
                  Material Name
                  <input
                    value={materialName}
                    onChange={(event) => setMaterialName(event.target.value)}
                    required
                    placeholder="Epoxy Resin 220"
                  />
                </label>
                <label>
                  UOM
                  <input
                    value={materialUom}
                    onChange={(event) => setMaterialUom(event.target.value)}
                    required
                    placeholder="EA"
                  />
                </label>
                <label>
                  Unit Cost
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={materialUnitCost}
                    onChange={(event) => setMaterialUnitCost(event.target.value)}
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={materialHazardous}
                    onChange={(event) => setMaterialHazardous(event.target.checked)}
                  />
                  Hazardous material
                </label>
                <button type="submit" disabled={materialBusy || !materialSku.trim() || !materialName.trim()}>
                  {materialBusy ? "Creating..." : "Create Material"}
                </button>
              </form>
            </article>
          ) : null}

          <article>
            <header className="data-panel__header">
              <h3>Create Transfer</h3>
              <p>Inventory movement</p>
            </header>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateTransfer();
              }}
            >
              <label>
                Material
                <select
                  value={transferMaterialId}
                  onChange={(event) => setTransferMaterialId(event.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select material
                  </option>
                  {materials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.sku} - {material.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                From Warehouse
                <select
                  value={transferWarehouseId}
                  onChange={(event) => setTransferWarehouseId(event.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select warehouse
                  </option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} - {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                To Site
                <select value={transferSiteId} onChange={(event) => setTransferSiteId(event.target.value)} required>
                  <option value="" disabled>
                    Select site
                  </option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.site_code} - {site.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={transferQuantity}
                  onChange={(event) => setTransferQuantity(event.target.value)}
                />
              </label>
              <label>
                Status
                <select value={transferStatus} onChange={(event) => setTransferStatus(event.target.value)}>
                  <option value="requested">Requested</option>
                  <option value="dispatched">Dispatched</option>
                  <option value="received">Received</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={
                  transferBusy ||
                  !transferMaterialId ||
                  !transferWarehouseId ||
                  !transferSiteId ||
                  Number(transferQuantity || 0) <= 0
                }
              >
                {transferBusy ? "Creating..." : "Create Transfer"}
              </button>
            </form>
          </article>
        </section>
      ) : null}

      {canManageInventory ? (
        <section className="data-panel">
          <header className="data-panel__header">
            <h3>Log Material Usage</h3>
            <p>Track consumption against sites/work orders</p>
          </header>
          <form
            className="inline-form inline-form--grid"
            onSubmit={(event) => {
              event.preventDefault();
              void handleLogUsage();
            }}
          >
            <label>
              Material
              <select value={usageMaterialId} onChange={(event) => setUsageMaterialId(event.target.value)} required>
                <option value="" disabled>
                  Select material
                </option>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.sku} - {material.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Work Order (optional)
              <select
                value={usageWorkOrderId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setUsageWorkOrderId(nextId);
                  if (nextId) setUsageSiteId(workOrdersById[nextId]?.site_id ?? usageSiteId);
                }}
              >
                <option value="">No linked work order</option>
                {workOrders.map((workOrder) => (
                  <option key={workOrder.id} value={workOrder.id}>
                    {workOrder.wo_number}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Site
              <select value={usageSiteId} onChange={(event) => setUsageSiteId(event.target.value)} required>
                <option value="" disabled>
                  Select site
                </option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.site_code} - {site.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantity Used
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={usageQuantity}
                onChange={(event) => setUsageQuantity(event.target.value)}
              />
            </label>
            <label>
              Used At (optional)
              <input
                type="datetime-local"
                value={usageUsedAt}
                onChange={(event) => setUsageUsedAt(event.target.value)}
              />
            </label>
            <button type="submit" disabled={usageBusy || !usageMaterialId || Number(usageQuantity || 0) <= 0}>
              {usageBusy ? "Logging..." : "Log Usage"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Site Stock</h3>
          <p>{loading ? "Refreshing..." : `${siteStocks.length} record(s)`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Material</th>
                <th>On Hand</th>
                <th>Allocated</th>
              </tr>
            </thead>
            <tbody>
              {siteStocks.map((row) => (
                <tr key={row.id}>
                  <td>{sitesById[row.site_id]?.site_code ?? sitesById[row.site_id]?.name ?? row.site_id}</td>
                  <td>
                    {materialsById[row.material_id]?.sku ?? row.material_id}
                    <div className="muted">{materialsById[row.material_id]?.name ?? "Unknown material"}</div>
                  </td>
                  <td>{formatNumber(row.qty_on_hand)}</td>
                  <td>{formatNumber(row.qty_allocated)}</td>
                </tr>
              ))}
              {!loading && siteStocks.length === 0 ? (
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

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Inventory Transfers</h3>
          <p>{`${transfers.length} record(s)`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Material</th>
                <th>From Warehouse</th>
                <th>To Site</th>
                <th>Quantity</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className="chip">{row.status.replace("_", " ")}</span>
                  </td>
                  <td>{materialsById[row.material_id]?.sku ?? row.material_id}</td>
                  <td>
                    {row.from_warehouse_id
                      ? (warehousesById[row.from_warehouse_id]?.code ?? row.from_warehouse_id)
                      : "-"}
                  </td>
                  <td>{row.to_site_id ? (sitesById[row.to_site_id]?.site_code ?? row.to_site_id) : "-"}</td>
                  <td>{formatNumber(row.quantity)}</td>
                  <td>{formatDate(row.created_at)}</td>
                </tr>
              ))}
              {!loading && transfers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No transfer history found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Material Usage</h3>
          <p>{`${usage.length} usage entry(s)`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Used At</th>
                <th>Material</th>
                <th>Site</th>
                <th>Work Order</th>
                <th>Quantity Used</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.used_at)}</td>
                  <td>{materialsById[row.material_id]?.sku ?? row.material_id}</td>
                  <td>{sitesById[row.site_id]?.site_code ?? row.site_id}</td>
                  <td>
                    {row.work_order_id ? (workOrdersById[row.work_order_id]?.wo_number ?? row.work_order_id) : "-"}
                  </td>
                  <td>{formatNumber(row.quantity_used)}</td>
                </tr>
              ))}
              {!loading && usage.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No material usage logged yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {success ? <p className="message message--success">{success}</p> : null}
      {error ? <p className="message message--error">{error}</p> : null}
      {!supabase ? <p className="message">Supabase is not configured for this deployment.</p> : null}
    </div>
  );
}
