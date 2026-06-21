import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, RefreshCw, ShieldCheck, Settings } from "lucide-react";

// Define types for user and permissions
interface UserRole {
  user_id: string;
  name: string;
  role: 'admin' | 'user';
  email: string;
}

interface PageAccess {
  id: string;
  user_id: string;
  page_path: string;
  can_access: boolean;
}

// Available pages based on the sidebar navigation - now including Dashboard at the top
const availablePages = [
  { id: '/', label: 'Dashboard' },
  { id: '/proprietes', label: 'Propriétés' },
  { id: '/proprietaires', label: 'Propriétaires' },
  { id: '/reservations', label: 'Réservations' },
  { id: '/clients', label: 'Clients' },
  { id: '/depenses', label: 'Dépenses' },
  { id: '/parametres', label: 'Paramètres' }
];

export default function UserManagement() {
  const [users, setUsers] = useState<UserRole[]>([]);
  const [pageAccess, setPageAccess] = useState<PageAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State for dialogs
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string>("");
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  
  // Fetch users and their roles
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Get all users with roles
      const { data: usersWithRoles, error: roleError } = await supabase
        .from('user_roles')
        .select('*');

      if (roleError) throw roleError;

      // Get emails from auth users if available
      // We'll need to ensure admins have access to this info through RLS policies
      const { data: authUsers, error: authError } = await supabase
        .from('auth.users')
        .select('id, email');

      // If we can't get auth users data, we'll just use what we have
      const userEmailMap: Record<string, string> = {};
      
      if (!authError && authUsers) {
        authUsers.forEach((authUser: any) => {
          userEmailMap[authUser.id] = authUser.email;
        });
      }

      // Get all page access permissions - using user_table_access instead of user_page_access
      const { data: accessData, error: accessError } = await supabase
        .from('user_table_access')
        .select('*');

      if (accessError) throw accessError;

      // Combine user roles with email data
      const enrichedUsers = (usersWithRoles || []).map((userRole: UserRole) => ({
        ...userRole,
        email: userEmailMap[userRole.user_id] || userRole.email || "N/A"
      }));

      setUsers(enrichedUsers);
      setPageAccess(accessData || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur de chargement",
        description: error.message || "Impossible de charger les utilisateurs",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Open role edit dialog
  const handleOpenRoleDialog = (userId: string, userName: string, currentRole: 'admin' | 'user') => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    setNewRole(currentRole);
    setRoleDialogOpen(true);
  };

  // Open access edit dialog
  const handleOpenAccessDialog = (userId: string, userName: string) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    setAccessDialogOpen(true);
  };

  // Update user role
  const updateUserRole = async () => {
    if (!selectedUserId) return;
    
    setIsUpdating(true);
    try {
      // Update the role in user_roles table
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', selectedUserId);

      if (error) throw error;

      // If role is changed to admin, grant access to all pages
      if (newRole === 'admin') {
        // First, check what permissions already exist
        const { data: existingAccess } = await supabase
          .from('user_table_access')
          .select('page_path')
          .eq('user_id', selectedUserId);
        
        const existingPages = existingAccess?.map(a => a.page_path) || [];
        
        // Create entries for pages that don't have permissions yet
        const missingPages = availablePages
          .filter(page => !existingPages.includes(page.id))
          .map(page => ({
            user_id: selectedUserId,
            page_path: page.id,
            can_access: true
          }));
        
        if (missingPages.length > 0) {
          const { error: insertError } = await supabase
            .from('user_table_access')
            .insert(missingPages);
            
          if (insertError) throw insertError;
        }
        
        // Update existing permissions to grant access
        if (existingPages.length > 0) {
          const { error: updateError } = await supabase
            .from('user_table_access')
            .update({ can_access: true })
            .eq('user_id', selectedUserId);
            
          if (updateError) throw updateError;
        }
      }

      toast({
        title: "Rôle mis à jour",
        description: `Le rôle de l'utilisateur a été changé avec succès.`,
      });

      // Refresh the data and close dialog
      fetchUsers();
      setRoleDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur de mise à jour",
        description: error.message || "Impossible de mettre à jour le rôle",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Toggle page access for a user
  const togglePageAccess = async (userId: string, pagePath: string, currentAccess: boolean) => {
    setIsUpdating(true);
    try {
      console.log(`Toggling access for user ${userId} to page ${pagePath}, current access: ${currentAccess}`);
      
      // Check if entry exists
      const { data: existingEntry } = await supabase
        .from('user_table_access')
        .select('id')
        .eq('user_id', userId)
        .eq('page_path', pagePath)
        .single();

      if (existingEntry) {
        // Update existing entry
        const { error } = await supabase
          .from('user_table_access')
          .update({ can_access: !currentAccess })
          .eq('id', existingEntry.id);

        if (error) throw error;
      } else {
        // Create new entry
        const { error } = await supabase
          .from('user_table_access')
          .insert({
            user_id: userId,
            page_path: pagePath,
            can_access: true // Default to true when creating a new entry
          });

        if (error) throw error;
      }

      // Refresh data immediately after making changes
      await fetchUsers();

      toast({
        title: "Accès mis à jour",
        description: `Les permissions ont été mises à jour.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur de mise à jour",
        description: error.message || "Impossible de mettre à jour l'accès",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Check if a user has access to a specific page
  const hasPageAccess = (userId: string, pagePath: string): boolean => {
    // Dashboard will be explicitly shown in the dialog, but we'll check permissions too
    const entry = pageAccess.find(
      access => access.user_id === userId && access.page_path === pagePath
    );
    return entry ? entry.can_access : false;
  };

  // Get user role based on user ID
  const getUserRole = (userId: string): 'admin' | 'user' => {
    const userRole = users.find(u => u.user_id === userId);
    return userRole ? userRole.role : 'user';
  };

  // If loading, show spinner
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-progest-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-row justify-between items-center">
          <div>
            <CardTitle>Gestion des utilisateurs</CardTitle>
            <CardDescription>
              Gérer les rôles et les accès des utilisateurs aux pages
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchUsers}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((userRole) => (
              <TableRow key={userRole.user_id}>
                <TableCell className="font-medium">
                  {userRole.name}
                </TableCell>
                <TableCell>
                  {userRole.email}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${userRole.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                    {userRole.role === 'admin' ? 'Admin' : 'Utilisateur'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center"
                      onClick={() => handleOpenRoleDialog(userRole.user_id, userRole.name, userRole.role)}
                      disabled={userRole.user_id === user?.id}
                    >
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Rôle
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center"
                      onClick={() => handleOpenAccessDialog(userRole.user_id, userRole.name)}
                      disabled={userRole.role === 'admin'} // Admin already has all access
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Accès
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Role Edit Dialog */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier le rôle</DialogTitle>
              <DialogDescription>
                Changer le rôle de l'utilisateur {selectedUserName}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Rôle</Label>
                  <Select 
                    value={newRole} 
                    onValueChange={(value: 'admin' | 'user') => setNewRole(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">Utilisateur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={updateUserRole} disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mise à jour...
                  </>
                ) : (
                  'Enregistrer'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Access Edit Dialog - now showing ALL pages including Dashboard */}
        <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Modifier les accès</DialogTitle>
              <DialogDescription>
                Gérer l'accès aux pages pour {selectedUserName}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-4">
                {availablePages.map(page => (
                  <div key={page.id} className="flex items-center justify-between">
                    <Label htmlFor={`access-${page.id}`} className="mr-2">
                      {page.label}
                    </Label>
                    <Switch
                      id={`access-${page.id}`}
                      checked={selectedUserId ? hasPageAccess(selectedUserId, page.id) : false}
                      onCheckedChange={() => {
                        if (selectedUserId) {
                          togglePageAccess(
                            selectedUserId,
                            page.id,
                            hasPageAccess(selectedUserId, page.id)
                          );
                        }
                      }}
                      disabled={
                        isUpdating || 
                        (selectedUserId === user?.id && page.id === '/parametres') // Can't remove self from parameters
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAccessDialogOpen(false)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
