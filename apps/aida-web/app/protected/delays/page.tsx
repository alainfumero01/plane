import { ScreenFrame } from "@/app/components/screen-frame";

export default function DelaysPage() {
  return (
    <ScreenFrame
      title="Delay Log"
      description="Delay capture with impact hours/cost tracking and escalation visibility for leadership and PM teams."
      highlights={[
        { label: "Open Delays", value: "8" },
        { label: "Critical Delays", value: "2" },
        { label: "Total Impact Hours", value: "126" },
        { label: "Impact Cost", value: "$74,300" },
      ]}
      panels={[
        {
          title: "Active Delay Events",
          items: [
            "Weather stand-down at SP-03 (high)",
            "Material shortage at GH-02 (critical)",
            "Crane downtime at NC-07 (medium)",
          ],
        },
        {
          title: "Escalation Readiness",
          items: [
            "Owner assignment and ETA required",
            "Management alert triggers by severity",
            "Projected profit impact roll-up",
          ],
        },
      ]}
      actions={[
        "Create new delay entry",
        "Update resolution timeline",
        "Escalate to upper management",
      ]}
    />
  );
}
