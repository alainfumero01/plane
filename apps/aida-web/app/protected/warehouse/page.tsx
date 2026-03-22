import { useCallback, useMemo, useEffect, useState } from "react";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatDate, formatNumber } from "@/app/lib/format";
import type { RoleCode } from "@/app/lib/roles";
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

type SiteStockSnapshot = {
  qty_on_hand: number;
  qty_allocated: number;
};

export default function WarehousePage() {
  const { activeCompanyId, roles } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [stocks, setStocks] = useState<WarehouseStockRecord[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);

  const [materialsById, setMaterialsById] = useState<Record<string, MaterialRecord>>({});
  const [sitesById, setSitesById] = useState<Record<string, SiteRecord>>({});

  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseCode, setWarehouseCode] = useState("");
  const [warehouseActive, setWarehouseActive] = useState(true);
  const [warehouseBusy, setWarehouseBusy] = useState(false);

  const [scanWarehouseId, setScanWarehouseId] = useState("");
  const [scanMaterialId, setScanMaterialId] = useState("");
  const [scanQuantity, setScanQuantity] = useState("1");
  const [scanReorderLevel, setScanReorderLevel] = useState("0");
  const [scanBusy, setScanBusy] = useState(false);

  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const canManageWarehouse = useMemo(
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

    const [warehouseRes, stockRes, transferRes, materialsRes, sitesRes] = await Promise.all([
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
      supabase
        .from("materials")
        .select("id,sku,name")
        .eq("company_id", activeCompanyId)
        .order("sku", { ascending: true }),
      supabase
        .from("sites")
        .select("id,site_code,name")
        .eq("company_id", activeCompanyId)
        .order("site_code", { ascending: true }),
    ]);

    const firstError = [warehouseRes.error, stockRes.error, transferRes.error, materialsRes.error, sitesRes.error].find(
      Boolean
    );
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const nextWarehouses = (warehouseRes.data ?? []) as WarehouseRecord[];
    const nextStocks = (stockRes.data ?? []) as WarehouseStockRecord[];
    const nextTransfers = (transferRes.data ?? []) as TransferRecord[];
    const nextMaterials = (materialsRes.data ?? []) as MaterialRecord[];
    const nextSites = (sitesRes.data ?? []) as SiteRecord[];

    setWarehouses(nextWarehouses);
    setStocks(nextStocks);
    setTransfers(nextTransfers);
    setMaterials(nextMaterials);

    const materialMap: Record<string, MaterialRecord> = {};
    for (const row of nextMaterials) materialMap[row.id] = row;
    setMaterialsById(materialMap);

    const siteMap: Record<string, SiteRecord> = {};
    for (const row of nextSites) siteMap[row.id] = row;
    setSitesById(siteMap);

    if (!scanWarehouseId && nextWarehouses[0]) setScanWarehouseId(nextWarehouses[0].id);
    if (!scanMaterialId && nextMaterials[0]) setScanMaterialId(nextMaterials[0].id);

    setLoading(false);
  }, [activeCompanyId, scanMaterialId, scanWarehouseId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  const handleCreateWarehouse = async () => {
    if (!supabase || !activeCompanyId) return;

    setWarehouseBusy(true);
    setError(null);
    setSuccess(null);

    const payload = {
      company_id: activeCompanyId,
      name: warehouseName.trim(),
      code: warehouseCode.trim().toUpperCase(),
      is_active: warehouseActive,
      location: {},
    };

    const { error: insertError } = await supabase.from("warehouses").insert(payload);
    if (insertError) {
      setError(insertError.message);
      setWarehouseBusy(false);
      return;
    }

    setWarehouseName("");
    setWarehouseCode("");
    setWarehouseActive(true);
    setSuccess(`Warehouse ${payload.code} created.`);
    await loadData();
    setWarehouseBusy(false);
  };

  const handleScanIn = async () => {
    if (!supabase || !activeCompanyId || !scanWarehouseId || !scanMaterialId) return;

    setScanBusy(true);
    setError(null);
    setSuccess(null);

    const existing = stocks.find((row) => row.warehouse_id === scanWarehouseId && row.material_id === scanMaterialId);

    const nextOnHand = Number(existing?.qty_on_hand ?? 0) + Number(scanQuantity || 0);
    const nextReserved = Number(existing?.qty_reserved ?? 0);
    const nextReorder =
      scanReorderLevel.trim().length > 0 ? Number(scanReorderLevel || 0) : Number(existing?.reorder_level ?? 0);

    const payload = {
      company_id: activeCompanyId,
      warehouse_id: scanWarehouseId,
      material_id: scanMaterialId,
      qty_on_hand: nextOnHand,
      qty_reserved: nextReserved,
      reorder_level: nextReorder,
    };

    const { error: upsertError } = await supabase
      .from("warehouse_stock")
      .upsert(payload, { onConflict: "company_id,warehouse_id,material_id" });

    if (upsertError) {
      setError(upsertError.message);
      setScanBusy(false);
      return;
    }

    setScanQuantity("1");
    setSuccess("Stock scan-in applied.");
    await loadData();
    setScanBusy(false);
  };

  const handleMarkDispatched = async (transfer: TransferRecord) => {
    if (!supabase || !activeCompanyId) return;

    setStatusBusyId(transfer.id);
    setError(null);
    setSuccess(null);

    const now = new Date().toISOString();
    const { error: transferError } = await supabase
      .from("inventory_transfers")
      .update({ status: "dispatched", dispatched_at: now })
      .eq("company_id", activeCompanyId)
      .eq("id", transfer.id)
      .in("status", ["requested", "queued"]);

    if (transferError) {
      setError(transferError.message);
      setStatusBusyId(null);
      return;
    }

    if (transfer.from_warehouse_id) {
      const existing = stocks.find(
        (row) => row.warehouse_id === transfer.from_warehouse_id && row.material_id === transfer.material_id
      );

      const nextOnHand = Math.max(0, Number(existing?.qty_on_hand ?? 0) - Number(transfer.quantity || 0));

      const { error: stockError } = await supabase.from("warehouse_stock").upsert(
        {
          company_id: activeCompanyId,
          warehouse_id: transfer.from_warehouse_id,
          material_id: transfer.material_id,
          qty_on_hand: nextOnHand,
          qty_reserved: Number(existing?.qty_reserved ?? 0),
          reorder_level: Number(existing?.reorder_level ?? 0),
        },
        { onConflict: "company_id,warehouse_id,material_id" }
      );

      if (stockError) {
        setError(stockError.message);
        setStatusBusyId(null);
        return;
      }
    }

    setSuccess("Transfer marked dispatched.");
    await loadData();
    setStatusBusyId(null);
  };

  const handleMarkReceived = async (transfer: TransferRecord) => {
    if (!supabase || !activeCompanyId) return;

    setStatusBusyId(transfer.id);
    setError(null);
    setSuccess(null);

    const now = new Date().toISOString();
    const { error: transferError } = await supabase
      .from("inventory_transfers")
      .update({ status: "received", received_at: now })
      .eq("company_id", activeCompanyId)
      .eq("id", transfer.id)
      .eq("status", "dispatched");

    if (transferError) {
      setError(transferError.message);
      setStatusBusyId(null);
      return;
    }

    if (transfer.to_site_id) {
      const siteStockRes = await supabase
        .from("site_stock")
        .select("qty_on_hand,qty_allocated")
        .eq("company_id", activeCompanyId)
        .eq("site_id", transfer.to_site_id)
        .eq("material_id", transfer.material_id)
        .maybeSingle<SiteStockSnapshot>();

      if (siteStockRes.error) {
        setError(siteStockRes.error.message);
        setStatusBusyId(null);
        return;
      }

      const nextOnHand = Number(siteStockRes.data?.qty_on_hand ?? 0) + Number(transfer.quantity || 0);
      const nextAllocated = Number(siteStockRes.data?.qty_allocated ?? 0);

      const { error: siteStockError } = await supabase.from("site_stock").upsert(
        {
          company_id: activeCompanyId,
          site_id: transfer.to_site_id,
          material_id: transfer.material_id,
          qty_on_hand: nextOnHand,
          qty_allocated: nextAllocated,
        },
        { onConflict: "company_id,site_id,material_id" }
      );

      if (siteStockError) {
        setError(siteStockError.message);
        setStatusBusyId(null);
        return;
      }
    }

    setSuccess("Transfer marked received and site stock reconciled.");
    await loadData();
    setStatusBusyId(null);
  };

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

      {canManageWarehouse ? (
        <section className="data-panel two-col">
          <article>
            <header className="data-panel__header">
              <h3>Create Warehouse</h3>
              <p>Warehouse/Admin action</p>
            </header>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateWarehouse();
              }}
            >
              <label>
                Warehouse Name
                <input
                  value={warehouseName}
                  onChange={(event) => setWarehouseName(event.target.value)}
                  required
                  placeholder="Central Materials Hub"
                />
              </label>
              <label>
                Code
                <input
                  value={warehouseCode}
                  onChange={(event) => setWarehouseCode(event.target.value)}
                  required
                  placeholder="WH-TX-01"
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={warehouseActive}
                  onChange={(event) => setWarehouseActive(event.target.checked)}
                />
                Warehouse is active
              </label>
              <button type="submit" disabled={warehouseBusy || !warehouseName.trim() || !warehouseCode.trim()}>
                {warehouseBusy ? "Creating..." : "Create Warehouse"}
              </button>
            </form>
          </article>

          <article>
            <header className="data-panel__header">
              <h3>Scan-In Stock</h3>
              <p>Add quantity into warehouse ledger</p>
            </header>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleScanIn();
              }}
            >
              <label>
                Warehouse
                <select value={scanWarehouseId} onChange={(event) => setScanWarehouseId(event.target.value)} required>
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
                Material
                <select value={scanMaterialId} onChange={(event) => setScanMaterialId(event.target.value)} required>
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
                Quantity to Add
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={scanQuantity}
                  onChange={(event) => setScanQuantity(event.target.value)}
                />
              </label>
              <label>
                Reorder Level (optional)
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={scanReorderLevel}
                  onChange={(event) => setScanReorderLevel(event.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={scanBusy || !scanWarehouseId || !scanMaterialId || Number(scanQuantity || 0) <= 0}
              >
                {scanBusy ? "Applying..." : "Apply Scan-In"}
              </button>
            </form>
          </article>
        </section>
      ) : null}

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
                {canManageWarehouse ? <th>Action</th> : null}
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
                  {canManageWarehouse ? (
                    <td className="row-actions">
                      {row.status === "requested" || row.status === "queued" ? (
                        <button
                          type="button"
                          onClick={() => void handleMarkDispatched(row)}
                          disabled={statusBusyId === row.id}
                        >
                          {statusBusyId === row.id ? "Updating..." : "Mark Dispatched"}
                        </button>
                      ) : null}
                      {row.status === "dispatched" ? (
                        <button
                          type="button"
                          onClick={() => void handleMarkReceived(row)}
                          disabled={statusBusyId === row.id}
                        >
                          {statusBusyId === row.id ? "Updating..." : "Mark Received"}
                        </button>
                      ) : null}
                      {row.status === "received" ? "Done" : null}
                    </td>
                  ) : null}
                </tr>
              ))}
              {!loading && transfers.length === 0 ? (
                <tr>
                  <td colSpan={canManageWarehouse ? 7 : 6} className="table-empty">
                    No transfer records found.
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
