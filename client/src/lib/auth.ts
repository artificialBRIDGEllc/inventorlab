import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./api";

export type AuthUser = { id: number; email: string; fullName: string; role: string; idmeVerified: boolean } | null;

export function useAuth() {
  const qc = useQueryClient();
  const { data: user, isLoading } = useQuery<AuthUser>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const r = await fetch("/api/auth/me", { credentials: "include" });
      if (r.status === 401) return null;
      if (!r.ok) return null;
      return r.json();
    },
    retry: false,
    staleTime: 60_000,
  });

  const loginMutation = useMutation({
    mutationFn: async (d: { email: string; password: string }) => {
      const r = await apiRequest("POST", "/api/auth/login", d);
      return r.json();
    },
    onSuccess: (data) => qc.setQueryData(["/api/auth/me"], data),
  });

  const registerMutation = useMutation({
    mutationFn: async (d: { email: string; password: string; fullName: string }) => {
      const r = await apiRequest("POST", "/api/auth/register", d);
      return r.json();
    },
    onSuccess: (data) => qc.setQueryData(["/api/auth/me"], data),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/auth/logout"); },
    onSuccess:  ()  => { qc.setQueryData(["/api/auth/me"], null); qc.invalidateQueries(); },
  });

  return {
    user: user ?? null, isLoading, isLoggedIn: !!user,
    login: loginMutation.mutateAsync, register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoginPending: loginMutation.isPending, isRegisterPending: registerMutation.isPending,
    loginError: loginMutation.error,
  };
}
