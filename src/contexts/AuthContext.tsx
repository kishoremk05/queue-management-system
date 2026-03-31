import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "super_admin" | "company_admin" | "staff";

interface AuthState {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  organizationId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  role: null,
  organizationId: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, organization_id")
        .eq("user_id", userId);

      if (error) throw error;

      if (data && data.length > 0) {
        // Prefer the highest-privilege role when a user has multiple role rows.
        const rolePriority: AppRole[] = [
          "super_admin",
          "company_admin",
          "staff",
        ];
        const selectedRole = rolePriority.find((candidate) =>
          data.some((row) => row.role === candidate),
        );

        const selectedRow =
          data.find((row) => row.role === selectedRole) ?? data[0];
        setRole(selectedRow.role as AppRole);
        setOrganizationId(selectedRow.organization_id);
      } else {
        setRole(null);
        setOrganizationId(null);
      }
    } catch (error) {
      console.error("Failed to fetch user role:", error);
      setRole(null);
      setOrganizationId(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const syncSession = (nextSession: Session | null) => {
      if (!isMounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(true);

      if (nextSession?.user) {
        void fetchRole(nextSession.user.id).finally(() => {
          if (isMounted) setLoading(false);
        });
      } else {
        setRole(null);
        setOrganizationId(null);
        setLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Avoid awaiting Supabase calls inside this callback to prevent auth deadlocks.
      setTimeout(() => syncSession(nextSession), 0);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        syncSession(session);
      })
      .catch((error) => {
        console.error("Failed to get auth session:", error);
        if (isMounted) {
          setRole(null);
          setOrganizationId(null);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setOrganizationId(null);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, role, organizationId, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
