
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
import { Checkbox } from "@/components/ui/checkbox";
import { BilanPropriete, Virement } from "@/types/proprietaires";
import { cn } from "@/lib/utils";

interface FormulaireVirementProps {
  propriete: BilanPropriete;
  onSubmit: (virement: Virement) => void;
  onCancel: () => void;
}

const virementSchema = z.object({
  id_propriete: z.string().uuid(),
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
}

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD" }).format(n);

const FormulaireVirement: React.FC<FormulaireVirementProps> = ({
  propriete,
  onSubmit,
  onCancel,
}) => {
  const [montantDepasse, setMontantDepasse] = useState(false);
  const [reservations, setReservations] = useState<ReservationOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(true);

  const form = useForm<VirementFormValues>({
    resolver: zodResolver(virementSchema),
    defaultValues: {
      id_propriete: propriete.id,
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
    setLoadingReservations(true);
    try {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, date_arrivee, date_depart, part_proprietaire")
        .eq("id_propriete", propriete.id)
        .neq("status", "Annulé")
        .eq("is_blocked", false)
        .gt("part_proprietaire", 0)
        .order("date_arrivee", { ascending: false });

      if (error) throw error;

      // Récupérer les IDs des virements de cette propriété
      const { data: virData } = await supabase
        .from("virements_proprietaires")
        .select("id")
        .eq("id_propriete", propriete.id);

      const virIds = (virData ?? []).map((v) => v.id);

      // Récupérer les réservations déjà liées à un virement
      let paidIds = new Set<string>();
      if (virIds.length > 0) {
        const { data: jData } = await supabase
          .from("virement_reservations")
          .select("id_reservation")
          .in("id_virement", virIds);
        paidIds = new Set((jData ?? []).map((j) => j.id_reservation));
      }

      // Garder uniquement les réservations non encore payées
      setReservations((data ?? []).filter((r) => !paidIds.has(r.id)));
    } catch (err) {
      console.error("Erreur lors du chargement des réservations:", err);
    } finally {
      setLoadingReservations(false);
    }
  };

  const totalSelected = reservations
    .filter((r) => selectedIds.includes(r.id))
    .reduce((sum, r) => sum + (r.part_proprietaire ?? 0), 0);

  const handleToggle = (id: string, checked: boolean) => {
    const next = checked
      ? [...selectedIds, id]
      : selectedIds.filter((s) => s !== id);
    setSelectedIds(next);

    const total = reservations
      .filter((r) => next.includes(r.id))
      .reduce((sum, r) => sum + (r.part_proprietaire ?? 0), 0);
    form.setValue("montant", total);
    setMontantDepasse(total > propriete.soldeDisponible);
  };

  const handleSelectAll = () => {
    const allIds = reservations.map((r) => r.id);
    const next = selectedIds.length === reservations.length ? [] : allIds;
    setSelectedIds(next);
    const total = next.length > 0
      ? reservations.reduce((sum, r) => sum + (r.part_proprietaire ?? 0), 0)
      : 0;
    form.setValue("montant", total);
    setMontantDepasse(total > propriete.soldeDisponible);
  };

  const handleMontantChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      form.setValue("montant", val);
      setMontantDepasse(val > propriete.soldeDisponible);
    }
  };

  const onFormSubmit = (data: VirementFormValues) => {
    if (data.montant > propriete.soldeDisponible) {
      setMontantDepasse(true);
      return;
    }

    onSubmit({
      id: crypto.randomUUID(),
      id_propriete: data.id_propriete,
      id_reservations: selectedIds.length > 0 ? selectedIds : undefined,
      date: data.date,
      montant: data.montant,
      mode_paiement: data.mode_paiement,
      reference: data.reference || "",
      remarque: data.remarque || "",
    });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">
        Effectuer un virement pour {propriete.nom}
      </h3>

      {/* Récapitulatif */}
      <div className="bg-muted/50 p-3 rounded-md">
        <p className="text-sm font-medium mb-2">Récapitulatif</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Propriétaire :</div>
          <div className="font-medium">{propriete.nom_proprietaire}</div>
          <div>Montant total à verser :</div>
          <div className="font-medium">{fmt(propriete.montantTotalAVerser)}</div>
          <div>Dépenses remboursables :</div>
          <div className="font-medium text-orange-600">
            {fmt(propriete.depensesRemboursables)}
          </div>
          <div>Montant déjà versé :</div>
          <div className="font-medium">{fmt(propriete.montantDejaVerse)}</div>
          <div>Solde disponible :</div>
          <div className={`font-medium ${propriete.soldeDisponible > 0 ? "text-green-600" : "text-red-600"}`}>
            {fmt(propriete.soldeDisponible)}
          </div>
        </div>
      </div>

      {/* Sélection des réservations */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            Réservations incluses dans ce virement
          </label>
          {reservations.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={handleSelectAll}>
              {selectedIds.length === reservations.length
                ? "Tout désélectionner"
                : "Tout sélectionner"}
            </Button>
          )}
        </div>

        {loadingReservations ? (
          <div className="text-sm text-muted-foreground p-3">Chargement…</div>
        ) : reservations.length === 0 ? (
          <div className="text-sm text-muted-foreground p-3 border rounded-md">
            Toutes les réservations ont déjà été réglées, ou il n'y en a aucune
            avec une part propriétaire.
          </div>
        ) : (
          <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
            {reservations.map((r) => (
              <label
                key={r.id}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 select-none"
              >
                <Checkbox
                  checked={selectedIds.includes(r.id)}
                  onCheckedChange={(checked) => handleToggle(r.id, !!checked)}
                />
                <span className="flex-1 text-sm font-medium">
                  {format(new Date(r.date_arrivee), "dd/MM/yyyy", { locale: fr })}
                  {" → "}
                  {format(new Date(r.date_depart), "dd/MM/yyyy", { locale: fr })}
                </span>
                <span className="text-sm font-semibold text-green-700">
                  {fmt(r.part_proprietaire)}
                </span>
              </label>
            ))}
          </div>
        )}

        {selectedIds.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {selectedIds.length} réservation{selectedIds.length > 1 ? "s" : ""} sélectionnée{selectedIds.length > 1 ? "s" : ""}{" "}
            — total : <span className="font-medium text-foreground">{fmt(totalSelected)}</span>
          </p>
        )}
      </div>

      {montantDepasse && (
        <Alert variant="destructive">
          <AlertTitle>Montant invalide</AlertTitle>
          <AlertDescription>
            Le montant saisi dépasse le solde disponible ({fmt(propriete.soldeDisponible)}).
            {propriete.depensesRemboursables > 0 &&
              ` (après déduction des dépenses remboursables de ${fmt(propriete.depensesRemboursables)})`}
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
          {/* Date */}
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
                        variant="outline"
                        className={cn(
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value
                          ? format(field.value, "P", { locale: fr })
                          : <span>Sélectionner une date</span>}
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

          {/* Montant */}
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
                    value={Number.isFinite(field.value as number) ? (field.value as number) : 0}
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
                  {selectedIds.length > 0
                    ? <>Total des réservations sélectionnées : <strong>{fmt(totalSelected)}</strong></>
                    : <>Maximum disponible : <strong>{fmt(propriete.soldeDisponible)}</strong></>}
                </FormDescription>
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

          {/* Référence */}
          <FormField
            control={form.control}
            name="reference"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Référence</FormLabel>
                <FormControl>
                  <Input placeholder="Référence du virement" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Remarque */}
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
