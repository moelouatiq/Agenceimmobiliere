import React, { useState, useEffect } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

// Dialogue pour le remboursement lors de l'annulation
const RefundDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  maxAmount 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: (amount: number, raison: string) => void;
  maxAmount: number;
}) => {
  const [amount, setAmount] = useState<number>(0);
  const [raison, setRaison] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (isOpen) {
      setAmount(0);
      setRaison("");
      setError(null);
    }
  }, [isOpen]);
  
  const handleConfirm = () => {
    if (amount < 0) {
      setError("Le montant doit être positif");
      return;
    }
    
    if (amount > maxAmount) {
      setError(`Le montant ne peut pas dépasser ${maxAmount.toFixed(2)} MAD`);
      return;
    }
    
    onConfirm(amount, raison);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remboursement pour annulation</DialogTitle>
          <DialogDescription>
            Veuillez saisir le montant à rembourser au client suite à l'annulation de la réservation.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500">
              Montant maximum remboursable:
            </div>
            <div className="font-semibold">
              {maxAmount.toLocaleString("fr-FR", { style: "currency", currency: "MAD" })}
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="refund-amount" className="text-sm font-medium">
              Montant du remboursement (MAD)
            </label>
            <Input
              id="refund-amount"
              type="number"
              min={0}
              max={maxAmount}
              step={0.01}
              value={amount === 0 ? "" : amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Montant à rembourser"
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="refund-reason" className="text-sm font-medium">
              Raison de l'annulation (optionnel)
            </label>
            <Input
              id="refund-reason"
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              placeholder="Motif de l'annulation"
            />
          </div>
          
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleConfirm}>
            Confirmer le remboursement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Define schema for the form
const reservationSchema = z.object({
  // Client fields
  nom: z.string().min(1, { message: 'Le nom est requis' }),
  prenom: z.string().min(1, { message: 'Le prénom est requis' }),
  telephone: z.string().min(1, { message: 'Le téléphone est requis' }),
  cin_passport: z.string().optional(),
  
  // Reservation fields
  id_client: z.string(),
  id_propriete: z.string(),
  date_arrivee: z.date(),
  date_depart: z.date(),
  prix_par_nuit: z.coerce.number().min(0.01),
  paiement_avance: z.coerce.number().min(0),
  mode_paiement: z.string(),
  reference: z.string().optional(),
  source: z.string(),
  taux_commission: z.coerce.number().min(0),
  status: z.string().default('Confirmé')
}).refine(data => data.date_depart > data.date_arrivee, {
  message: "La date de départ doit être postérieure à la date d'arrivée",
  path: ['date_depart'],
});

type ReservationFormValues = z.infer<typeof reservationSchema>;

type ReservationDetailsDialogProps = {
  reservationId: string | null;
  onClose: () => void;
  onUpdate: () => void;
};

type Client = {
  id: string;
  nom: string;
  prenom: string;
  telephone?: string;
  cin_passport?: string;
};

type Propriete = {
  id: string;
  nom: string;
  taux_commission: number;
};

type SourceReservation = {
  id: string;
  nom: string;
};

const ReservationDetailsDialog: React.FC<ReservationDetailsDialogProps> = ({ reservationId, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [proprietes, setProprietes] = useState<Propriete[]>([]);
  const [sources, setSources] = useState<SourceReservation[]>([]);
  const [initialStatus, setInitialStatus] = useState<string>('Confirmé');
  
  // Client information
  const [clientData, setClientData] = useState<Client | null>(null);
  
  // État pour le dialogue de remboursement
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [paiementsClient, setPaiementsClient] = useState<number>(0);

  // Calculated fields
  const [nombreJours, setNombreJours] = useState<number>(0);
  const [prixTotal, setPrixTotal] = useState<number>(0);
  const [resteAPayer, setResteAPayer] = useState<number>(0);
  const [montantCommission, setMontantCommission] = useState<number>(0);
  const [partProprietaire, setPartProprietaire] = useState<number>(0);

  const form = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      nom: '',
      prenom: '',
      telephone: '',
      cin_passport: '',
      id_client: '',
      id_propriete: '',
      date_arrivee: new Date(),
      date_depart: new Date(),
      prix_par_nuit: 0,
      paiement_avance: 0,
      mode_paiement: 'Espèces',
      reference: '',
      source: '',
      taux_commission: 0,
      status: 'Confirmé',
    },
  });

  const watchPrixParNuit = form.watch('prix_par_nuit');
  const watchPaiementAvance = form.watch('paiement_avance');
  const watchDateArrivee = form.watch('date_arrivee');
  const watchDateDepart = form.watch('date_depart');
  const watchTauxCommission = form.watch('taux_commission');
  const watchPropriete = form.watch('id_propriete');
  const watchStatus = form.watch('status');

  // Load reference data
  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        const [clientsData, proprietesData, sourcesData] = await Promise.all([
          supabase.from('clients').select('id, nom, prenom').order('nom'),
          supabase.from('proprietes').select('id, nom, taux_commission').order('nom'),
          supabase.from('sources_reservation').select('id, nom').order('nom')
        ]);

        if (clientsData.error) throw clientsData.error;
        if (proprietesData.error) throw proprietesData.error;
        if (sourcesData.error) throw sourcesData.error;

        setClients(clientsData.data || []);
        setProprietes(proprietesData.data || []);
        setSources(sourcesData.data || []);

      } catch (error) {
        console.error("Error loading reference data:", error);
        toast.error("Erreur lors du chargement des données de référence");
      }
    };

    fetchReferenceData();
  }, []);

  // Load reservation data
  useEffect(() => {
    const fetchReservation = async () => {
      if (!reservationId) return;
      
      setLoading(true);
      try {
        // Récupérer les détails de la réservation
        const { data, error } = await supabase
          .from('reservations')
          .select('*')
          .eq('id', reservationId)
          .single();
          
        if (error) throw error;
        if (!data) throw new Error("Réservation non trouvée");
        
        setInitialStatus(data.status || 'Confirmé');
        
        // Récupérer les informations client
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('id, nom, prenom, telephone, cin_passport')
          .eq('id', data.id_client)
          .single();
          
        if (clientError) throw clientError;
        if (!clientData) throw new Error("Client non trouvé");
        
        setClientData(clientData);
        
        form.reset({
          // Client fields
          nom: clientData.nom || '',
          prenom: clientData.prenom || '',
          telephone: clientData.telephone || '',
          cin_passport: clientData.cin_passport || '',
          
          // Reservation fields
          id_client: data.id_client,
          id_propriete: data.id_propriete,
          date_arrivee: parseISO(data.date_arrivee),
          date_depart: parseISO(data.date_depart),
          prix_par_nuit: data.prix_par_nuit,
          paiement_avance: data.paiement_avance,
          mode_paiement: data.mode_paiement,
          reference: data.reference || '',
          source: data.source,
          taux_commission: data.taux_commission,
          status: data.status || 'Confirmé',
        });
        
        // Récupérer le montant total des paiements effectués par le client pour cette réservation
        const { data: paiements, error: erreurPaiements } = await supabase
          .from('reglements_clients')
          .select('montant')
          .eq('id_reservation', reservationId);
          
        if (!erreurPaiements && paiements) {
          const totalPaiements = paiements.reduce((sum, p) => sum + Number(p.montant || 0), 0);
          setPaiementsClient(totalPaiements);
        }
        
      } catch (error) {
        console.error("Error fetching reservation:", error);
        toast.error("Erreur lors du chargement de la réservation");
      } finally {
        setLoading(false);
      }
    };

    fetchReservation();
  }, [reservationId, form]);

  // Update calculated fields
  useEffect(() => {
    let jours = 0;
    if (watchDateArrivee && watchDateDepart) {
      jours = differenceInDays(watchDateDepart, watchDateArrivee);
      if (jours < 0) jours = 0;
    }
    setNombreJours(jours);

    const prixNuit = Number(watchPrixParNuit) || 0;
    const avance = Number(watchPaiementAvance) || 0;
    const taux = Number(watchTauxCommission) || 0;

    const prix = prixNuit * jours;
    setPrixTotal(prix);
    setResteAPayer(prix - avance);

    const commission = prix * (taux / 100);
    setMontantCommission(commission);
    setPartProprietaire(prix - commission);
  }, [watchDateArrivee, watchDateDepart, watchPrixParNuit, watchPaiementAvance, watchTauxCommission]);

  // Update commission rate when property changes
  useEffect(() => {
    if (watchPropriete) {
      const propriete = proprietes.find(p => p.id === watchPropriete);
      if (propriete) {
        form.setValue('taux_commission', Number(propriete.taux_commission));
      }
    }
  }, [watchPropriete, proprietes, form]);

  // Vérifier si le statut a changé vers "Annulé"
  useEffect(() => {
    if (watchStatus === 'Annulé' && initialStatus !== 'Annulé') {
      setShowRefundDialog(true);
    }
  }, [watchStatus, initialStatus]);

  // Gérer le remboursement et l'annulation
  const handleRefund = async (montantRemboursement: number, raison: string) => {
    if (!reservationId) return;
    setShowRefundDialog(false);
    
    try {
      setSubmitting(true);
      
      // Si montantRemboursement > 0, créer un enregistrement de remboursement
      if (montantRemboursement > 0) {
        const remboursement = {
          id: uuidv4(),
          date: format(new Date(), 'yyyy-MM-dd'),
          id_reservation: reservationId,
          montant: -montantRemboursement, // Montant négatif pour indiquer un remboursement
          mode_paiement: 'Remboursement',
          reference: null,
          remarque: `Remboursement suite à annulation${raison ? ': ' + raison : ''}`,
        };
        
        const { error: remboursementError } = await supabase
          .from('reglements_clients')
          .insert(remboursement);
          
        if (remboursementError) throw remboursementError;
        
        // Recalculer le montant de l'avance en déduisant le remboursement
        const avanceActuelle = Number(form.getValues('paiement_avance')) || 0;
        const nouvelleAvance = Math.max(0, avanceActuelle - montantRemboursement);
        form.setValue('paiement_avance', nouvelleAvance);
      }
      
      // Mettre à jour le statut de la réservation
      const updateData = {
        status: 'Annulé',
        paiement_avance: Number(form.getValues('paiement_avance')), // Mise à jour du paiement d'avance
        reste_a_payer: 0 // Mettre le reste à payer à 0 puisque la réservation est annulée
      };
      
      const { error: updateError } = await supabase
        .from('reservations')
        .update(updateData)
        .eq('id', reservationId);
        
      if (updateError) throw updateError;
      
      toast.success('Réservation annulée et remboursement enregistré');
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Erreur lors de l'annulation:", error);
      toast.error("Erreur lors de l'annulation de la réservation");
      // Réinitialiser le statut
      form.setValue('status', initialStatus);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (data: ReservationFormValues) => {
    if (!reservationId) return;
    
    // Si on essaie d'annuler, afficher le dialogue de remboursement
    if (data.status === 'Annulé' && initialStatus !== 'Annulé') {
      setShowRefundDialog(true);
      return;
    }
    
    setSubmitting(true);
    try {
      // Update client information
      const clientUpdateData = {
        nom: data.nom,
        prenom: data.prenom,
        telephone: data.telephone,
        cin_passport: data.cin_passport || null
      };
      
      const { error: clientError } = await supabase
        .from('clients')
        .update(clientUpdateData)
        .eq('id', data.id_client);
        
      if (clientError) throw clientError;
      
      // Update reservation data
      const updateData = {
        id_propriete: data.id_propriete,
        date_arrivee: format(data.date_arrivee, 'yyyy-MM-dd'),
        date_depart: format(data.date_depart, 'yyyy-MM-dd'),
        nombre_jours: nombreJours,
        prix_par_nuit: data.prix_par_nuit,
        prix_total: prixTotal,
        paiement_avance: data.paiement_avance,
        reste_a_payer: resteAPayer,
        mode_paiement: data.mode_paiement,
        reference: data.reference || null,
        source: data.source,
        taux_commission: data.taux_commission,
        montant_commission: montantCommission,
        part_proprietaire: partProprietaire,
        status: data.status
      };
      
      const { error } = await supabase
        .from('reservations')
        .update(updateData)
        .eq('id', reservationId);
        
      if (error) throw error;
      
      toast.success('Réservation mise à jour avec succès');
      setInitialStatus(data.status); // Mettre à jour le statut initial
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error updating reservation:", error);
      toast.error("Erreur lors de la mise à jour de la réservation");
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MAD'
    }).format(amount);
  };

  const renderStatusBadge = (status: string) => {
    if (status === 'Confirmé') {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Confirmé</Badge>;
    } else if (status === 'Annulé') {
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Annulé</Badge>;
    }
    return status;
  };

  return (
    <>
      <Dialog open={!!reservationId} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails de la réservation</DialogTitle>
            <DialogDescription>
              Consultez et modifiez les informations de la réservation.
            </DialogDescription>
          </DialogHeader>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Chargement des détails...</span>
            </div>
          ) : (
            <Form {...form}>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  form.handleSubmit(onSubmit)(e);
                }} 
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Client Information Section */}
                  <div className="col-span-2">
                    <h3 className="text-lg font-medium mb-4">Informations Client</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md bg-gray-50">
                      <FormField
                        control={form.control}
                        name="nom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="prenom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prénom</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="telephone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Téléphone</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="cin_passport"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CIN / Passport</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  {/* Hidden client ID field */}
                  <FormField
                    control={form.control}
                    name="id_client"
                    render={({ field }) => (
                      <input type="hidden" {...field} />
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut de la réservation</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un statut">
                                {renderStatusBadge(field.value)}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Confirmé">Confirmé</SelectItem>
                            <SelectItem value="Annulé">Annulé</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {initialStatus === 'Annulé' && (
                    <div className="col-span-2">
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Réservation annulée</AlertTitle>
                        <AlertDescription>
                          Cette réservation a été annulée, mais vous pouvez toujours la modifier.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                  
                  <FormField
                    control={form.control}
                    name="id_propriete"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Propriété</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner une propriété" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {proprietes.map(propriete => (
                              <SelectItem key={propriete.id} value={propriete.id}>
                                {propriete.nom}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="date_arrivee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date d'arrivée</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, 'dd/MM/yyyy', { locale: fr })
                                ) : (
                                  <span>Sélectionner une date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              locale={fr}
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="date_depart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de départ</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, 'dd/MM/yyyy', { locale: fr })
                                ) : (
                                  <span>Sélectionner une date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              locale={fr}
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="prix_par_nuit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prix par nuit (MAD)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={field.value === undefined ? "" : String(field.value)}
                            onChange={e => {
                              const val = e.target.value;
                              field.onChange(val === '' ? undefined : Number(val));
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="paiement_avance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paiement avancé (MAD)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={field.value === undefined ? "" : String(field.value)}
                            onChange={e => {
                              const val = e.target.value;
                              field.onChange(val === '' ? undefined : Number(val));
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="mode_paiement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mode de paiement</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un mode" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Espèces">Espèces</SelectItem>
                            <SelectItem value="Virement">Virement</SelectItem>
                            <SelectItem value="Carte bancaire">Carte bancaire</SelectItem>
                            <SelectItem value="PayPal">PayPal</SelectItem>
                            <SelectItem value="Autre">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="reference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Référence</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            value={field.value || ''}
                            placeholder="Référence du paiement (optionnel)" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Source</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner une source" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {sources.map(src => (
                              <SelectItem key={src.id} value={src.nom}>
                                {src.nom}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="taux_commission"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Taux de commission (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={field.value === undefined ? "" : String(field.value)}
                            onChange={e => {
                              const val = e.target.value;
                              field.onChange(val === '' ? undefined : Number(val));
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="border rounded-md p-3 bg-gray-50">
                    <div className="text-sm text-gray-500">Nombre de jours</div>
                    <div className="font-semibold text-lg">{nombreJours}</div>
                  </div>
                  <div className="border rounded-md p-3 bg-gray-50">
                    <div className="text-sm text-gray-500">Prix total</div>
                    <div className="font-semibold text-lg">{formatPrice(prixTotal)}</div>
                  </div>
                  <div className="border rounded-md p-3 bg-gray-50">
                    <div className="text-sm text-gray-500">Reste à payer</div>
                    <div className="font-semibold text-lg">{formatPrice(resteAPayer)}</div>
                  </div>
                  <div className="border rounded-md p-3 bg-gray-50">
                    <div className="text-sm text-gray-500">Commission</div>
                    <div className="font-semibold text-lg">{formatPrice(montantCommission)}</div>
                  </div>
                  <div className="border rounded-md p-3 bg-gray-50">
                    <div className="text-sm text-gray-500">Part propriétaire</div>
                    <div className="font-semibold text-lg">{formatPrice(partProprietaire)}</div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enregistrement...
                    </> : 'Enregistrer les modifications'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
      
      <RefundDialog 
        isOpen={showRefundDialog}
        onClose={() => setShowRefundDialog(false)}
        onConfirm={handleRefund}
        maxAmount={paiementsClient}
      />
    </>
  );
};

export default ReservationDetailsDialog;
