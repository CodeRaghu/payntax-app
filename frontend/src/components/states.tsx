import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-slate-500" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const notFound = error instanceof ApiError && error.status === 404;
  const message = notFound
    ? "We couldn't find that. It may have been deleted, or it belongs to another firm."
    : error instanceof Error
      ? error.message
      : "Something went wrong.";
  return (
    <div className="p-6">
      <Alert tone="danger" title={notFound ? "Not found" : "Couldn't load this page"}>
        <p>{message}</p>
        {onRetry && !notFound && (
          <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
            Try again
          </Button>
        )}
      </Alert>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 p-10 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {children && <div className="text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
