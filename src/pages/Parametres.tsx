
import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ReferenceTableManager from "@/components/reference/ReferenceTableManager";
import UserManagement from "@/components/settings/UserManagement";
import AppSettingsManager from "@/components/settings/AppSettingsManager";
import BackupManager from "@/components/settings/BackupManager";
import useUserPermissions from "@/hooks/useUserPermissions";

const definitions = [{
  key: "sources_reservation",
  title: "Sources de réservation",
  table: "sources_reservation",
  placeholder: "Nouvelle source…"
}, {
  key: "noms_residences",
  title: "Noms de résidences",
  table: "noms_residences",
  placeholder: "Nouveau nom de résidence…"
}, {
  key: "types_appartements",
  title: "Type",
  table: "types_appartements",
  placeholder: "Nouveau type d'appartement…"
}, {
  key: "groupes_proprietes",
  title: "Groupes",
  table: "groupes_proprietes",
  placeholder: "Nouveau groupe…"
}, {
  key: "types_depenses",
  title: "Types de dépenses",
  table: "types_depenses",
  placeholder: "Nouveau type de dépense…"
}, {
  key: "user_management",
  title: "Utilisateurs",
  table: "user_management",
  placeholder: ""
}, {
  key: "app_settings",
  title: "Paramètres App",
  table: "app_settings",
  placeholder: ""
}, {
  key: "backup",
  title: "Backup",
  table: "",
  placeholder: ""
}];

export default function Parametres() {
  const { isAdmin, isLoading } = useUserPermissions();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-progest-primary"></div>
      </div>
    );
  }

  // Filter definitions if not admin - only show app_settings and user_management tabs for admins
  const visibleDefinitions = isAdmin 
    ? definitions 
    : definitions.filter(def => def.key !== "user_management" && def.key !== "app_settings");

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <h1 className="font-bold text-2xl mb-6 text-progest-primary">Paramètres</h1>
      <Tabs defaultValue={visibleDefinitions[0].key} className="w-full">
        <TabsList className="mb-2">
          {visibleDefinitions.map(def => (
            <TabsTrigger key={def.key} value={def.key}>
              {def.title}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {definitions
          .filter(def => def.key !== "user_management" && def.key !== "app_settings" && def.key !== "backup")
          .map(def => (
            <TabsContent key={def.key} value={def.key}>
              <ReferenceTableManager
                table={def.table}
                label={def.title}
                placeholder={def.placeholder}
              />
            </TabsContent>
          ))}
        
        {isAdmin && (
          <TabsContent key="user_management" value="user_management">
            <UserManagement />
          </TabsContent>
        )}
        
        {isAdmin && (
          <TabsContent key="app_settings" value="app_settings">
            <AppSettingsManager />
          </TabsContent>
        )}

        <TabsContent key="backup" value="backup">
          <BackupManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
