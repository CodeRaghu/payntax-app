"use client";

import { ChevronRight, RotateCw, Trash2, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { ApiError } from "@/api/client";
import {
  uploadDocument,
  useDeleteDocument,
  useDocuments,
  useInvalidateDocuments,
  useRetryDocument,
} from "@/api/hooks/documents";
import { useTaxReturn } from "@/api/hooks/returns";
import { DOCUMENT_TYPE_LABELS } from "@/api/types";
import { Breadcrumbs } from "@/components/app-shell";
import { EmptyState, ErrorState, Loading, PageHeader } from "@/components/states";
import { DocumentStatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { cn, formatBytes, timeAgo } from "@/lib/utils";

export const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_BYTES = 20 * 1024 * 1024;

type Upload = { key: string; name: string; progress: number; error?: string };

/** Client-side checks before upload; the API re-checks everything (REQ-DOC-001). */
export function checkFile(file: File): string | undefined {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Unsupported file type. Upload a PDF, JPG or PNG.";
  if (file.size > MAX_BYTES) return "Too large. Files must be 20 MB or smaller.";
  if (file.size === 0) return "This file is empty.";
  return undefined;
}

/** SCR-07 Documents: upload and status. Statuses refresh without reloading the page. */
export function DocumentsScreen({ returnId }: { returnId: string }) {
  const taxReturn = useTaxReturn(returnId);
  const documents = useDocuments(returnId);
  const invalidate = useInvalidateDocuments(returnId);
  const retry = useRetryDocument(returnId);
  const remove = useDeleteDocument(returnId);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = (key: string, change: Partial<Upload>) =>
    setUploads((current) => current.map((u) => (u.key === key ? { ...u, ...change } : u)));

  async function handleFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      const problem = checkFile(file);
      setUploads((current) => [...current, { key, name: file.name, progress: 0, error: problem }]);
      if (problem) continue;
      uploadDocument(returnId, file, (progress) => patch(key, { progress }))
        .then(() => {
          setUploads((current) => current.filter((u) => u.key !== key));
          invalidate();
        })
        .catch((error: unknown) =>
          patch(key, { error: error instanceof ApiError || error instanceof Error ? error.message : "Upload failed." }),
        );
    }
  }

  if (taxReturn.isPending) return <Loading />;
  if (taxReturn.isError) return <ErrorState error={taxReturn.error} />;
  const r = taxReturn.data;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Clients", href: "/clients" },
          { label: r.client_name, href: `/clients/${r.client}` },
          { label: `${r.tax_year} Return`, href: `/returns/${r.id}` },
          { label: "Documents" },
        ]}
      />
      <PageHeader title="Documents" description="W-2s and pay stubs for this return." />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "mb-6 flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white p-8 text-center",
          dragging && "border-blue-600 bg-blue-50",
        )}
      >
        <UploadCloud className="h-8 w-8 text-slate-400" aria-hidden />
        <p className="text-sm text-slate-700">Drag and drop W-2s and pay stubs here</p>
        <p className="text-xs text-slate-500">PDF · JPG · PNG, up to 20 MB each</p>
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          Browse files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          aria-label="Choose files to upload"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="mb-6 space-y-2" aria-label="Uploads in progress">
          {uploads.map((u) => (
            <li key={u.key} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{u.name}</span>
                {u.error ? (
                  <Button variant="ghost" size="sm" onClick={() => setUploads((c) => c.filter((x) => x.key !== u.key))}>
                    Dismiss
                  </Button>
                ) : (
                  <span className="text-slate-500">{Math.round(u.progress * 100)}%</span>
                )}
              </div>
              {u.error ? (
                <p className="mt-1 text-red-700">{u.error}</p>
              ) : (
                <div
                  className="mt-2 h-1.5 rounded bg-slate-100"
                  role="progressbar"
                  aria-label={`Uploading ${u.name}`}
                  aria-valuenow={Math.round(u.progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="h-full rounded bg-blue-600 transition-all" style={{ width: `${u.progress * 100}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Card>
        {documents.isPending ? (
          <Loading />
        ) : documents.isError ? (
          <ErrorState error={documents.error} onRetry={() => documents.refetch()} />
        ) : documents.data.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No documents yet">Upload a W-2 to start.</EmptyState>
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>File</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Uploaded</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody aria-live="polite">
              {documents.data.map((d) => {
                const reviewable = ["needs_review", "ready_for_review", "reviewed"].includes(d.status);
                return (
                  <tr key={d.id}>
                    <Td>
                      {reviewable ? (
                        <Link href={`/returns/${returnId}/documents/${d.id}`} className="font-medium text-blue-800 hover:underline">
                          {d.filename}
                        </Link>
                      ) : (
                        <span className="font-medium">{d.filename}</span>
                      )}
                      <span className="block text-xs text-slate-500">{formatBytes(d.size)}</span>
                      {d.error_message && <span className="block text-xs text-red-700">{d.error_message}</span>}
                    </Td>
                    <Td>{DOCUMENT_TYPE_LABELS[d.doc_type]}</Td>
                    <Td>
                      <DocumentStatusBadge status={d.status} />
                      {d.attention_count > 0 && d.status !== "reviewed" && (
                        <span className="ml-2 text-xs text-amber-800">{d.attention_count} to check</span>
                      )}
                    </Td>
                    <Td className="text-slate-600">{timeAgo(d.created_at)}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        {d.status === "failed" && (
                          <Button variant="ghost" size="sm" loading={retry.isPending} onClick={() => retry.mutate(d.id)}>
                            <RotateCw className="h-4 w-4" aria-hidden /> Retry
                          </Button>
                        )}
                        {reviewable && (
                          <Link
                            href={`/returns/${returnId}/documents/${d.id}`}
                            className="inline-flex h-8 items-center rounded-md px-2 text-slate-700 hover:bg-slate-100"
                            aria-label={`Review ${d.filename}`}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${d.filename}`}
                          onClick={() => window.confirm(`Delete ${d.filename}?`) && remove.mutate(d.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      {remove.isError && (
        <Alert tone="danger" className="mt-4">
          {remove.error.message}
        </Alert>
      )}
    </>
  );
}
