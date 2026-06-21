
import React, { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { BilanPropriete, Virement } from "@/types/proprietaires";
import { cn } from "@/lib/utils";

interface FormulaireVirementProps {
  propriete: BilanPropriete;
  onSubmit: (virement: Virement) => void;
  onCancel: () => void;
}

const virementSchema = z.object({
  id_propriete: z.string().uuid(),
  id_reservation: z.string().uuid().optional(),
  date: z.date(),
  montant: z.number().positive().min(0.01),
  mode_paiement: z.string().min(1, "Veuillez sélectionner un mode de paiement"),
  reference: z.string().optional(),
  remarque: z.string().optional(),
});

type VirementFormValues = z.infer<typeof virementSchema>;

interface ReservationOption {
  id: string;
  date_arrivee: string;
  date_depart: string;
  part_proprietaire: number;
  proprietesNom?: string;
}

const FormulaireVirement: React.FC<FormulaireVirementProps> = ({
  propriete,
  onSubmit,
  onCancel,
}) => {
  const [montantDepasse, setMontantDepasse] = useState(false);
  const [reservations, setReservations] = useState<ReservationOption[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<ReservationOption | null>(null);
  
  const form = useForm<VirementFormValues>({
    resolver: zodResolver(virementSchema),
    defaultValues: {
      id_propriete: propriete.id,
      id_reservation: "general",
      date: new Date(),
      montant: 0,
      mode_paiement: "",
      reference: "",
      remarque: "",
    },
  });

  useEffect(() => {
    fetchReservations();
  }, [propriete.id]);

  const fetchReservations = async () => {
    try {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, date_arrivee, date_depart, part_proprietaire, proprietes!inner(nom)")
        .eq("id_propriete", propriete.id)
        .neq("status", "Annulé")
        .gt("part_proprietaire", 0)
        .order("date_arrivee", { ascending: false });

      if (error) throw error;

      // Get existing virements for this property
      const { data: virementsData, error: virementsError } = await supabase
        .from("virements_proprietaires")
        .select("id_reservation, montant")
        .eq("id_propriete", propriete.id)
        .not("id_reservation", "is", null);

      if (virementsError) throw virementsError;

      // Filter out fully paid reservations
      const formattedReservations = data
        .map((res: any) => ({
          id: res.id,
          date_arrivee: res.date_arrivee,
          date_depart: res.date_depart,
          part_proprietaire: res.part_proprietaire,
          proprietesNom: res.proprietes?.nom || propriete.nom,
        }))
        .filter((reservation) => {
          // Calculate total paid for this specific reservation
          const totalPaid = virementsData
            .filter(v => v.id_reservation === reservation.id)
            .reduce((sum, v) => sum + (Number(v.montant) || 0), 0);
          
          // Only show reservations that haven't been fully paid
          return totalPaid < reservation.part_proprietaire;
        });

      setReservations(formattedReservations);
    } catch (error) {
      console.error("Erreur lors du chargement des réservations:", error);
    }
  };

  const handleMontantChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const montant = parseFloat(e.target.value);
    if (!isNaN(montant)) {
      const maxAmount = selectedReservation ? selectedReservation.part_proprietaire : propriete.soldeDisponible;
      setMontantDepasse(montant > maxAmount);
      form.setValue("montant", montant);
    }
  };

  const handleReservationChange = (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    setSelectedReservation(reservation || null);
    
    if (reservation) {
      // Auto-fill the amount with the owner's share
      form.setValue("montant", reservation.part_proprietaire);
      setMontantDepasse(false);
    } else {
      form.setValue("montant", 0);
    }
    form.setValue("id_reservation", reservationId === "general" ? "" : reservationId);
  };

  const onFormSubmit = (data: VirementFormValues) => {
    const maxAmount = selectedReservation ? selectedReservation.part_proprietaire : propriete.soldeDisponible;
    if (data.montant > maxAmount) {
      setMontantDepasse(true);
      return;
    }
    
    const newVirement: Virement = {
      id: crypto.randomUUID(),
      id_propriete: data.id_propriete,
      id_reservation: data.id_reservation || undefined,
      date: data.date,
      montant: data.montant,
      mode_paiement: data.mode_paiement,
      reference: data.reference || "",
      remarque: data.remarque || "",
    };
    
    onSubmit(newVirement);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">
        Effectuer un virement pour {propriete.nom}
      </h3>

      <div className="bg-muted/50 p-3 rounded-md">
        <p className="text-sm font-medium">Récapitulatif</p>
        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
          <div>Propriétaire:</div>
          <div className="font-medium">{propriete.nom_proprietaire}</div>
          <div>Montant total à verser:</div>
          <div className="font-medium">
            {new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "MAD",
            }).format(propriete.montantTotalAVerser)}
          </div>
          <div>Dépenses remboursables:</div>
          <div className="font-medium text-orange-600">
            {new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "MAD",
            }).format(propriete.depensesRemboursables)}
          </div>
          <div>Montant déjà versé:</div>
          <div className="font-medium">
            {new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "MAD",
            }).format(propriete.montantDejaVerse)}
          </div>
          <div>Solde disponible:</div>
          <div className={`font-medium ${propriete.soldeDisponible > 0 ? "text-green-600" : "text-red-600"}`}>
            {new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "MAD",
            }).format(propriete.soldeDisponible)}
          </div>
        </div>
      </div>

      {montantDepasse && (
        <Alert variant="destructive">
          <AlertTitle>Montant invalide</AlertTitle>
          <AlertDescription>
            {selectedReservation ? (
              <>Le montant saisi dépasse la part propriétaire de cette réservation ({new Intl.NumberFormat("fr-FR", {
                style: "currency",
                currency: "MAD",
              }).format(selectedReservation.part_proprietaire)}).</>
            ) : (
              <>Le montant saisi dépasse le solde disponible de{" "}
              {new Intl.NumberFormat("fr-FR", {
                style: "currency",
                currency: "MAD",
              }).format(propriete.soldeDisponible)}
              {propriete.depensesRemboursables > 0 && ` (après déduction des dépenses remboursables de ${new Intl.NumberFormat("fr-FR", {
                style: "currency",
                currency: "MAD",
              }).format(propriete.depensesRemboursables)})`}.</>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit(onFormSubmit)(e);
          }} 
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="id_reservation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Réservation associée (optionnel)</FormLabel>
                <Select
                  onValueChange={handleReservationChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une réservation" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="general">Virement général (sans réservation)</SelectItem>
                    {reservations.map((reservation) => (
                      <SelectItem key={reservation.id} value={reservation.id}>
                        {format(new Date(reservation.date_arrivee), "dd/MM/yyyy", { locale: fr })} - {format(new Date(reservation.date_depart), "dd/MM/yyyy", { locale: fr })} 
                        ({new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "MAD",
                        }).format(reservation.part_proprietaire)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  {selectedReservation && (
                    <div className="text-sm mt-2 p-2 bg-muted/50 rounded">
                      <p><strong>Réservation sélectionnée:</strong></p>
                      <p>Du {format(new Date(selectedReservation.date_arrivee), "dd/MM/yyyy", { locale: fr })} au {format(new Date(selectedReservation.date_depart), "dd/MM/yyyy", { locale: fr })}</p>
                      <p>Part propriétaire: {new Intl.NumberFormat("fr-FR", {
                        style: "currency",
                        currency: "MAD",
                      }).format(selectedReservation.part_proprietaire)}</p>
                    </div>
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Date du virement</FormLabel>
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
                          format(field.value, "P", { locale: fr })
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
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="montant"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Montant (MAD)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={Number.isFinite(field.value as unknown as number) ? (field.value as number) : 0}
                    onChange={(e) => {
                      handleMontantChange(e);
                      const val = parseFloat(e.target.value);
                      field.onChange(isNaN(val) ? 0 : val);
                    }}
                    className={cn(
                      montantDepasse && "border-red-500 focus-visible:ring-red-500"
                    )}
                  />
                </FormControl>
                <FormDescription>
                  {selectedReservation ? (
                    <>Maximum pour cette réservation: {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "MAD",
                    }).format(selectedReservation.part_proprietaire)}</>
                  ) : (
                    <>Maximum: {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "MAD",
                    }).format(propriete.soldeDisponible)}
                    {propriete.depensesRemboursables > 0 && " (après déduction des dépenses remboursables)"}</>
                  )}
                </FormDescription>
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
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un mode de paiement" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="virement">Virement bancaire</SelectItem>
                    <SelectItem value="especes">Espèces</SelectItem>
                    <SelectItem value="cheque">Chèque</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
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
                    placeholder="Référence du virement"
                    {...field}
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
                <FormLabel>Remarque (optionnel)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Remarque ou commentaire sur le virement"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={montantDepasse || form.formState.isSubmitting}
            >
              Enregistrer le virement
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default FormulaireVirement;
