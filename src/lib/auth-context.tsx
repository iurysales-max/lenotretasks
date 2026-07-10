import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

export type AppRole = "admin" | "rh" | "gestor" | "colaborador";

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  cargo: string | null;
  phone: string | null;
  sector_id: string | null;
  status: "active" | "inactive";
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async (s: Session | null) => {
    setSession(s);
    if (!s?.user) {
      setProfile(null);
      setRoles([]);
      setLoading(false);
      return;
    }
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", s.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", s.user.id),
    ]);
    setProfile((p as Profile) ?? null);
    setRoles((r ?? []).map((x: { role: AppRole }) => x.role));
    setLoading(false);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      // Use setTimeout to avoid deadlock as per Supabase docs
      setTimeout(() => void load(s), 0);
    });
    supabase.auth.getSession().then(({ data }) => void load(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    await load(data.session);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, roles, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}

export function useHasRole(...allowed: AppRole[]) {
  const { roles } = useAuth();
  return roles.some((r) => allowed.includes(r));
}

export function useAuthSubscription() {
  const qc = useQueryClient();
  const router = useRouter();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") qc.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [qc, router]);
}
