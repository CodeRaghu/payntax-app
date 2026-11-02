import { Form1040Screen } from "@/features/form1040/form1040-screen";

export const metadata = { title: "Form 1040" };

export default async function Form1040Page({ params }: PageProps<"/returns/[returnId]/form-1040">) {
  const { returnId } = await params;
  return <Form1040Screen returnId={returnId} />;
}
