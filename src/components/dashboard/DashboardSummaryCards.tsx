
import React from "react";
import { Card } from "@/components/ui/card";
import { DollarSign, Receipt, Briefcase, TrendingDown, ArrowDownRight } from "lucide-react";

interface DashboardSummaryData {
  revenuTotal: number;
  totalRecu: number;
  revenuBrutAgence: number;
  revenuNetAgence: number;
  avancesReservationsAnnulees?: number;
}

interface DashboardSummaryCardsProps {
  data: DashboardSummaryData;
}

const summaries = [{
  key: "revenuTotal",
  title: "Total Réservations",
  icon: Receipt,
  bg: "bg-[#F1F0FB]",
  text: "text-blue-900"
}, {
  key: "totalRecu",
  title: "Total Reçu des Clients",
  icon: DollarSign,
  bg: "bg-[#F2FCE2]",
  text: "text-green-700"
}, {
  key: "avancesReservationsAnnulees",
  title: "Avances Réservations Annulées",
  icon: ArrowDownRight,
  bg: "bg-[#FFEFD6]",
  text: "text-red-700"
}, {
  key: "revenuBrutAgence",
  title: "Revenu Brut Agence",
  icon: Briefcase,
  bg: "bg-[#1A1F2C]",
  text: "text-white"
}, {
  key: "revenuNetAgence",
  title: "Revenu Net Agence",
  icon: TrendingDown,
  bg: "bg-[#FEC6A1]",
  text: "text-orange-900"
}];

function formatMontant(montant: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'MAD'
  }).format(montant);
}

const DashboardSummaryCards: React.FC<DashboardSummaryCardsProps> = ({
  data
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {summaries.map(summary => {
        const Icon = summary.icon;
        const value = data[summary.key as keyof DashboardSummaryData] || 0;
        
        return (
          <Card 
            key={summary.key} 
            className={`p-3 shadow-sm ${summary.bg}`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className={`text-xs font-medium ${summary.text}`}>
                {summary.title}
              </span>
              <div className={`p-1.5 rounded-full bg-white/40`}>
                <Icon className={`h-4 w-4 ${summary.text}`} />
              </div>
            </div>
            <div className={`text-xl font-bold ${summary.text}`}>
              {formatMontant(value)}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default DashboardSummaryCards;
