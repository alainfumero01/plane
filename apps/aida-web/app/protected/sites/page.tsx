import { Link } from "react-router";
import { ScreenFrame } from "@/app/components/screen-frame";

export default function SitesPage() {
  return (
    <div>
      <ScreenFrame
        title="Sites Portfolio"
        description="Portfolio view of all wind farm sites including repair load, staffing levels, inventory, and schedule windows."
        highlights={[
          { label: "Total Sites", value: "21" },
          { label: "Sites In Progress", value: "12" },
          { label: "Crew Members On Site", value: "143" },
          { label: "Vehicles Deployed", value: "36" },
        ]}
        panels={[
          {
            title: "Priority Sites",
            items: [
              "South Plains Wind Farm - Estimated end: 2026-04-10",
              "Prairie Harbor - Estimated end: 2026-05-03",
              "Sand Creek Wind Field - Delay watchlist",
            ],
          },
          {
            title: "Operational Visibility",
            items: [
              "Windmills actively worked on",
              "Crew roster and role assignment",
              "Inventory and vehicles currently on site",
            ],
          },
        ]}
        actions={[
          "Create or edit site profile",
          "Assign site operators and PMs",
          "Open site-level turbine/blade hierarchy",
        ]}
      />

      <p className="message">
        Quick links: <Link to="/sites/site-001">Site detail example</Link>
      </p>
    </div>
  );
}
