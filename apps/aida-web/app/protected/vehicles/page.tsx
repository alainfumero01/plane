import { ScreenFrame } from "@/app/components/screen-frame";

export default function VehiclesPage() {
  return (
    <ScreenFrame
      title="Vehicles"
      description="Fleet tracking for dispatch, return, and site assignment history."
      highlights={[
        { label: "Vehicles Registered", value: "64" },
        { label: "Currently Deployed", value: "36" },
        { label: "In Maintenance", value: "5" },
        { label: "Driver Assignments", value: "32" },
      ]}
      panels={[
        {
          title: "Current Site Deployments",
          items: [
            "TX-4421 Pickup at SP-03",
            "TX-1809 Utility Van at GH-02",
            "TX-9234 Crane Support at NC-07",
          ],
        },
        {
          title: "Dispatch Integrity",
          items: [
            "Outbound and return timestamps",
            "Driver responsibility chain",
            "Vehicle usage tied to project/site context",
          ],
        },
      ]}
      actions={[
        "Assign vehicle to site",
        "Record vehicle return",
        "Review assignment history",
      ]}
    />
  );
}
