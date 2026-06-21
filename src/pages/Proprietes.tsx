
import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectTrigger, SelectValue, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ListeProprietes, { Propriete } from '@/components/proprietes/ListeProprietes';

// Schéma de validation pour le formulaire de propriété
const proprieteSchema = z.object({
  nom: z.string().min(1, {
    message: 'Le nom est requis'
  }),
  nom_proprietaire: z.string().min(1, {
    message: 'Le nom du propriétaire est requis'
  }),
  contact_proprietaire: z.string().min(1, {
    message: 'Le contact du propriétaire est requis'
  }),
  adresse: z.string().min(1, {
    message: "L'adresse est requise"
  }),
  nom_residence: z.string().optional(),
  type_appartement: z.string().min(1, {
    message: "Le type d'appartement est requis"
  }),
  groupe: z.string().optional(),
  taux_commission: z.coerce.number().min(0, {
    message: 'Le taux doit être positif'
  }).max(100, {
    message: 'Le taux ne peut pas dépasser 100%'
  }),
  autre_info: z.string().optional()
});
type ProprietesFormValues = z.infer<typeof proprieteSchema>;

const Proprietes = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("ajouter");

  // State pour listes déroulantes dynamiques
  const [residences, setResidences] = useState<{ id: string, nom: string }[]>([]);
  const [types, setTypes] = useState<{ id: string, nom: string }[]>([]);
  const [groupes, setGroupes] = useState<{ id: string, nom: string }[]>([]);

  useEffect(() => {
    // Charger valeurs depuis Supabase pour les dropdowns
    const fetchDropdowns = async () => {
      try {
        const [{ data: nomsResidences }, { data: typesAppart }, { data: groupesProp }] = await Promise.all([
          supabase.from('noms_residences').select('id, nom').order('nom'),
          supabase.from('types_appartements').select('id, nom').order('nom'),
          supabase.from('groupes_proprietes').select('id, nom').order('nom')
        ]);
        setResidences(nomsResidences ?? []);
        setTypes(typesAppart ?? []);
        setGroupes(groupesProp ?? []);
      } catch (error) {
        toast.error('Impossible de charger les listes');
      }
    };
    fetchDropdowns();
  }, []);

  // Initialiser le formulaire avec les valeurs par défaut
  const form = useForm<ProprietesFormValues>({
    resolver: zodResolver(proprieteSchema),
    defaultValues: {
      nom: '',
      nom_proprietaire: '',
      contact_proprietaire: '',
      adresse: '',
      nom_residence: '',
      type_appartement: '',
      groupe: '',
      taux_commission: 0,
      autre_info: ''
    }
  });

  const onSubmit = async (data: ProprietesFormValues) => {
    setIsSubmitting(true);
    try {
      if (currentId) {
        // Mode édition
        const { error } = await supabase
          .from('proprietes')
          .update(data)
          .eq('id', currentId);
        
        if (error) throw error;
        toast.success('Propriété mise à jour avec succès');
      } else {
        // Mode création
        const id = uuidv4();
        const { error } = await supabase
          .from('proprietes')
          .insert({ id, ...data });
        
        if (error) throw error;
        toast.success('Propriété ajoutée avec succès');
      }
      form.reset();
      setCurrentId(null);
    } catch (error) {
      console.error("Erreur lors de l'opération:", error);
      toast.error("Erreur lors de l'enregistrement de la propriété");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (propriete: Propriete) => {
    setCurrentId(propriete.id);
    form.reset({
      nom: propriete.nom,
      nom_proprietaire: propriete.nom_proprietaire,
      contact_proprietaire: propriete.contact_proprietaire,
      adresse: propriete.adresse,
      nom_residence: propriete.nom_residence || '',
      type_appartement: propriete.type_appartement,
      groupe: propriete.groupe || '',
      taux_commission: propriete.taux_commission,
      autre_info: propriete.autre_info || ''
    });
  };

  // Nouvelle fonction pour gérer le clic sur le bouton modifier dans le tableau
  const handleEditClick = (propriete: Propriete) => {
    handleEdit(propriete);
    setActiveTab("ajouter");
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6 text-progest-primary">Gestion des Propriétés</h1>
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="ajouter">
                {currentId ? "Modifier la propriété" : "Ajouter une propriété"}
              </TabsTrigger>
              <TabsTrigger value="liste" onClick={() => {
                if (currentId) {
                  setCurrentId(null);
                  form.reset();
                }
              }}>
                Liste des propriétés
              </TabsTrigger>
            </TabsList>
            <TabsContent value="ajouter">
              <Form {...form}>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    form.handleSubmit(onSubmit)(e);
                  }} 
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="nom" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de la propriété</FormLabel>
                        <FormControl>
                          <Input placeholder="Nom de la propriété" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="nom_proprietaire" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom du propriétaire</FormLabel>
                        <FormControl>
                          <Input placeholder="Nom du propriétaire" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="contact_proprietaire" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact du propriétaire</FormLabel>
                        <FormControl>
                          <Input placeholder="Téléphone ou email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="adresse" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adresse</FormLabel>
                        <FormControl>
                          <Input placeholder="Adresse complète" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {/* Nom de la résidence - Dropdown lié à noms_residences */}
                    <FormField control={form.control} name="nom_residence" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de la résidence</FormLabel>
                        <Select
                          value={field.value || ""}
                          onValueChange={(value) => form.setValue("nom_residence", value)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner une résidence (optionnel)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {residences.map(option => (
                              <SelectItem key={option.id} value={option.nom}>{option.nom}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {/* Type d'appartement - Dropdown lié à types_appartements */}
                    <FormField control={form.control} name="type_appartement" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type d'appartement</FormLabel>
                        <Select
                          value={field.value || ""}
                          onValueChange={(value) => form.setValue("type_appartement", value)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un type d'appartement" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {types.map(option => (
                              <SelectItem key={option.id} value={option.nom}>{option.nom}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {/* Groupe - Dropdown lié à groupes_proprietes */}
                    <FormField control={form.control} name="groupe" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Groupe</FormLabel>
                        <Select
                          value={field.value || ""}
                          onValueChange={(value) => form.setValue("groupe", value)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un groupe (optionnel)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {groupes.map(option => (
                              <SelectItem key={option.id} value={option.nom}>{option.nom}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="taux_commission" render={({ field }) => (
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
                              // Accepter uniquement vide ou nombre
                              field.onChange(val === '' ? undefined : Number(val));
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="autre_info" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Autres informations</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Informations supplémentaires (optionnel)" className="min-h-32" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="flex gap-4">
                    <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
                      {isSubmitting ? 'Enregistrement...' : currentId ? 'Mettre à jour' : 'Ajouter la propriété'}
                    </Button>
                    {currentId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setCurrentId(null);
                          form.reset();
                        }}
                        className="w-full md:w-auto"
                      >
                        Annuler
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </TabsContent>
            <TabsContent value="liste">
              <ListeProprietes onEdit={handleEdit} onEditClick={handleEditClick} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Proprietes;
