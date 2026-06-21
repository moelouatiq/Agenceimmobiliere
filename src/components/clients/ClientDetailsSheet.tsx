
import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";

type Props = {
  clientId: string | null;
  onClose: () => void;
};

type BaseClient = {
  nom: string;
  prenom: string;
  telephone: string;
  cin_passport: string;
};

type Reservation = {
  id: string;
  date_reservation: string | null;
  date_arrivee: string | null;
  date_depart: string | null;
  prix_total: number | null;
  paiement_avance: number | null;
  reste_a_payer: number | null;
  id_propriete: string | null;
  proprietes?: { nom: string } | null;
};

type Paiement = {
  id: string;
  date: string | null;
  montant: number | null;
  mode_paiement: string | null;
  reference: string | null;
  remarque: string | null;
  id_reservation: string;
  reservations?: {
    date_arrivee: string | null;
    date_depart: string | null;
    id_propriete: string | null;
    proprietes?: { nom: string } | null;
  };
};

const ClientDetailsDialog: React.FC<Props> = ({ clientId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<BaseClient | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [payments, setPayments] = useState<Paiement[]>([]);
  const [tab, setTab] = useState("resa");

  useEffect(() => {
    const fetchAll = async () => {
      if (!clientId) return;
      setLoading(true);
      // Infos de base du client
      const { data: c } = await supabase
        .from("clients")
        .select("nom, prenom, telephone, cin_passport")
        .eq("id", clientId)
        .single();
      setClient(c);
      // Récupérer les réservations + propriété (proprietes doit être objet ou null)
      const { data: resa } = await supabase
        .from("reservations")
        .select(
          "id, date_reservation, date_arrivee, date_depart, prix_total, paiement_avance, reste_a_payer, id_propriete, proprietes(nom)"
        )
        .eq("id_client", clientId)
        .order("date_reservation", { ascending: false });

      // Fix : certaines versions de supabase renvoient proprietes en array (!)
      const safeResas = (resa || []).map((r: any) => ({
        ...r,
        proprietes:
          Array.isArray(r.proprietes) && r.proprietes.length > 0
            ? r.proprietes[0]
            : r.proprietes && !Array.isArray(r.proprietes)
            ? r.proprietes
            : null,
      }));
      setReservations(safeResas);

      // Récupérer les paiements pour toutes ces résa
      const resaIds = safeResas.map((r) => r.id);
      let paies: Paiement[] = [];
      if (resaIds.length > 0) {
        const { data: pays } = await supabase
          .from("reglements_clients")
          .select(
            "id, date, montant, mode_paiement, reference, remarque, id_reservation, reservations(date_arrivee, date_depart, id_propriete, proprietes(nom))"
          )
          .in("id_reservation", resaIds)
          .order("date", { ascending: false });

        // Pareil : fix bug "reservations" array
        paies =
          (pays || []).map((pay: any) => ({
            ...pay,
            reservations:
              Array.isArray(pay.reservations) && pay.reservations.length > 0
                ? pay.reservations[0]
                : pay.reservations && !Array.isArray(pay.reservations)
                ? pay.reservations
                : null,
          })) ?? [];
      }
      setPayments(paies);

      setLoading(false);
    };
    if (clientId) {
      fetchAll();
    }
  }, [clientId]);

  return (
    <Dialog open={!!clientId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-2xl w-full p-0 max-h-[92vh] overflow-hidden bg-white"
        style={{
          width: "650px",
          maxHeight: "92vh",
          overflow: "hidden",
        }}
      >
        <div className="flex flex-col h-full overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Fiche client</DialogTitle>
            {client && (
              <div className="mt-2 mb-2 bg-gray-50 rounded px-4 py-2 flex flex-col gap-1">
                <div>
                  <span className="font-bold">Nom complet : </span>
                  <span>
                    {client.nom} {client.prenom}
                  </span>
                </div>
                <div>
                  <span className="font-bold">Téléphone : </span>
                  <span>{client.telephone}</span>
                </div>
                <div>
                  <span className="font-bold">CIN/Passport : </span>
                  <span>{client.cin_passport}</span>
                </div>
              </div>
            )}
          </DialogHeader>
          <Separator className="mb-1" />
          <div className="px-6 pb-3 flex-1 flex flex-col min-h-0">
            <Tabs value={tab} onValueChange={setTab} className="w-full h-full flex-1 flex flex-col min-h-0">
              <TabsList className="mb-4">
                <TabsTrigger value="resa">Historique des réservations</TabsTrigger>
                <TabsTrigger value="paiements">Historique des paiements</TabsTrigger>
              </TabsList>
              <Separator className="mb-2" />
              <div className="flex-1 min-h-0">
                {/* Onglet Réservations */}
                <TabsContent value="resa" className="h-full min-h-0">
                  {loading ? (
                    <div className="py-8 text-center">
                      <Loader2 className="mx-auto animate-spin" />
                    </div>
                  ) : reservations.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      Aucune donnée disponible
                    </div>
                  ) : (
                    <div className="max-h-[340px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date réservation</TableHead>
                            <TableHead>Dates de séjour</TableHead>
                            <TableHead>Propriété</TableHead>
                            <TableHead>Montant total</TableHead>
                            <TableHead>Paiement avancé</TableHead>
                            <TableHead>Reste à payer</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reservations.map((resa) => (
                            <TableRow key={resa.id}>
                              <TableCell>
                                {resa.date_reservation
                                  ? new Date(resa.date_reservation).toLocaleDateString("fr-FR")
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                {resa.date_arrivee
                                  ? new Date(resa.date_arrivee).toLocaleDateString("fr-FR")
                                  : "-"}
                                {" - "}
                                {resa.date_depart
                                  ? new Date(resa.date_depart).toLocaleDateString("fr-FR")
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                {resa.proprietes?.nom || "-"}
                              </TableCell>
                              <TableCell>
                                {typeof resa.prix_total === "number"
                                  ? resa.prix_total.toLocaleString("fr-FR", {
                                      style: "currency",
                                      currency: "MAD",
                                    })
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                {typeof resa.paiement_avance === "number"
                                  ? resa.paiement_avance.toLocaleString("fr-FR", {
                                      style: "currency",
                                      currency: "MAD",
                                    })
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                {typeof resa.reste_a_payer === "number"
                                  ? resa.reste_a_payer.toLocaleString("fr-FR", {
                                      style: "currency",
                                      currency: "MAD",
                                    })
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
                {/* Onglet Paiements */}
                <TabsContent value="paiements" className="h-full min-h-0">
                  {loading ? (
                    <div className="py-8 text-center">
                      <Loader2 className="mx-auto animate-spin" />
                    </div>
                  ) : payments.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      Aucune donnée disponible
                    </div>
                  ) : (
                    <div className="max-h-[340px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date du paiement</TableHead>
                            <TableHead>Référence</TableHead>
                            <TableHead>Montant payé</TableHead>
                            <TableHead>Mode de paiement</TableHead>
                            <TableHead>Remarque</TableHead>
                            <TableHead>Pour la réservation</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map((pay) => (
                            <TableRow key={pay.id}>
                              <TableCell>
                                {pay.date
                                  ? new Date(pay.date).toLocaleDateString("fr-FR")
                                  : "-"}
                              </TableCell>
                              <TableCell>{pay.reference || "-"}</TableCell>
                              <TableCell>
                                {typeof pay.montant === "number"
                                  ? pay.montant.toLocaleString("fr-FR", {
                                      style: "currency",
                                      currency: "MAD",
                                    })
                                  : "-"}
                              </TableCell>
                              <TableCell>{pay.mode_paiement || "-"}</TableCell>
                              <TableCell>{pay.remarque || "-"}</TableCell>
                              <TableCell>
                                {pay.reservations?.proprietes?.nom ? (
                                  <>
                                    {pay.reservations?.proprietes?.nom}
                                    <br />
                                    {pay.reservations?.date_arrivee
                                      ? new Date(pay.reservations.date_arrivee).toLocaleDateString(
                                          "fr-FR"
                                        )
                                      : "-"}
                                    {" - "}
                                    {pay.reservations?.date_depart
                                      ? new Date(pay.reservations.date_depart).toLocaleDateString(
                                          "fr-FR"
                                        )
                                      : "-"}
                                  </>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
          <div className="p-6 pt-2">
            <DialogClose asChild>
              <button className="w-full mt-2 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 font-medium">
                Fermer
              </button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientDetailsDialog;
