import { useEffect, useMemo, useState } from "react";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatDate, formatNumber } from "@/app/lib/format";
import { supabase } from "@/app/lib/supabase";

type ReportRecord = {
  id: string;
  project_id: string | null;
  site_id: string | null;
  template_id: string | null;
  report_type: string;
  status: string;
  generated_at: string;
  approved_at: string | null;
  export_path: string | null;
};

type TemplateRecord = {
  id: string;
  name: string;
  version: string;
  is_default: boolean;
};

type SectionRecord = {
  id: string;
  report_id: string;
  title: string;
  section_key: string;
  order_no: number;
};

type SiteRecord = { id: string; site_code: string; name: string };
type ProjectRecord = { id: string; code: string; name: string };

export default function ReportsPage() {
  const { activeCompanyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [sitesById, setSitesById] = useState<Record<string, SiteRecord>>({});
  const [projectsById, setProjectsById] = useState<Record<string, ProjectRecord>>({});

  useEffect(() => {
    const run = async () => {
      if (!supabase || !activeCompanyId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const [reportsRes, templatesRes, sectionsRes] = await Promise.all([
        supabase
          .from("reports")
          .select("id,project_id,site_id,template_id,report_type,status,generated_at,approved_at,export_path")
          .eq("company_id", activeCompanyId)
          .order("generated_at", { ascending: false })
          .limit(120),
        supabase
          .from("report_templates")
          .select("id,name,version,is_default")
          .eq("company_id", activeCompanyId)
          .order("name", { ascending: true }),
        supabase
          .from("report_sections")
          .select("id,report_id,title,section_key,order_no")
          .eq("company_id", activeCompanyId)
          .order("order_no", { ascending: true })
          .limit(300),
      ]);

      const firstError = [reportsRes.error, templatesRes.error, sectionsRes.error].find(Boolean);
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const nextReports = (reportsRes.data ?? []) as ReportRecord[];
      setReports(nextReports);
      setTemplates((templatesRes.data ?? []) as TemplateRecord[]);
      setSections((sectionsRes.data ?? []) as SectionRecord[]);

      const siteIds = Array.from(
        new Set(nextReports.map((row) => row.site_id).filter((value): value is string => Boolean(value)))
      );
      const projectIds = Array.from(
        new Set(nextReports.map((row) => row.project_id).filter((value): value is string => Boolean(value)))
      );

      const [sitesRes, projectsRes] = await Promise.all([
        siteIds.length > 0
          ? supabase.from("sites").select("id,site_code,name").eq("company_id", activeCompanyId).in("id", siteIds)
          : Promise.resolve({ data: [], error: null }),
        projectIds.length > 0
          ? supabase.from("projects").select("id,code,name").eq("company_id", activeCompanyId).in("id", projectIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const mapError = [sitesRes.error, projectsRes.error].find(Boolean);
      if (mapError) {
        setError(mapError.message);
        setLoading(false);
        return;
      }

      const siteMap: Record<string, SiteRecord> = {};
      for (const row of (sitesRes.data ?? []) as SiteRecord[]) siteMap[row.id] = row;
      setSitesById(siteMap);

      const projectMap: Record<string, ProjectRecord> = {};
      for (const row of (projectsRes.data ?? []) as ProjectRecord[]) projectMap[row.id] = row;
      setProjectsById(projectMap);

      setLoading(false);
    };

    void run();
  }, [activeCompanyId]);

  const templateById = useMemo(() => {
    const map: Record<string, TemplateRecord> = {};
    for (const row of templates) map[row.id] = row;
    return map;
  }, [templates]);

  const sectionCountByReport = useMemo(() => {
    const map = new Map<string, number>();
    for (const section of sections) {
      map.set(section.report_id, (map.get(section.report_id) ?? 0) + 1);
    }
    return map;
  }, [sections]);

  const draftReports = reports.filter((row) => row.status === "draft").length;
  const readyForApproval = reports.filter((row) => row.status === "ready_for_approval").length;
  const latestExport = reports.find((row) => Boolean(row.export_path));

  return (
    <div className="screen-stack">
      <ScreenFrame
        title="Reports"
        description="Prefilled project completion reporting with evidence references, delays, approvals, and export workflow."
        highlights={[
          { label: "Draft Reports", value: formatNumber(draftReports) },
          { label: "Ready for Approval", value: formatNumber(readyForApproval) },
          { label: "Template Versions", value: formatNumber(templates.length) },
          { label: "Latest Export", value: latestExport ? formatDate(latestExport.generated_at) : "-" },
        ]}
        panels={[
          {
            title: "Report Composition",
            items: [
              `${formatNumber(sections.length)} section block(s) currently stored`,
              `${formatNumber(reports.length)} report instance(s) tracked`,
              "Report rows remain linked to site/project execution context",
            ],
          },
          {
            title: "Workflow Baseline",
            items: [
              "Draft and approval statuses are tracked on every report",
              "Template versions are company-scoped and reusable",
              "Export path is persisted for final package traceability",
            ],
          },
        ]}
        actions={["Generate report draft", "Edit section narratives", "Finalize and export report"]}
      />

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Report Templates</h3>
          <p>{loading ? "Refreshing..." : `${templates.length} template(s)`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Version</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td>{template.name}</td>
                  <td>{template.version}</td>
                  <td>{template.is_default ? "Yes" : "No"}</td>
                </tr>
              ))}
              {!loading && templates.length === 0 ? (
                <tr>
                  <td colSpan={3} className="table-empty">
                    No report templates configured.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Report Register</h3>
          <p>{`${reports.length} report(s)`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Type</th>
                <th>Project</th>
                <th>Site</th>
                <th>Template</th>
                <th>Sections</th>
                <th>Generated</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className="chip">{row.status.replace("_", " ")}</span>
                  </td>
                  <td>{row.report_type}</td>
                  <td>{row.project_id ? (projectsById[row.project_id]?.code ?? row.project_id) : "-"}</td>
                  <td>{row.site_id ? (sitesById[row.site_id]?.site_code ?? row.site_id) : "-"}</td>
                  <td>{row.template_id ? (templateById[row.template_id]?.name ?? row.template_id) : "-"}</td>
                  <td>{formatNumber(sectionCountByReport.get(row.id) ?? 0)}</td>
                  <td>{formatDate(row.generated_at)}</td>
                </tr>
              ))}
              {!loading && reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    No reports generated yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {error ? <p className="message message--error">{error}</p> : null}
      {!supabase ? <p className="message">Supabase is not configured for this deployment.</p> : null}
    </div>
  );
}
