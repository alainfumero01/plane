import { ScreenFrame } from "@/app/components/screen-frame";

export default function InventoryPage() {
  return (
    <ScreenFrame
      title="Inventory"
      description="Visibility across site stock, transfer status, and material consumption tied to active work orders."
      highlights={[
        { label: "Warehouse SKUs", value: "1,482" },
        { label: "Site SKUs", value: "398" },
        { label: "Transfers In Transit", value: "14" },
        { label: "Shortage Alerts", value: "6" },
      ]}
      panels={[
        {
          title: "Site Stock Snapshot",
          items: [
            "SP-03 Resin Kit RK-22: 12 units",
            "GH-02 Fiberglass Roll FG-48: 4 units (critical)",
            "NC-07 PPE Shield Set: 33 units",
          ],
        },
        {
          title: "Material Usage Trace",
          items: [
            "WO-882 consumed RK-22 (2.5 units)",
            "WO-901 consumed ADH-19 (1.2 units)",
            "WO-917 consumed CLR-04 (0.8 units)",
          ],
        },
      ]}
      actions={[
        "Request warehouse transfer",
        "Review stock reconciliation",
        "Audit material usage by work order",
      ]}
    />
  );
}
