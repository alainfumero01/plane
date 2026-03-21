import { ScreenFrame } from "@/app/components/screen-frame";

export default function EngineerReviewPage() {
  return (
    <ScreenFrame
      title="Engineer Review"
      description="Remote technical decision workspace for reviewing evidence, answering field questions, and issuing approvals."
      highlights={[
        { label: "Pending Questions", value: "19" },
        { label: "Pending Reviews", value: "11" },
        { label: "Average Response SLA", value: "2h 14m" },
        { label: "Awaiting More Evidence", value: "4" },
      ]}
      panels={[
        {
          title: "Review Queue",
          items: [
            "WO-882: edge bond tolerance confirmation",
            "WO-901: thermal imaging anomaly verification",
            "WO-917: final cure profile signoff",
          ],
        },
        {
          title: "Future Integration Readiness",
          items: [
            "External message mapping via external_message_links",
            "Provider-agnostic communication thread model",
            "WhatsApp ingestion endpoint scaffold ready",
          ],
        },
      ]}
      actions={[
        "Respond to operator question",
        "Approve or reject repair outcome",
        "Request additional evidence",
      ]}
    />
  );
}
