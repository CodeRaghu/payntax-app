import { Badge } from "@/components/ui/badge";
import type { DocumentStatus, ReturnStatus } from "@/api/types";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const DOCUMENT: Record<DocumentStatus, [string, Tone]> = {
  uploading: ["Uploading…", "info"],
  uploaded: ["Queued…", "info"],
  scanning: ["Scanning…", "info"],
  classifying: ["Classifying…", "info"],
  extracting: ["Extracting…", "info"],
  needs_review: ["Needs review", "warning"],
  ready_for_review: ["Ready to review", "info"],
  reviewed: ["Reviewed", "success"],
  rejected: ["Rejected", "danger"],
  failed: ["Extraction failed", "danger"],
};

const RETURN: Record<ReturnStatus, [string, Tone]> = {
  draft: ["Draft", "neutral"],
  in_review: ["In review", "warning"],
  ready: ["Ready", "info"],
  complete: ["Complete", "success"],
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const [label, tone] = DOCUMENT[status];
  return (
    <Badge tone={tone}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </Badge>
  );
}

export function ReturnStatusBadge({ status }: { status: ReturnStatus }) {
  const [label, tone] = RETURN[status];
  return <Badge tone={tone}>{label}</Badge>;
}
