import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import { keys } from "./keys";

export function useAuditEvents(filters: { action?: string; page?: number }) {
  return useQuery({
    queryKey: keys.audit({ action: filters.action ?? "", page: filters.page ?? 1 }),
    queryFn: () =>
      unwrap(
        api.GET("/api/audit-events", {
          params: { query: { action: filters.action || undefined, page: filters.page ?? 1 } },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}
