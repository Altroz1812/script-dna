import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { ActiveOrgProvider } from "@/contexts/ActiveOrgContext";
import { ClassroomSessionProvider } from "@/contexts/ClassroomSessionContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
// Eager: landing + auth (first paint critical)
import LandingPage from "@/pages/LandingPage";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import NotFound from "@/pages/NotFound";
import Unauthorized from "@/pages/Unauthorized";
// Lazy: everything else (route-level code splitting)
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Index = lazy(() => import("@/pages/Index"));
const FontCompiler = lazy(() => import("@/pages/FontCompiler"));
const CoursesPage = lazy(() => import("@/pages/CoursesPage"));
const BatchesPage = lazy(() => import("@/pages/BatchesPage"));
const BatchDetailPage = lazy(() => import("@/pages/BatchDetailPage"));
const UsersPage = lazy(() => import("@/pages/UsersPage"));
const RolesPage = lazy(() => import("@/pages/RolesPage"));
const StudentsPage = lazy(() => import("@/pages/StudentsPage"));
const OrganizationsPage = lazy(() => import("@/pages/OrganizationsPage"));
const LeadsPage = lazy(() => import("@/pages/LeadsPage"));
const EnrollmentsPage = lazy(() => import("@/pages/EnrollmentsPage"));
const SchedulePage = lazy(() => import("@/pages/SchedulePage"));
const AttendancePage = lazy(() => import("@/pages/AttendancePage"));
const LiveClassesPage = lazy(() => import("@/pages/LiveClassesPage"));
const MaterialsPage = lazy(() => import("@/pages/MaterialsPage"));
const PaymentsPage = lazy(() => import("@/pages/PaymentsPage"));
const PayrollPage = lazy(() => import("@/pages/PayrollPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const ActivityLogsPage = lazy(() => import("@/pages/ActivityLogsPage"));
const SubscriptionPlansPage = lazy(() => import("@/pages/SubscriptionPlansPage"));
const CouponsPage = lazy(() => import("@/pages/CouponsPage"));
const CurriculumPage = lazy(() => import("@/pages/CurriculumPage"));
const SystemMonitoringPage = lazy(() => import("@/pages/SystemMonitoringPage"));
const PracticeAssignmentsPage = lazy(() => import("@/pages/PracticeAssignmentsPage"));
const StudentSubmissionsPage = lazy(() => import("@/pages/StudentSubmissionsPage"));
const StudentLessonViewer = lazy(() => import("@/pages/StudentLessonViewer"));
const StudentProgressPage = lazy(() => import("@/pages/StudentProgressPage"));
const ParentChildrenPage = lazy(() => import("@/pages/ParentChildrenPage"));
const ParentProgressPage = lazy(() => import("@/pages/ParentProgressPage"));
const OrderHistoryPage = lazy(() => import("@/pages/OrderHistoryPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const SelectOrganizationPage = lazy(() => import("@/pages/SelectOrganizationPage"));
const PracticeCanvasPage = lazy(() => import("@/pages/PracticeCanvasPage"));

const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);
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
            <Suspense fallback={<RouteFallback />}>
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
            </Suspense>
            </ClassroomSessionProvider>
            </ActiveOrgProvider>
          </AuthProvider>
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
