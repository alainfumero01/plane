import { useParams } from "react-router";
import { ScreenFrame } from "@/app/components/screen-frame";

export default function ProjectDetailPage() {
  const { projectId } = useParams();

  return (
    <ScreenFrame
      title={`Project Detail: ${projectId ?? "unknown-project"}`}
      description="Contract-level planning, scope controls, delay impact, and projected profit visibility."
      highlights={[
        { label: "Planned Start", value: "2026-03-25" },
        { label: "Planned End", value: "2026-06-28" },
        { label: "Projected Revenue", value: "$1,240,000" },
        { label: "Projected Profit", value: "$412,800" },
      ]}
      panels={[
        {
          title: "Execution Snapshot",
          items: [
            "57 open work orders across 12 sites",
            "8 active delay events with 126 impact hours",
            "Engineer review SLA adherence: 94%",
          ],
        },
        {
          title: "Scope and Risk",
          items: [
            "Lightning strike remediation package at Site SP-03",
            "Composite reinforcement backlog at Site GH-02",
            "Weather-driven timeline risk flagged by PM assistant",
          ],
        },
      ]}
      actions={[
        "Adjust project scope items",
        "Approve budget rebaseline",
        "Publish project status summary",
      ]}
    />
  );
}
