"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";

import { useClients } from "@/api/hooks/clients";
import { FILING_STATUS_LABELS } from "@/api/types";
import { EmptyState, ErrorState, Loading, PageHeader } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";

/** SCR-04 Client list (firm dashboard). REQ-CLI-001. */
export function ClientListScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const clients = useClients(deferredSearch, page);
  const pageCount = clients.data ? Math.max(1, Math.ceil(clients.data.count / 25)) : 1;

  return (
    <>
      <PageHeader
        title="Clients"
        description="Search by name, email or the last 4 digits of the SSN."
        actions={
          <Link href="/clients/new" className={buttonVariants()}>
            <Plus className="h-4 w-4" aria-hidden /> New client
          </Link>
        }
      />
      <Card>
        <div className="border-b border-slate-100 p-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <Input
              type="search"
              aria-label="Search clients"
              placeholder="Search clients"
              className="pl-8"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        {clients.isPending ? (
          <Loading />
        ) : clients.isError ? (
          <ErrorState error={clients.error} onRetry={() => clients.refetch()} />
        ) : clients.data.results.length === 0 ? (
          <div className="p-6">
            <EmptyState title={deferredSearch ? "No clients match your search" : "No clients yet"}>
              {!deferredSearch && "Add your first client to open a return."}
            </EmptyState>
          </div>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>SSN</Th>
                  <Th>Filing status</Th>
                  <Th>Email</Th>
                  <Th className="text-right">Returns</Th>
                </tr>
              </thead>
              <tbody>
                {clients.data.results.map((client) => (
                  <tr
                    key={client.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/clients/${client.id}`)}
                  >
                    <Td>
                      <Link href={`/clients/${client.id}`} className="font-medium text-blue-800 hover:underline">
                        {client.last_name}, {client.first_name}
                      </Link>
                    </Td>
                    <Td className="font-mono text-slate-600">{client.ssn_masked || "—"}</Td>
                    <Td>{client.filing_status ? FILING_STATUS_LABELS[client.filing_status] : "—"}</Td>
                    <Td className="text-slate-600">{client.email || "—"}</Td>
                    <Td className="text-right">{client.return_count}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {pageCount > 1 && (
              <div className="flex items-center justify-end gap-2 p-3 text-sm text-slate-600">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                Page {page} of {pageCount}
                <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
