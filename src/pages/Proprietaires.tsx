
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import GestionVirements from "@/components/proprietaires/GestionVirements";
import RapportPropriete from "@/components/proprietaires/RapportPropriete";
export default function Proprietaires() {
  return <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      <h1 className="font-bold text-2xl mb-6 text-progest-primary">Propriétaires</h1>
      <Card>
        <CardHeader>
          <CardTitle>Gestion des propriétaires</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="virements" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="virements">Virements</TabsTrigger>
              <TabsTrigger value="rapport">Rapport PDF</TabsTrigger>
            </TabsList>
            <TabsContent value="virements">
              <GestionVirements />
            </TabsContent>
            <TabsContent value="rapport">
              <RapportPropriete />
            </TabsContent>
            <TabsContent value="liste">
              <p className="text-muted-foreground">
                La gestion des propriétaires sera implémentée prochainement.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>;
}
