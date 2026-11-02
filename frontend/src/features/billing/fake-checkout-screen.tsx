"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { useCompleteFakeCheckout } from "@/api/hooks/billing";
import { AuthLayout } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Local stand-in for Stripe's hosted checkout page. Never shown when a real billing provider is set. */
export function FakeCheckoutScreen() {
  const router = useRouter();
  const session = useSearchParams().get("session") ?? "";
  const complete = useCompleteFakeCheckout();

  return (
    <AuthLayout title="Test checkout" subtitle="Development only. Stands in for Stripe hosted checkout.">
      {complete.isError && (
        <Alert tone="danger" className="mb-4">
          {complete.error.message}
        </Alert>
      )}
      <div className="space-y-3">
        <Button
          className="w-full"
          disabled={!session}
          loading={complete.isPending}
          onClick={() => complete.mutate(session, { onSuccess: () => router.replace("/clients") })}
        >
          Simulate successful payment
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => router.replace("/billing/plan")}>
          Cancel
        </Button>
      </div>
    </AuthLayout>
  );
}
