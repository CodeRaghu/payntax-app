"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useCallback, useState, type ReactNode } from "react";

import { ApiError } from "@/api/client";

export const MOCKING = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;
function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

const MockWorker = dynamic(() => import("@/mocks/mock-worker"), { ssr: false });

/** Starts the mock API (MSW) when NEXT_PUBLIC_API_MOCKING=enabled, before any request is made. */
function MockApi({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!MOCKING);
  const onReady = useCallback(() => setReady(true), []);
  if (!ready) {
    return (
      <>
        <MockWorker onReady={onReady} />
        <p className="p-8 text-sm text-slate-500">Starting mock API…</p>
      </>
    );
  }
  return (
    <>
      <div className="bg-amber-100 px-4 py-1 text-center text-xs text-amber-900">
        Mock API: data is fake and resets on reload. Sign in with owner@payntax.test / any password, MFA code 123456.
      </div>
      {children}
    </>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <MockApi>{children}</MockApi>
    </QueryClientProvider>
  );
}
