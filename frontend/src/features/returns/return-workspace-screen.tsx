"use client";

import { FileText, FileUp } from "lucide-react";
import Link from "next/link";

import { useMarkReturnComplete, useTaxReturn } from "@/api/hooks/returns";
import { Breadcrumbs } from "@/components/app-shell";
import { ErrorState, Loading, PageHeader } from "@/components/states";
import { ReturnStatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** SCR-06 Return workspace: one client + tax year. Hub for documents (SCR-07) and the 1040 (SCR-09). */
export function ReturnWorkspaceScreen({ returnId }: { returnId: string }) {
  const taxReturn = useTaxReturn(returnId);
  const complete = useMarkReturnComplete(returnId);

  if (taxReturn.isPending) return <Loading />;
  if (taxReturn.isError) return <ErrorState error={taxReturn.error} onRetry={() => taxReturn.refetch()} />;
  const r = taxReturn.data;
  const counts = r.document_counts;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Clients", href: "/clients" },
          { label: r.client_name, href: `/clients/${r.client}` },
          { label: `${r.tax_year} Return` },
        ]}
      />
      <PageHeader
        title={`${r.client_name} · ${r.tax_year} Form ${r.form_type}`}
        description={<ReturnStatusBadge status={r.status} />}
        actions={
          r.status === "complete" ? (
            <Button variant="secondary" loading={complete.isPending} onClick={() => complete.mutate("ready")}>
              Reopen return
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={r.status !== "ready"}
              loading={complete.isPending}
              onClick={() => complete.mutate("complete")}
            >
              Mark return complete
            </Button>
          )
        }
      />
      {counts.needs_attention > 0 && (
        <Alert tone="warning" className="mb-6" title={`${counts.needs_attention} document(s) need your review`}>
          Low-confidence values and failed checks are highlighted on the review screen.
        </Alert>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-blue-700" aria-hidden /> Documents
            </CardTitle>
            <CardDescription>Upload W-2s and pay stubs, then review what was extracted.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-4 gap-2 text-center text-sm">
              <Stat label="Total" value={counts.total} />
              <Stat label="Processing" value={counts.processing} />
              <Stat label="Need review" value={counts.needs_attention} />
              <Stat label="Reviewed" value={counts.reviewed} />
            </dl>
            <Link href={`/returns/${r.id}/documents`} className={buttonVariants()}>
              Open documents
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-700" aria-hidden /> Form 1040
            </CardTitle>
            <CardDescription>Lines are filled from reviewed W-2s. Edit lines and download the PDF.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/returns/${r.id}/form-1040`} className={buttonVariants({ variant: "secondary" })}>
              Open Form 1040
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-50 p-2">
      <dd className="text-lg font-semibold text-slate-900">{value}</dd>
      <dt className="text-xs text-slate-500">{label}</dt>
    </div>
  );
}
