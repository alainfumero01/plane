import { useEffect, useMemo, useState } from "react";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatDate, formatNumber } from "@/app/lib/format";
import { supabase } from "@/app/lib/supabase";

type WarehouseRecord = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
};

type WarehouseStockRecord = {
  id: string;
  warehouse_id: string;
  material_id: string;
  qty_on_hand: number;
  qty_reserved: number;
  reorder_level: number;
};

type TransferRecord = {
  id: string;
  from_warehouse_id: string | null;
  to_site_id: string | null;
  material_id: string;
  quantity: number;
  status: string;
  dispatched_at: string | null;
  received_at: string | null;
  created_at: string;
};

type MaterialRecord = { id: string; sku: string; name: string };
type SiteRecord = { id: string; site_code: string; name: string };

export default function WarehousePage() {
  const { activeCompanyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [stocks, setStocks] = useState<WarehouseStockRecord[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [materialsById, setMaterialsById] = useState<Record<string, MaterialRecord>>({});
  const [sitesById, setSitesById] = useState<Record<string, SiteRecord>>({});

  useEffect(() => {
    const run = async () => {
      if (!supabase || !activeCompanyId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const [warehouseRes, stockRes, transferRes] = await Promise.all([
        supabase
          .from("warehouses")
          .select("id,name,code,is_active")
          .eq("company_id", activeCompanyId)
          .order("code", { ascending: true }),
        supabase
          .from("warehouse_stock")
          .select("id,warehouse_id,material_id,qty_on_hand,qty_reserved,reorder_level")
          .eq("company_id", activeCompanyId)
          .order("updated_at", { ascending: false })
          .limit(120),
        supabase
          .from("inventory_transfers")
          .select("id,from_warehouse_id,to_site_id,material_id,quantity,status,dispatched_at,received_at,created_at")
          .eq("company_id", activeCompanyId)
          .order("created_at", { ascending: false })
          .limit(120),
      ]);

      const firstError = [warehouseRes.error, stockRes.error, transferRes.error].find(Boolean);
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const nextWarehouses = (warehouseRes.data ?? []) as WarehouseRecord[];
      const nextStocks = (stockRes.data ?? []) as WarehouseStockRecord[];
      const nextTransfers = (transferRes.data ?? []) as TransferRecord[];
      setWarehouses(nextWarehouses);
      setStocks(nextStocks);
      setTransfers(nextTransfers);

      const materialIds = Array.from(new Set([...nextStocks, ...nextTransfers].map((row) => row.material_id)));
      const siteIds = Array.from(
        new Set(nextTransfers.map((row) => row.to_site_id).filter((value): value is string => Boolean(value)))
      );

      const [materialsRes, sitesRes] = await Promise.all([
        materialIds.length > 0
          ? supabase.from("materials").select("id,sku,name").eq("company_id", activeCompanyId).in("id", materialIds)
          : Promise.resolve({ data: [], error: null }),
        siteIds.length > 0
          ? supabase.from("sites").select("id,site_code,name").eq("company_id", activeCompanyId).in("id", siteIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const mapError = [materialsRes.error, sitesRes.error].find(Boolean);
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

      setLoading(false);
    };

    void run();
  }, [activeCompanyId]);

  const today = new Date().toISOString().slice(0, 10);
  const openTransfers = transfers.filter((row) => row.status !== "received").length;
  const dispatchedToday = transfers.filter((row) => row.dispatched_at?.slice(0, 10) === today).length;
  const receivedToday = transfers.filter((row) => row.received_at?.slice(0, 10) === today).length;
  const pendingScanIn = stocks.filter((row) => Number(row.qty_on_hand ?? 0) <= Number(row.reorder_level ?? 0)).length;

  const warehouseById = useMemo(() => {
    const map: Record<string, WarehouseRecord> = {};
    for (const row of warehouses) map[row.id] = row;
    return map;
  }, [warehouses]);

  return (
    <div className="screen-stack">
      <ScreenFrame
        title="Warehouse Operations"
        description="Live scan-in, dispatch, and receiving controls for warehouse-to-site logistics."
        highlights={[
          { label: "Open Transfers", value: formatNumber(openTransfers) },
          { label: "Dispatched Today", value: formatNumber(dispatchedToday) },
          { label: "Received Today", value: formatNumber(receivedToday) },
          { label: "Reorder Alerts", value: formatNumber(pendingScanIn) },
        ]}
        panels={[
          {
            title: "Dispatch Queue",
            items: [
              `${formatNumber(transfers.length)} transfer records in current queue view`,
              `${formatNumber(openTransfers)} transfer(s) still open`,
              `${formatNumber(warehouses.length)} warehouse location(s) configured`,
            ],
          },
          {
            title: "Warehouse Controls",
            items: [
              `${formatNumber(stocks.length)} stock ledger entries`,
              "Transfer lifecycle remains auditable from request to receipt",
              "Warehouse and site context is attached to every movement record",
            ],
          },
        ]}
        actions={["Scan inventory into stock ledger", "Dispatch transfer to site", "Mark transfer received"]}
      />

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Warehouse Stock</h3>
          <p>{loading ? "Refreshing..." : `${stocks.length} stock row(s)`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>Material</th>
                <th>On Hand</th>
                <th>Reserved</th>
                <th>Reorder Level</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((row) => (
                <tr key={row.id}>
                  <td>{warehouseById[row.warehouse_id]?.code ?? row.warehouse_id}</td>
                  <td>
                    {materialsById[row.material_id]?.sku ?? row.material_id}
                    <div className="muted">{materialsById[row.material_id]?.name ?? "Unknown material"}</div>
                  </td>
                  <td>{formatNumber(row.qty_on_hand)}</td>
                  <td>{formatNumber(row.qty_reserved)}</td>
                  <td>{formatNumber(row.reorder_level)}</td>
                </tr>
              ))}
              {!loading && stocks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No warehouse stock records available.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Transfer History</h3>
          <p>{`${transfers.length} transfer(s)`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Material</th>
                <th>From</th>
                <th>To</th>
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
                      ? (warehouseById[row.from_warehouse_id]?.code ?? row.from_warehouse_id)
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
                    No transfer records found.
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
