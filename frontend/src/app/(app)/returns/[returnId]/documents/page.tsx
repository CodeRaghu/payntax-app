import { DocumentsScreen } from "@/features/documents/documents-screen";

export const metadata = { title: "Documents" };

export default async function DocumentsPage({ params }: PageProps<"/returns/[returnId]/documents">) {
  const { returnId } = await params;
  return <DocumentsScreen returnId={returnId} />;
}
