
import React, { useState, useEffect } from 'react';
import { format, parseISO, isAfter, isBefore, isEqual, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Eye, Edit, Trash2, Search, Filter, Calendar as CalendarIcon, ChevronUp, ChevronDown, FileText, Loader2, Check, X, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReservationDetailsDialog from './ReservationDetailsDialog';
import ContractGenerator from './ContractGenerator';
import ReceiptGenerator from './ReceiptGenerator';
import { Badge } from '@/components/ui/badge';

// Type des données de réservation avec jointure clients et propriétés
type ReservationWithDetails = {
  id: string;
  client: Client;
  propriete: Propriete;
  date_arrivee: string;
  date_depart: string;
  nombre_jours: number;
  prix_total: number;
  prix_par_nuit?: number;
  paiement_avance: number;
  reste_a_payer: number;
  mode_paiement: string;
  reference: string | null;
  source: string;
  date_reservation: string;
  status: string; // Ajout du champ status
};

// Type pour les propriétés et sources (pour les filtres)
type Propriete = {
  id: string;
  nom: string;
  nom_residence?: string;
  type_appartement?: string;
};
type SourceReservation = {
  id: string;
  nom: string;
};

// Type pour les filtres
type FiltersType = {
  searchTerm: string;
  proprieteId: string;
  sourceNom: string;
  status: string; // Ajout du filtre par statut
  dateArriveeDebut: Date | null;
  dateArriveeFin: Date | null;
};

// Constante pour le tri par défaut
const DEFAULT_SORT = {
  field: 'date_arrivee',
  direction: 'asc' as 'asc' | 'desc'
};

// Liste des statuts disponibles
const STATUSES = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'Confirmé', label: 'Confirmé' },
  { value: 'Annulé', label: 'Annulé' },
];

// Type des clients
type Client = {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  cin_passport?: string;
  autre_info?: string;
};

// Type pour les propriétés
type ProprieteFilter = {
  id: string;
  nom: string;
};

