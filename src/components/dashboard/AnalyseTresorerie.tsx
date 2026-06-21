
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowDown, ArrowUp, Banknote, DollarSign, Minus, FileText, TrendingDown, Briefcase, Calendar as CalendarIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

function formatMontant(montant: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD' }).format(montant);
}

interface TresorerieData {
  totalEncaisse: number;
  totalDebourse: number;
  depensesRemboursables: number;
  depensesNonRemboursables: number;
  soldeDispo: number;
  loading: boolean;
}

interface AnalyseTresorerieProps {
  revenuTotal: number;
  revenuBrutAgence: number;
  revenuNetAgence: number;
  avancesReservationsAnnulees: number;
}

const defaultRange = () => {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: now
  }
};

export default function AnalyseTresorerie({
  revenuTotal = 0,
  revenuBrutAgence = 0,
  revenuNetAgence = 0,
  avancesReservationsAnnulees = 0
}: AnalyseTresorerieProps) {
  const [dateRange, setDateRange] = useState<{start: Date; end: Date}>(defaultRange());
  const [openCalendar, setOpenCalendar] = useState(false);
  const [data, setData] = useState<TresorerieData>({
    totalEncaisse: 0,
    totalDebourse: 0,
    depensesRemboursables: 0,
    depensesNonRemboursables: 0,
    soldeDispo: 0,
    loading: true
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTresorerie();
    // eslint-disable-next-line
  }, [dateRange]);

  async function fetchTresorerie() {
    setData(d => ({ ...d, loading: true }));
    setError(null);
    try {
      const { start, end } = dateRange;

      // 1. Total encaissé (reglements_clients)
      const { data: reglements, error: regErr } = await supabase
        .from("reglements_clients")
        .select("montant,date,id_reservation")
        .gte("date", start.toISOString())
        .lte("date", end.toISOString());
      
      if (regErr) throw regErr;

      // Récupérer les réservations pour filtrer les réglements des réservations annulées
      const { data: reservations, error: resErr } = await supabase
        .from("reservations")
        .select("id,status,paiement_avance");
      
      if (resErr) throw resErr;

      // Filtrer les réglements pour exclure ceux liés aux réservations annulées
      const reglementsValides = reglements?.filter(reglement => {
        const reservation = reservations?.find(r => r.id === reglement.id_reservation);
        return reservation && reservation.status !== 'Annulé';
      });

      // 2. Total déboursé (virements_proprietaires)
      const { data: virements, error: virErr } = await supabase
        .from("virements_proprietaires")
        .select("montant,date")
        .gte("date", start.toISOString())
        .lte("date", end.toISOString());
      if (virErr) throw virErr;

      // 3. Dépenses remboursables (depenses)
      const { data: depenses, error: depErr } = await supabase
        .from("depenses")
        .select("montant,date,nature")
        .gte("date", start.toISOString())
        .lte("date", end.toISOString());
      if (depErr) throw depErr;

      // 4. Récupérer directement les avances des réservations annulées
      const reservationsAnnulees = reservations?.filter(r => r.status === 'Annulé') || [];
      const avancesAnnulees = reservationsAnnulees.reduce((sum, r) => sum + (Number(r.paiement_avance) || 0), 0);

      const totalEncaisse = reglementsValides?.reduce((sum, r) => sum + (Number(r.montant) || 0), 0) || 0;
      const totalDebourse = virements?.reduce((sum, v) => sum + (Number(v.montant) || 0), 0) || 0;
      const depRem = depenses?.filter(d => d.nature === "remboursable") ?? [];
      const depNonRem = depenses?.filter(d => d.nature === "non remboursable") ?? [];
      const depensesRemboursables = depRem.reduce((sum, d) => sum + (Number(d.montant) || 0), 0);
      const depensesNonRemboursables = depNonRem.reduce((sum, d) => sum + (Number(d.montant) || 0), 0);
      
      // Inclure les avances des réservations annulées dans le solde disponible
      const soldeDispo = totalEncaisse - totalDebourse - depensesRemboursables - depensesNonRemboursables + avancesAnnulees;

      setData({
        totalEncaisse,
        totalDebourse,
        depensesRemboursables,
        depensesNonRemboursables,
        soldeDispo,
        loading: false
      });
    } catch (err: any) {
      setError("Erreur lors du chargement de l'analyse de trésorerie");
      setData(d => ({ ...d, loading: false }));
    }
  }

  // Date range display
  const formateDate = (d?: Date) =>
    d ? format(d, "dd/MM/yyyy") : "";

  // Définition des blocs selon la demande
  const blocSynthese = [
    {
      key: "revenuTotal",
      title: "Total Réservations",
      icon: <FileText size={18} />,
      value: revenuTotal,
    },
    {
      key: "soldeDispo",
      title: "Solde de trésorerie disponible",
      icon: <Banknote size={18} />,
      value: data.soldeDispo,
      highlight: data.soldeDispo < 0,
    },
  ];

  const blocEncaissements = [
    {
      key: "totalEncaisse",
      title: "Total encaissé (Clients)",
      icon: <DollarSign size={18} />,
      value: data.totalEncaisse,
    },
    {
      key: "avancesAnnulees",
      title: "Avances réservations annulées",
      icon: <ArrowDown size={18} />,
      value: avancesReservationsAnnulees,
    },
  ];

  const blocDecaissements = [
    {
      key: "totalDebourse",
      title: "Virements propriétaires",
      icon: <ArrowDown size={18} />,
      value: data.totalDebourse,
    },
    {
      key: "depensesRemboursables",
      title: "Dépenses remboursables",
      icon: <Minus size={18} />,
      value: data.depensesRemboursables,
    },
    {
      key: "depensesNonRemboursables",
      title: "Dépenses non remboursables",
      icon: <Minus size={18} />,
      value: data.depensesNonRemboursables,
    },
  ];

  const blocRevenusAgence = [
    {
      key: "revenuBrutAgence",
      title: "Revenu brut agence",
      icon: <Briefcase size={18} />,
      value: revenuBrutAgence,
    },
    {
      key: "revenuNetAgence",
      title: "Revenu net agence",
      icon: <TrendingDown size={18} />,
      value: revenuNetAgence,
    },
  ];

  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-blue-900">Analyse de la trésorerie</h2>
        {/* Filtre dates */}
        <Popover open={openCalendar} onOpenChange={setOpenCalendar}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="text-xs h-8 flex items-center gap-1 mt-2 sm:mt-0"
              size="sm"
            >
              <CalendarIcon size={14} />
              <span>
                {formateDate(dateRange.start)} - {formateDate(dateRange.end)}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={{ from: dateRange.start, to: dateRange.end }}
              onSelect={(range) => {
                if (range && range.from && range.to) {
                  setDateRange({ start: range.from, end: range.to });
                  setOpenCalendar(false);
                }
              }}
              numberOfMonths={2}
              className="p-3"
            />
          </PopoverContent>
        </Popover>
      </div>
      {error && (
        <div className="bg-red-100 text-red-800 px-3 py-1.5 rounded text-sm mb-2">{error}</div>
      )}
      
      {/* Nouvelle mise en page en grille */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bloc 1: Synthèse */}
        <Card className="p-3 bg-[#F1F0FB] shadow-sm border border-blue-100">
          <div className="flex items-center mb-1.5">
            <h3 className="text-sm font-bold text-blue-900">Synthèse</h3>
          </div>
          <Separator className="mb-2 bg-blue-200" />
          <div className="space-y-2">
            {blocSynthese.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="bg-white bg-opacity-70 rounded-full p-1">
                    {item.icon}
                  </div>
                  <Label className="text-xs font-medium">{item.title}</Label>
                </div>
                <div className={`font-bold text-right ${item.key === "soldeDispo" && item.highlight ? "text-red-600" : "text-blue-900"}`}>
                  {item.key === "soldeDispo" && data.loading ? "..." : formatMontant(item.value)}
                </div>
              </div>
            ))}
          </div>
          {/* Affichage de l'alerte si solde négatif */}
          {data.soldeDispo < 0 && (
            <div className="bg-red-200 text-red-900 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 border border-red-400 mt-2 animate-pulse">
              <ArrowDown size={14} /> Alerte : solde négatif !
            </div>
          )}
        </Card>
        
        {/* Bloc 2: Encaissements */}
        <Card className="p-3 bg-[#F2FCE2] shadow-sm border border-green-100">
          <div className="flex items-center mb-1.5">
            <h3 className="text-sm font-bold text-green-700">Encaissements (Clients)</h3>
          </div>
          <Separator className="mb-2 bg-green-200" />
          <div className="space-y-2">
            {blocEncaissements.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="bg-white bg-opacity-70 rounded-full p-1">
                    {item.icon}
                  </div>
                  <Label className="text-xs font-medium text-green-700">{item.title}</Label>
                </div>
                <div className="font-bold text-right text-green-700">
                  {item.key === "totalEncaisse" && data.loading ? "..." : formatMontant(item.value)}
                </div>
              </div>
            ))}
          </div>
        </Card>
        
        {/* Bloc 3: Décaissements */}
        <Card className="p-3 bg-[#FFEFD6] shadow-sm border border-orange-100">
          <div className="flex items-center mb-1.5">
            <h3 className="text-sm font-bold text-red-700">Décaissements (Sorties d'argent)</h3>
          </div>
          <Separator className="mb-2 bg-orange-200" />
          <div className="space-y-2">
            {blocDecaissements.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="bg-white bg-opacity-70 rounded-full p-1">
                    {item.icon}
                  </div>
                  <Label className="text-xs font-medium text-red-700">{item.title}</Label>
                </div>
                <div className="font-bold text-right text-red-700">
                  {data.loading ? "..." : formatMontant(item.value)}
                </div>
              </div>
            ))}
          </div>
        </Card>
        
        {/* Bloc 4: Revenus Agence */}
        <Card className="p-3 bg-[#1A1F2C] shadow-sm border border-gray-800">
          <div className="flex items-center mb-1.5">
            <h3 className="text-sm font-bold text-white">Revenus Agence</h3>
          </div>
          <Separator className="mb-2 bg-gray-500" />
          <div className="space-y-2">
            {blocRevenusAgence.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="bg-white bg-opacity-20 rounded-full p-1">
                    {item.icon}
                  </div>
                  <Label className="text-xs font-medium text-white">{item.title}</Label>
                </div>
                <div className="font-bold text-right text-white">
                  {formatMontant(item.value)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
