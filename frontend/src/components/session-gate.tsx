"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useSession } from "@/api/hooks/auth";
import type { Session } from "@/api/types";
import { ErrorState, Loading } from "@/components/states";

/**
 * Where a user belongs given their sign-in state (navigation diagram in docs/screens):
 * SCR-01 log in → SCR-02 MFA → (new firm) SCR-03 plan → SCR-04 clients.
 * The backend enforces the same rules; this only keeps people on the right screen.
 */
export type Gate = "guest" | "mfa" | "billing" | "app";

const USABLE = new Set(["trialing", "active", "past_due"]);

export function homeFor(session: Session): string {
  if (!session.authenticated) return "/login";
  if (!session.mfa_verified) return "/mfa";
  if (!session.subscription_status || !USABLE.has(session.subscription_status)) return "/billing/plan";
  return "/clients";
}

function allowed(gate: Gate, session: Session): boolean {
  const home = homeFor(session);
  switch (gate) {
    case "guest":
      return !session.authenticated;
    case "mfa":
      return session.authenticated && !session.mfa_verified;
    case "billing":
      return session.mfa_verified;
    case "app":
      return home === "/clients";
  }
}

export function SessionGate({ gate, children }: { gate: Gate; children: ReactNode }) {
  const { data: session, error, refetch } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const ok = session ? allowed(gate, session) : false;

  useEffect(() => {
    if (session && !ok) {
      const next = gate === "app" && !session.authenticated ? `/login?next=${encodeURIComponent(pathname)}` : homeFor(session);
      router.replace(next);
    }
  }, [session, ok, gate, pathname, router]);

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!session || !ok) return <Loading />;
  return <>{children}</>;
}
