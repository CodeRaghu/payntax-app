"use client";

import { Download, Pencil, Undo2 } from "lucide-react";
import { useState } from "react";

import { form1040PdfUrl, useForm1040, useUpdateFormLine } from "@/api/hooks/forms";
import { useTaxReturn } from "@/api/hooks/returns";
import type { FormLine } from "@/api/types";
import { Breadcrumbs } from "@/components/app-shell";
import { ErrorState, Loading, PageHeader } from "@/components/states";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { formatMoney } from "@/lib/utils";

const SOURCE: Record<FormLine["source"], { label: string; tone: "info" | "neutral" | "warning" | "success" }> = {
  w2: { label: "From W-2s", tone: "info" },
  computed: { label: "Calculated", tone: "neutral" },
  cpa: { label: "Edited", tone: "success" },
  missing: { label: "Needs entry", tone: "warning" },
};

/** SCR-09 Form 1040: view, edit and download (REQ-FRM-001..003). */
export function Form1040Screen({ returnId }: { returnId: string }) {
  const taxReturn = useTaxReturn(returnId);
  const form = useForm1040(returnId);

  if (taxReturn.isPending || form.isPending) return <Loading />;
  if (taxReturn.isError) return <ErrorState error={taxReturn.error} />;
  if (form.isError) return <ErrorState error={form.error} onRetry={() => form.refetch()} />;
  const r = taxReturn.data;
  const sections = [...new Set(form.data.lines.map((line) => line.section))];

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Clients", href: "/clients" },
          { label: r.client_name, href: `/clients/${r.client}` },
          { label: `${r.tax_year} Return`, href: `/returns/${returnId}` },
          { label: "Form 1040" },
        ]}
      />
      <PageHeader
        title={`Form 1040 · ${r.tax_year}`}
        description={`${r.client_name}. Lines come from reviewed W-2s; edited lines are recorded in the audit log.`}
        actions={
          <a href={form1040PdfUrl(returnId)} className={buttonVariants()} download>
            <Download className="h-4 w-4" aria-hidden /> Download PDF
          </a>
        }
      />
      {form.data.warnings.length > 0 && (
        <Alert tone="warning" className="mb-6" title="Before you file">
          <ul className="list-disc pl-4">
            {form.data.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}
      <div className="space-y-6">
        {sections.map((section) => (
          <Card key={section}>
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">{section}</h2>
            <Table>
              <thead>
                <tr>
                  <Th className="w-16">Line</Th>
                  <Th>Description</Th>
                  <Th className="w-32">Source</Th>
                  <Th className="w-56 text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {form.data.lines
                  .filter((line) => line.section === section)
                  .map((line) => (
                    <LineRow key={line.line} line={line} returnId={returnId} />
                  ))}
              </tbody>
            </Table>
          </Card>
        ))}
      </div>
    </>
  );
}

function LineRow({ line, returnId }: { line: FormLine; returnId: string }) {
  const update = useUpdateFormLine(returnId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const source = SOURCE[line.source];
  const inputId = `line-${line.line}`;

  function startEdit() {
    setDraft(line.value ?? "");
    setEditing(true);
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    const cleaned = draft.replace(/[,$\s]/g, "");
    if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return;
    update.mutate({ line: line.line, value: Number(cleaned).toFixed(2) }, { onSuccess: () => setEditing(false) });
  }

  return (
    <tr>
      <Td className="font-mono font-medium">{line.line}</Td>
      <Td>
        <label htmlFor={inputId}>{line.label}</label>
        {line.source === "cpa" && line.computed_value !== null && (
          <span className="block text-xs text-slate-500">Calculated value: {formatMoney(line.computed_value)}</span>
        )}
        {update.isError && <span className="block text-xs text-red-700">{update.error.message}</span>}
      </Td>
      <Td>
        <Badge tone={source.tone}>{source.label}</Badge>
      </Td>
      <Td className="text-right">
        {editing ? (
          <form onSubmit={save} className="flex items-center justify-end gap-1">
            <Input
              id={inputId}
              autoFocus
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
              className="w-32 text-right font-mono"
              aria-invalid={!/^-?[\d,]+(\.\d{1,2})?$/.test(draft.trim() || "x")}
            />
            <Button type="submit" size="sm" loading={update.isPending}>
              Save
            </Button>
          </form>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <span className="font-mono">{formatMoney(line.value)}</span>
            {line.editable && (
              <Button variant="ghost" size="icon" aria-label={`Edit line ${line.line}`} onClick={startEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {line.source === "cpa" && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Reset line ${line.line} to the calculated value`}
                loading={update.isPending}
                onClick={() => update.mutate({ line: line.line, value: null })}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </Td>
    </tr>
  );
}
