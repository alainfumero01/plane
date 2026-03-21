import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatDate, formatNumber } from "@/app/lib/format";
import { supabase } from "@/app/lib/supabase";

type WorkOrderRecord = {
  id: string;
  wo_number: string;
  title: string;
  status: string;
  priority: string;
  damage_summary: string;
  planned_hours: number | null;
  actual_hours: number | null;
  site_id: string;
  project_id: string;
};

type TaskRecord = {
  id: string;
  title: string;
  status: string;
  planned_hours: number;
  actual_hours: number;
};

type DelayRecord = {
  id: string;
  severity: string;
  reason: string;
  impact_hours: number;
  impact_cost: number;
  resolved_at: string | null;
};

type EvidenceRecord = {
  id: string;
  storage_path: string;
  captured_at: string;
  ai_summary: string | null;
};

type ThreadRecord = { id: string };

type QuestionRecord = {
  id: string;
  question_text: string;
  asked_at: string;
  priority: string;
};

type ResponseRecord = {
  question_id: string;
  response_text: string;
  responded_at: string;
};

type EngineerReviewRecord = {
  review_status: string;
  review_notes: string;
  reviewed_at: string | null;
};

export default function WorkOrderDetailPage() {
  const { workOrderId } = useParams();
  const { activeCompanyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workOrder, setWorkOrder] = useState<WorkOrderRecord | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [delays, setDelays] = useState<DelayRecord[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const [reviews, setReviews] = useState<EngineerReviewRecord[]>([]);

  useEffect(() => {
    const run = async () => {
      if (!supabase || !activeCompanyId || !workOrderId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const workOrderRes = await supabase
        .from("work_orders")
        .select("id,wo_number,title,status,priority,damage_summary,site_id,project_id")
        .eq("company_id", activeCompanyId)
        .eq("id", workOrderId)
        .maybeSingle<WorkOrderRecord>();

      if (workOrderRes.error) {
        setError(workOrderRes.error.message);
        setLoading(false);
        return;
      }

      if (!workOrderRes.data) {
        setWorkOrder(null);
        setLoading(false);
        return;
      }

      setWorkOrder(workOrderRes.data);

      const [tasksRes, delaysRes, evidenceRes, threadsRes, reviewsRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("id,title,status,planned_hours,actual_hours")
          .eq("company_id", activeCompanyId)
          .eq("work_order_id", workOrderId)
          .order("sequence_no", { ascending: true }),
        supabase
          .from("delays")
          .select("id,severity,reason,impact_hours,impact_cost,resolved_at")
          .eq("company_id", activeCompanyId)
          .eq("work_order_id", workOrderId)
          .order("start_at", { ascending: false }),
        supabase
          .from("evidence_items")
          .select("id,storage_path,captured_at,ai_summary")
          .eq("company_id", activeCompanyId)
          .eq("work_order_id", workOrderId)
          .order("captured_at", { ascending: false }),
        supabase
          .from("communication_threads")
          .select("id")
          .eq("company_id", activeCompanyId)
          .eq("work_order_id", workOrderId),
        supabase
          .from("engineer_reviews")
          .select("review_status,review_notes,reviewed_at")
          .eq("company_id", activeCompanyId)
          .eq("work_order_id", workOrderId)
          .order("reviewed_at", { ascending: false }),
      ]);

      const firstError = [tasksRes.error, delaysRes.error, evidenceRes.error, threadsRes.error, reviewsRes.error].find(
        Boolean
      );
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const threadIds = ((threadsRes.data ?? []) as ThreadRecord[]).map((thread) => thread.id);
      let questionRows: QuestionRecord[] = [];
      let responseRows: ResponseRecord[] = [];

      if (threadIds.length > 0) {
        const questionsRes = await supabase
          .from("operator_questions")
          .select("id,question_text,asked_at,priority")
          .eq("company_id", activeCompanyId)
          .in("thread_id", threadIds)
          .order("asked_at", { ascending: false });

        if (questionsRes.error) {
          setError(questionsRes.error.message);
          setLoading(false);
          return;
        }

        questionRows = (questionsRes.data ?? []) as QuestionRecord[];
        const questionIds = questionRows.map((question) => question.id);

        if (questionIds.length > 0) {
          const responsesRes = await supabase
            .from("engineer_responses")
            .select("question_id,response_text,responded_at")
            .eq("company_id", activeCompanyId)
            .in("question_id", questionIds)
            .order("responded_at", { ascending: false });

          if (responsesRes.error) {
            setError(responsesRes.error.message);
            setLoading(false);
            return;
          }

          responseRows = (responsesRes.data ?? []) as ResponseRecord[];
        }
      }

      setTasks((tasksRes.data ?? []) as TaskRecord[]);
      setDelays((delaysRes.data ?? []) as DelayRecord[]);
      setEvidence((evidenceRes.data ?? []) as EvidenceRecord[]);
      setReviews((reviewsRes.data ?? []) as EngineerReviewRecord[]);
      setQuestions(questionRows);
      setResponses(responseRows);
      setLoading(false);
    };

    void run();
  }, [activeCompanyId, workOrderId]);

  const totalPlannedHours = tasks.reduce((sum, task) => sum + Number(task.planned_hours ?? 0), 0);
  const totalActualHours = tasks.reduce((sum, task) => sum + Number(task.actual_hours ?? 0), 0);
  const responseByQuestion = useMemo(() => {
    const map = new Map<string, ResponseRecord>();
    for (const row of responses) {
      if (!map.has(row.question_id)) map.set(row.question_id, row);
    }
    return map;
  }, [responses]);

  return (
    <div className="screen-stack">
      <ScreenFrame
        title={`Work Order ${workOrder?.wo_number ?? workOrderId ?? "unknown"}`}
        description={workOrder?.title ?? "Execution workspace for tasks, evidence, delays, and engineer collaboration."}
        highlights={[
          { label: "Status", value: workOrder?.status.replace("_", " ") ?? "-" },
          { label: "Priority", value: workOrder?.priority ?? "-" },
          { label: "Planned Hours", value: formatNumber(totalPlannedHours) },
          { label: "Actual Hours", value: formatNumber(totalActualHours) },
        ]}
        panels={[
          {
            title: "Damage Summary",
            items: [workOrder?.damage_summary || "No damage summary recorded yet."],
          },
          {
            title: "Engineer Workflow",
            items: [
              `${formatNumber(questions.length)} operator question(s) logged`,
              `${formatNumber(reviews.length)} engineer review record(s)`,
              reviews[0]
                ? `Latest review: ${reviews[0].review_status} (${formatDate(reviews[0].reviewed_at)})`
                : "No review completed yet.",
            ],
          },
        ]}
        actions={["Update task progress", "Upload evidence", "Log delay impact"]}
      />

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Task Queue</h3>
          <p>{`${tasks.length} task(s)`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Planned</th>
                <th>Actual</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.title}</td>
                  <td>
                    <span className="chip">{task.status.replace("_", " ")}</span>
                  </td>
                  <td>{formatNumber(task.planned_hours)}</td>
                  <td>{formatNumber(task.actual_hours)}</td>
                </tr>
              ))}
              {!loading && tasks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No tasks found for this work order.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="data-panel two-col">
        <article>
          <header className="data-panel__header">
            <h3>Delays</h3>
            <p>{`${delays.length} logged`}</p>
          </header>
          <ul className="dense-list">
            {delays.map((delay) => (
              <li key={delay.id}>
                <strong>{delay.severity}</strong> {delay.reason || "No reason"} ({formatNumber(delay.impact_hours)}h)
              </li>
            ))}
            {!loading && delays.length === 0 ? <li>No delays logged.</li> : null}
          </ul>
        </article>

        <article>
          <header className="data-panel__header">
            <h3>Evidence Timeline</h3>
            <p>{`${evidence.length} item(s)`}</p>
          </header>
          <ul className="dense-list">
            {evidence.map((item) => (
              <li key={item.id}>
                <strong>{formatDate(item.captured_at)}</strong> {item.ai_summary || item.storage_path}
              </li>
            ))}
            {!loading && evidence.length === 0 ? <li>No evidence uploaded yet.</li> : null}
          </ul>
        </article>
      </section>

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Operator Questions and Engineer Responses</h3>
          <p>{`${questions.length} question(s)`}</p>
        </header>
        <ul className="qa-list">
          {questions.map((question) => {
            const response = responseByQuestion.get(question.id);
            return (
              <li key={question.id}>
                <p>
                  <strong>Q ({question.priority})</strong> {question.question_text}
                </p>
                <p className="muted">Asked: {formatDate(question.asked_at)}</p>
                <p>
                  <strong>A</strong> {response?.response_text ?? "Pending engineer response"}
                </p>
              </li>
            );
          })}
          {!loading && questions.length === 0 ? <li>No operator questions logged.</li> : null}
        </ul>
      </section>

      <p className="message">
        Related links: {workOrder ? <Link to={`/sites/${workOrder.site_id}`}>Site</Link> : null}
        {workOrder ? " · " : ""}
        {workOrder ? <Link to={`/projects/${workOrder.project_id}`}>Project</Link> : null}
      </p>

      {error ? <p className="message message--error">{error}</p> : null}
      {!workOrder && !loading ? <p className="message">Work order not found or not accessible.</p> : null}
    </div>
  );
}
