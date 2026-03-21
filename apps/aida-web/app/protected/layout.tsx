import { Navigate, Outlet, useLocation } from "react-router";
import { AppShell } from "@/app/components/app-shell";
import { useAuth } from "@/app/lib/auth-context";
import { canAccessPath } from "@/app/lib/roles";

export default function ProtectedLayout() {
  const location = useLocation();
  const { loading, session, roles } = useAuth();

  if (loading) {
    return (
      <div className="public-page">
        <div className="public-card">
          <h1>Loading AIDA workspace...</h1>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canAccessPath(location.pathname, roles)) {
    return (
      <AppShell>
        <div className="screen-frame">
          <header className="screen-frame__header">
            <h2>Access Restricted</h2>
            <p>Your current role cannot open this module. Use Role Preview or request elevated access.</p>
          </header>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
