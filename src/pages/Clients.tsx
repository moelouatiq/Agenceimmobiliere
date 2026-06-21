
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ClientTable from "@/components/clients/ClientTable";

const Clients = () => {
  console.log("Rendering Clients page");
  
  return (
    <div className="px-4 py-4">
      <Card className="border-shd-primary/20">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-lg text-shd-primary">Liste des clients</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-3">
          <ClientTable />
        </CardContent>
      </Card>
    </div>
  );
};

export default Clients;
