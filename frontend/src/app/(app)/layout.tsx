import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { SessionGate } from "@/components/session-gate";
import { Loading } from "@/components/states";

/** Every screen here needs sign-in, MFA and an active subscription. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<Loading />}>
      <SessionGate gate="app">
        <AppShell>
          <Suspense fallback={<Loading />}>{children}</Suspense>
        </AppShell>
      </SessionGate>
    </Suspense>
  );
}
