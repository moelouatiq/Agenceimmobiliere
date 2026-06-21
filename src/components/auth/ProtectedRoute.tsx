
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import useUserPermissions from "@/hooks/useUserPermissions";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading: authLoading } = useAuth();
  const { canAccessTable, isAdmin, isLoading: permissionsLoading } = useUserPermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const isLoading = authLoading || permissionsLoading;

  const currentPath = location.pathname;

  useEffect(() => {
    if (!isLoading) {
      if (!session) {
        // Not authenticated, redirect to login
        console.log('User not authenticated, redirecting to login');
        navigate("/signin");
      } else if (!isAdmin) {
        // For regular users, check page access permission for all pages (including dashboard)
        // Remove leading slash for checking permissions
        const pagePath = currentPath === '/' ? '' : currentPath.substring(1);
        
        if (!canAccessTable(pagePath)) {
          console.log(`Access denied to ${pagePath}, redirecting to first accessible page`);
          
          // Instead of hardcoding redirect to dashboard, find the first page they have access to
          const pages = ['dashboard', 'clients', 'proprietes', 'proprietaires', 'reservations', 'depenses'];
          
          for (const page of pages) {
            if (canAccessTable(page)) {
              const redirectPath = page === 'dashboard' ? '/' : `/${page}`;
              console.log(`Found accessible page: ${page}, redirecting to ${redirectPath}`);
              navigate(redirectPath);
              return;
            }
          }
          
          // If no pages are accessible, show access denied
          console.log('No accessible pages found, showing access denied');
        }
      } else {
        console.log('Admin user detected, access granted to all pages');
      }
    }
  }, [session, isLoading, navigate, canAccessTable, isAdmin, currentPath]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-progest-primary"></div>
      </div>
    );
  }

  // If authenticated but no permission for this page (including dashboard now)
  if (session) {
    const pagePath = currentPath === '/' ? '' : currentPath.substring(1);
    if (!isAdmin && !canAccessTable(pagePath)) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Accès refusé</AlertTitle>
            <AlertDescription>
              Vous n'avez pas les permissions nécessaires pour accéder à cette page.
            </AlertDescription>
          </Alert>
        </div>
      );
    }
  }

  return session ? <>{children}</> : null;
};
