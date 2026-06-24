
import { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

export type UserRole = 'admin' | 'user' | null;

interface UseUserPermissionsReturnType {
  isAdmin: boolean;
  userRole: UserRole;
  canAccessTable: (tableNameOrPath: string) => boolean;
  isLoading: boolean;
  refreshPermissions: () => Promise<void>;
}

/**
 * A hook to manage user permissions and roles
 */
export const useUserPermissions = (): UseUserPermissionsReturnType => {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [tableAccess, setTableAccess] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  // Maps page paths to table names and vice versa
  const pathToTableMapping: Record<string, string> = {
    '': 'dashboard', // Explicitly map root path to dashboard
    '/': 'dashboard', // Also map slash to dashboard
    'dashboard': 'dashboard', // Map dashboard path to dashboard table
    'clients': 'clients',
    'proprietes': 'proprietes',
    'proprietaires': 'proprietaires',
    'reservations': 'reservations',
    'depenses': 'depenses',
    'parametres': 'parametres'
  };

  // Get table name from page path
  const getTableNameFromPath = (pagePath: string): string => {
    return pathToTableMapping[pagePath] || pagePath;
  };

  // Get page path from table name
  const getPagePathFromTable = (tableName: string): string => {
    // Find the key that corresponds to this table name
    const entry = Object.entries(pathToTableMapping).find(([_, value]) => value === tableName);
    return entry ? entry[0] : tableName;
  };

  const refreshPermissions = async () => {
    if (!user) {
      setUserRole(null);
      setTableAccess({});
      setIsLoading(false);
      return;
    }

    // Ne montrer le spinner que lors du tout premier chargement
    if (userRole === null) setIsLoading(true);
    try {
      console.log('Fetching permissions for user:', user.id);
      // Get user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleError) {
        console.error('Error fetching user role:', roleError);
        setUserRole(null);
      } else {
        console.log('User role:', roleData?.role);
        setUserRole(roleData?.role as UserRole);
      }

      // If user is admin, they have access to everything
      if (roleData?.role === 'admin') {
        console.log('User is admin, has access to all pages');
        setTableAccess({});
      } else {
        // Get table access permissions
        const { data: accessData, error: accessError } = await supabase
          .from('user_table_access')
          .select('table_name, page_path, can_access')
          .eq('user_id', user.id);

        if (accessError) {
          console.error('Error fetching table access:', accessError);
        } else {
          console.log('Access data:', accessData);
          const accessMap: Record<string, boolean> = {};
          
          // Initialize all navigation paths to false
          Object.keys(pathToTableMapping).forEach(path => {
            accessMap[path] = false;
          });
          
          // REMOVED: Default dashboard access for all authenticated users
          // Now dashboard access is controlled by the database like other pages
          
          // Update with actual permissions from database
          (accessData || []).forEach(item => {
            // Store access by both table_name and page_path for flexibility
            if (item.page_path) {
              const pagePath = item.page_path.startsWith('/') 
                ? item.page_path.substring(1) 
                : item.page_path;
              accessMap[pagePath] = item.can_access;
            }
            
            if (item.table_name) {
              accessMap[item.table_name] = item.can_access;
              // Also add corresponding page path if it exists
              const pagePath = getPagePathFromTable(item.table_name);
              if (pagePath) {
                accessMap[pagePath] = item.can_access;
              }
            }
          });
          
          console.log('Processed access map:', accessMap);
          setTableAccess(accessMap);
        }
      }
    } catch (error) {
      console.error('Error in refreshPermissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshPermissions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // This function checks if the user can access a table or page path
  const canAccessTable = (tableNameOrPath: string): boolean => {
    // Admin can access everything
    if (userRole === 'admin') return true;
    
    // REMOVED: Special case for dashboard
    // Now dashboard is treated like any other page
    
    // Remove leading slash if present
    if (tableNameOrPath.startsWith('/')) {
      tableNameOrPath = tableNameOrPath.substring(1);
    }
    
    console.log(`Checking access for ${tableNameOrPath}:`, tableAccess[tableNameOrPath]);
    
    // Check direct access by path
    if (tableAccess[tableNameOrPath] === true) {
      return true;
    }
    
    // If checking a path, also check corresponding table name
    const tableName = getTableNameFromPath(tableNameOrPath);
    if (tableName !== tableNameOrPath && tableAccess[tableName] === true) {
      return true;
    }
    
    // If checking a table name, also check corresponding path
    const pagePath = getPagePathFromTable(tableNameOrPath);
    if (pagePath !== tableNameOrPath && tableAccess[pagePath] === true) {
      return true;
    }
    
    return false;
  };

  return {
    isAdmin: userRole === 'admin',
    userRole,
    canAccessTable,
    isLoading,
    refreshPermissions
  };
};

export default useUserPermissions;
