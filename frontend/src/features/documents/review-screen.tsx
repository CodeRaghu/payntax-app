"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useDocument, useDocuments, useMarkReviewed, useRevealSensitive, useUpdateField } from "@/api/hooks/documents";
import { useTaxReturn } from "@/api/hooks/returns";
import { DOCUMENT_TYPE_LABELS, type DocumentDetail, type ExtractedField } from "@/api/types";
import { Breadcrumbs } from "@/components/app-shell";
import { ErrorState, Loading } from "@/components/states";
import { DocumentStatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** SCR-08 Document review, side by side (REQ-REV-001..004, REQ-EXT-*). */
export function ReviewScreen({ returnId, documentId }: { returnId: string; documentId: string }) {
  const router = useRouter();
  const taxReturn = useTaxReturn(returnId);
  const document = useDocument(documentId);
  const siblings = useDocuments(returnId);
  const markReviewed = useMarkReviewed(documentId, returnId);
  const [activeField, setActiveField] = useState<string>();

  const reviewable = useMemo(
    () => (siblings.data ?? []).filter((d) => ["needs_review", "ready_for_review", "reviewed"].includes(d.status)),
    [siblings.data],
  );
  const index = reviewable.findIndex((d) => d.id === documentId);
  const go = (offset: number) => {
    const next = reviewable[index + offset];
    if (next) router.push(`/returns/${returnId}/documents/${next.id}`);
  };

  if (document.isPending || taxReturn.isPending) return <Loading />;
  if (document.isError) return <ErrorState error={document.error} onRetry={() => document.refetch()} />;
  if (taxReturn.isError) return <ErrorState error={taxReturn.error} />;
  const doc = document.data;
  const r = taxReturn.data;
  const attention = doc.extracted_fields.filter((f) => f.needs_attention).length;
  const canReview = ["needs_review", "ready_for_review"].includes(doc.status);

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <Breadcrumbs
        items={[
          { label: "Clients", href: "/clients" },
          { label: r.client_name, href: `/clients/${r.client}` },
          { label: `${r.tax_year} Return`, href: `/returns/${returnId}` },
          { label: "Documents", href: `/returns/${returnId}/documents` },
          { label: doc.filename },
        ]}
      />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Link
          href={`/returns/${returnId}/documents`}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Documents
        </Link>
        <h1 className="text-lg font-semibold">
          {doc.filename} · {DOCUMENT_TYPE_LABELS[doc.doc_type]} · {r.tax_year}
        </h1>
        <DocumentStatusBadge status={doc.status} />
        <div className="ml-auto">
          <Button
            disabled={!canReview || attention > 0}
            loading={markReviewed.isPending}
            onClick={() => markReviewed.mutate(undefined)}
            title={attention > 0 ? "Resolve the highlighted fields first" : undefined}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Mark reviewed
          </Button>
        </div>
      </div>
      {markReviewed.isError && (
        <Alert tone="danger" className="mb-3">
          {markReviewed.error.message}
        </Alert>
      )}
      {doc.error_message && (
        <Alert tone="warning" className="mb-3">
          {doc.error_message}
        </Alert>
      )}

      <Card className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
        <DocumentViewer doc={doc} activeField={doc.extracted_fields.find((f) => f.id === activeField)} />
        <FieldPanel doc={doc} returnId={returnId} onFocusField={setActiveField} />
      </Card>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span className={cn(attention ? "text-amber-800" : "text-green-800")} aria-live="polite">
          {attention
            ? `${attention} field${attention === 1 ? "" : "s"} need${attention === 1 ? "s" : ""} attention`
            : doc.status === "reviewed"
              ? "Reviewed. This document feeds the return."
              : "All fields checked. Mark the document reviewed."}
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" disabled={index <= 0} onClick={() => go(-1)}>
            Previous doc
          </Button>
          <Button variant="secondary" disabled={index < 0 || index >= reviewable.length - 1} onClick={() => go(1)}>
            Next doc
          </Button>
        </div>
      </div>
    </div>
  );
}

function DocumentViewer({ doc, activeField }: { doc: DocumentDetail; activeField?: ExtractedField }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const isImage = doc.content_type.startsWith("image/");
  const bbox = activeField?.bbox;

  return (
    <div className="flex min-h-80 flex-col border-b border-slate-200 bg-slate-100 lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white p-2">
        {isImage ? (
          <>
            <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center text-xs text-slate-600">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Rotate" onClick={() => setRotation((r) => (r + 90) % 360)}>
              <RotateCw className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <span className="px-2 text-xs text-slate-500">PDF viewer: use its own zoom and page controls.</span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!doc.file_url ? (
          <p className="text-sm text-slate-500">The file isn&apos;t available.</p>
        ) : isImage ? (
          <div
            className="relative mx-auto origin-top"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, width: "100%" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-signed URL from storage, not a static asset */}
            <img src={doc.file_url} alt={`Scan of ${doc.filename}`} className="w-full" />
            {bbox && (
              <div
                aria-hidden
                className="pointer-events-none absolute rounded border-2 border-blue-600 bg-blue-500/10"
                style={{
                  left: `${bbox[0] * 100}%`,
                  top: `${bbox[1] * 100}%`,
                  width: `${bbox[2] * 100}%`,
                  height: `${bbox[3] * 100}%`,
                }}
              />
            )}
          </div>
        ) : (
          <iframe title={`Document ${doc.filename}`} src={doc.file_url} className="h-full min-h-[60vh] w-full rounded bg-white" />
        )}
      </div>
    </div>
  );
}

