
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { fr } from "date-fns/locale/fr";
import { CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { useQuery } from "@tanstack/react-query";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// Schéma de validation pour le formulaire
const formSchema = z.object({
  id_propriete: z.string({
    required_error: "Veuillez sélectionner une propriété",
  }),
  type_depense: z.string({
    required_error: "Veuillez sélectionner un type de dépense",
  }),
  nature: z.string({
    required_error: "Veuillez sélectionner une nature",
  }),
  date: z.date({
    required_error: "Veuillez sélectionner une date",
  }),
  montant: z.coerce.number().min(0.01, "Le montant doit être supérieur à 0"),
  mode_paiement: z.string({
    required_error: "Veuillez sélectionner un mode de paiement",
  }),
  reference: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// Fonctions pour récupérer les données
const fetchProprietes = async () => {
  const { data, error } = await supabase
    .from("proprietes")
    .select("id, nom")
    .order("nom");
  
  if (error) throw error;
  return data;
};

const fetchTypesDepenses = async () => {
  const { data, error } = await supabase
    .from("types_depenses")
    .select("id, nom")
    .order("nom");
  
  if (error) throw error;
  return data;
};

export default function AjouterDepenseForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Récupération des données pour les listes déroulantes
  const { data: proprietes = [], isLoading: isLoadingProprietes } = useQuery({
    queryKey: ["proprietes"],
    queryFn: fetchProprietes,
  });

  const { data: typesDepenses = [], isLoading: isLoadingTypesDepenses } = useQuery({
    queryKey: ["typesDepenses"],
    queryFn: fetchTypesDepenses,
  });

  // Initialisation du formulaire avec React Hook Form et Zod
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      montant: undefined,
      reference: "",
    },
  });

  // Soumission du formulaire
  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);
      
      // Chercher le nom du type de dépense sélectionné
      const typeDepenseNom = typesDepenses.find(
        (type) => type.id === values.type_depense
      )?.nom;

      // Insertion dans la base de données
      const { error } = await supabase.from("depenses").insert({
        id_propriete: values.id_propriete,
        type_depense: typeDepenseNom,
        nature: values.nature,
        date: format(values.date, "yyyy-MM-dd"),
        montant: values.montant,
        mode_paiement: values.mode_paiement,
        reference: values.reference || null,
      });

      if (error) throw error;

      // Notification de succès
      toast({
        title: "Dépense enregistrée",
        description: "La dépense a été enregistrée avec succès",
      });

      // Réinitialisation du formulaire
      form.reset({
        id_propriete: "",
        type_depense: "",
        nature: "",
        date: new Date(),
        montant: undefined, // Changed from empty string to undefined
        mode_paiement: "",
        reference: "",
      });
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit(onSubmit)(e);
        }} 
        className="space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Propriété */}
          <FormField
            control={form.control}
            name="id_propriete"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Propriété</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une propriété" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isLoadingProprietes ? (
                      <SelectItem value="loading" disabled>
                        Chargement...
                      </SelectItem>
                    ) : (
                      proprietes.map((prop) => (
                        <SelectItem key={prop.id} value={prop.id}>
                          {prop.nom}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Type de dépense */}
          <FormField
            control={form.control}
            name="type_depense"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type de dépense</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isLoadingTypesDepenses ? (
                      <SelectItem value="loading" disabled>
                        Chargement...
                      </SelectItem>
                    ) : (
                      typesDepenses.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.nom}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Nature */}
          <FormField
            control={form.control}
            name="nature"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nature</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une nature" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="remboursable">Remboursable</SelectItem>
                    <SelectItem value="non remboursable">
                      Non remboursable
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Date */}
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Date de la dépense</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "dd/MM/yyyy", { locale: fr })
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
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Montant */}
          <FormField
            control={form.control}
            name="montant"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Montant</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value;
                      field.onChange(value === "" ? undefined : value);
                    }}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Mode de paiement */}
          <FormField
            control={form.control}
            name="mode_paiement"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mode de paiement</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un mode" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="espèces">Espèces</SelectItem>
                    <SelectItem value="carte">Carte bancaire</SelectItem>
                    <SelectItem value="virement">Virement</SelectItem>
                    <SelectItem value="chèque">Chèque</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Référence */}
          <FormField
            control={form.control}
            name="reference"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Référence (facultatif)</FormLabel>
                <FormControl>
                  <Input placeholder="Référence du paiement" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? "Enregistrement..." : "Enregistrer la dépense"}
        </Button>
      </form>
    </Form>
  );
}
