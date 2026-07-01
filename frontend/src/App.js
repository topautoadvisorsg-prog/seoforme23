import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";

import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import ClientWorkspaceLayout from "@/components/ClientWorkspaceLayout";

import LoginPage from "@/pages/Login";
import OverviewPage from "@/pages/Overview";
import ClientsPage from "@/pages/Clients";
import ApprovalsPage from "@/pages/Approvals";
import AnalyticsPage from "@/pages/Analytics";
import NotificationsPage from "@/pages/Notifications";
import SettingsPage from "@/pages/Settings";

import ClientDashboard from "@/pages/clientWorkspace/ClientDashboard";
import ContentQueue from "@/pages/clientWorkspace/ContentQueue";
import ServicesPage from "@/pages/clientWorkspace/ServicesPage";
import OnboardingPage from "@/pages/clientWorkspace/OnboardingPage";
import ConnectionsPage from "@/pages/clientWorkspace/ConnectionsPage";
import ActivityPage from "@/pages/clientWorkspace/ActivityPage";
import ChannelComingSoon from "@/pages/clientWorkspace/ChannelComingSoon";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster richColors closeButton position="bottom-right" />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Agency-level shell */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<OverviewPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="approvals" element={<ApprovalsPage />} />
            <Route
              path="analytics"
              element={
                <ProtectedRoute roles={["admin", "manager"]}>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Client workspace shell (Supabase-style per-client sidebar) */}
          <Route
            path="/dashboard/clients/:id"
            element={
              <ProtectedRoute>
                <ClientWorkspaceLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ClientDashboard />} />
            <Route path="queue" element={<ContentQueue />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="connections" element={<ConnectionsPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="channel/:channel" element={<ChannelComingSoon />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
