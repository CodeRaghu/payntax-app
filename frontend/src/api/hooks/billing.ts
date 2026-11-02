import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import { keys } from "./keys";

export function usePlans() {
  return useQuery({ queryKey: keys.plans, queryFn: () => unwrap(api.GET("/api/billing/plans")) });
}

export function useSubscription() {
  return useQuery({
    queryKey: keys.subscription,
    queryFn: () => unwrap(api.GET("/api/billing/subscription")),
    retry: false,
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: (plan: string) => unwrap(api.POST("/api/billing/checkout", { body: { plan } })),
  });
}

export function usePortal() {
  return useMutation({ mutationFn: () => unwrap(api.POST("/api/billing/portal")) });
}

export function useCompleteFakeCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (session: string) => unwrap(api.POST("/api/billing/fake/complete", { body: { session } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.session });
      queryClient.invalidateQueries({ queryKey: keys.subscription });
    },
  });
}
