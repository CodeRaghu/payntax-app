"use client";

import { Check } from "lucide-react";

import { useSession } from "@/api/hooks/auth";
import { useCheckout, usePlans } from "@/api/hooks/billing";
import { AuthLayout } from "@/components/app-shell";
import { ErrorState, Loading } from "@/components/states";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";

/** SCR-03 Choose plan → hosted checkout (REQ-BIL-001). Card details never touch our pages. */
export function PlanScreen() {
  const { data: session } = useSession();
  const plans = usePlans();
  const checkout = useCheckout();
  const isOwner = session?.user?.role === "owner";

  if (plans.isPending) return <Loading />;
  if (plans.isError) return <ErrorState error={plans.error} onRetry={() => plans.refetch()} />;

  return (
    <AuthLayout title="Choose a plan" subtitle="Start with a free trial. Texas sales tax is added at checkout.">
      {!isOwner && (
        <Alert tone="warning" className="mb-4">
          Your firm doesn&apos;t have an active subscription. Ask the firm owner to choose a plan.
        </Alert>
      )}
      {checkout.isError && (
        <Alert tone="danger" className="mb-4">
          {checkout.error.message}
        </Alert>
      )}
      <ul className="space-y-3">
        {plans.data.map((plan) => (
          <li key={plan.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-baseline justify-between">
              <p className="font-semibold text-slate-900">{plan.name}</p>
              <p className="text-sm text-slate-700">
                <span className="text-lg font-semibold">${formatMoney(plan.monthly_price_cents / 100)}</span> / month
              </p>
            </div>
            <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-700" aria-hidden /> {feature}
                </li>
              ))}
            </ul>
            <Button
              className="mt-4 w-full"
              disabled={!isOwner}
              loading={checkout.isPending && checkout.variables === plan.id}
              onClick={() =>
                checkout.mutate(plan.id, { onSuccess: ({ url }) => window.location.assign(url) })
              }
            >
              Start {plan.trial_days}-day trial
            </Button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-slate-500">Prices are placeholders until the pricing decision (D5).</p>
    </AuthLayout>
  );
}
