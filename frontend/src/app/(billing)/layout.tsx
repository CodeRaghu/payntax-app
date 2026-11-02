import { Suspense } from "react";

import { SessionGate } from "@/components/session-gate";
import { Loading } from "@/components/states";

export default function BillingLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<Loading />}>
      <SessionGate gate="billing">{children}</SessionGate>
    </Suspense>
  );
}
