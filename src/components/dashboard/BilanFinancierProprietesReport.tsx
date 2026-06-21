import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Search, Building, Home, PiggyBank, Receipt, Banknote, DollarSign, ArrowDown, ArrowUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";

interface ProprieteFinanciere {
  id: string;
  nom: string;
  nom_proprietaire: string;
  groupe: string;
  nom_residence: string;
  revenuTotal: number;
  totalRecu: number;
  resteARecevoir: number;
  revenuBrutAgence: number;
  revenuBrutProprietaire: number;
  depensesRemboursables: number;
  depensesNonRemboursables: number;
  revenuNetAgence: number;
  revenuNetProprietaire: number;
  virementsRealises: number;
  resteAVerser: number;
}

interface BilanFinancierProprietesReportProps {
  onTotalsChange?: (totals: {
    revenuTotal: number;
    totalRecu: number;
    revenuBrutAgence: number;
    revenuNetAgence: number;
    avancesReservationsAnnulees: number;
  }) => void;
}

const BilanFinancierProprietesReport: React.FC<BilanFinancierProprietesReportProps> = ({ onTotalsChange }) => {
  const [data, setData] = useState<ProprieteFinanciere[]>([]);
  const [filteredData, setFilteredData] = useState<ProprieteFinanciere[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [groupeFilter, setGroupeFilter] = useState<string>("");
  const [residenceFilter, setResidenceFilter] = useState<string>("");
  const [proprietaireFilter, setProprietaireFilter] = useState<string>("");
  
  const [groupes, setGroupes] = useState<string[]>([]);
  const [residences, setResidences] = useState<string[]>([]);
  const [proprietaires, setProprietaires] = useState<string[]>([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [data, searchTerm, groupeFilter, residenceFilter, proprietaireFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: proprietesData, error: proprietesError } = await supabase
        .from('proprietes')
        .select('*');
      
      if (proprietesError) throw proprietesError;
      
      // Récupérer les réservations non-annulées
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservations')
        .select('*')
        .neq('status', 'Annulé');
      
      if (reservationsError) throw reservationsError;
      
      // Récupérer les réservations annulées séparément
      const { data: reservationsAnnuleesData, error: reservationsAnnuleesError } = await supabase
        .from('reservations')
        .select('*')
        .eq('status', 'Annulé');
      
      if (reservationsAnnuleesError) throw reservationsAnnuleesError;

      // Calculer le montant total des avances des réservations annulées
      const avancesReservationsAnnulees = reservationsAnnuleesData.reduce(
        (sum: number, reservation: any) => sum + (Number(reservation.paiement_avance) || 0),
        0
      );
      
      const { data: reglementsData, error: reglementsError } = await supabase
        .from('reglements_clients')
        .select('*');
      
      if (reglementsError) throw reglementsError;
      
      const { data: depensesData, error: depensesError } = await supabase
        .from('depenses')
        .select('*');
      
      if (depensesError) throw depensesError;
      
      const { data: virementsData, error: virementsError } = await supabase
        .from('virements_proprietaires')
        .select('*');
      
      if (virementsError) throw virementsError;
      
      const bilanFinancier: ProprieteFinanciere[] = proprietesData.map((propriete: any) => {
        const reservationsPropriete = reservationsData.filter((r: any) => r.id_propriete === propriete.id);
        
        const revenuTotal = reservationsPropriete.reduce(
          (sum: number, reservation: any) => sum + (Number(reservation.prix_total) || 0),
          0
        );
        
        const reglementsPropriete = reglementsData.filter((r: any) => {
          const reservation = reservationsData.find((res: any) => res.id === r.id_reservation);
          return reservation && reservation.id_propriete === propriete.id;
        });
        
        const totalRecu = reglementsPropriete.reduce(
          (sum: number, reglement: any) => sum + (Number(reglement.montant) || 0),
          0
        );
        
        const revenuBrutAgence = reservationsPropriete.reduce(
          (sum: number, reservation: any) => sum + (Number(reservation.montant_commission) || 0),
          0
        );
        
        const revenuBrutProprietaire = reservationsPropriete.reduce(
          (sum: number, reservation: any) => sum + (Number(reservation.part_proprietaire) || 0),
          0
        );
        
        const depensesPropriete = depensesData.filter((d: any) => d.id_propriete === propriete.id);
        
        const depensesRemboursables = depensesPropriete
          .filter((d: any) => d.nature === 'remboursable')
          .reduce((sum: number, depense: any) => sum + (Number(depense.montant) || 0), 0);
        
        const depensesNonRemboursables = depensesPropriete
          .filter((d: any) => d.nature === 'non remboursable')
          .reduce((sum: number, depense: any) => sum + (Number(depense.montant) || 0), 0);
        
        const virementsPropriete = virementsData.filter((v: any) => v.id_propriete === propriete.id);
        
        const virementsRealises = virementsPropriete.reduce(
          (sum: number, virement: any) => sum + (Number(virement.montant) || 0),
          0
        );
        
        const resteARecevoir = revenuTotal - totalRecu;
        
        // Modification de la formule du revenu net de l'agence - nous n'ajoutons pas les avances
        // au niveau de chaque propriété car les avances des réservations annulées sont calculées globalement
        const revenuNetAgence = revenuBrutAgence - depensesNonRemboursables;
        
        const revenuNetProprietaire = revenuBrutProprietaire - depensesRemboursables;
        const resteAVerser = revenuNetProprietaire - virementsRealises;
        
        return {
          id: propriete.id,
          nom: propriete.nom,
          nom_proprietaire: propriete.nom_proprietaire,
          groupe: propriete.groupe,
          nom_residence: propriete.nom_residence,
          revenuTotal,
          totalRecu,
          resteARecevoir,
          revenuBrutAgence,
          revenuBrutProprietaire,
          depensesRemboursables,
          depensesNonRemboursables,
          revenuNetAgence,
          revenuNetProprietaire,
          virementsRealises,
          resteAVerser
        };
      });
      
      setData(bilanFinancier);
      
      const uniqueGroupes = Array.from(new Set(proprietesData.map((p: any) => p.groupe))).filter(Boolean);
      const uniqueResidences = Array.from(new Set(proprietesData.map((p: any) => p.nom_residence))).filter(Boolean);
      const uniqueProprietaires = Array.from(new Set(proprietesData.map((p: any) => p.nom_proprietaire))).filter(Boolean);
      
      setGroupes(uniqueGroupes);
      setResidences(uniqueResidences);
      setProprietaires(uniqueProprietaires);
      
      // --- SYNTHÈSE pour DashboardSummaryCards
      const total_revenuTotal = bilanFinancier.reduce((sum, row) => sum + row.revenuTotal, 0);
      const total_totalRecu = bilanFinancier.reduce((sum, row) => sum + row.totalRecu, 0);
      const total_revenuBrutAgence = bilanFinancier.reduce((sum, row) => sum + row.revenuBrutAgence, 0);
      
      // Modification de la formule pour le total du revenu net de l'agence
      // On ajoute les avances des réservations annulées au revenu net total
      const total_depensesNonRemboursables = bilanFinancier.reduce((sum, row) => sum + row.depensesNonRemboursables, 0);
      const total_revenuNetAgence = total_revenuBrutAgence - total_depensesNonRemboursables + avancesReservationsAnnulees;

      onTotalsChange?.({
        revenuTotal: total_revenuTotal,
        totalRecu: total_totalRecu,
        revenuBrutAgence: total_revenuBrutAgence,
        revenuNetAgence: total_revenuNetAgence,
        avancesReservationsAnnulees
      });
      
    } catch (err: any) {
      console.error("Erreur lors de la récupération des données:", err);
      setError("Une erreur est survenue lors de la récupération des données.");
      toast({
        title: "Erreur",
        description: "Impossible de charger les données financières",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...data];
    
    if (searchTerm) {
      filtered = filtered.filter((item) =>
        item.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.nom_proprietaire.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (groupeFilter) {
      filtered = filtered.filter((item) => item.groupe === groupeFilter);
    }
    
    if (residenceFilter) {
      filtered = filtered.filter((item) => item.nom_residence === residenceFilter);
    }
    
    if (proprietaireFilter) {
      filtered = filtered.filter((item) => item.nom_proprietaire === proprietaireFilter);
    }
    
    setFilteredData(filtered);
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MAD'
    }).format(amount);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredData.length]);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setGroupeFilter("");
    setResidenceFilter("");
    setProprietaireFilter("");
  };

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 text-red-600 p-4 rounded-md">{error}</div>}
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Rechercher une propriété..." 
            className="pl-8" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
        
        <Select value={groupeFilter} onValueChange={setGroupeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Groupe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les groupes</SelectItem>
            {groupes.map((groupe) => (
              <SelectItem key={groupe} value={groupe}>{groupe}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={residenceFilter} onValueChange={setResidenceFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Résidence" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="toutes">Toutes les résidences</SelectItem>
            {residences.map((residence) => (
              <SelectItem key={residence} value={residence}>{residence}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={proprietaireFilter} onValueChange={setProprietaireFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Propriétaire" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les propriétaires</SelectItem>
            {proprietaires.map((proprietaire) => (
              <SelectItem key={proprietaire} value={proprietaire}>{proprietaire}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button variant="outline" onClick={resetFilters}>
          Réinitialiser les filtres
        </Button>
      </div>
      
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]"><div className="flex items-center"><Building className="mr-2 h-4 w-4" /> Propriété</div></TableHead>
                <TableHead className="text-right"><div className="flex items-center justify-end"><DollarSign className="mr-2 h-4 w-4" /> Revenu Total</div></TableHead>
                <TableHead className="text-right"><div className="flex items-center justify-end"><Banknote className="mr-2 h-4 w-4" /> Total Reçu</div></TableHead>
                <TableHead className="text-right"><div className="flex items-center justify-end"><ArrowDown className="mr-2 h-4 w-4" /> Reste à Recevoir</div></TableHead>
                <TableHead className="text-right"><div className="flex items-center justify-end"><Receipt className="mr-2 h-4 w-4" /> Revenu Brut Agence</div></TableHead>
                <TableHead className="text-right"><div className="flex items-center justify-end"><Home className="mr-2 h-4 w-4" /> Revenu Brut Propriétaire</div></TableHead>
                <TableHead className="text-right"><div className="flex items-center justify-end"><PiggyBank className="mr-2 h-4 w-4" /> Dépenses Remboursables</div></TableHead>
                <TableHead className="text-right"><div className="flex items-center justify-end"><PiggyBank className="mr-2 h-4 w-4" /> Dépenses Non Remboursables</div></TableHead>
                <TableHead className="text-right"><div className="flex items-center justify-end"><Receipt className="mr-2 h-4 w-4" /> Revenu Net Agence</div></TableHead>
                <TableHead className="text-right"><div className="flex items-center justify-end"><Home className="mr-2 h-4 w-4" /> Revenu Net Propriétaire</div></TableHead>
                <TableHead className="text-right"><div className="flex items-center justify-end"><ArrowUp className="mr-2 h-4 w-4" /> Virements Réalisés</div></TableHead>
                <TableHead className="text-right"><div className="flex items-center justify-end"><ArrowDown className="mr-2 h-4 w-4" /> Reste à Verser</div></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(12).fill(0).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : currentItems.length > 0 ? (
                currentItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nom}</TableCell>
                    <TableCell className="text-right">{formatPrice(item.revenuTotal)}</TableCell>
                    <TableCell className="text-right">{formatPrice(item.totalRecu)}</TableCell>
                    <TableCell className="text-right font-medium text-orange-600">{formatPrice(item.resteARecevoir)}</TableCell>
                    <TableCell className="text-right">{formatPrice(item.revenuBrutAgence)}</TableCell>
                    <TableCell className="text-right">{formatPrice(item.revenuBrutProprietaire)}</TableCell>
                    <TableCell className="text-right">{formatPrice(item.depensesRemboursables)}</TableCell>
                    <TableCell className="text-right">{formatPrice(item.depensesNonRemboursables)}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">{formatPrice(item.revenuNetAgence)}</TableCell>
                    <TableCell className="text-right font-medium">{formatPrice(item.revenuNetProprietaire)}</TableCell>
                    <TableCell className="text-right">{formatPrice(item.virementsRealises)}</TableCell>
                    <TableCell className="text-right font-medium text-red-600">{formatPrice(item.resteAVerser)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={12} className="h-24 text-center">
                    Aucun résultat trouvé.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {filteredData.length > 0 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            
            {Array.from({ length: totalPages }).map((_, i) => {
              const pageNum = i + 1;
              if (
                pageNum === 1 ||
                pageNum === totalPages ||
                (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
              ) {
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      isActive={pageNum === currentPage}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              }
              return null;
            })}
            
            <PaginationItem>
              <PaginationNext
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
      
      <div className="text-sm text-muted-foreground text-right pt-2">
        {filteredData.length} propriété{filteredData.length !== 1 ? 's' : ''} trouvée{filteredData.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

export default BilanFinancierProprietesReport;
