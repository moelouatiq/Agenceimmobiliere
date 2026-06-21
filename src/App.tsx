
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/app-sidebar";
import SignIn from "@/pages/SignIn";
import SignUp from "@/pages/SignUp";
import Index from "./pages/Index";
import Proprietes from "./pages/Proprietes";
import Proprietaires from "./pages/Proprietaires";
import Reservations from "./pages/Reservations";
import NotFound from "./pages/NotFound";
import Parametres from "./pages/Parametres";
import Clients from "./pages/Clients";
import Depenses from "./pages/Depenses";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename="/">
        <AuthProvider>
          <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <SidebarProvider>
                    <div className="min-h-screen flex w-full bg-gray-50">
                      <AppSidebar />
                      <main className="flex-1 relative">
                        <SidebarTrigger />
                        <Routes>
                          <Route path="/" element={<Index />} />
                          <Route path="/proprietes" element={<Proprietes />} />
                          <Route path="/proprietaires" element={<Proprietaires />} />
                          <Route path="/reservations" element={<Reservations />} />
                          <Route path="/parametres" element={<Parametres />} />
                          <Route path="/clients" element={<Clients />} />
                          <Route path="/depenses" element={<Depenses />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </main>
                    </div>
                  </SidebarProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
