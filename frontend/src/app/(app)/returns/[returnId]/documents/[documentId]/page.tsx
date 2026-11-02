import { ReviewScreen } from "@/features/documents/review-screen";

export const metadata = { title: "Review document" };

export default async function ReviewPage({ params }: PageProps<"/returns/[returnId]/documents/[documentId]">) {
  const { returnId, documentId } = await params;
  return <ReviewScreen returnId={returnId} documentId={documentId} />;
}
