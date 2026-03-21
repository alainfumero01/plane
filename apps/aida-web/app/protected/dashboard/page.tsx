import { ScreenFrame } from "@/app/components/screen-frame";

export default function DashboardPage() {
  return (
    <ScreenFrame
      title="Operational Dashboard"
      description="Company-wide control tower for active wind repair programs, delay risks, and engineering review queues."
      highlights={[
        { label: "Active Sites", value: "12" },
        { label: "Open Work Orders", value: "57" },
        { label: "Unresolved Delays", value: "8" },
        { label: "Pending Engineer Reviews", value: "19" },
      ]}
      panels={[
        {
          title: "Live Site Operations",
          items: [
            "South Plains Wind Farm: 4 turbines under active blade repair",
            "Gulf Ridge Site: crew coverage at 86% for today",
            "North Crest Site: material shortage warning for resin kits",
          ],
        },
        {
          title: "Financial Pulse",
          items: [
            "Projected daily cost: $28,450",
            "Projected project profit: $412,800",
            "Largest current delay cost driver: weather stand-down",
          ],
        },
      ]}
      actions={[
        "Open high-risk site details",
        "Escalate unresolved delays",
        "Route pending questions to engineers",
      ]}
    />
  );
}
