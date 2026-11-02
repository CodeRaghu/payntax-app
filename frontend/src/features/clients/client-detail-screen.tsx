"use client";

import { Eye, EyeOff, FolderOpen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useClient, useRevealSsn, useUpdateClient } from "@/api/hooks/clients";
import { useCreateReturn, useReturns } from "@/api/hooks/returns";
import { FILING_STATUS_LABELS } from "@/api/types";
import { Breadcrumbs } from "@/components/app-shell";
import { ErrorState, Loading, PageHeader } from "@/components/states";
import { ReturnStatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";

import { ClientForm } from "./client-form";

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 4 }, (_, i) => THIS_YEAR - i).filter((y) => y >= 2020);

/** SCR-05 Client details: profile, masked SSN, and returns by tax year. */
export function ClientDetailScreen({ clientId }: { clientId: string }) {
  const router = useRouter();
  const client = useClient(clientId);
  const update = useUpdateClient(clientId);
  const reveal = useRevealSsn(clientId);
  const returns = useReturns(clientId);
  const createReturn = useCreateReturn(clientId);
  const [editing, setEditing] = useState(false);
  const [shownSsn, setShownSsn] = useState<string>();
  const [year, setYear] = useState(YEARS[0]);

  if (client.isPending) return <Loading />;
  if (client.isError) return <ErrorState error={client.error} onRetry={() => client.refetch()} />;
  const c = client.data;
  const existingYears = new Set(returns.data?.results.map((r) => r.tax_year));

  return (
    <>
      <Breadcrumbs items={[{ label: "Clients", href: "/clients" }, { label: c.full_name }]} />
      <PageHeader
        title={c.full_name}
        description={c.filing_status ? FILING_STATUS_LABELS[c.filing_status] : undefined}
        actions={
          !editing && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit client
            </Button>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{editing ? "Edit client" : "Profile"}</CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <ClientForm
                client={c}
                submitLabel="Save changes"
                onSubmit={async (values) => {
                  await update.mutateAsync(values);
                  setShownSsn(undefined);
                  setEditing(false);
                }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">SSN</dt>
                  <dd className="flex items-center gap-2 font-mono">
                    {shownSsn ?? (c.ssn_masked || "—")}
                    {c.ssn_masked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={reveal.isPending}
                        aria-label={shownSsn ? "Hide SSN" : "Show full SSN"}
                        onClick={() =>
                          shownSsn
                            ? setShownSsn(undefined)
                            : reveal.mutate(undefined, { onSuccess: ({ ssn }) => setShownSsn(ssn) })
                        }
                      >
                        {shownSsn ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    )}
                  </dd>
                  {shownSsn && <p className="text-xs text-slate-500">Viewing the full SSN is recorded in the audit log.</p>}
                </div>
                <Item label="Email" value={c.email} />
                <Item label="Phone" value={c.phone} />
                <Item
                  label="Address"
                  value={[c.street, [c.city, c.state].filter(Boolean).join(", "), c.zip_code].filter(Boolean).join(" ")}
                />
                <div className="sm:col-span-2">
                  <Item label="Notes" value={c.notes} />
                </div>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Returns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {returns.isPending ? (
              <Loading />
            ) : returns.isError ? (
              <ErrorState error={returns.error} />
            ) : returns.data.results.length === 0 ? (
              <p className="text-sm text-slate-500">No returns yet.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Year</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Docs</Th>
                  </tr>
                </thead>
                <tbody>
                  {returns.data.results.map((r) => (
                    <tr key={r.id}>
                      <Td>
                        <Link href={`/returns/${r.id}`} className="font-medium text-blue-800 hover:underline">
                          {r.tax_year} Form {r.form_type}
                        </Link>
                      </Td>
                      <Td>
                        <ReturnStatusBadge status={r.status} />
                      </Td>
                      <Td className="text-right">{r.document_counts.total}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <label htmlFor="tax_year" className="text-sm font-medium">
                Open a return
              </label>
              <div className="flex gap-2">
                <Select id="tax_year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {YEARS.map((y) => (
                    <option key={y} value={y} disabled={existingYears.has(y)}>
                      {y} {existingYears.has(y) ? "(open)" : ""}
                    </option>
                  ))}
                </Select>
                <Button
                  loading={createReturn.isPending}
                  disabled={existingYears.has(year)}
                  onClick={() =>
                    createReturn.mutate(year, { onSuccess: (r) => router.push(`/returns/${r.id}`) })
                  }
                >
                  <FolderOpen className="h-4 w-4" aria-hidden /> Open
                </Button>
              </div>
              {createReturn.isError && <Alert tone="danger">{createReturn.error.message}</Alert>}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Item({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="whitespace-pre-wrap text-slate-900">{value || "—"}</dd>
    </div>
  );
}
