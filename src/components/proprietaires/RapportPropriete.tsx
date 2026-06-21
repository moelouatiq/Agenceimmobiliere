
import React, { useState, useEffect } from "react";
import { format, parse, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar as CalendarIcon, Printer, AlertCircle, RefreshCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Propriete, 
  Reservation, 
  Depense, 
  Virement, 
  RapportPropriete 
} from "@/types/proprietaires";

const RapportProprietePage = () => {
  const [proprietesOptions, setProprietesOptions] = useState<Propriete[]>([]);
  const [selectedProprieteId, setSelectedProprieteId] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState<Date | undefined>();
  const [dateFin, setDateFin] = useState<Date | undefined>();
  const [rapport, setRapport] = useState<RapportPropriete | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProprietes = async () => {
      try {
        setError(null);
        const { data, error } = await supabase.from("proprietes").select("*");
        if (error) {
          toast({
            variant: "destructive",
            title: "Erreur lors du chargement des propriétés",
            description: error.message,
          });
          throw error;
        }
        if (!data || data.length === 0) {
          toast({
            variant: "destructive",
            title: "Aucune propriété trouvée",
            description: "Veuillez d'abord ajouter des propriétés",
          });
          return;
        }
        setProprietesOptions(data);
      } catch (err: any) {
        console.error("Erreur lors du chargement des propriétés:", err);
        setError("Impossible de charger les propriétés. Veuillez réessayer.");
      }
    };

    fetchProprietes();
  }, []);

  const genererRapport = async () => {
    if (!selectedProprieteId || !dateDebut || !dateFin) {
      setError("Veuillez sélectionner une propriété et des dates");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { data: proprieteData, error: proprieteError } = await supabase
        .from("proprietes")
        .select("*")
        .eq("id", selectedProprieteId)
        .single();

      if (proprieteError) {
        toast({
          variant: "destructive",
          title: "Erreur lors du chargement de la propriété",
          description: proprieteError.message,
        });
        throw proprieteError;
      }

      if (!proprieteData) {
        toast({
          variant: "destructive",
          title: "Propriété non trouvée",
          description: "La propriété sélectionnée n'existe pas",
        });
        return;
      }

      const dateDebutStr = format(dateDebut, "yyyy-MM-dd");
      const dateFinStr = format(dateFin, "yyyy-MM-dd");

      const { data: reservationsData, error: reservationsError } = await supabase
        .from("reservations")
        .select("*")
        .eq("id_propriete", selectedProprieteId)
        .neq("status", "Annulé") // Exclure les réservations avec le statut "Annulé"
        .gte("date_arrivee", dateDebutStr)
        .lte("date_depart", dateFinStr);

      if (reservationsError) {
        toast({
          variant: "destructive",
          title: "Erreur lors du chargement des réservations",
          description: reservationsError.message,
        });
        throw reservationsError;
      }

      const { data: depensesData, error: depensesError } = await supabase
        .from("depenses")
        .select("*")
        .eq("id_propriete", selectedProprieteId)
        .eq("nature", "remboursable")
        .gte("date", dateDebutStr)
        .lte("date", dateFinStr);

      if (depensesError) {
        toast({
          variant: "destructive",
          title: "Erreur lors du chargement des dépenses",
          description: depensesError.message,
        });
        throw depensesError;
      }

      const { data: virementsData, error: virementsError } = await supabase
        .from("virements_proprietaires")
        .select("*")
        .eq("id_propriete", selectedProprieteId)
        .gte("date", dateDebutStr)
        .lte("date", dateFinStr);

      if (virementsError) {
        toast({
          variant: "destructive",
          title: "Erreur lors du chargement des virements",
          description: virementsError.message,
        });
        throw virementsError;
      }

      const totalFacture = (reservationsData || []).reduce((sum, res) => sum + Number(res.prix_total || 0), 0);
      const totalCommissions = (reservationsData || []).reduce((sum, res) => sum + Number(res.montant_commission || 0), 0);
      const totalPartProprietaire = (reservationsData || []).reduce((sum, res) => sum + Number(res.part_proprietaire || 0), 0);
      const totalDepensesRemboursables = (depensesData || []).reduce((sum, dep) => sum + Number(dep.montant || 0), 0);
      const totalVirements = (virementsData || []).reduce((sum, vir) => sum + Number(vir.montant || 0), 0);
      const soldeAVerser = totalPartProprietaire - totalDepensesRemboursables - totalVirements;

      const nouveauRapport: RapportPropriete = {
        propriete: proprieteData,
        dateDebut,
        dateFin,
        totalFacture,
        totalCommissions,
        totalPartProprietaire,
        depensesRemboursables: totalDepensesRemboursables,
        virements: totalVirements,
        soldeAVerser,
        reservations: (reservationsData || []).sort((a, b) => new Date(a.date_arrivee).getTime() - new Date(b.date_arrivee).getTime()),
        depenses: depensesData || [],
        virementsList: virementsData || [],
      };

      setRapport(nouveauRapport);
      toast({
        title: "Rapport généré avec succès",
        description: "Le rapport a été généré pour la période sélectionnée.",
      });
    } catch (err: any) {
      console.error("Erreur lors de la génération du rapport:", err);
      setError("Une erreur est survenue lors de la génération du rapport. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const genererPDF = () => {
    if (!rapport) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Veuillez autoriser les popups pour imprimer le rapport");
      return;
    }

    const proprieteName = rapport.propriete.nom;
    const dateDebutFormatted = format(rapport.dateDebut, "dd/MM/yyyy");
    const dateFinFormatted = format(rapport.dateFin, "dd/MM/yyyy");

    const style = `
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 210mm;
          margin: 0 auto;
          padding: 20px;
        }
        h1, h2, h3 {
          color: #2c3e50;
        }
        h1 {
          text-align: center;
          margin-bottom: 5px;
          font-size: 24px;
        }
        h2 {
          font-size: 18px;
          border-bottom: 1px solid #ddd;
          padding-bottom: 5px;
          margin-top: 25px;
        }
        .header-info {
          text-align: center;
          margin-bottom: 20px;
          font-style: italic;
          color: #666;
          font-size: 14px;
        }
        .summary-box {
          background-color: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 5px;
          padding: 15px;
          margin-bottom: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 12px;
        }
        th {
          background-color: #eaeff5;
          text-align: left;
          padding: 8px;
          border-bottom: 2px solid #ddd;
        }
        td {
          padding: 8px;
          border-bottom: 1px solid #ddd;
        }
        .amount {
          text-align: right;
        }
        .total-row {
          font-weight: bold;
          background-color: #f1f5fb;
        }
        .empty-table {
          text-align: center;
          padding: 20px;
          color: #666;
          font-style: italic;
          background-color: #f9f9f9;
        }
        .signature {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
        }
        .page-break {
          page-break-before: always;
        }
        @media print {
          body {
            width: 210mm;
          }
          .no-print {
            display: none;
          }
        }
        .logo {
          max-height: 64px;
          margin-bottom: 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 10px;
          font-weight: bold;
          color: #333;
          border-top: 1px solid #ddd;
          padding-top: 20px;
          line-height: 1.4;
        }
      </style>
    `;
    
    const formatMontant = (montant) => {
      return new Intl.NumberFormat('fr-FR', { 
        style: 'currency', 
        currency: 'MAD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(montant);
    };

    const formatDate = (dateStr) => {
      let date;
      if (typeof dateStr === 'string') {
        date = parseISO(dateStr);
      } else {
        date = dateStr;
      }
      return format(date, 'dd/MM/yyyy', { locale: fr });
    };

    const reservationsHTML = rapport.reservations.length > 0 
      ? `
        <table>
          <thead>
            <tr>
              <th>Date d'arrivée</th>
              <th>Date de départ</th>
              <th>Nuits</th>
              <th>Prix/nuit</th>
              <th>Total</th>
              <th>Taux Com.</th>
              <th>Montant Com.</th>
              <th>Part Propriétaire</th>
            </tr>
          </thead>
          <tbody>
            ${rapport.reservations.map(r => `
              <tr>
                <td>${formatDate(r.date_arrivee)}</td>
                <td>${formatDate(r.date_depart)}</td>
                <td>${r.nombre_jours}</td>
                <td class="amount">${formatMontant(r.prix_par_nuit)}</td>
                <td class="amount">${formatMontant(r.prix_total)}</td>
                <td class="amount">${r.taux_commission}%</td>
                <td class="amount">${formatMontant(r.montant_commission)}</td>
                <td class="amount">${formatMontant(r.part_proprietaire)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="4">Total</td>
              <td class="amount">${formatMontant(rapport.totalFacture)}</td>
              <td></td>
              <td class="amount">${formatMontant(rapport.totalCommissions)}</td>
              <td class="amount">${formatMontant(rapport.totalPartProprietaire)}</td>
            </tr>
          </tbody>
        </table>
      ` 
      : `<div class="empty-table">Aucune réservation pour cette période</div>`;

    const depensesHTML = rapport.depenses.length > 0
      ? `
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Nature</th>
              <th>Montant</th>
              <th>Référence</th>
            </tr>
          </thead>
          <tbody>
            ${rapport.depenses.map(d => `
              <tr>
                <td>${formatDate(d.date)}</td>
                <td>${d.type_depense || '-'}</td>
                <td>${d.nature}</td>
                <td class="amount">${formatMontant(d.montant)}</td>
                <td>${d.reference || '-'}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3">Total des dépenses</td>
              <td class="amount">${formatMontant(rapport.depensesRemboursables)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      `
      : `<div class="empty-table">Aucune dépense remboursable pour cette période</div>`;

    const virementsHTML = rapport.virementsList.length > 0
      ? `
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Montant</th>
              <th>Mode de paiement</th>
              <th>Référence</th>
              <th>Réservation associée</th>
            </tr>
          </thead>
          <tbody>
            ${rapport.virementsList.map(v => {
              const reservation = rapport.reservations.find(r => r.id === v.id_reservation);
              const reservationInfo = reservation 
                ? `${formatDate(reservation.date_arrivee)} - ${formatDate(reservation.date_depart)}`
                : '-';
              return `
                <tr>
                  <td>${formatDate(v.date)}</td>
                  <td class="amount">${formatMontant(v.montant)}</td>
                  <td>${v.mode_paiement}</td>
                  <td>${v.reference || '-'}</td>
                  <td>${reservationInfo}</td>
                </tr>
              `;
            }).join('')}
            <tr class="total-row">
              <td colspan="1">Total des virements</td>
              <td class="amount">${formatMontant(rapport.virements)}</td>
              <td colspan="3"></td>
            </tr>
          </tbody>
        </table>
      `
      : `<div class="empty-table">Aucun virement pour cette période</div>`;

    const html = `<!DOCTYPE html>
      <html>
      <head>
        <title>Bilan de propriété - ${proprieteName}</title>
        <meta charset="UTF-8">
        ${style}
      </head>
      <body>
        <div class="header">
          <img src="/lovable-uploads/b055d24c-dddf-4cef-9dc7-c7e18da4955c.png" alt="SUD HOWS DISTRIBUTION Logo" class="logo" />
          <p style="margin: 8px 0; font-size: 12px; line-height: 1.4;">
            SUD HOWS DISTRIBUTION Agence Immobilière Et Conciergerie<br />
            N°1850, Mosquée Attowba, Imiouadar, Commune Tamri<br />
            Téléphone : 07 70 74 54 44 / 05 28 20 09 22<br />
            RC : 58239 – IF : 48588455 – ICE : 002716399000091
          </p>
        </div>
        
        <h1 className="text-2xl font-bold text-violet-800">Bilan de propriété</h1>
        <p className="text-gray-500">
          ${rapport.propriete.nom} - Période du ${dateDebutFormatted} au ${dateFinFormatted}
        </p>
        
        <div class="summary-box">
          <table>
            <tr>
              <td><strong>Propriété:</strong></td>
              <td>${rapport.propriete.nom}</td>
              <td><strong>Propriétaire:</strong></td>
              <td>${rapport.propriete.nom_proprietaire}</td>
            </tr>
            <tr>
              <td><strong>Période:</strong></td>
              <td>Du ${dateDebutFormatted} au ${dateFinFormatted}</td>
              <td><strong>Contact:</strong></td>
              <td>${rapport.propriete.contact_proprietaire}</td>
            </tr>
            <tr>
              <td><strong>Total facturé:</strong></td>
              <td>${formatMontant(rapport.totalFacture)}</td>
              <td><strong>Total commissions:</strong></td>
              <td>${formatMontant(rapport.totalCommissions)}</td>
            </tr>
            <tr>
              <td><strong>Part Propriétaire:</strong></td>
              <td>${formatMontant(rapport.totalPartProprietaire)}</td>
              <td><strong>Dépenses remboursables:</strong></td>
              <td>${formatMontant(rapport.depensesRemboursables)}</td>
            </tr>
            <tr>
              <td><strong>Virements effectués:</strong></td>
              <td>${formatMontant(rapport.virements)}</td>
              <td><strong>Solde à verser:</strong></td>
              <td><strong>${formatMontant(rapport.soldeAVerser)}</strong></td>
            </tr>
          </table>
        </div>
        
        <h2>Réservations</h2>
        ${reservationsHTML}
        
        <h2>Dépenses remboursables</h2>
        ${depensesHTML}
        
        <h2>Virements effectués</h2>
        ${virementsHTML}
        
        <div class="signature">
          <p>Document généré le ${format(new Date(), 'dd/MM/yyyy', { locale: fr })}.</p>
        </div>
      
      </body>
      </html>`;
    
    printWindow.document.write(html);
    printWindow.document.close();
    
    printWindow.onload = function() {
      printWindow.print();
    };
  };

  const formatMontant = (montant: number) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'MAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(montant);
  };

  const formatDate = (dateStr: Date | string) => {
    let date;
    if (typeof dateStr === 'string') {
      date = parseISO(dateStr);
    } else {
      date = dateStr;
    }
    return format(date, 'dd/MM/yyyy', { locale: fr });
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => setError(null)}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="bg-white">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Propriété</label>
              {loading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={selectedProprieteId || ""}
                  onValueChange={setSelectedProprieteId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une propriété" />
                  </SelectTrigger>
                  <SelectContent>
                    {proprietesOptions.map((prop) => (
                      <SelectItem key={prop.id} value={prop.id}>
                        {prop.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date de début</label>
              {loading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateDebut && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateDebut ? (
                        format(dateDebut, "dd/MM/yyyy", { locale: fr })
                      ) : (
                        <span>Choisir une date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateDebut}
                      onSelect={setDateDebut}
                      locale={fr}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date de fin</label>
              {loading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateFin && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFin ? (
                        format(dateFin, "dd/MM/yyyy", { locale: fr })
                      ) : (
                        <span>Choisir une date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateFin}
                      onSelect={setDateFin}
                      locale={fr}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <div className="flex items-end gap-2">
              <Button 
                onClick={genererRapport} 
                disabled={!selectedProprieteId || !dateDebut || !dateFin || loading}
                className="bg-violet-700 hover:bg-violet-800"
              >
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">⌛</span>
                    Chargement...
                  </>
                ) : (
                  "Afficher le rapport"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : rapport && (
        <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-violet-800">Bilan de propriété</h1>
              <p className="text-gray-500">
                {rapport.propriete.nom} - Période du{" "}
                {format(rapport.dateDebut, "dd/MM/yyyy", { locale: fr })} au{" "}
                {format(rapport.dateFin, "dd/MM/yyyy", { locale: fr })}
              </p>
            </div>
            <Button onClick={genererPDF} className="bg-purple-700 hover:bg-purple-800">
              <Printer className="mr-2 h-4 w-4" /> Imprimer en PDF
            </Button>
          </div>

          <Card className="bg-gray-50">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Propriété</p>
                  <p className="font-medium">{rapport.propriete.nom}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Propriétaire</p>
                  <p className="font-medium">{rapport.propriete.nom_proprietaire}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total facturé</p>
                  <p className="font-medium">{formatMontant(rapport.totalFacture)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total commissions</p>
                  <p className="font-medium">{formatMontant(rapport.totalCommissions)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Part Propriétaire</p>
                  <p className="font-medium">{formatMontant(rapport.totalPartProprietaire)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Dépenses remboursables</p>
                  <p className="font-medium">{formatMontant(rapport.depensesRemboursables)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Virements effectués</p>
                  <p className="font-medium">{formatMontant(rapport.virements)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-bold">Solde à verser</p>
                  <p className="font-bold text-violet-800">{formatMontant(rapport.soldeAVerser)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-xl font-semibold mb-4">Réservations</h2>
            {rapport.reservations.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Date d'arrivée</TableHead>
                      <TableHead>Date de départ</TableHead>
                      <TableHead>Nuits</TableHead>
                      <TableHead className="text-right">Prix/nuit</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Taux Com.</TableHead>
                      <TableHead className="text-right">Montant Com.</TableHead>
                      <TableHead className="text-right">Part Propriétaire</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rapport.reservations.map((reservation) => (
                      <TableRow key={reservation.id}>
                        <TableCell>{formatDate(reservation.date_arrivee)}</TableCell>
                        <TableCell>{formatDate(reservation.date_depart)}</TableCell>
                        <TableCell>{reservation.nombre_jours}</TableCell>
                        <TableCell className="text-right">{formatMontant(reservation.prix_par_nuit)}</TableCell>
                        <TableCell className="text-right">{formatMontant(reservation.prix_total)}</TableCell>
                        <TableCell className="text-right">{reservation.taux_commission}%</TableCell>
                        <TableCell className="text-right">{formatMontant(reservation.montant_commission)}</TableCell>
                        <TableCell className="text-right">{formatMontant(reservation.part_proprietaire)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 font-medium">
                      <TableCell colSpan={4}>Total</TableCell>
                      <TableCell className="text-right">{formatMontant(rapport.totalFacture)}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">{formatMontant(rapport.totalCommissions)}</TableCell>
                      <TableCell className="text-right">{formatMontant(rapport.totalPartProprietaire)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-md text-gray-500 italic">
                Aucune réservation pour cette période
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Dépenses remboursables</h2>
            {rapport.depenses.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Nature</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Référence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rapport.depenses.map((depense) => (
                      <TableRow key={depense.id}>
                        <TableCell>{formatDate(depense.date)}</TableCell>
                        <TableCell>{depense.type_depense || "-"}</TableCell>
                        <TableCell>{depense.nature}</TableCell>
                        <TableCell className="text-right">{formatMontant(depense.montant)}</TableCell>
                        <TableCell>{depense.reference || "-"}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 font-medium">
                      <TableCell colSpan={3}>Total des dépenses</TableCell>
                      <TableCell className="text-right">{formatMontant(rapport.depensesRemboursables)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-md text-gray-500 italic">
                Aucune dépense remboursable pour cette période
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Virements effectués</h2>
            {rapport.virementsList.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Mode de paiement</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead>Réservation associée</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {rapport.virementsList.map((virement) => {
                       const reservation = rapport.reservations.find(r => r.id === virement.id_reservation);
                       const reservationInfo = reservation 
                         ? `${formatDate(reservation.date_arrivee)} - ${formatDate(reservation.date_depart)}`
                         : '-';
                       return (
                         <TableRow key={virement.id}>
                           <TableCell>{formatDate(virement.date)}</TableCell>
                           <TableCell className="text-right">{formatMontant(virement.montant)}</TableCell>
                           <TableCell>{virement.mode_paiement}</TableCell>
                           <TableCell>{virement.reference || "-"}</TableCell>
                           <TableCell>{reservationInfo}</TableCell>
                         </TableRow>
                       );
                     })}
                    <TableRow className="bg-gray-50 font-medium">
                      <TableCell>Total des virements</TableCell>
                      <TableCell className="text-right">{formatMontant(rapport.virements)}</TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-md text-gray-500 italic">
                Aucun virement pour cette période
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RapportProprietePage;
