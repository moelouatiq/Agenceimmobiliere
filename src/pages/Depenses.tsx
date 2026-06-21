
import React from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import AjouterDepenseForm from "@/components/depenses/AjouterDepenseForm";
import ListeDepenses from "@/components/depenses/ListeDepenses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Depenses() {
  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      <h1 className="font-bold text-2xl mb-6 text-progest-primary">Dépenses</h1>
      <Card>
        <CardHeader>
          <CardTitle>Gestion des dépenses</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ajouter" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="ajouter">Ajouter une dépense</TabsTrigger>
              <TabsTrigger value="liste">Liste des dépenses</TabsTrigger>
            </TabsList>
            <TabsContent value="ajouter">
              <AjouterDepenseForm />
            </TabsContent>
            <TabsContent value="liste">
              <ListeDepenses />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
