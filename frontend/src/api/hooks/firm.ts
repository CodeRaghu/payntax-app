import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import type { Role } from "../types";
import { keys } from "./keys";

export function useFirm() {
  return useQuery({ queryKey: keys.firm, queryFn: () => unwrap(api.GET("/api/firm")) });
}

export function useUpdateFirm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => unwrap(api.PATCH("/api/firm", { body: { name } })),
    onSuccess: (firm) => {
      queryClient.setQueryData(keys.firm, firm);
      queryClient.invalidateQueries({ queryKey: keys.session });
    },
  });
}

export function useFirmUsers() {
  return useQuery({ queryKey: keys.firmUsers, queryFn: () => unwrap(api.GET("/api/firm/users")) });
}

export function useUpdateFirmUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; role?: Role; is_active?: boolean }) =>
      unwrap(api.PATCH("/api/firm/users/{id}", { params: { path: { id } }, body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.firmUsers }),
  });
}

export function useInvitations(enabled: boolean) {
  return useQuery({
    queryKey: keys.invitations,
    queryFn: () => unwrap(api.GET("/api/firm/invitations")),
    enabled,
  });
}

export function useInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: Role }) => unwrap(api.POST("/api/firm/invitations", { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.invitations }),
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/firm/invitations/{id}", { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.invitations }),
  });
}
