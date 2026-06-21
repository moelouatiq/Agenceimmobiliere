
import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from "@/components/ui/table";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";

type Props = {
  clientId: string | null;
  onClose: () => void;
};

const ClientReservationHistoryDialog: React.FC<Props> = ({ clientId, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [reservations, setReservations] = useState<any[]>([]);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    supabase
      .from("reservations")
      .select("id, date_reservation, prix_total, paiement_avance, reste_a_payer, id_propriete, proprietes(nom)")
      .eq("id_client", clientId)
      .order("date_reservation", { ascending: false })
      .then(({ data, error }) => {
        setReservations(data || []);
        setLoading(false);
      });
  }, [clientId]);

  return (
    <Dialog open={!!clientId} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-3xl w-full p-6"> {/* Set larger width for modal */}
        <DialogHeader>
          <DialogTitle>Historique des réservations</DialogTitle>
          <DialogDescription>
            <span>Liste des réservations du client</span>
          </DialogDescription>
        </DialogHeader>
        <div
          className="max-h-[420px] overflow-y-auto"
        > {/* vertical scroll, fixed height; no horizontal scroll */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date réservation</TableHead>
                <TableHead>Propriété</TableHead>
                <TableHead>Prix total</TableHead>
                <TableHead>Avance</TableHead>
                <TableHead>Reste à payer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    <Loader2 className="mx-auto animate-spin" />
                  </TableCell>
                </TableRow>
              ) : reservations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Aucune réservation</TableCell>
                </TableRow>
              ) : (
                reservations.map(resa => (
                  <TableRow key={resa.id}>
                    <TableCell>{resa.date_reservation ? (new Date(resa.date_reservation)).toLocaleDateString("fr-FR") : "-"}</TableCell>
                    <TableCell>{resa.proprietes?.nom || "-"}</TableCell>
                    <TableCell>{resa.prix_total?.toLocaleString("fr-FR", { style: "currency", currency: "MAD" })}</TableCell>
                    <TableCell>{resa.paiement_avance?.toLocaleString("fr-FR", { style: "currency", currency: "MAD" })}</TableCell>
                    <TableCell>{resa.reste_a_payer?.toLocaleString("fr-FR", { style: "currency", currency: "MAD" })}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <DialogClose asChild>
          <button className="mt-2 px-4 py-1 bg-gray-200 rounded hover:bg-gray-300">Fermer</button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
};

export default ClientReservationHistoryDialog;
