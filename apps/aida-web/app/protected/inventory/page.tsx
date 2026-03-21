import { useEffect, useMemo, useState } from "react";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatDate, formatNumber } from "@/app/lib/format";
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
  quantity_used: number;
  used_at: string;
};

type MaterialRecord = { id: string; sku: string; name: string };
type SiteRecord = { id: string; name: string; site_code: string };
type WarehouseRecord = { id: string; name: string; code: string };
type WorkOrderRecord = { id: string; wo_number: string };

export default function InventoryPage() {
  const { activeCompanyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siteStocks, setSiteStocks] = useState<SiteStockRecord[]>([]);
  const [warehouseStocks, setWarehouseStocks] = useState<WarehouseStockRecord[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [materialsById, setMaterialsById] = useState<Record<string, MaterialRecord>>({});
  const [sitesById, setSitesById] = useState<Record<string, SiteRecord>>({});
  const [warehousesById, setWarehousesById] = useState<Record<string, WarehouseRecord>>({});
  const [workOrdersById, setWorkOrdersById] = useState<Record<string, WorkOrderRecord>>({});

  useEffect(() => {
    const run = async () => {
      if (!supabase || !activeCompanyId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const [siteStockRes, warehouseStockRes, transferRes, usageRes] = await Promise.all([
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
          .select("id,material_id,work_order_id,quantity_used,used_at")
          .eq("company_id", activeCompanyId)
          .order("used_at", { ascending: false })
          .limit(80),
      ]);

      const firstError = [siteStockRes.error, warehouseStockRes.error, transferRes.error, usageRes.error].find(Boolean);
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const nextSiteStocks = (siteStockRes.data ?? []) as SiteStockRecord[];
      const nextWarehouseStocks = (warehouseStockRes.data ?? []) as WarehouseStockRecord[];
      const nextTransfers = (transferRes.data ?? []) as TransferRecord[];
      const nextUsage = (usageRes.data ?? []) as UsageRecord[];

      setSiteStocks(nextSiteStocks);
      setWarehouseStocks(nextWarehouseStocks);
      setTransfers(nextTransfers);
      setUsage(nextUsage);

      const materialIds = new Set<string>();
      const siteIds = new Set<string>();
      const warehouseIds = new Set<string>();
      const workOrderIds = new Set<string>();

      for (const row of nextSiteStocks) {
        materialIds.add(row.material_id);
        siteIds.add(row.site_id);
      }
      for (const row of nextWarehouseStocks) {
        materialIds.add(row.material_id);
        warehouseIds.add(row.warehouse_id);
      }
      for (const row of nextTransfers) {
        materialIds.add(row.material_id);
        if (row.to_site_id) siteIds.add(row.to_site_id);
        if (row.from_warehouse_id) warehouseIds.add(row.from_warehouse_id);
      }
      for (const row of nextUsage) {
        materialIds.add(row.material_id);
        if (row.work_order_id) workOrderIds.add(row.work_order_id);
      }

      const [materialsRes, sitesRes, warehousesRes, workOrdersRes] = await Promise.all([
        materialIds.size > 0
          ? supabase
              .from("materials")
              .select("id,sku,name")
              .eq("company_id", activeCompanyId)
              .in("id", Array.from(materialIds))
          : Promise.resolve({ data: [], error: null }),
        siteIds.size > 0
          ? supabase
              .from("sites")
              .select("id,name,site_code")
              .eq("company_id", activeCompanyId)
              .in("id", Array.from(siteIds))
          : Promise.resolve({ data: [], error: null }),
        warehouseIds.size > 0
          ? supabase
              .from("warehouses")
              .select("id,name,code")
              .eq("company_id", activeCompanyId)
              .in("id", Array.from(warehouseIds))
          : Promise.resolve({ data: [], error: null }),
        workOrderIds.size > 0
          ? supabase
              .from("work_orders")
              .select("id,wo_number")
              .eq("company_id", activeCompanyId)
              .in("id", Array.from(workOrderIds))
          : Promise.resolve({ data: [], error: null }),
      ]);

      const mapError = [materialsRes.error, sitesRes.error, warehousesRes.error, workOrdersRes.error].find(Boolean);
      if (mapError) {
        setError(mapError.message);
        setLoading(false);
        return;
      }

      const materialMap: Record<string, MaterialRecord> = {};
      for (const row of (materialsRes.data ?? []) as MaterialRecord[]) materialMap[row.id] = row;
      setMaterialsById(materialMap);

      const siteMap: Record<string, SiteRecord> = {};
      for (const row of (sitesRes.data ?? []) as SiteRecord[]) siteMap[row.id] = row;
      setSitesById(siteMap);

      const warehouseMap: Record<string, WarehouseRecord> = {};
      for (const row of (warehousesRes.data ?? []) as WarehouseRecord[]) warehouseMap[row.id] = row;
      setWarehousesById(warehouseMap);

      const workOrderMap: Record<string, WorkOrderRecord> = {};
      for (const row of (workOrdersRes.data ?? []) as WorkOrderRecord[]) workOrderMap[row.id] = row;
      setWorkOrdersById(workOrderMap);

      setLoading(false);
    };

    void run();
  }, [activeCompanyId]);

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
                <th>Work Order</th>
                <th>Quantity Used</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.used_at)}</td>
                  <td>{materialsById[row.material_id]?.sku ?? row.material_id}</td>
                  <td>
                    {row.work_order_id ? (workOrdersById[row.work_order_id]?.wo_number ?? row.work_order_id) : "-"}
                  </td>
                  <td>{formatNumber(row.quantity_used)}</td>
                </tr>
              ))}
              {!loading && usage.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No material usage logged yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {error ? <p className="message message--error">{error}</p> : null}
      {!supabase ? <p className="message">Supabase is not configured for this deployment.</p> : null}
    </div>
  );
}
