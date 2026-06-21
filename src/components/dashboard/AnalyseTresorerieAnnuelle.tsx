import React, { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabaseClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { startOfYear, endOfYear, format, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale'; // Import French locale
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

function formatMontant(montant: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD' }).format(montant);
}

interface MonthlyData {
  month: string;
  monthNumber: number;
  totalEncaisse: number;
  totalRecuClients: number;
  avancesAnnulees: number;
  virementsProprietaires: number;
  depensesRemboursables: number;
  depensesNonRemboursables: number;
  revenuBrutAgence: number;
  revenuNetAgence: number;
  totalReservations: number;
  soldeTresorerie: number;
}

interface AnalyseTresorerieAnnuelleProps {
  currentYear?: number;
}

export default function AnalyseTresorerieAnnuelle({ currentYear = new Date().getFullYear() }: AnalyseTresorerieAnnuelleProps) {
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("table");

  // Générer une liste d'années pour le sélecteur (de 2020 à l'année actuelle + 1)
  const currentYearValue = new Date().getFullYear();
  const yearOptions = Array.from(
    { length: currentYearValue - 2020 + 2 },
    (_, i) => currentYearValue + 1 - i
  );

  useEffect(() => {
    fetchYearlyData(selectedYear);
  }, [selectedYear]);

  async function fetchYearlyData(year: number) {
    setIsLoading(true);
    setError(null);
    try {
      // Créer un tableau pour les 12 mois de l'année avec des valeurs par défaut
      const monthsInitial: MonthlyData[] = Array.from({ length: 12 }, (_, i) => {
        const date = addMonths(new Date(year, 0, 1), i);
        return {
          month: format(date, 'MMMM', { locale: fr }), // Use French locale
          monthNumber: i + 1,
          totalEncaisse: 0,
          totalRecuClients: 0,
          avancesAnnulees: 0,
          virementsProprietaires: 0,
          depensesRemboursables: 0,
          depensesNonRemboursables: 0,
          revenuBrutAgence: 0,
          revenuNetAgence: 0,
          totalReservations: 0,
          soldeTresorerie: 0
        };
      });

      const yearStart = startOfYear(new Date(year, 0, 1));
      const yearEnd = endOfYear(new Date(year, 0, 1));

      // 1. Total encaissé (reglements_clients) - excluant réservations annulées
      const { data: reglements, error: regErr } = await supabase
        .from("reglements_clients")
        .select("montant,date,id_reservation")
        .gte("date", yearStart.toISOString())
        .lte("date", yearEnd.toISOString());
      
      if (regErr) throw regErr;

      // 2. Récupérer réservations
      const { data: reservations, error: resErr } = await supabase
        .from("reservations")
        .select("id,status,prix_total,paiement_avance,date_arrivee,date_depart") 
        .gte("date_arrivee", yearStart.toISOString())
        .lte("date_depart", yearEnd.toISOString());
      
      if (resErr) throw resErr;
      
      // 3. Virements propriétaires
      const { data: virements, error: virErr } = await supabase
        .from("virements_proprietaires")
        .select("montant,date")
        .gte("date", yearStart.toISOString())
        .lte("date", yearEnd.toISOString());
      
      if (virErr) throw virErr;

      // 4. Dépenses
      const { data: depenses, error: depErr } = await supabase
        .from("depenses")
        .select("montant,date,nature")
        .gte("date", yearStart.toISOString())
        .lte("date", yearEnd.toISOString());
      
      if (depErr) throw depErr;

      // Traitement des données par mois
      const monthlyDataMap = new Map<number, MonthlyData>();
      
      // Initialiser la map avec les données vides pour chaque mois
      monthsInitial.forEach(month => {
        monthlyDataMap.set(month.monthNumber, {...month});
      });
      
      // Filtrer les réglements valides (non annulés)
      const reglementsValides = reglements?.filter(reglement => {
        const reservation = reservations?.find(r => r.id === reglement.id_reservation);
        return reservation && reservation.status !== 'Annulé';
      }) || [];
      
      // Calculer les avances annulées en utilisant paiement_avance directement
      const reservationsAnnulees = reservations?.filter(r => r.status === 'Annulé') || [];
      
      // Total réservations par mois
      reservations?.forEach(reservation => {
        if (reservation.status !== 'Annulé' && reservation.prix_total) {
          const date = new Date(reservation.date_arrivee as string);
          const month = date.getMonth() + 1;
          const monthData = monthlyDataMap.get(month);
          if (monthData) {
            monthData.totalReservations += Number(reservation.prix_total);
          }
        }
      });
      
      // Réglements clients par mois
      reglementsValides.forEach(reglement => {
        if (reglement.date && reglement.montant) {
          const date = new Date(reglement.date);
          const month = date.getMonth() + 1;
          const monthData = monthlyDataMap.get(month);
          if (monthData) {
            monthData.totalEncaisse += Number(reglement.montant);
            monthData.totalRecuClients += Number(reglement.montant);
          }
        }
      });
      
      // Avances sur réservations annulées en utilisant paiement_avance
      reservationsAnnulees.forEach(reservation => {
        if (reservation.date_arrivee && reservation.paiement_avance) {
          const date = new Date(reservation.date_arrivee as string);
          const month = date.getMonth() + 1;
          const monthData = monthlyDataMap.get(month);
          if (monthData) {
            monthData.avancesAnnulees += Number(reservation.paiement_avance);
          }
        }
      });
      
      // Virements propriétaires
      virements?.forEach(virement => {
        if (virement.date && virement.montant) {
          const date = new Date(virement.date);
          const month = date.getMonth() + 1;
          const monthData = monthlyDataMap.get(month);
          if (monthData) {
            monthData.virementsProprietaires += Number(virement.montant);
          }
        }
      });
      
      // Dépenses remboursables et non remboursables
      depenses?.forEach(depense => {
        if (depense.date && depense.montant) {
          const date = new Date(depense.date);
          const month = date.getMonth() + 1;
          const monthData = monthlyDataMap.get(month);
          if (monthData) {
            if (depense.nature === 'remboursable') {
              monthData.depensesRemboursables += Number(depense.montant);
            } else if (depense.nature === 'non remboursable') {
              monthData.depensesNonRemboursables += Number(depense.montant);
            }
          }
        }
      });
      
      // Calculer les revenus de l'agence et le solde de trésorerie
      monthlyDataMap.forEach((monthData) => {
        // Calcul du revenu brut de l'agence (20% des réservations)
        monthData.revenuBrutAgence = monthData.totalReservations * 0.2;
        
        // Revenu net agence = Revenu Brut - Dépenses Non Remboursables + Avances annulées
        monthData.revenuNetAgence = 
          monthData.revenuBrutAgence - 
          monthData.depensesNonRemboursables + 
          monthData.avancesAnnulees;
        
        // Solde de trésorerie = Total encaissé - Virements propriétaires - Dépenses + Avances annulées
        monthData.soldeTresorerie = 
          monthData.totalEncaisse - 
          monthData.virementsProprietaires - 
          monthData.depensesRemboursables - 
          monthData.depensesNonRemboursables +
          monthData.avancesAnnulees;
      });
      
      // Convertir la map en tableau trié par numéro de mois
      const sortedMonthlyData = Array.from(monthlyDataMap.values())
        .sort((a, b) => a.monthNumber - b.monthNumber);
      
      setMonthlyData(sortedMonthlyData);
      setIsLoading(false);
    } catch (err: any) {
      console.error("Erreur lors du chargement des données annuelles:", err);
      setError("Erreur lors du chargement des données. Veuillez réessayer.");
      setIsLoading(false);
    }
  }

  const renderBarChart = () => (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart
        data={monthlyData}
        margin={{ top: 10, right: 10, left: 10, bottom: 40 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="month"
          angle={-45}
          textAnchor="end"
          height={60}
          tick={{ fontSize: 10 }}
        />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip formatter={(value) => formatMontant(Number(value))} />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: "10px" }} />
        <Bar dataKey="totalEncaisse" name="Total encaissé" fill="#4CAF50" />
        <Bar dataKey="virementsProprietaires" name="Virements propriétaires" fill="#FF5722" />
        <Bar dataKey="revenuNetAgence" name="Revenu net agence" fill="#2196F3" />
      </BarChart>
    </ResponsiveContainer>
  );

  const renderLineChart = () => (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart
        data={monthlyData}
        margin={{ top: 10, right: 10, left: 10, bottom: 40 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="month"
          angle={-45}
          textAnchor="end"
          height={60}
          tick={{ fontSize: 10 }}
        />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip formatter={(value) => formatMontant(Number(value))} />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: "10px" }} />
        <Line type="monotone" dataKey="soldeTresorerie" name="Solde de trésorerie" stroke="#9C27B0" activeDot={{ r: 6 }} />
        <Line type="monotone" dataKey="revenuNetAgence" name="Revenu net agence" stroke="#2196F3" />
        <Line type="monotone" dataKey="revenuBrutAgence" name="Revenu brut agence" stroke="#3F51B5" />
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-lg">Analyse de trésorerie annuelle</CardTitle>
        <Select
          value={selectedYear?.toString()}
          onValueChange={(value) => setSelectedYear(parseInt(value))}
        >
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="pt-0 px-3">
        {error && (
          <div className="bg-red-100 text-red-800 p-2 mb-3 rounded text-sm">{error}</div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-60">
            <p className="text-gray-500 text-sm">Chargement des données...</p>
          </div>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
              <TabsList className="mb-3 h-8">
                <TabsTrigger value="table" className="text-xs px-3 py-1">Tableau</TabsTrigger>
                <TabsTrigger value="barChart" className="text-xs px-3 py-1">Barres</TabsTrigger>
                <TabsTrigger value="lineChart" className="text-xs px-3 py-1">Linéaire</TabsTrigger>
              </TabsList>
              
              <TabsContent value="table">
                <div className="overflow-x-auto">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-bold">Mois</TableHead>
                        <TableHead className="text-right">Total réservations</TableHead>
                        <TableHead className="text-right">Total encaissé</TableHead>
                        <TableHead className="text-right">Total reçu clients</TableHead>
                        <TableHead className="text-right">Avances annulées</TableHead>
                        <TableHead className="text-right">Virements propriétaires</TableHead>
                        <TableHead className="text-right">Dép. remboursables</TableHead>
                        <TableHead className="text-right">Dép. non remboursables</TableHead>
                        <TableHead className="text-right">Revenu brut agence</TableHead>
                        <TableHead className="text-right">Revenu net agence</TableHead>
                        <TableHead className="text-right">Solde trésorerie</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyData.map((month) => (
                        <TableRow key={month.monthNumber}>
                          <TableCell className="font-medium">{month.month}</TableCell>
                          <TableCell className="text-right">{formatMontant(month.totalReservations)}</TableCell>
                          <TableCell className="text-right">{formatMontant(month.totalEncaisse)}</TableCell>
                          <TableCell className="text-right">{formatMontant(month.totalRecuClients)}</TableCell>
                          <TableCell className="text-right">{formatMontant(month.avancesAnnulees)}</TableCell>
                          <TableCell className="text-right">{formatMontant(month.virementsProprietaires)}</TableCell>
                          <TableCell className="text-right">{formatMontant(month.depensesRemboursables)}</TableCell>
                          <TableCell className="text-right">{formatMontant(month.depensesNonRemboursables)}</TableCell>
                          <TableCell className="text-right">{formatMontant(month.revenuBrutAgence)}</TableCell>
                          <TableCell className="text-right">{formatMontant(month.revenuNetAgence)}</TableCell>
                          <TableCell className={`text-right ${month.soldeTresorerie < 0 ? 'text-red-600 font-bold' : ''}`}>
                            {formatMontant(month.soldeTresorerie)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              
              <TabsContent value="barChart">
                {renderBarChart()}
              </TabsContent>
              
              <TabsContent value="lineChart">
                {renderLineChart()}
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}
