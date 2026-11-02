"use client";

import { setupWorker } from "msw/browser";
import { useEffect } from "react";

import { handlers } from "./handlers";

/** Browser-only (msw/browser has no Node build). Loaded with next/dynamic { ssr: false }. */
export default function MockWorker({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    setupWorker(...handlers)
      .start({ onUnhandledFrame: "bypass", quiet: true })
      .then(onReady);
  }, [onReady]);
  return null;
}
