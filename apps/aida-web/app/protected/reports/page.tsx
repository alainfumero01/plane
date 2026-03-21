import { ScreenFrame } from "@/app/components/screen-frame";

export default function ReportsPage() {
  return (
    <ScreenFrame
      title="Reports"
      description="Prefilled project completion reporting with evidence references, costs, delays, approvals, and export workflow."
      highlights={[
        { label: "Draft Reports", value: "6" },
        { label: "Ready for Approval", value: "3" },
        { label: "Template Versions", value: "4" },
        { label: "Latest Export", value: "2026-03-20" },
      ]}
      panels={[
        {
          title: "Report Composition",
          items: [
            "Auto-prefill from work orders/tasks",
            "Evidence and inspection timeline binding",
            "Materials, costs, and delay summary roll-up",
          ],
        },
        {
          title: "AI Draft Workflow",
          items: [
            "report-draft edge function for narrative scaffold",
            "Engineer editing and approval chain",
            "Export path tracking for final package",
          ],
        },
      ]}
      actions={[
        "Generate report draft",
        "Edit section narratives",
        "Finalize and export report",
      ]}
    />
  );
}
