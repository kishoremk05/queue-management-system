import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

type AppRole = "super_admin" | "company_admin" | "staff";

export function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole: AppRole }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-action border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/company-login" replace />;
  if (role !== requiredRole) return <Navigate to="/" replace />;

  return <>{children}</>;
}
