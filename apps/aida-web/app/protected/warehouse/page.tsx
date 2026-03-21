import { ScreenFrame } from "@/app/components/screen-frame";

export default function WarehousePage() {
  return (
    <ScreenFrame
      title="Warehouse Operations"
      description="Scan-in, transfer dispatch, and receiving controls for warehouse-to-site logistics."
      highlights={[
        { label: "Open Transfers", value: "14" },
        { label: "Dispatched Today", value: "9" },
        { label: "Received Today", value: "7" },
        { label: "Pending Scan-In", value: "22" },
      ]}
      panels={[
        {
          title: "Dispatch Queue",
          items: [
            "TR-112 to Site SP-03 (departing 08:30)",
            "TR-115 to Site GH-02 (awaiting quality release)",
            "TR-117 to Site NC-07 (driver assigned)",
          ],
        },
        {
          title: "Warehouse Controls",
          items: [
            "Barcode/QR scan intake",
            "Batch lot traceability",
            "Stock adjustment history with audit log",
          ],
        },
      ]}
      actions={[
        "Scan inventory into stock ledger",
        "Dispatch transfer to site",
        "Mark transfer received",
      ]}
    />
  );
}
