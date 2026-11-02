"use client";

import { useState } from "react";

import { useAuditEvents } from "@/api/hooks/audit";
import { useSession } from "@/api/hooks/auth";
import { Breadcrumbs } from "@/components/app-shell";
import { EmptyState, ErrorState, Loading, PageHeader } from "@/components/states";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

const FILTERS = [
  { value: "", label: "All activity" },
  { value: "auth.", label: "Sign-ins and MFA" },
  { value: "client.", label: "Clients" },
  { value: "document.", label: "Documents and review" },
  { value: "form1040.", label: "Form 1040" },
  { value: "firm.", label: "Users and firm" },
  { value: "billing.", label: "Billing" },
];

/** SCR-11 Audit log: every view and edit of client data, for the firm owner (REQ-SEC-001). */
export function AuditLogScreen() {
  const { data: session } = useSession();
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const events = useAuditEvents({ action, page });
  const pageCount = events.data ? Math.max(1, Math.ceil(events.data.count / 25)) : 1;

  if (session?.user?.role !== "owner") {
    return <Alert tone="warning">Only the firm owner can see the audit log.</Alert>;
  }

  return (
    <>
      <Breadcrumbs items={[{ label: "Firm settings", href: "/settings" }, { label: "Audit log" }]} />
      <PageHeader
        title="Audit log"
        description="Who viewed or changed client data, and when. Entries can't be edited or deleted."
        actions={
          <Select
            aria-label="Filter activity"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="w-56"
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        }
      />
      <Card>
        {events.isPending ? (
          <Loading />
        ) : events.isError ? (
          <ErrorState error={events.error} onRetry={() => events.refetch()} />
        ) : events.data.results.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No activity yet" />
          </div>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>User</Th>
                  <Th>Action</Th>
                  <Th>Object</Th>
                  <Th>Details</Th>
                  <Th>IP</Th>
                </tr>
              </thead>
              <tbody>
                {events.data.results.map((event) => (
                  <tr key={event.id}>
                    <Td className="whitespace-nowrap">{formatDateTime(event.at)}</Td>
                    <Td>{event.user_email ?? "—"}</Td>
                    <Td className="font-mono text-xs">{event.action}</Td>
                    <Td className="text-xs text-slate-600">
                      {event.object_type ? `${event.object_type} ${event.object_id.slice(0, 8)}` : "—"}
                    </Td>
                    <Td className="max-w-xs truncate font-mono text-xs text-slate-600">
                      {Object.keys(event.metadata ?? {}).length ? JSON.stringify(event.metadata) : "—"}
                    </Td>
                    <Td className="text-xs text-slate-600">{event.ip_address ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex items-center justify-end gap-2 p-3 text-sm text-slate-600">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Newer
              </Button>
              Page {page} of {pageCount}
              <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
                Older
              </Button>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
