import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import type { Session } from "../types";
import { keys } from "./keys";

export function useSession() {
  return useQuery({
    queryKey: keys.session,
    queryFn: () => unwrap(api.GET("/api/auth/session")),
    staleTime: 30_000,
  });
}

function useSetSession() {
  const queryClient = useQueryClient();
  return (session: Session) => queryClient.setQueryData(keys.session, session);
}

export function useLogin() {
  const setSession = useSetSession();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) => unwrap(api.POST("/api/auth/login", { body })),
    onSuccess: setSession,
  });
}

export function useSignup() {
  const setSession = useSetSession();
  return useMutation({
    mutationFn: (body: { firm_name: string; full_name: string; email: string; password: string }) =>
      unwrap(api.POST("/api/auth/signup", { body })),
    onSuccess: setSession,
  });
}

export function useMfaSetup() {
  return useMutation({ mutationFn: () => unwrap(api.POST("/api/auth/mfa/setup")) });
}

export function useMfaVerify() {
  const setSession = useSetSession();
  return useMutation({
    mutationFn: (code: string) => unwrap(api.POST("/api/auth/mfa/verify", { body: { code } })),
    onSuccess: setSession,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/auth/logout")),
    onSettled: () => queryClient.clear(),
  });
}

export function useInvitationPreview(token: string) {
  return useQuery({
    queryKey: ["invitation", token],
    queryFn: () => unwrap(api.GET("/api/auth/invitations/{token}", { params: { path: { token } } })),
    retry: false,
  });
}

export function useAcceptInvitation(token: string) {
  const setSession = useSetSession();
  return useMutation({
    mutationFn: (body: { full_name: string; password: string }) =>
      unwrap(api.POST("/api/auth/invitations/{token}/accept", { params: { path: { token } }, body })),
    onSuccess: setSession,
  });
}
