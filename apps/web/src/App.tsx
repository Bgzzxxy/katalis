import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ToastProvider } from "./hooks/useToast";
import { AppLayout } from "./components/layout/AppLayout";
import { RequireAuth } from "./components/RequireAuth";
import { MonitorPage } from "./pages/MonitorPage";
import { ModelsPage } from "./pages/ModelsPage";
import { KeysDashboardPage } from "./pages/KeysDashboardPage";
import { BillingPage } from "./pages/BillingPage";
import { DocsPage } from "./pages/DocsPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/monitor" replace />} />
              <Route path="/monitor" element={<MonitorPage />} />
              <Route path="/models" element={<ModelsPage />} />
              <Route path="/docs" element={<DocsPage />} />
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/register" element={<RegisterPage />} />
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
              <Route path="*" element={<Navigate to="/monitor" replace />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}