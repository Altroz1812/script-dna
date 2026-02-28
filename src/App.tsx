import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Index from "@/pages/Index";
import FontCompiler from "@/pages/FontCompiler";
import NotFound from "@/pages/NotFound";
import CoursesPage from "@/pages/CoursesPage";
import BatchesPage from "@/pages/BatchesPage";
import UsersPage from "@/pages/UsersPage";
import RolesPage from "@/pages/RolesPage";
import StudentsPage from "@/pages/StudentsPage";
import OrganizationsPage from "@/pages/OrganizationsPage";
import LeadsPage from "@/pages/LeadsPage";
import EnrollmentsPage from "@/pages/EnrollmentsPage";
import SchedulePage from "@/pages/SchedulePage";
import AttendancePage from "@/pages/AttendancePage";
import LiveClassesPage from "@/pages/LiveClassesPage";
import MaterialsPage from "@/pages/MaterialsPage";
import PaymentsPage from "@/pages/PaymentsPage";
import PayrollPage from "@/pages/PayrollPage";
import ReportsPage from "@/pages/ReportsPage";
import NotificationsPage from "@/pages/NotificationsPage";
import SettingsPage from "@/pages/SettingsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/batches" element={<BatchesPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/live-classes" element={<LiveClassesPage />} />
              <Route path="/materials" element={<MaterialsPage />} />
              <Route path="/leads" element={<LeadsPage />} />
              <Route path="/enrollments" element={<EnrollmentsPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/payroll" element={<PayrollPage />} />
              <Route path="/font-architect" element={<Index />} />
              <Route path="/font-compiler" element={<FontCompiler />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/organizations" element={<OrganizationsPage />} />
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<SettingsPage />} />
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
