import { useParams, Link } from "react-router";
import { ScreenFrame } from "@/app/components/screen-frame";

export default function SiteDetailPage() {
  const { siteId } = useParams();
  const resolvedSite = siteId ?? "unknown-site";

  return (
    <div>
      <ScreenFrame
        title={`Site Detail: ${resolvedSite}`}
        description="Execution-focused site view showing turbines, blades, assigned crews, evidence activity, and risks."
        highlights={[
          { label: "Active Turbines", value: "9" },
          { label: "Assigned Crew", value: "23" },
          { label: "Materials On Site", value: "312 SKUs" },
          { label: "Daily Cost Estimate", value: "$6,920" },
        ]}
        panels={[
          {
            title: "Repair Scope",
            items: [
              "T-19 Blade B: edge delamination repair",
              "T-22 Blade A: lightning strike damage containment",
              "T-27 Blade C: gelcoat restoration and QA check",
            ],
          },
          {
            title: "People and Assets",
            items: [
              "Crew lead: Jordan Miles",
              "Engineer assigned: Isla Mendez",
              "Vehicles present: 3 trucks, 1 crane support",
            ],
          },
        ]}
        actions={[
          "Log delay event",
          "Open turbine/blade detail",
          "Review site evidence timeline",
        ]}
      />

      <p className="message">
        Continue to <Link to="/turbines/T-19/blades/B">Turbine/Blade detail</Link>
      </p>
    </div>
  );
}
