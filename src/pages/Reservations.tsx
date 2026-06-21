import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, FileText, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReservationsList from '@/components/reservations/ReservationsList';
import ReservationsCalendar from '@/components/reservations/ReservationsCalendar';
import CalendarFilters from '@/components/reservations/CalendarFilters';
import ContractGenerator from '@/components/reservations/ContractGenerator';
import ReceiptGenerator from '@/components/reservations/ReceiptGenerator';
import WeeklyOverview from '@/components/reservations/WeeklyOverview';

type Propriete = {
  id: string;
  nom: string;
  taux_commission: number;
  nom_residence?: string;
  type_appartement?: string;
};
type SourceReservation = { id: string, nom: string };

const reservationSchema = z.object({
  nom: z.string().min(1, { message: 'Le nom est requis' }),
  prenom: z.string().min(1, { message: 'Le prénom est requis' }),
  telephone: z.string().min(1, { message: 'Le téléphone est requis' }),
  cin_passport: z.string().optional(),
  autre_info: z.string().optional(),

  id_propriete: z.string().min(1, { message: 'Veuillez sélectionner une propriété' }),
  source: z.string().min(1, { message: 'La source est requise' }),
  date_arrivee: z.date({ required_error: "La date d'arrivée est requise" }),
  date_depart: z.date({ required_error: "La date de départ est requise" }),
  prix_par_nuit: z.coerce.number().min(0.01, { message: 'Le prix par nuit doit être supérieur à 0' }),
  paiement_avance: z.coerce.number().min(0, { message: 'Le paiement avancé doit être positif' }),
  mode_paiement: z.string().min(1, { message: 'Le mode de paiement est requis' }),
  reference: z.string().optional(),
  taux_commission: z.coerce.number().min(0, { message: 'Le taux doit être positif' }),

  remarque: z.string().optional(),
}).refine(data => data.date_depart > data.date_arrivee, {
  message: "La date de départ doit être postérieure à la date d'arrivée",
  path: ['date_depart'],
});

type ReservationFormValues = z.infer<typeof reservationSchema>;

