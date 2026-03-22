import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/app/lib/auth-context";
import type { RoleCode } from "@/app/lib/roles";

const joinRoleOptions: Array<{ value: RoleCode; label: string }> = [
  { value: "site_operator", label: "Site Operator" },
  { value: "project_manager", label: "Project Manager" },
  { value: "warehouse", label: "Warehouse" },
  { value: "offshore_engineer", label: "Off-Shore Engineer" },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { createCompany, joinCompany, setDefaultCompany, user } = useAuth();
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [joinSlug, setJoinSlug] = useState("");
  const [joinRole, setJoinRole] = useState<RoleCode>("site_operator");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="screen-stack">
      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Complete Tenant Onboarding</h3>
          <p>{user?.email ?? "Authenticated user"}</p>
        </header>
        <p className="message">
          Your account is signed in, but it is not attached to any active company tenant yet. Create a new tenant or
          join an existing one to continue.
        </p>
      </section>

      <section className="data-panel two-col">
        <article>
          <header className="data-panel__header">
            <h3>Create Company</h3>
            <p>Start a new tenant</p>
          </header>

          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              setBusy("create");
              setError(null);
              setStatus(null);
              void (async () => {
                try {
                  await createCompany(createName.trim(), createSlug.trim() || null);
                  setStatus("Company created and set as default. Redirecting to dashboard...");
                  navigate("/dashboard", { replace: true });
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to create company.");
                } finally {
                  setBusy(null);
                }
              })();
            }}
          >
            <label>
              Company name
              <input
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                required
                placeholder="Appia Wind Services"
              />
            </label>
            <label>
              Slug (optional)
              <input
                value={createSlug}
                onChange={(event) => setCreateSlug(event.target.value)}
                placeholder="appia-wind"
              />
            </label>
            <button type="submit" disabled={busy !== null}>
              {busy === "create" ? "Creating..." : "Create Company"}
            </button>
          </form>
        </article>

        <article>
          <header className="data-panel__header">
            <h3>Join Existing Company</h3>
            <p>Use company slug</p>
          </header>

          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              setBusy("join");
              setError(null);
              setStatus(null);
              void (async () => {
                try {
                  const companyId = await joinCompany(joinSlug.trim(), joinRole);
                  await setDefaultCompany(companyId);
                  setStatus("Company joined and set as default. Redirecting to dashboard...");
                  navigate("/dashboard", { replace: true });
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to join company.");
                } finally {
                  setBusy(null);
                }
              })();
            }}
          >
            <label>
              Company slug
              <input
                value={joinSlug}
                onChange={(event) => setJoinSlug(event.target.value)}
                required
                placeholder="appia-wind"
              />
            </label>
            <label>
              Role
              <select value={joinRole} onChange={(event) => setJoinRole(event.target.value as RoleCode)}>
                {joinRoleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={busy !== null}>
              {busy === "join" ? "Joining..." : "Join Company"}
            </button>
          </form>
        </article>
      </section>

      {status ? <p className="message message--success">{status}</p> : null}
      {error ? <p className="message message--error">{error}</p> : null}
    </div>
  );
}