const ReservationsList: React.FC = () => {
  // États
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([]);
  const [filteredReservations, setFilteredReservations] = useState<ReservationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [proprietes, setProprietes] = useState<ProprieteFilter[]>([]);
  const [sources, setSources] = useState<SourceReservation[]>([]);

  // État pour la suppression
  const [reservationToDelete, setReservationToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // État pour l'édition
  const [editReservationId, setEditReservationId] = useState<string | null>(null);
  
  // État pour la génération de contrat
  const [contractReservationData, setContractReservationData] = useState<any>(null);
  const [showContract, setShowContract] = useState(false);
  
  // État pour la génération de récépissé
  const [receiptReservationData, setReceiptReservationData] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // État pour le tri
  const [sortConfig, setSortConfig] = useState({
    field: DEFAULT_SORT.field,
    direction: DEFAULT_SORT.direction
  });

  // État pour les filtres
  const [filters, setFilters] = useState<FiltersType>({
    searchTerm: '',
    proprieteId: 'all',
    sourceNom: 'all',
    status: 'all',
    dateArriveeDebut: null,
    dateArriveeFin: null
  });

  const [showTomorrow, setShowTomorrow] = useState(false);
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  // Chargement initial des données
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Chargement des réservations avec jointures
        const {
          data: reservationsData,
          error: reservationsError
        } = await supabase.from('reservations').select(`
            id,
            date_reservation,
            source,
            date_arrivee,
            date_depart,
            nombre_jours,
            prix_total,
            prix_par_nuit,
            paiement_avance,
            reste_a_payer,
            mode_paiement,
            reference,
            status,
            clients (id, nom, prenom, cin_passport, telephone),
            proprietes (id, nom, nom_residence, type_appartement)
          `).order('date_arrivee', {
          ascending: true
        });
        if (reservationsError) throw reservationsError;

        // Transformation des données
        const formattedReservations: ReservationWithDetails[] = (reservationsData || []).map((item: any) => {
          // Extract client data
          const client: Client = {
            id: item.clients?.id || '',
            nom: item.clients?.nom || '',
            prenom: item.clients?.prenom || '',
            telephone: item.clients?.telephone || '',
            cin_passport: item.clients?.cin_passport || '',
            autre_info: item.clients?.autre_info || ''
          };
          
          // Extract property data
          const propriete: Propriete = {
            id: item.proprietes?.id || '',
            nom: item.proprietes?.nom || '',
            nom_residence: item.proprietes?.nom_residence || '',
            type_appartement: item.proprietes?.type_appartement || ''
          };
          
          return {
            id: item.id,
            client,
            propriete,
            date_arrivee: item.date_arrivee,
            date_depart: item.date_depart,
            nombre_jours: item.nombre_jours,
            prix_total: item.prix_total,
            prix_par_nuit: item.prix_par_nuit,
            paiement_avance: item.paiement_avance,
            reste_a_payer: item.reste_a_payer,
            mode_paiement: item.mode_paiement,
            reference: item.reference,
            source: item.source,
            date_reservation: item.date_reservation,
            status: item.status || 'Confirmé' // Par défaut "Confirmé" si null
          };
        });
        setReservations(formattedReservations);
        setFilteredReservations(formattedReservations);

        // Chargement des propriétés (pour les filtres)
        const {
          data: proprietesData
        } = await supabase.from('proprietes').select('id, nom').order('nom');
        setProprietes(proprietesData || []);

        // Chargement des sources (pour les filtres)
        const {
          data: sourcesData
        } = await supabase.from('sources_reservation').select('id, nom').order('nom');
        setSources(sourcesData || []);
      } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Erreur lors du chargement des réservations"
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Appliquer les filtres et le tri aux réservations
  useEffect(() => {
    // Fonction pour appliquer les filtres
    const applyFilters = (data: ReservationWithDetails[]) => {
      return data.filter(item => {
        // Recherche textuelle (nom client, référence ou propriété)
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch = filters.searchTerm === '' || 
          `${item.client.nom} ${item.client.prenom}`.toLowerCase().includes(searchLower) || 
          (item.reference?.toLowerCase() || '').includes(searchLower) || 
          item.propriete.nom.toLowerCase().includes(searchLower);

        // Filtre par propriété
        const matchesPropriete = filters.proprieteId === 'all' || item.propriete.id === filters.proprieteId;

        // Filtre par statut
        const matchesStatus = filters.status === 'all' || item.status === filters.status;

        // Filtre par plage de dates d'arrivée
        let matchesDateArrivee = true;
        const dateArrivee = parseISO(item.date_arrivee);
        if (filters.dateArriveeDebut) {
          matchesDateArrivee = isAfter(dateArrivee, filters.dateArriveeDebut) || isEqual(dateArrivee, filters.dateArriveeDebut);
        }
        if (filters.dateArriveeFin && matchesDateArrivee) {
          matchesDateArrivee = isBefore(dateArrivee, filters.dateArriveeFin) || isEqual(dateArrivee, filters.dateArriveeFin);
        }
        // Filtre "Arrivées/Sorties demain"
        const matchesTomorrow = !showTomorrow || (
          item.date_arrivee === tomorrowStr || item.date_depart === tomorrowStr
        );

        return matchesSearch && matchesPropriete && matchesStatus && matchesDateArrivee && matchesTomorrow;
      });
    };

    // Fonction pour trier les résultats
    const sortData = (data: ReservationWithDetails[]) => {
      return [...data].sort((a, b) => {
        let aValue: string | number | Date;
        let bValue: string | number | Date;

        // Special handling for client name
        if (sortConfig.field === 'client_nom') {
          aValue = `${a.client.nom} ${a.client.prenom}`;
          bValue = `${b.client.nom} ${b.client.prenom}`;
        } 
        // Special handling for property name
        else if (sortConfig.field === 'propriete_nom') {
          aValue = a.propriete.nom;
          bValue = b.propriete.nom;
        }
        else {
          // @ts-ignore - we know these fields exist
          aValue = a[sortConfig.field];
          // @ts-ignore
          bValue = b[sortConfig.field];
        }

        // Conversion pour les dates
        if (sortConfig.field === 'date_arrivee' || sortConfig.field === 'date_depart') {
          aValue = parseISO(aValue as string);
          bValue = parseISO(bValue as string);
        }

        // Gestion de la direction
        const direction = sortConfig.direction === 'asc' ? 1 : -1;
        if (aValue < bValue) return -1 * direction;
        if (aValue > bValue) return 1 * direction;
        return 0;
      });
    };

    // Appliquer les filtres puis le tri
    const filtered = applyFilters(reservations);
    const sorted = sortData(filtered);
    setFilteredReservations(sorted);
  }, [reservations, filters, sortConfig, proprietes, showTomorrow, tomorrowStr]);

  // Gérer la suppression d'une réservation
  const handleDelete = async () => {
    if (!reservationToDelete) return;
    try {
      setIsDeleting(true);

      // 1. D'abord supprimer les paiements liés à cette réservation
      const { error: paymentsError } = await supabase
        .from('reglements_clients')
        .delete()
        .eq('id_reservation', reservationToDelete);
      
      if (paymentsError) {
        console.error("Erreur lors de la suppression des paiements:", paymentsError);
        throw new Error("Impossible de supprimer les paiements liés à cette réservation.");
      }

      // 2. Ensuite supprimer la réservation
      const { error: reservationError } = await supabase
        .from('reservations')
        .delete()
        .eq('id', reservationToDelete);
      
      if (reservationError) throw reservationError;

      // Mettre à jour la liste
      setReservations(prev => prev.filter(res => res.id !== reservationToDelete));
      toast({
        description: 'Réservation et paiements associés supprimés avec succès'
      });
      setReservationToDelete(null);
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur: " + (error instanceof Error ? error.message : "Erreur lors de la suppression")
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Gérer le changement de tri
  const handleSort = (field: string) => {
    setSortConfig({
      field: field,
      direction: field === sortConfig.field ? sortConfig.direction === 'asc' ? 'desc' : 'asc' : 'asc'
    });
  };

  // Formater le prix
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MAD'
    }).format(amount);
  };

  // Gérer la mise à jour après édition
  const handleReservationUpdate = () => {
    // Recharger les données
    const fetchData = async () => {
      try {
        setLoading(true);
        const {
          data: reservationsData,
          error: reservationsError
        } = await supabase.from('reservations').select(`
            id,
            date_reservation,
            source,
            date_arrivee,
            date_depart,
            nombre_jours,
            prix_total,
            prix_par_nuit,
            paiement_avance,
            reste_a_payer,
            mode_paiement,
            reference,
            status,
            clients (id, nom, prenom, cin_passport, telephone),
            proprietes (id, nom, nom_residence, type_appartement)
          `).order('date_arrivee', {
          ascending: true
        });
        if (reservationsError) throw reservationsError;
        const formattedReservations: ReservationWithDetails[] = (reservationsData || []).map((item: any) => {
          // Extract client data
          const client: Client = {
            id: item.clients?.id || '',
            nom: item.clients?.nom || '',
            prenom: item.clients?.prenom || '',
            telephone: item.clients?.telephone || '',
            cin_passport: item.clients?.cin_passport || '',
            autre_info: item.clients?.autre_info || ''
          };
          
          // Extract property data
          const propriete: Propriete = {
            id: item.proprietes?.id || '',
            nom: item.proprietes?.nom || '',
            nom_residence: item.proprietes?.nom_residence || '',
            type_appartement: item.proprietes?.type_appartement || ''
          };
          
          return {
            id: item.id,
            client,
            propriete,
            date_arrivee: item.date_arrivee,
            date_depart: item.date_depart,
            nombre_jours: item.nombre_jours,
            prix_total: item.prix_total,
            prix_par_nuit: item.prix_par_nuit,
            paiement_avance: item.paiement_avance,
            reste_a_payer: item.reste_a_payer,
            mode_paiement: item.mode_paiement,
            reference: item.reference,
            source: item.source,
            date_reservation: item.date_reservation,
            status: item.status || 'Confirmé'
          };
        });
        setReservations(formattedReservations);
      } catch (error) {
        console.error("Erreur lors du rechargement des données:", error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Erreur lors du rechargement des réservations"
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  };

  // Générer la classe du header de colonne triable
  const getSortableHeaderClass = (field: string) => {
    return cn("cursor-pointer hover:bg-gray-50 transition-colors", sortConfig.field === field ? "text-violet-700 font-semibold" : "");
  };

  // Afficher l'icône de tri
  const renderSortIcon = (field: string) => {
    if (field !== sortConfig.field) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp className="inline ml-1 h-4 w-4" /> : <ChevronDown className="inline ml-1 h-4 w-4" />;
  };

  // Afficher le statut avec un indicateur visuel
  const renderStatus = (status: string) => {
    if (status === 'Confirmé') {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
          <Check className="h-3 w-3" />
          Confirmé
        </Badge>
      );
    } else if (status === 'Annulé') {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
          <X className="h-3 w-3" />
          Annulé
        </Badge>
      );
    }
    return <span>{status || 'Confirmé'}</span>;
  };

  // Fonction pour générer le contrat d'une réservation
  const handleGenerateContract = (reservation: ReservationWithDetails) => {
    const contractData = {
      clientNom: reservation.client.nom,
      clientPrenom: reservation.client.prenom,
      clientCinPassport: reservation.client.cin_passport || '',
      clientTelephone: reservation.client.telephone || '',
      dateReservation: parseISO(reservation.date_reservation),
      dateArrivee: parseISO(reservation.date_arrivee),
      dateDepart: parseISO(reservation.date_depart),
      nombreJours: reservation.nombre_jours,
      prixParNuit: reservation.prix_par_nuit || (reservation.prix_total / reservation.nombre_jours),
      prixTotal: reservation.prix_total,
      paiementAvance: reservation.paiement_avance,
      resteAPayer: reservation.reste_a_payer
    };

    setContractReservationData(contractData);
    setShowContract(true);
  };

  // Fonction pour générer le récépissé d'une réservation
  const handleGenerateReceipt = (reservation: ReservationWithDetails) => {
    const receiptData = {
      clientNom: reservation.client.nom,
      clientPrenom: reservation.client.prenom,
      clientTelephone: reservation.client.telephone || '',
      proprieteNom: reservation.propriete.nom,
      residenceNom: reservation.propriete.nom_residence || '',
      typeAppartement: reservation.propriete.type_appartement || '',
      dateArrivee: parseISO(reservation.date_arrivee),
      dateDepart: parseISO(reservation.date_depart),
      nombreJours: reservation.nombre_jours,
      prixParNuit: reservation.prix_par_nuit || (reservation.prix_total / reservation.nombre_jours),
      prixTotal: reservation.prix_total,
      paiementAvance: reservation.paiement_avance,
      resteAPayer: reservation.reste_a_payer
    };

    setReceiptReservationData(receiptData);
    setShowReceipt(true);
  };

  return <div className="space-y-4">
      {/* Barre de recherche et filtres */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input 
            type="text" 
            placeholder="Search by client, reference, or property..." 
            value={filters.searchTerm} 
            onChange={e => setFilters({
          ...filters,
          searchTerm: e.target.value
        })} 
            className="pl-9" 
          />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 md:w-auto">
          {/* Filtre par propriété */}
          <Select 
            value={filters.proprieteId} 
            onValueChange={value => setFilters({
          ...filters,
          proprieteId: value
        })}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Property" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All properties</SelectItem>
              {proprietes.map(prop => (
                <SelectItem key={prop.id} value={prop.id}>{prop.nom}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Filtre par statut */}
          <Select 
            value={filters.status} 
            onValueChange={value => setFilters({
          ...filters,
          status: value
        })}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(status => (
                <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filtre de date d'arrivée */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="text-sm">Date d'arrivée:</span>
        </div>
        
        {/* Date début */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[130px] pl-3 text-left font-normal", !filters.dateArriveeDebut && "text-muted-foreground")}>
              {filters.dateArriveeDebut ? format(filters.dateArriveeDebut, 'dd/MM/yyyy') : <span>Du</span>}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={filters.dateArriveeDebut || undefined} onSelect={date => setFilters({
            ...filters,
            dateArriveeDebut: date
          })} locale={fr} className="pointer-events-auto" />
          </PopoverContent>
        </Popover>
        
        {/* Date fin */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[130px] pl-3 text-left font-normal", !filters.dateArriveeFin && "text-muted-foreground")}>
              {filters.dateArriveeFin ? format(filters.dateArriveeFin, 'dd/MM/yyyy') : <span>Au</span>}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={filters.dateArriveeFin || undefined} onSelect={date => setFilters({
            ...filters,
            dateArriveeFin: date
          })} locale={fr} className="pointer-events-auto" />
          </PopoverContent>
        </Popover>
        
        {/* Bouton pour réinitialiser les filtres de date */}
        {(filters.dateArriveeDebut || filters.dateArriveeFin) && <Button variant="ghost" size="sm" onClick={() => setFilters({
        ...filters,
        dateArriveeDebut: null,
        dateArriveeFin: null
      })}>
            Reset dates
          </Button>}

        {/* Bouton Arrivées/Sorties demain */}
        <Button
          variant={showTomorrow ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowTomorrow(v => !v)}
          className={showTomorrow ? 'bg-orange-500 hover:bg-orange-600 border-orange-500' : ''}
        >
          Arrivées / Sorties demain
        </Button>

        {/* Compteur de résultats */}
        <div className="ml-auto flex items-center gap-3">
          <div className="text-sm text-gray-500">
            {filteredReservations.length} reservation{filteredReservations.length !== 1 ? 's' : ''} trouvée{filteredReservations.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Tableau des réservations */}
      {(() => {
        const tableHeader = (
          <TableRow>
            <TableHead className={getSortableHeaderClass("client_nom")} onClick={() => handleSort("client_nom")}>
              Client {renderSortIcon("client_nom")}
            </TableHead>
            <TableHead className={getSortableHeaderClass("propriete_nom")} onClick={() => handleSort("propriete_nom")}>
              Propriété {renderSortIcon("propriete_nom")}
            </TableHead>
            <TableHead className={getSortableHeaderClass("date_arrivee")} onClick={() => handleSort("date_arrivee")}>
              Date d'arrivée {renderSortIcon("date_arrivee")}
            </TableHead>
            <TableHead className={getSortableHeaderClass("date_depart")} onClick={() => handleSort("date_depart")}>
              Date de départ {renderSortIcon("date_depart")}
            </TableHead>
            <TableHead>Nuits</TableHead>
            <TableHead>Prix total</TableHead>
            <TableHead>Mode paiement</TableHead>
            <TableHead className={getSortableHeaderClass("status")} onClick={() => handleSort("status")}>
              Statut {renderSortIcon("status")}
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        );

        const renderRows = (list: ReservationWithDetails[], rowClass: string) =>
          list.map(reservation => (
            <TableRow key={reservation.id} className={rowClass}>
              <TableCell className="whitespace-nowrap">
                {reservation.client.nom} {reservation.client.prenom}
              </TableCell>
              <TableCell className="whitespace-nowrap">{reservation.propriete.nom}</TableCell>
              <TableCell className="whitespace-nowrap">
                {format(parseISO(reservation.date_arrivee), 'dd/MM/yyyy')}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {format(parseISO(reservation.date_depart), 'dd/MM/yyyy')}
              </TableCell>
              <TableCell>{reservation.nombre_jours}</TableCell>
              <TableCell className="whitespace-nowrap">{formatPrice(reservation.prix_total)}</TableCell>
              <TableCell>{reservation.mode_paiement}</TableCell>
              <TableCell className="whitespace-nowrap">{renderStatus(reservation.status)}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" aria-label="Générer contrat" title="Générer contrat" onClick={() => handleGenerateContract(reservation)}>
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Générer récépissé" title="Générer récépissé" onClick={() => handleGenerateReceipt(reservation)}>
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Modifier" onClick={() => setEditReservationId(reservation.id)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Supprimer" onClick={() => setReservationToDelete(reservation.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ));

        if (loading) {
          return (
            <div className="rounded-md border overflow-hidden">
              <Table><TableBody>
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <span className="mt-2 block text-sm text-gray-500">Chargement des réservations...</span>
                  </TableCell>
                </TableRow>
              </TableBody></Table>
            </div>
          );
        }

        if (showTomorrow) {
          const arrivees = filteredReservations.filter(r => r.date_arrivee === tomorrowStr);
          const departs  = filteredReservations.filter(r => r.date_depart  === tomorrowStr);
          return (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                  <h3 className="font-semibold text-green-700">Arrivées demain ({arrivees.length})</h3>
                </div>
                <div className="rounded-md border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>{tableHeader}</TableHeader>
                      <TableBody>
                        {arrivees.length === 0
                          ? <TableRow><TableCell colSpan={9} className="text-center py-6 text-gray-400">Aucune arrivée prévue demain</TableCell></TableRow>
                          : renderRows(arrivees, 'bg-green-50 hover:bg-green-100')}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
                  <h3 className="font-semibold text-red-700">Départs demain ({departs.length})</h3>
                </div>
                <div className="rounded-md border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>{tableHeader}</TableHeader>
                      <TableBody>
                        {departs.length === 0
                          ? <TableRow><TableCell colSpan={9} className="text-center py-6 text-gray-400">Aucun départ prévu demain</TableCell></TableRow>
                          : renderRows(departs, 'bg-red-50 hover:bg-red-100')}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="rounded-md border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>{tableHeader}</TableHeader>
                <TableBody>
                  {filteredReservations.length === 0
                    ? <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          <div className="text-gray-500">
                            <FileText className="h-12 w-12 mx-auto opacity-20" />
                            <p className="mt-2">Aucune réservation ne correspond aux critères</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    : renderRows(filteredReservations, '')}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })()}

      {/* Dialogue de confirmation de suppression */}
      <Dialog open={!!reservationToDelete} onOpenChange={open => !open && setReservationToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cette réservation ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline" disabled={isDeleting}>
                Annuler
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suppression...
                </> : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog détails et édition de réservation */}
      <ReservationDetailsDialog reservationId={editReservationId} onClose={() => setEditReservationId(null)} onUpdate={handleReservationUpdate} />

      {/* Dialog générateur de contrat */}
      {contractReservationData && (
        <ContractGenerator
          isOpen={showContract}
          onClose={() => setShowContract(false)}
          data={contractReservationData}
        />
      )}
      
      {/* Dialog générateur de récépissé */}
      {receiptReservationData && (
        <ReceiptGenerator
          isOpen={showReceipt}
          onClose={() => setShowReceipt(false)}
          data={receiptReservationData}
        />
      )}
    </div>;
};
export default ReservationsList;

