"use client";

import { useRouter } from "next/navigation";

import { useCreateClient } from "@/api/hooks/clients";
import { Breadcrumbs } from "@/components/app-shell";
import { PageHeader } from "@/components/states";
import { Card, CardContent } from "@/components/ui/card";

import { ClientForm } from "./client-form";

export function NewClientScreen() {
  const router = useRouter();
  const create = useCreateClient();
  return (
    <>
      <Breadcrumbs items={[{ label: "Clients", href: "/clients" }, { label: "New client" }]} />
      <PageHeader title="New client" />
      <Card className="max-w-3xl">
        <CardContent>
          <ClientForm
            submitLabel="Create client"
            onSubmit={async (values) => {
              const client = await create.mutateAsync(values);
              router.push(`/clients/${client.id}`);
            }}
            onCancel={() => router.push("/clients")}
          />
        </CardContent>
      </Card>
    </>
  );
}
