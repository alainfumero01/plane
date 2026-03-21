import { useEffect, useMemo, useState } from "react";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatDate, formatNumber } from "@/app/lib/format";
import { supabase } from "@/app/lib/supabase";

type EngineerReviewRecord = {
  id: string;
  work_order_id: string;
  site_id: string;
  review_status: string;
  review_notes: string;
  reviewed_at: string | null;
  created_at: string;
};

type QuestionRecord = {
  id: string;
  thread_id: string;
  site_id: string;
  question_text: string;
  priority: string;
  asked_at: string;
};

type ResponseRecord = {
  id: string;
  question_id: string;
  response_text: string;
  responded_at: string;
};

type WorkOrderRecord = { id: string; wo_number: string; title: string };
type SiteRecord = { id: string; site_code: string; name: string };

export default function EngineerReviewPage() {
  const { activeCompanyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<EngineerReviewRecord[]>([]);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const [workOrdersById, setWorkOrdersById] = useState<Record<string, WorkOrderRecord>>({});
  const [sitesById, setSitesById] = useState<Record<string, SiteRecord>>({});

  useEffect(() => {
    const run = async () => {
      if (!supabase || !activeCompanyId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const [reviewsRes, questionsRes, responsesRes] = await Promise.all([
        supabase
          .from("engineer_reviews")
          .select("id,work_order_id,site_id,review_status,review_notes,reviewed_at,created_at")
          .eq("company_id", activeCompanyId)
          .order("created_at", { ascending: false })
          .limit(120),
        supabase
          .from("operator_questions")
          .select("id,thread_id,site_id,question_text,priority,asked_at")
          .eq("company_id", activeCompanyId)
          .order("asked_at", { ascending: false })
          .limit(120),
        supabase
          .from("engineer_responses")
          .select("id,question_id,response_text,responded_at")
          .eq("company_id", activeCompanyId)
          .order("responded_at", { ascending: false })
          .limit(120),
      ]);

      const firstError = [reviewsRes.error, questionsRes.error, responsesRes.error].find(Boolean);
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const nextReviews = (reviewsRes.data ?? []) as EngineerReviewRecord[];
      const nextQuestions = (questionsRes.data ?? []) as QuestionRecord[];
      const nextResponses = (responsesRes.data ?? []) as ResponseRecord[];
      setReviews(nextReviews);
      setQuestions(nextQuestions);
      setResponses(nextResponses);

      const workOrderIds = Array.from(new Set(nextReviews.map((row) => row.work_order_id)));
      const siteIds = Array.from(
        new Set([...nextReviews.map((row) => row.site_id), ...nextQuestions.map((row) => row.site_id)])
      );

      const [workOrdersRes, sitesRes] = await Promise.all([
        workOrderIds.length > 0
          ? supabase
              .from("work_orders")
              .select("id,wo_number,title")
              .eq("company_id", activeCompanyId)
              .in("id", workOrderIds)
          : Promise.resolve({ data: [], error: null }),
        siteIds.length > 0
          ? supabase.from("sites").select("id,site_code,name").eq("company_id", activeCompanyId).in("id", siteIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const mapError = [workOrdersRes.error, sitesRes.error].find(Boolean);
      if (mapError) {
        setError(mapError.message);
        setLoading(false);
        return;
      }

      const workOrderMap: Record<string, WorkOrderRecord> = {};
      for (const row of (workOrdersRes.data ?? []) as WorkOrderRecord[]) workOrderMap[row.id] = row;
      setWorkOrdersById(workOrderMap);

      const siteMap: Record<string, SiteRecord> = {};
      for (const row of (sitesRes.data ?? []) as SiteRecord[]) siteMap[row.id] = row;
      setSitesById(siteMap);

      setLoading(false);
    };

    void run();
  }, [activeCompanyId]);

  const responseByQuestion = useMemo(() => {
    const map = new Map<string, ResponseRecord>();
    for (const row of responses) {
      if (!map.has(row.question_id)) map.set(row.question_id, row);
    }
    return map;
  }, [responses]);

  const pendingQuestions = questions.filter((row) => !responseByQuestion.has(row.id)).length;
  const pendingReviews = reviews.filter((row) => row.review_status === "pending").length;
  const awaitingEvidence = reviews.filter((row) => row.review_status === "needs_more_evidence").length;

  return (
    <div className="screen-stack">
      <ScreenFrame
        title="Engineer Review"
        description="Remote technical decision workspace for evidence review, Q&A response, and signoff progression."
        highlights={[
          { label: "Pending Questions", value: formatNumber(pendingQuestions) },
          { label: "Pending Reviews", value: formatNumber(pendingReviews) },
          { label: "Responses Logged", value: formatNumber(responses.length) },
          { label: "Awaiting More Evidence", value: formatNumber(awaitingEvidence) },
        ]}
        panels={[
          {
            title: "Review Queue",
            items: [
              `${formatNumber(reviews.length)} review records in active queue`,
              `${formatNumber(reviews.filter((row) => row.review_status === "approved").length)} approved decisions`,
              `${formatNumber(reviews.filter((row) => row.review_status === "rejected").length)} rejected decisions`,
            ],
          },
          {
            title: "Communication Readiness",
            items: [
              `${formatNumber(questions.length)} operator questions tracked`,
              "Questions are linked to site and thread context for future channel ingestion",
              "Response logs remain compatible with external_message_links evolution",
            ],
          },
        ]}
        actions={["Respond to operator question", "Approve or reject repair outcome", "Request additional evidence"]}
      />

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Review Queue</h3>
          <p>{loading ? "Refreshing..." : `${reviews.length} review(s)`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Work Order</th>
                <th>Site</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((row) => (
                <tr key={row.id}>
                  <td>{workOrdersById[row.work_order_id]?.wo_number ?? row.work_order_id}</td>
                  <td>{sitesById[row.site_id]?.site_code ?? row.site_id}</td>
                  <td>
                    <span className="chip">{row.review_status.replace("_", " ")}</span>
                  </td>
                  <td>{row.review_notes || "-"}</td>
                  <td>{row.reviewed_at ? formatDate(row.reviewed_at) : "Pending"}</td>
                </tr>
              ))}
              {!loading && reviews.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No engineer reviews recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Operator Q&A</h3>
          <p>{`${questions.length} question(s)`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Site</th>
                <th>Question</th>
                <th>Asked</th>
                <th>Response</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((row) => {
                const response = responseByQuestion.get(row.id);
                return (
                  <tr key={row.id}>
                    <td>{row.priority}</td>
                    <td>{sitesById[row.site_id]?.site_code ?? row.site_id}</td>
                    <td>{row.question_text}</td>
                    <td>{formatDate(row.asked_at)}</td>
                    <td>
                      {response
                        ? `${formatDate(response.responded_at)} · ${response.response_text}`
                        : "Pending response"}
                    </td>
                  </tr>
                );
              })}
              {!loading && questions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No operator questions recorded yet.
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
