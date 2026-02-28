import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Unauthorized from "@/pages/Unauthorized";
import PlaceholderPage from "@/pages/PlaceholderPage";
import Index from "@/pages/Index";
import FontCompiler from "@/pages/FontCompiler";
import NotFound from "@/pages/NotFound";
import CoursesPage from "@/pages/CoursesPage";
import BatchesPage from "@/pages/BatchesPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Protected app shell */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'support', 'teacher', 'student', 'parent']}><Dashboard /></ProtectedRoute>} />
              <Route path="/courses" element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'support', 'teacher', 'student']}><CoursesPage /></ProtectedRoute>} />
              <Route path="/batches" element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'support', 'teacher', 'student']}><BatchesPage /></ProtectedRoute>} />
              <Route path="/schedule" element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'support', 'teacher', 'student', 'parent']}><PlaceholderPage /></ProtectedRoute>} />
              <Route path="/attendance" element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'teacher']}><PlaceholderPage /></ProtectedRoute>} />
              <Route path="/live-classes" element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'teacher', 'student']}><PlaceholderPage /></ProtectedRoute>} />
              <Route path="/materials" element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'teacher', 'student']}><PlaceholderPage /></ProtectedRoute>} />
              <Route path="/leads" element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'support']}><PlaceholderPage /></ProtectedRoute>} />
              <Route path="/enrollments" element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'support']}><PlaceholderPage /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute allowedRoles={['superadmin', 'admin']}><PlaceholderPage /></ProtectedRoute>} />
              <Route path="/students" element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'support', 'teacher', 'parent']}><PlaceholderPage /></ProtectedRoute>} />
              <Route path="/payments" element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'support', 'parent']}><PlaceholderPage /></ProtectedRoute>} />
              <Route path="/payroll" element={<ProtectedRoute allowedRoles={['superadmin']}><PlaceholderPage /></ProtectedRoute>} />
              <Route path="/font-architect" element={<ProtectedRoute allowedRoles={['superadmin', 'admin']}><Index /></ProtectedRoute>} />
              <Route path="/font-compiler" element={<ProtectedRoute allowedRoles={['superadmin', 'admin']}><FontCompiler /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={['superadmin', 'admin']}><PlaceholderPage /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'support']}><PlaceholderPage /></ProtectedRoute>} />
              <Route path="/organizations" element={<ProtectedRoute allowedRoles={['superadmin']}><PlaceholderPage /></ProtectedRoute>} />
              <Route path="/roles" element={<ProtectedRoute allowedRoles={['superadmin']}><PlaceholderPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={['superadmin', 'admin']}><PlaceholderPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'support', 'teacher', 'student', 'parent']}><PlaceholderPage /></ProtectedRoute>} />
            </Route>

            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