const Reservations = () => {
  const [activeTab, setActiveTab] = useState<string>("ajout");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proprietes, setProprietes] = useState<Propriete[]>([]);
  const [sources, setSources] = useState<SourceReservation[]>([]);

  const [nombreJours, setNombreJours] = useState<number>(0);
  const [prixTotal, setPrixTotal] = useState<number>(0);
  const [resteAPayer, setResteAPayer] = useState<number>(0);
  const [montantCommission, setMontantCommission] = useState<number>(0);
  const [partProprietaire, setPartProprietaire] = useState<number>(0);

  const today = new Date();

  const form = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      nom: '',
      prenom: '',
      telephone: '',
      cin_passport: '',
      autre_info: '',
      id_propriete: '',
      source: '',
      date_arrivee: undefined,
      date_depart: undefined,
      prix_par_nuit: 0,
      paiement_avance: 0,
      mode_paiement: '',
      reference: '',
      taux_commission: 0,
      remarque: '',
    },
  });

  const watchPrixParNuit = form.watch('prix_par_nuit');
  const watchPaiementAvance = form.watch('paiement_avance');
  const watchDateArrivee = form.watch('date_arrivee');
  const watchDateDepart = form.watch('date_depart');
  const watchTauxCommission = form.watch('taux_commission');
  const watchPropriete = form.watch('id_propriete');

  const [showContract, setShowContract] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    const fetchProprietes = async () => {
      try {
        const { data, error } = await supabase
          .from('proprietes')
          .select('id, nom, taux_commission, nom_residence, type_appartement')
          .order('nom');
        if (error) throw error;
        setProprietes(data || []);
      } catch (error) {
        console.error('Erreur lors du chargement des propriétés:', error);
        toast.error('Impossible de charger les propriétés');
      }
    };
    fetchProprietes();

    const fetchSources = async () => {
      try {
        const { data, error } = await supabase
          .from('sources_reservation')
          .select('id, nom')
          .order('nom');
        if (error) throw error;
        setSources(data ?? []);
      } catch (error) {
        toast.error('Impossible de charger les sources de réservation');
      }
    };
    fetchSources();
  }, []);

  useEffect(() => {
    if (watchPropriete) {
      const propriete = proprietes.find(p => p.id === watchPropriete);
      if (propriete) {
        form.setValue('taux_commission', Number(propriete.taux_commission));
      }
    }
  }, [watchPropriete, proprietes, form]);

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

  const [filterOptions, setFilterOptions] = useState<{
    nomsResidences: { id: string; nom: string }[];
    typesAppartements: { id: string; nom: string }[];
    groupes: { id: string; nom: string }[];
  }>({ nomsResidences: [], typesAppartements: [], groupes: [] });

  const [calendarFilters, setCalendarFilters] = useState<{
    nomResid: string | undefined;
    type: string | undefined;
    groupe: string | undefined;
    search: string;
  }>({ nomResid: undefined, type: undefined, groupe: undefined, search: "" });

  useEffect(() => {
    const fetchNomsResidences = supabase
      .from('noms_residences')
      .select('id, nom').order('nom');
    const fetchTypesAppartements = supabase
      .from('types_appartements')
      .select('id, nom').order('nom');
    const fetchGroupes = supabase
      .from('groupes_proprietes')
      .select('id, nom').order('nom');
    Promise.all([
      fetchNomsResidences,
      fetchTypesAppartements,
      fetchGroupes
    ]).then(([nomsResid, typesApps, groupesData]) => {
      setFilterOptions({
        nomsResidences: nomsResid.data ?? [],
        typesAppartements: typesApps.data ?? [],
        groupes: groupesData.data ?? [],
      });
    });
  }, []);

  const [calendarProprietes, setCalendarProprietes] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("proprietes")
        .select("id, nom, nom_residence, type_appartement, groupe")
        .order("nom");
      setCalendarProprietes(data ?? []);
    })();
  }, []);

  const filteredProprietes = calendarProprietes.filter((prop) => {
    const matchesNomResid = calendarFilters.nomResid
      ? prop.nom_residence === calendarFilters.nomResid
      : true;
    const matchesType = calendarFilters.type
      ? prop.type_appartement === calendarFilters.type
      : true;
    const matchesGroupe = calendarFilters.groupe
      ? prop.groupe === calendarFilters.groupe
      : true;
    const searchLower = calendarFilters.search?.trim().toLowerCase();
    const matchesSearch = searchLower
      ? prop.nom.toLowerCase().includes(searchLower)
      : true;

    return matchesNomResid && matchesType && matchesGroupe && matchesSearch;
  });

  const onSubmit = async (data: ReservationFormValues, event?: React.BaseSyntheticEvent) => {
    if (event) {
      event.preventDefault();
    }
    setIsSubmitting(true);
    try {
      const clientId = uuidv4();
      const clientInsert = await supabase.from('clients').insert({
        id: clientId,
        nom: data.nom,
        prenom: data.prenom,
        telephone: data.telephone,
        cin_passport: data.cin_passport || null,
        autre_info: data.autre_info || null
      });
      if (clientInsert.error) throw clientInsert.error;

      const reservationId = uuidv4();
      const dateReservationStr = format(today, 'yyyy-MM-dd');

      const reservationInsert = await supabase.from('reservations').insert({
        id: reservationId,
        date_reservation: dateReservationStr,
        id_propriete: data.id_propriete,
        id_client: clientId,
        source: data.source,
        date_arrivee: format(data.date_arrivee, 'yyyy-MM-dd'),
        date_depart: format(data.date_depart, 'yyyy-MM-dd'),
        nombre_jours: nombreJours,
        prix_par_nuit: data.prix_par_nuit,
        prix_total: prixTotal,
        paiement_avance: data.paiement_avance,
        reste_a_payer: resteAPayer,
        mode_paiement: data.mode_paiement,
        reference: data.reference || null,
        taux_commission: data.taux_commission,
        montant_commission: montantCommission,
        part_proprietaire: partProprietaire,
        status: 'Confirmé' // Default status
      });
      if (reservationInsert.error) throw reservationInsert.error;

      const reglementInsert = await supabase.from('reglements_clients').insert({
        id: uuidv4(),
        date: dateReservationStr,
        id_reservation: reservationId,
        montant: data.paiement_avance,
        mode_paiement: data.mode_paiement,
        reference: data.reference || null,
        remarque: data.remarque || null
      });
      if (reglementInsert.error) throw reglementInsert.error;

      toast.success('Réservation ajoutée avec succès');
      form.reset();
      setNombreJours(0);
      setPrixTotal(0);
      setResteAPayer(0);
      setMontantCommission(0);
      setPartProprietaire(0);
    } catch (error) {
      console.error("Erreur lors de l'ajout de la réservation:", error);
      toast.error("Erreur lors de l'ajout de la réservation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSelectedPropertyData = () => {
    const selectedProperty = proprietes.find(p => p.id === form.getValues('id_propriete'));
    return {
      nom: selectedProperty?.nom || '',
      nom_residence: selectedProperty?.nom_residence || '',
      type_appartement: selectedProperty?.type_appartement || '',
    };
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Gestion des Réservations</h1>
      <Tabs defaultValue="ajout" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="calendrier">Calendrier</TabsTrigger>
          <TabsTrigger value="vue-hebdomadaire">Vue Hebdomadaire</TabsTrigger>
          <TabsTrigger value="liste">Liste des réservations</TabsTrigger>
          <TabsTrigger value="ajout">Ajouter une réservation</TabsTrigger>
        </TabsList>

        <TabsContent value="calendrier">
          <Card>
            <CardHeader>
              <CardTitle>Calendrier des réservations</CardTitle>
              <CardDescription>
                Visualisez les réservations sur un calendrier.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CalendarFilters
                nomsResidences={filterOptions.nomsResidences}
                typesAppartements={filterOptions.typesAppartements}
                groupes={filterOptions.groupes}
                onChange={setCalendarFilters}
              />
              <React.Suspense fallback={<div>Chargement du calendrier...</div>}>
                <ReservationsCalendar
                  onlyProprietes={filteredProprietes}
                />
              </React.Suspense>
              {filteredProprietes.length === 0 && (
                <div className="text-center text-lg font-semibold text-red-600 py-12">
                  Aucun appartement ne correspond à votre sélection. Veuillez ajuster vos filtres.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vue-hebdomadaire">
          <Card>
            <CardHeader>
              <CardTitle>Vue hebdomadaire des réservations</CardTitle>
              <CardDescription>
                Visualisez les réservations par semaine pour planifier le nettoyage et la préparation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CalendarFilters
                nomsResidences={filterOptions.nomsResidences}
                typesAppartements={filterOptions.typesAppartements}
                groupes={filterOptions.groupes}
                onChange={setCalendarFilters}
              />
              <div className="mt-4">
                <WeeklyOverview onlyProprietes={filteredProprietes} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="liste">
          <Card>
            <CardHeader>
              <CardTitle>Liste des réservations</CardTitle>
              <CardDescription>
                Consultez et gérez toutes les réservations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReservationsList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ajout">
          <Card>
            <CardHeader>
              <CardTitle>Ajouter une réservation</CardTitle>
              <CardDescription>
                Complétez le formulaire ci-dessous pour ajouter une nouvelle réservation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    form.handleSubmit(onSubmit)(e);
                  }} 
                  className="space-y-8"
                >
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-violet-800">Informations Client</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="nom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom</FormLabel>
                            <FormControl>
                              <Input placeholder="Nom du client" {...field} />
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
                              <Input placeholder="Prénom du client" {...field} />
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
                              <Input placeholder="Numéro de téléphone" {...field} />
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
                            <FormLabel>CIN / Passeport</FormLabel>
                            <FormControl>
                              <Input placeholder="Numéro de CIN ou passeport (optionnel)" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="autre_info"
                      render={({ field }) => (
                        <FormItem className="mt-6">
                          <FormLabel>Autres informations</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Informations supplémentaires (optionnel)"
                              className="min-h-20"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-violet-800">Détails de la Réservation</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                {proprietes.map((propriete) => (
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

                      <div className="flex items-center gap-4">
                        <FormLabel className="mt-2">Date de réservation</FormLabel>
                        <div className="border rounded-md px-3 py-2 bg-gray-50">{format(today, 'dd/MM/yyyy')}</div>
                      </div>

                      <div className="col-span-1"></div>

                      <FormField
                        control={form.control}
                        name="date_arrivee"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Date d'arrivée</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
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
                          <FormItem className="flex flex-col">
                            <FormLabel>Date de départ</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
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
                                placeholder="Ex: 500"
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
                                placeholder="Ex: 200"
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
                              <Input placeholder="Référence du paiement (optionnel)" {...field} />
                            </FormControl>
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
                                placeholder="Ex: 15"
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

                      <FormField
                        control={form.control}
                        name="remarque"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Remarque (paiement)</FormLabel>
                            <FormControl>
                              <Input placeholder="Remarque sur le paiement (optionnel)" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-violet-800">Valeurs Calculées</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      <div className="border rounded-md p-3 bg-gray-50">
                        <div className="text-sm text-gray-500">Nombre de jours</div>
                        <div className="font-semibold text-lg">{nombreJours || 0}</div>
                      </div>
                      <div className="border rounded-md p-3 bg-gray-50">
                        <div className="text-sm text-gray-500">Prix total (MAD)</div>
                        <div className="font-semibold text-lg">{prixTotal.toFixed(2)}</div>
                      </div>
                      <div className="border rounded-md p-3 bg-gray-50">
                        <div className="text-sm text-gray-500">Reste à payer (MAD)</div>
                        <div className="font-semibold text-lg">{resteAPayer.toFixed(2)}</div>
                      </div>
                      <div className="border rounded-md p-3 bg-gray-50">
                        <div className="text-sm text-gray-500">Commission (MAD)</div>
                        <div className="font-semibold text-lg">{montantCommission.toFixed(2)}</div>
                      </div>
                      <div className="border rounded-md p-3 bg-gray-50">
                        <div className="text-sm text-gray-500">Part propriétaire (MAD)</div>
                        <div className="font-semibold text-lg">{partProprietaire.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Ajout en cours...' : 'Ajouter la réservation'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowContract(true)}
                      disabled={!form.getValues('nom') || !form.getValues('prenom')}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Créer le Contrat
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowReceipt(true)}
                      disabled={!form.getValues('nom') || !form.getValues('prenom') || !form.getValues('id_propriete')}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Générer le Récépissé
                    </Button>
                  </div>
                </form>
              </Form>

              <ContractGenerator
                isOpen={showContract}
                onClose={() => setShowContract(false)}
                data={{
                  clientNom: form.getValues('nom'),
                  clientPrenom: form.getValues('prenom'),
                  clientCinPassport: form.getValues('cin_passport') || '',
                  clientTelephone: form.getValues('telephone'),
                  dateReservation: today,
                  dateArrivee: form.getValues('date_arrivee') || today,
                  dateDepart: form.getValues('date_depart') || today,
                  nombreJours,
                  prixParNuit: Number(form.getValues('prix_par_nuit')) || 0,
                  prixTotal,
                  paiementAvance: Number(form.getValues('paiement_avance')) || 0,
                  resteAPayer
                }}
              />
              
              <ReceiptGenerator
                isOpen={showReceipt}
                onClose={() => setShowReceipt(false)}
                data={{
                  clientNom: form.getValues('nom'),
                  clientPrenom: form.getValues('prenom'),
                  clientTelephone: form.getValues('telephone'),
                  proprieteNom: getSelectedPropertyData().nom,
                  residenceNom: getSelectedPropertyData().nom_residence,
                  typeAppartement: getSelectedPropertyData().type_appartement,
                  dateArrivee: form.getValues('date_arrivee') || today,
                  dateDepart: form.getValues('date_depart') || today,
                  nombreJours,
                  prixParNuit: Number(form.getValues('prix_par_nuit')) || 0,
                  prixTotal,
                  paiementAvance: Number(form.getValues('paiement_avance')) || 0,
                  resteAPayer
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reservations;
