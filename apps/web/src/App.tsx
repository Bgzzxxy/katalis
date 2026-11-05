import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ToastProvider } from "./hooks/useToast";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { PublicLayout } from "./components/layout/PublicLayout";
import { RequireAuth } from "./components/RequireAuth";
import { MonitorPage } from "./pages/MonitorPage";
import { ModelsPage } from "./pages/ModelsPage";
import { KeysDashboardPage } from "./pages/KeysDashboardPage";
import { BillingPage } from "./pages/BillingPage";
import { DocsPage } from "./pages/DocsPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { LandingPage } from "./pages/LandingPage";
import { UsagePage } from "./pages/UsagePage";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route element={<PublicLayout />}>
              <Route path="/models" element={<ModelsPage />} />
              <Route path="/docs" element={<DocsPage />} />
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/register" element={<RegisterPage />} />
            </Route>
            <Route element={<DashboardLayout />}>
              <Route path="/monitor" element={<MonitorPage />} />
              <Route
                path="/keys"
                element={
                  <RequireAuth>
                    <KeysDashboardPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/billing"
                element={
                  <RequireAuth>
                    <BillingPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/usage"
                element={
                  <RequireAuth>
                    <UsagePage />
                  </RequireAuth>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/monitor" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}