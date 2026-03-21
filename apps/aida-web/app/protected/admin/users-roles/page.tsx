import { ScreenFrame } from "@/app/components/screen-frame";

export default function UsersRolesPage() {
  return (
    <ScreenFrame
      title="User and Role Management"
      description="Company governance for memberships, role assignment, and site-level access control boundaries."
      highlights={[
        { label: "Active Members", value: "184" },
        { label: "Pending Invites", value: "9" },
        { label: "Custom Roles", value: "2" },
        { label: "Site Assignments", value: "133" },
      ]}
      panels={[
        {
          title: "Role Matrix",
          items: [
            "Business Owner / Admin: company-wide control",
            "Warehouse: logistics control",
            "Project Manager: planning + execution",
            "Site Operator: assigned sites only",
            "Off-Shore Engineer: review/report workflows",
          ],
        },
        {
          title: "Access Boundaries",
          items: [
            "Company-level isolation via RLS",
            "Site assignment overlays for operator scope",
            "Audit logs for permission-sensitive changes",
          ],
        },
      ]}
      actions={[
        "Invite or deactivate member",
        "Change membership role",
        "Manage site assignments",
      ]}
    />
  );
}
