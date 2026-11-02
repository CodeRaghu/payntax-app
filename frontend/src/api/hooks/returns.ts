import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import { keys } from "./keys";

export function useReturns(clientId: string) {
  return useQuery({
    queryKey: keys.returns(clientId),
    queryFn: () => unwrap(api.GET("/api/returns", { params: { query: { client: clientId } } })),
  });
}

export function useTaxReturn(id: string) {
  return useQuery({
    queryKey: keys.taxReturn(id),
    queryFn: () => unwrap(api.GET("/api/returns/{id}", { params: { path: { id } } })),
  });
}

export function useCreateReturn(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taxYear: number) =>
      unwrap(api.POST("/api/returns", { body: { client: clientId, tax_year: taxYear } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.returns(clientId) });
      queryClient.invalidateQueries({ queryKey: keys.client(clientId) });
    },
  });
}

export function useMarkReturnComplete(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: "complete" | "ready") =>
      unwrap(api.PATCH("/api/returns/{id}", { params: { path: { id } }, body: { status } })),
    onSuccess: (data) => queryClient.setQueryData(keys.taxReturn(id), data),
  });
}
