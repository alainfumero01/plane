import { useParams } from "react-router";
import { ScreenFrame } from "@/app/components/screen-frame";

export default function TurbineBladeDetailPage() {
  const { turbineId, bladeId } = useParams();

  return (
    <ScreenFrame
      title={`Turbine ${turbineId ?? "?"} / Blade ${bladeId ?? "?"}`}
      description="Asset-level repair history, methodology references, and evidence timeline for engineering decisions."
      highlights={[
        { label: "Blade Status", value: "In Repair" },
        { label: "Damage Severity", value: "High" },
        { label: "Evidence Items", value: "46" },
        { label: "Current Methodology", value: "RPR-COMP-7.2" },
      ]}
      panels={[
        {
          title: "Damage Timeline",
          items: [
            "2026-03-14: Initial crack map uploaded",
            "2026-03-16: Engineer requested additional thermal images",
            "2026-03-18: Reinforcement patch approved",
          ],
        },
        {
          title: "QA Control",
          items: [
            "Inspection checkpoints linked to evidence sequence",
            "Pending final post-cure validation",
            "Signoff blocked until final photo series uploaded",
          ],
        },
      ]}
      actions={[
        "Open linked work order",
        "Upload new inspection evidence",
        "Request engineer signoff",
      ]}
    />
  );
}
