import { Suspense } from "react";

import { Loading } from "@/components/states";

export default function AuthGroupLayout({ children }: LayoutProps<"/">) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}
