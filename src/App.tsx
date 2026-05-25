import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { ActiveOrgProvider } from "@/contexts/ActiveOrgContext";
import { ClassroomSessionProvider } from "@/contexts/ClassroomSessionContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import LandingPage from "@/pages/LandingPage";
import Dashboard from "@/pages/Dashboard";
import Index from "@/pages/Index";
import FontCompiler from "@/pages/FontCompiler";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import CoursesPage from "@/pages/CoursesPage";
import BatchesPage from "@/pages/BatchesPage";
import BatchDetailPage from "@/pages/BatchDetailPage";
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
import CheckoutPage from "@/pages/CheckoutPage";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import ActivityLogsPage from "@/pages/ActivityLogsPage";
import SubscriptionPlansPage from "@/pages/SubscriptionPlansPage";
import CouponsPage from "@/pages/CouponsPage";
import CurriculumPage from "@/pages/CurriculumPage";
import SystemMonitoringPage from "@/pages/SystemMonitoringPage";
import PracticeAssignmentsPage from "@/pages/PracticeAssignmentsPage";
import StudentSubmissionsPage from "@/pages/StudentSubmissionsPage";
import StudentLessonViewer from "@/pages/StudentLessonViewer";
import StudentProgressPage from "@/pages/StudentProgressPage";
import ParentChildrenPage from "@/pages/ParentChildrenPage";
import ParentProgressPage from "@/pages/ParentProgressPage";
import OrderHistoryPage from "@/pages/OrderHistoryPage";
import ProfilePage from "@/pages/ProfilePage";
import SelectOrganizationPage from "@/pages/SelectOrganizationPage";
import Unauthorized from "@/pages/Unauthorized";
import PracticeCanvasPage from "@/pages/PracticeCanvasPage";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 60_000,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ActiveOrgProvider>
            <ClassroomSessionProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route
                path="/select-organization"
                element={
                  <ProtectedRoute allowedRoles={['superadmin', 'admin', 'support', 'teacher']}>
                    <SelectOrganizationPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected app routes */}
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/batches" element={<BatchesPage />} />
                <Route path="/batches/:batchId" element={<BatchDetailPage />} />
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
                <Route path="/settings" element={<ProtectedRoute allowedRoles={['superadmin']}><SettingsPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/activity-logs" element={<ActivityLogsPage />} />
                <Route path="/subscriptions" element={<SubscriptionPlansPage />} />
                <Route path="/coupons" element={<CouponsPage />} />
                <Route path="/curriculum" element={<CurriculumPage />} />
                <Route path="/monitoring" element={<SystemMonitoringPage />} />
                <Route path="/practice" element={<PracticeAssignmentsPage />} />
                <Route path="/practice-canvas" element={<PracticeCanvasPage />} />
                <Route path="/submissions" element={<StudentSubmissionsPage />} />
                <Route path="/courses/:courseId/lessons" element={<StudentLessonViewer />} />
                <Route path="/my-progress" element={<StudentProgressPage />} />
                <Route path="/my-children" element={<ParentChildrenPage />} />
                <Route path="/child-progress" element={<ParentProgressPage />} />
                <Route path="/my-orders" element={<OrderHistoryPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            </ClassroomSessionProvider>
            </ActiveOrgProvider>
          </AuthProvider>
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
