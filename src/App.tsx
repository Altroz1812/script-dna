import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
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
            {/* All routes open — auth bypassed */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/batches" element={<BatchesPage />} />
              <Route path="/schedule" element={<PlaceholderPage />} />
              <Route path="/attendance" element={<PlaceholderPage />} />
              <Route path="/live-classes" element={<PlaceholderPage />} />
              <Route path="/materials" element={<PlaceholderPage />} />
              <Route path="/leads" element={<PlaceholderPage />} />
              <Route path="/enrollments" element={<PlaceholderPage />} />
              <Route path="/users" element={<PlaceholderPage />} />
              <Route path="/students" element={<PlaceholderPage />} />
              <Route path="/payments" element={<PlaceholderPage />} />
              <Route path="/payroll" element={<PlaceholderPage />} />
              <Route path="/font-architect" element={<Index />} />
              <Route path="/font-compiler" element={<FontCompiler />} />
              <Route path="/reports" element={<PlaceholderPage />} />
              <Route path="/notifications" element={<PlaceholderPage />} />
              <Route path="/organizations" element={<PlaceholderPage />} />
              <Route path="/roles" element={<PlaceholderPage />} />
              <Route path="/settings" element={<PlaceholderPage />} />
              <Route path="/profile" element={<PlaceholderPage />} />
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
