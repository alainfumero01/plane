import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatDate, formatNumber } from "@/app/lib/format";
import type { RoleCode } from "@/app/lib/roles";
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
  sequence_no?: number;
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
  const { activeCompanyId, roles } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [workOrder, setWorkOrder] = useState<WorkOrderRecord | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [delays, setDelays] = useState<DelayRecord[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const [reviews, setReviews] = useState<EngineerReviewRecord[]>([]);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskStatus, setTaskStatus] = useState("todo");
  const [taskPlannedHours, setTaskPlannedHours] = useState("2");
  const [taskBusy, setTaskBusy] = useState(false);

  const [delayCategory, setDelayCategory] = useState("weather");
  const [delaySeverity, setDelaySeverity] = useState("medium");
  const [delayReason, setDelayReason] = useState("");
  const [delayHours, setDelayHours] = useState("0");
  const [delayCost, setDelayCost] = useState("0");
  const [delayBusy, setDelayBusy] = useState(false);

  const canWriteExecution = useMemo(
    () =>
      roles.some(
        (role: RoleCode) => role === "business_owner_admin" || role === "project_manager" || role === "site_operator"
      ),
    [roles]
  );

  const loadData = useCallback(async () => {
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
        .select("id,title,status,planned_hours,actual_hours,sequence_no")
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
  }, [activeCompanyId, workOrderId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalPlannedHours = tasks.reduce((sum, task) => sum + Number(task.planned_hours ?? 0), 0);
  const totalActualHours = tasks.reduce((sum, task) => sum + Number(task.actual_hours ?? 0), 0);
  const responseByQuestion = useMemo(() => {
    const map = new Map<string, ResponseRecord>();
    for (const row of responses) {
      if (!map.has(row.question_id)) map.set(row.question_id, row);
    }
    return map;
  }, [responses]);

  const handleCreateTask = async () => {
    if (!supabase || !activeCompanyId || !workOrderId || !workOrder) return;

    setTaskBusy(true);
    setError(null);
    setSuccess(null);

    const nextSequence = (tasks[tasks.length - 1]?.sequence_no ?? tasks.length) + 1;
    const payload = {
      company_id: activeCompanyId,
      work_order_id: workOrderId,
      site_id: workOrder.site_id,
      title: taskTitle.trim(),
      status: taskStatus,
      sequence_no: nextSequence,
      planned_hours: Number(taskPlannedHours || 0),
      actual_hours: 0,
    };

    const { error: insertError } = await supabase.from("tasks").insert(payload);
    if (insertError) {
      setError(insertError.message);
      setTaskBusy(false);
      return;
    }

    setTaskTitle("");
    setTaskStatus("todo");
    setTaskPlannedHours("2");
    setSuccess("Task created successfully.");
    await loadData();
    setTaskBusy(false);
  };

  const handleCreateDelay = async () => {
    if (!supabase || !activeCompanyId || !workOrderId || !workOrder) return;

    setDelayBusy(true);
    setError(null);
    setSuccess(null);

    const payload = {
      company_id: activeCompanyId,
      project_id: workOrder.project_id,
      site_id: workOrder.site_id,
      work_order_id: workOrderId,
      category: delayCategory,
      severity: delaySeverity,
      reason: delayReason.trim(),
      impact_hours: Number(delayHours || 0),
      impact_cost: Number(delayCost || 0),
    };

    const { error: insertError } = await supabase.from("delays").insert(payload);
    if (insertError) {
      setError(insertError.message);
      setDelayBusy(false);
      return;
    }

    setDelayCategory("weather");
    setDelaySeverity("medium");
    setDelayReason("");
    setDelayHours("0");
    setDelayCost("0");
    setSuccess("Delay logged successfully.");
    await loadData();
    setDelayBusy(false);
  };

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

      {canWriteExecution ? (
        <section className="data-panel two-col">
          <article>
            <header className="data-panel__header">
              <h3>Create Task</h3>
              <p>Execution write action</p>
            </header>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateTask();
              }}
            >
              <label>
                Task Title
                <input
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  required
                  placeholder="Surface prep and masking"
                />
              </label>
              <label>
                Status
                <select value={taskStatus} onChange={(event) => setTaskStatus(event.target.value)}>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </label>
              <label>
                Planned Hours
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={taskPlannedHours}
                  onChange={(event) => setTaskPlannedHours(event.target.value)}
                />
              </label>
              <button type="submit" disabled={taskBusy || !taskTitle.trim()}>
                {taskBusy ? "Creating..." : "Create Task"}
              </button>
            </form>
          </article>

          <article>
            <header className="data-panel__header">
              <h3>Log Delay</h3>
              <p>Execution write action</p>
            </header>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateDelay();
              }}
            >
              <label>
                Category
                <select value={delayCategory} onChange={(event) => setDelayCategory(event.target.value)}>
                  <option value="weather">Weather</option>
                  <option value="material">Material</option>
                  <option value="equipment">Equipment</option>
                  <option value="staffing">Staffing</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Severity
                <select value={delaySeverity} onChange={(event) => setDelaySeverity(event.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label>
                Reason
                <textarea
                  value={delayReason}
                  onChange={(event) => setDelayReason(event.target.value)}
                  required
                  placeholder="Weather stand-down due to wind speed"
                />
              </label>
              <label>
                Impact Hours
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={delayHours}
                  onChange={(event) => setDelayHours(event.target.value)}
                />
              </label>
              <label>
                Impact Cost
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={delayCost}
                  onChange={(event) => setDelayCost(event.target.value)}
                />
              </label>
              <button type="submit" disabled={delayBusy || !delayReason.trim()}>
                {delayBusy ? "Logging..." : "Log Delay"}
              </button>
            </form>
          </article>
        </section>
      ) : null}

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
        {workOrder ? " | " : ""}
        {workOrder ? <Link to={`/projects/${workOrder.project_id}`}>Project</Link> : null}
      </p>

      {success ? <p className="message message--success">{success}</p> : null}
      {error ? <p className="message message--error">{error}</p> : null}
      {!workOrder && !loading ? <p className="message">Work order not found or not accessible.</p> : null}
    </div>
  );
}
