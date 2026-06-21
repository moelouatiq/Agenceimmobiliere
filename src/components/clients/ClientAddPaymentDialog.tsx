
import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

type Props = {
  client: {id: string; nom: string; prenom: string} | null;
  onClose: () => void;
  onPaid: () => void;
};

type Reservation = {
  id: string;
  proprietes: { nom: string };
  date_arrivee: string;
  reste_a_payer: number;
};

const fallbackModeOptions = [
  "Espèces",
  "Chèque",
  "Virement bancaire",
  "Carte bancaire",
  "Paiement mobile"
];

const ClientAddPaymentDialog: React.FC<Props> = ({ client, onClose, onPaid }) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [reservationId, setReservationId] = useState<string>("");
  const [montant, setMontant] = useState<string>("");
  const [modePaiement, setModePaiement] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [remarque, setRemarque] = useState<string>("");
  const [modeOptions, setModeOptions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Lookup for reste à payer of selected reservation
  const selectedReservation = useMemo(
    () => reservations.find(r => r.id === reservationId) || null,
    [reservations, reservationId]
  );

  useEffect(() => {
    if (!client) {
      setReservations([]);
      setReservationId("");
      setMontant("");
      setModePaiement("");
      return;
    }
    setLoading(true);
    supabase
      .from("reservations")
      .select("id, proprietes(nom), date_arrivee, reste_a_payer")
      .eq("id_client", client.id)
      .gt("reste_a_payer", 0)
      .neq("status", "Annulé") // Exclure les réservations annulées
      .then(({ data, error }) => {
        if (error) {
          toast.error("Erreur lors du chargement des réservations");
          setReservations([]);
        } else {
          const formattedData = (data || []).map((item: any) => ({
            id: item.id,
            proprietes: { nom: item.proprietes?.nom || "Propriété inconnue" },
            date_arrivee: item.date_arrivee,
            reste_a_payer: item.reste_a_payer
          }));
          setReservations(formattedData);
        }
        setLoading(false);
      });

    supabase
      .from("modes_paiement")
      .select("nom")
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          setModeOptions(fallbackModeOptions);
        } else {
          setModeOptions((data || []).map((m: any) => m.nom).filter((nom: string) => !!nom));
        }
      });
  }, [client]);

  // Amount input handler: block values > reste_a_payer if selectedReservation exists
  const handleMontantChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!selectedReservation) {
      setMontant(val);
      return;
    }
    const num = Number(val);
    if (num > selectedReservation.reste_a_payer) {
      toast.error(`Le montant ne peut pas dépasser le reste à payer (${selectedReservation.reste_a_payer.toLocaleString("fr-FR", { style: "currency", currency: "MAD" })})`);
    }
    setMontant(val);
  };

  const trySave = async () => {
    if (!reservationId || reservationId === "loading" || reservationId === "no-data") { 
      toast.error("Sélectionnez la réservation concernée."); 
      return; 
    }
    const montantNum = Number(montant);
    if (Number.isNaN(montantNum) || montantNum <= 0) { 
      toast.error("Montant invalide."); 
      return; 
    }
    if (!selectedReservation) {
      toast.error("Réservation sélectionnée invalide.");
      return;
    }
    if (montantNum > selectedReservation.reste_a_payer) {
      toast.error(`Le montant dépasse le reste à payer (${selectedReservation.reste_a_payer.toLocaleString("fr-FR", { style: "currency", currency: "MAD" })})`);
      return;
    }
    if (!modePaiement || modePaiement === "default") { 
      toast.error("Sélectionnez le mode de paiement."); 
      return; 
    }
    setSubmitting(true);
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase
      .from("reglements_clients")
      .insert([{
        id_reservation: reservationId,
        montant: montantNum,
        mode_paiement: modePaiement,
        reference: reference || null,
        remarque: remarque || null,
        date: today,
      }]);
    setSubmitting(false);
    if(error) {
      toast.error("Erreur lors de l'enregistrement.");
      return;
    }
    toast.success("Paiement enregistré.");
    setReservationId(reservationId);
    setMontant(montant);
    setModePaiement(modePaiement);
    onPaid();
    onClose();
  };

  return (
    <Dialog open={!!client} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un paiement</DialogTitle>
          <DialogDescription>
            <span>
              {client ? `Client : ${client.nom} ${client.prenom}` : ""}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mb-4">
          {/* Select réservation */}
          <div>
            <label className="text-sm mb-1 block">Réservation concernée <span className="text-red-600">*</span></label>
            <Select value={reservationId} onValueChange={setReservationId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une réservation" />
              </SelectTrigger>
              <SelectContent>
                {loading && (
                  <SelectItem value="loading" disabled>Chargement…</SelectItem>
                )}
                {!loading && reservations.length === 0 && (
                  <SelectItem value="no-data" disabled>Pas de réservation impayée</SelectItem>
                )}
                {reservations.map(resa => (
                  <SelectItem key={resa.id} value={resa.id}>
                    {resa.proprietes?.nom || "?"} — {resa.date_arrivee ? new Date(resa.date_arrivee).toLocaleDateString("fr-FR") : "?"} (à payer: {resa.reste_a_payer?.toLocaleString("fr-FR", { style: "currency", currency: "MAD" })})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Display reste à payer if available */}
            {selectedReservation && (
              <div className="mt-1 text-xs text-muted-foreground">
                Reste à payer : <span className="font-semibold">{selectedReservation.reste_a_payer.toLocaleString("fr-FR", { style: "currency", currency: "MAD" })}</span>
              </div>
            )}
          </div>
          {/* Montant */}
          <div>
            <label className="text-sm mb-1 block">Montant <span className="text-red-600">*</span></label>
            <Input
              type="number"
              min={1}
              step="any"
              max={selectedReservation ? selectedReservation.reste_a_payer : undefined}
              value={montant}
              onChange={handleMontantChange}
              placeholder="Saisir le montant"
              disabled={!reservationId || reservationId === "loading" || reservationId === "no-data"}
            />
          </div>
          {/* Mode de paiement */}
          <div>
            <label className="text-sm mb-1 block">Mode de paiement <span className="text-red-600">*</span></label>
            <Select value={modePaiement} onValueChange={setModePaiement}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un mode" />
              </SelectTrigger>
              <SelectContent>
                {modeOptions.length === 0 ? (
                  <SelectItem value="default" disabled>Mode de paiement…</SelectItem>
                ) : (
                  modeOptions.map(opt => (
                    !!opt ? <SelectItem key={opt} value={opt}>{opt}</SelectItem> : null
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          {/* Autres champs */}
          <div>
            <label className="text-sm mb-1 block">Référence</label>
            <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Référence (facultatif)" />
          </div>
          <div>
            <label className="text-sm mb-1 block">Remarque</label>
            <Textarea value={remarque} onChange={e => setRemarque(e.target.value)} placeholder="Remarque (facultatif)" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={submitting}>Annuler</Button>
          </DialogClose>
          <Button type="button" onClick={trySave} disabled={submitting}>
            {submitting ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClientAddPaymentDialog;
