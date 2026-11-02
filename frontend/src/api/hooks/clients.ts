import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import type { ClientInput } from "../types";
import { keys } from "./keys";

export function useClients(search: string, page = 1) {
  return useQuery({
    queryKey: keys.clients(search, page),
    queryFn: () => unwrap(api.GET("/api/clients", { params: { query: { search: search || undefined, page } } })),
    placeholderData: keepPreviousData,
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: keys.client(id),
    queryFn: () => unwrap(api.GET("/api/clients/{id}", { params: { path: { id } } })),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ClientInput) => unwrap(api.POST("/api/clients", { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.clientsAll }),
  });
}

export function useUpdateClient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ClientInput>) =>
      unwrap(api.PATCH("/api/clients/{id}", { params: { path: { id } }, body })),
    onSuccess: (client) => {
      queryClient.setQueryData(keys.client(id), client);
      queryClient.invalidateQueries({ queryKey: keys.clientsAll });
    },
  });
}

export function useRevealSsn(id: string) {
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/clients/{id}/reveal-ssn", { params: { path: { id } } })),
  });
}
