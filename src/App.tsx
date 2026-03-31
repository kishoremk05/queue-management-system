import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import CompanySignup from "./pages/CompanySignup";
import CompanyLogin from "./pages/CompanyLogin";
import SuperAdmin from "./pages/SuperAdmin";
import CompanyDashboard from "./pages/CompanyDashboard";
import StaffSignup from "./pages/StaffSignup";
import StaffDashboard from "./pages/StaffDashboard";
import Kiosk from "./pages/Kiosk";
import Display from "./pages/Display";
import TokenTracker from "./pages/TokenTracker";
import PaymentCallback from "./pages/PaymentCallback";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/company-signup" element={<CompanySignup />} />
            <Route path="/payment/callback" element={<PaymentCallback />} />
            <Route path="/company-login" element={<CompanyLogin />} />
            <Route path="/staff-signup" element={<StaffSignup />} />
            <Route
              path="/super-admin"
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <SuperAdmin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company-dashboard"
              element={
                <ProtectedRoute requiredRole="company_admin">
                  <CompanyDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff"
              element={
                <ProtectedRoute requiredRole="staff">
                  <StaffDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/kiosk/:orgId" element={<Kiosk />} />
            <Route path="/display/:orgId" element={<Display />} />
            <Route
              path="/track/:orgId/:tokenNumber"
              element={<TokenTracker />}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
