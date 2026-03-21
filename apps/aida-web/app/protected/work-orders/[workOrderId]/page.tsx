import { useParams } from "react-router";
import { ScreenFrame } from "@/app/components/screen-frame";

export default function WorkOrderDetailPage() {
  const { workOrderId } = useParams();

  return (
    <ScreenFrame
      title={`Work Order ${workOrderId ?? "unknown"}`}
      description="Execution workspace for task tracking, evidence capture, operator Q&A, and engineer review decisions."
      highlights={[
        { label: "Status", value: "In Progress" },
        { label: "Priority", value: "High" },
        { label: "Planned Hours", value: "42" },
        { label: "Actual Hours", value: "31" },
      ]}
      panels={[
        {
          title: "Task Queue",
          items: [
            "Surface prep and contamination removal - done",
            "Composite layup pass 1 - in progress",
            "Cure and post-cure inspection - queued",
          ],
        },
        {
          title: "Engineer Collaboration",
          items: [
            "Q-148: Operator asked about edge bonding tolerance",
            "Engineer response posted with updated spec limits",
            "Review decision: continue with method RPR-COMP-7.2",
          ],
        },
      ]}
      actions={[
        "Update task progress",
        "Upload repair evidence",
        "Log delay and impact",
      ]}
    />
  );
}
