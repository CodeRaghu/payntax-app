import { ClientDetailScreen } from "@/features/clients/client-detail-screen";

export const metadata = { title: "Client" };

export default async function ClientPage({ params }: PageProps<"/clients/[clientId]">) {
  const { clientId } = await params;
  return <ClientDetailScreen clientId={clientId} />;
}
