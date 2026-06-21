
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BilanFinancierProprietesReport from "@/components/dashboard/BilanFinancierProprietesReport";
import DashboardSummaryCards from "@/components/dashboard/DashboardSummaryCards";
import AnalyseTresorerie from "@/components/dashboard/AnalyseTresorerie";
import AnalyseTresorerieAnnuelle from "@/components/dashboard/AnalyseTresorerieAnnuelle";
import useUserPermissions from "@/hooks/useUserPermissions";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const [totals, setTotals] = useState({
    revenuTotal: 0,
    totalRecu: 0,
    revenuBrutAgence: 0,
    revenuNetAgence: 0,
    avancesReservationsAnnulees: 0
  });
  
  const { isAdmin, userRole } = useUserPermissions();
  const { session } = useAuth();
  
  useEffect(() => {
    console.log("Dashboard loaded with the following user status:");
    console.log("- User authenticated:", !!session);
    console.log("- User role:", userRole);
    console.log("- Is admin:", isAdmin);
  }, [session, userRole, isAdmin]);
  
  return <div className="w-full p-4 space-y-4">
      <h1 className="text-2xl font-bold text-progest-primary">Tableau de bord</h1>
      <p className="text-gray-600 text-sm">
        Bienvenue sur l'interface de gestion ERP pour locations immobilières.
      </p>

      {/* --- Analyse de la trésorerie --- */}
      <Card className="p-3">
        <CardContent className="pt-2 px-2">
          <AnalyseTresorerie revenuTotal={totals.revenuTotal} revenuBrutAgence={totals.revenuBrutAgence} revenuNetAgence={totals.revenuNetAgence} avancesReservationsAnnulees={totals.avancesReservationsAnnulees} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-lg">Bilan par propriété</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-3">
          <BilanFinancierProprietesReport onTotalsChange={setTotals} />
        </CardContent>
      </Card>
      
      {/* Nouvelle section d'analyse de trésorerie annuelle */}
      <AnalyseTresorerieAnnuelle />
    </div>;
};
export default Index;
