
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { LayoutDashboard, Book, Users, Building, User, DollarSign, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import useUserPermissions from "@/hooks/useUserPermissions";
import { useEffect, useState } from "react";

// Navigation items with their corresponding paths
const allNavigationItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard
  }, 
  {
    title: "Réservations",
    url: "/reservations",
    icon: Book
  }, 
  {
    title: "Clients",
    url: "/clients",
    icon: Users
  }, 
  {
    title: "Propriétés",
    url: "/proprietes",
    icon: Building
  }, 
  {
    title: "Propriétaires",
    url: "/proprietaires",
    icon: User
  }, 
  {
    title: "Dépenses",
    url: "/depenses",
    icon: DollarSign
  }, 
  {
    title: "Paramètres",
    url: "/parametres",
    icon: Settings
  }
];

export function AppSidebar() {
  const { signOut } = useAuth();
  const { isAdmin, canAccessTable, isLoading } = useUserPermissions();
  const [navigationItems, setNavigationItems] = useState(allNavigationItems);
  
  useEffect(() => {
    if (!isLoading) {
      // If user is admin, show all items
      if (isAdmin) {
        setNavigationItems(allNavigationItems);
      } else {
        // For regular users, filter based on access permissions
        const filteredItems = allNavigationItems.filter(item => {
          // For dashboard, check access to dashboard specifically
          if (item.url === '/') {
            return canAccessTable('dashboard');
          }
          
          // For other pages, check if user has access
          const pagePath = item.url.startsWith('/') ? item.url.substring(1) : item.url;
          return canAccessTable(pagePath);
        });
        
        setNavigationItems(filteredItems);
      }
    }
  }, [isAdmin, canAccessTable, isLoading]);

  // Show loading state while permissions are loading
  if (isLoading) {
    return (
      <Sidebar className="bg-shd-primary/5 border-r border-shd-primary/10 min-h-screen">
        <SidebarContent>
          <div className="px-6 py-4 flex justify-center">
            <img src="/lovable-uploads/b055d24c-dddf-4cef-9dc7-c7e18da4955c.png" alt="SUD HOWS DISTRIBUTION" className="h-16 mb-6" />
          </div>
          <div className="p-4">
            <div className="animate-pulse h-8 bg-gray-200 rounded mb-2"></div>
            <div className="animate-pulse h-8 bg-gray-200 rounded mb-2"></div>
            <div className="animate-pulse h-8 bg-gray-200 rounded mb-2"></div>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }
  
  return (
    <Sidebar 
      variant="sidebar" 
      collapsible="icon" 
      className="bg-shd-primary/5 border-r border-shd-primary/10 min-h-screen transition-all duration-300 ease-in-out"
    >
      <SidebarContent>
        <div className="px-4 py-4 flex justify-center items-center">
          <img 
            src="/lovable-uploads/b055d24c-dddf-4cef-9dc7-c7e18da4955c.png" 
            alt="SUD HOWS DISTRIBUTION" 
            className="h-16 mb-6 transition-all group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:mb-2" 
          />
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel className="text-shd-primary uppercase text-sm mb-1 px-6">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <a href={item.url} className="flex items-center gap-3 px-6 py-2.5 rounded-lg hover:bg-shd-primary/10 transition-colors group text-base">
                      <item.icon size={22} className="text-shd-primary group-hover:text-shd-secondary" />
                      <span className="font-medium">{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Déconnexion">
                  <button 
                    onClick={signOut}
                    className="flex items-center gap-3 px-6 py-2.5 rounded-lg hover:bg-shd-primary/10 transition-colors group text-base w-full"
                  >
                    <LogOut size={22} className="text-shd-primary group-hover:text-shd-secondary" />
                    <span className="font-medium">Déconnexion</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export default AppSidebar;
