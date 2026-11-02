import { ReturnWorkspaceScreen } from "@/features/returns/return-workspace-screen";

export const metadata = { title: "Return" };

export default async function ReturnPage({ params }: PageProps<"/returns/[returnId]">) {
  const { returnId } = await params;
  return <ReturnWorkspaceScreen returnId={returnId} />;
}