function FieldPanel({
  doc,
  returnId,
  onFocusField,
}: {
  doc: DocumentDetail;
  returnId: string;
  onFocusField: (id: string) => void;
}) {
  const reveal = useRevealSensitive(doc.id);
  const [revealed, setRevealed] = useState<Record<string, string>>();
  const fields = doc.extracted_fields;

  if (fields.length === 0) {
    return (
      <div className="p-6 text-sm text-slate-600">
        No fields were extracted from this document. Check it, then mark it reviewed. It won&apos;t feed the 1040.
      </div>
    );
  }

  // Fields needing attention come first, so they come first in tab order too.
  const ordered = [...fields.filter((f) => f.needs_attention), ...fields.filter((f) => !f.needs_attention)];
  const hasSensitive = fields.some((f) => f.sensitive);

  return (
    <div className="min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
        <span>
          Values under {Math.round(doc.confidence_threshold * 100)}% confidence or failing a check are flagged ⚠. Enter
          accepts, Tab moves on, Ctrl+S saves.
        </span>
        {hasSensitive && !revealed && (
          <Button
            variant="ghost"
            size="sm"
            loading={reveal.isPending}
            onClick={() => reveal.mutate(undefined, { onSuccess: ({ values }) => setRevealed(values) })}
          >
            <Eye className="h-4 w-4" aria-hidden /> Show SSN
          </Button>
        )}
      </div>
      <ul className="divide-y divide-slate-100">
        {ordered.map((field) => (
          <FieldRow
            key={field.id}
            field={field}
            documentId={doc.id}
            returnId={returnId}
            revealedValue={revealed?.[field.name]}
            onFocus={() => onFocusField(field.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function FieldRow({
  field,
  documentId,
  returnId,
  revealedValue,
  onFocus,
}: {
  field: ExtractedField;
  documentId: string;
  returnId: string;
  revealedValue?: string;
  onFocus: () => void;
}) {
  const update = useUpdateField(documentId, returnId);
  const shown = revealedValue ?? field.value;
  const [draft, setDraft] = useState(shown);
  const [lastShown, setLastShown] = useState(shown);
  if (shown !== lastShown) {
    // The server value changed (save, reveal, or another field's rule update): reset the draft.
    setLastShown(shown);
    setDraft(shown);
  }
  const locked = field.sensitive && revealedValue === undefined;
  const dirty = draft !== shown;
  const inputId = `field-${field.id}`;
  const issueId = `${inputId}-issue`;

  const save = () => dirty && update.mutate({ fieldId: field.id, value: draft });
  const acknowledge = () => update.mutate({ fieldId: field.id, acknowledged: true });

  return (
    <li className={cn("px-4 py-3", field.needs_attention && "bg-amber-50/60")}>
      <div className="flex items-start gap-3">
        <label htmlFor={inputId} className="w-48 shrink-0 pt-2 text-sm text-slate-700">
          {field.label}
        </label>
        <div className="min-w-0 flex-1 space-y-1">
          <Input
            id={inputId}
            value={draft}
            readOnly={locked}
            onFocus={onFocus}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                e.preventDefault();
                save();
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (dirty) save();
                else if (field.needs_attention) acknowledge();
              }
            }}
            aria-invalid={field.needs_attention}
            aria-describedby={field.needs_attention ? issueId : undefined}
            className={cn(
              field.kind === "money" && "text-right font-mono",
              field.kind === "ssn" || field.kind === "ein" ? "font-mono" : "",
            )}
          />
          {field.corrected && field.original_value !== field.value && (
            <p className="text-xs text-slate-500">
              Extracted as <span className="font-mono">{field.original_value}</span>
            </p>
          )}
          {field.needs_attention && (
            <div id={issueId} className="flex flex-wrap items-center gap-2 text-xs text-amber-900">
              <span>
                {field.rule_issue || `Low confidence (${Math.round(field.confidence * 100)}%). Compare with the document.`}
              </span>
              <Button variant="link" size="sm" className="h-auto text-xs" onClick={acknowledge} loading={update.isPending}>
                Value is correct
              </Button>
            </div>
          )}
          {update.isError && <p className="text-xs text-red-700">{update.error.message}</p>}
        </div>
        <span className="w-14 shrink-0 pt-2 text-right text-xs" aria-hidden>
          {field.needs_attention ? (
            <span className="inline-flex items-center gap-1 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              {field.low_confidence ? `${Math.round(field.confidence * 100)}%` : ""}
            </span>
          ) : (
            <CheckCircle2 className="ml-auto h-4 w-4 text-green-700" />
          )}
        </span>
      </div>
    </li>
  );
}
