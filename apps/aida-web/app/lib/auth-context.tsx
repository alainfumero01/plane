import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { dedupeRoles, type RoleCode } from "./roles";
import { hasSupabaseConfig, supabase } from "./supabase";

type Membership = {
  companyId: string;
  roleCode: RoleCode;
  isDefaultCompany: boolean;
};

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  memberships: Membership[];
  activeCompanyId: string | null;
  roles: RoleCode[];
  rolePreview: RoleCode | null;
  setRolePreview: (role: RoleCode | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  createCompany: (companyName: string, companySlug?: string | null) => Promise<string>;
  joinCompany: (companySlug: string, roleCode?: RoleCode) => Promise<string>;
  setDefaultCompany: (companyId: string) => Promise<void>;
  refreshMemberships: () => Promise<void>;
  signOut: () => Promise<void>;
};

const RolePreviewStorageKey = "aida.rolePreview";

const AuthContext = createContext<AuthContextValue | null>(null);

const deriveRolesFromUser = (user: User | null): RoleCode[] => {
  if (!user) return [];

  const metadataRoles = user.app_metadata?.roles;
  if (Array.isArray(metadataRoles)) {
    return dedupeRoles(metadataRoles.filter((entry): entry is string => typeof entry === "string"));
  }

  const singleRole = user.app_metadata?.role;
  if (typeof singleRole === "string") {
    return dedupeRoles([singleRole]);
  }

  return [];
};

const parseRoleCode = (value: unknown): RoleCode | null => {
  if (
    value === "business_owner_admin" ||
    value === "warehouse" ||
    value === "project_manager" ||
    value === "site_operator" ||
    value === "offshore_engineer"
  ) {
    return value;
  }

  return null;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [rolePreview, setRolePreviewState] = useState<RoleCode | null>(null);

  const setRolePreview = useCallback((role: RoleCode | null) => {
    setRolePreviewState(role);
    if (typeof window !== "undefined") {
      if (role) window.localStorage.setItem(RolePreviewStorageKey, role);
      else window.localStorage.removeItem(RolePreviewStorageKey);
    }
  }, []);

  const loadMemberships = useCallback(async (userId: string) => {
    if (!supabase) {
      setMemberships([]);
      return;
    }

    const { data, error } = await supabase
      .from("user_company_memberships")
      .select("company_id,is_default_company,roles(code)")
      .eq("user_id", userId)
      .eq("status", "active");

    if (error) {
      console.error("Failed to load memberships", error);
      setMemberships([]);
      return;
    }

    const parsed: Membership[] = (data ?? [])
      .map((row) => {
        const rawRoles = row.roles as { code?: string } | Array<{ code?: string }> | null;
        const roleRecord = Array.isArray(rawRoles) ? rawRoles[0] : rawRoles;
        const roleCode = parseRoleCode(roleRecord?.code);

        if (!roleCode) return null;

        return {
          companyId: row.company_id,
          roleCode,
          isDefaultCompany: row.is_default_company ?? false,
        } satisfies Membership;
      })
      .filter((entry): entry is Membership => entry !== null);

    setMemberships(parsed);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(RolePreviewStorageKey);
      const parsed = parseRoleCode(stored);
      if (parsed) setRolePreviewState(parsed);
    }

    if (!hasSupabaseConfig || !supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;

    let mounted = true;

    const initSession = async () => {
      const { data } = await client.auth.getSession();
      if (!mounted) return;

      setSession(data.session ?? null);
      if (data.session?.user) await loadMemberships(data.session.user.id);
      setLoading(false);
    };

    void initSession();

    const { data: listener } = client.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession ?? null);
      if (nextSession?.user) await loadMemberships(nextSession.user.id);
      else setMemberships([]);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadMemberships]);

  const roles = useMemo(() => {
    const membershipRoles = dedupeRoles(memberships.map((membership) => membership.roleCode));

    if (rolePreview) return [rolePreview];

    if (membershipRoles.length > 0) return membershipRoles;

    const userRoles = deriveRolesFromUser(session?.user ?? null);
    if (userRoles.length > 0) return userRoles;

    return ["site_operator" as RoleCode];
  }, [memberships, rolePreview, session?.user]);

  const activeCompanyId = useMemo(() => {
    const defaultMembership = memberships.find((membership) => membership.isDefaultCompany);
    if (defaultMembership) return defaultMembership.companyId;
    if (memberships[0]) return memberships[0].companyId;

    const metadataCompanyId = session?.user?.app_metadata?.company_id;
    return typeof metadataCompanyId === "string" ? metadataCompanyId : null;
  }, [memberships, session?.user?.app_metadata]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase is not configured.");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    if (!supabase) throw new Error("Supabase is not configured.");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const refreshMemberships = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    await loadMemberships(userId);
  }, [loadMemberships, session?.user?.id]);

  const createCompany = useCallback(
    async (companyName: string, companySlug?: string | null) => {
      if (!supabase) throw new Error("Supabase is not configured.");

      const { data, error } = await supabase.rpc("create_company_with_owner", {
        p_company_name: companyName,
        p_company_slug: companySlug || null,
      });

      if (error) throw error;
      await refreshMemberships();
      return data as string;
    },
    [refreshMemberships]
  );

  const joinCompany = useCallback(
    async (companySlug: string, roleCode: RoleCode = "site_operator") => {
      if (!supabase) throw new Error("Supabase is not configured.");

      const { data, error } = await supabase.rpc("join_company", {
        p_company_slug: companySlug,
        p_role_code: roleCode,
      });

      if (error) throw error;
      await refreshMemberships();
      return data as string;
    },
    [refreshMemberships]
  );

  const setDefaultCompany = useCallback(
    async (companyId: string) => {
      if (!supabase) throw new Error("Supabase is not configured.");

      const { error } = await supabase.rpc("set_default_company", {
        p_company_id: companyId,
      });

      if (error) throw error;
      await refreshMemberships();
    },
    [refreshMemberships]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      memberships,
      activeCompanyId,
      roles,
      rolePreview,
      setRolePreview,
      signIn,
      signUp,
      createCompany,
      joinCompany,
      setDefaultCompany,
      refreshMemberships,
      signOut,
    }),
    [
      activeCompanyId,
      createCompany,
      joinCompany,
      loading,
      memberships,
      refreshMemberships,
      rolePreview,
      roles,
      session,
      setDefaultCompany,
      setRolePreview,
      signIn,
      signOut,
      signUp,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
};
