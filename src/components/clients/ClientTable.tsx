
import React, { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from "@/components/ui/table";
import { Eye, Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import ClientAddPaymentDialog from "./ClientAddPaymentDialog";
import { toast } from "sonner";
import ClientDetailsDialog from "./ClientDetailsSheet";

type ClientRow = {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  cin_passport: string;
  total_reservations: number;
  total_paye: number;
  reste_a_payer: number;
};

const ClientTable: React.FC = () => {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detailsClientId, setDetailsClientId] = useState<string | null>(null);
  const [paymentClient, setPaymentClient] = useState<{id: string; nom: string; prenom: string} | null>(null);
  const [reload, setReload] = useState(0);

  // Récupérer tous les clients ayant au moins une réservation
  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      // Récupérer les infos clients + sommes depuis la base
      const { data, error } = await supabase.rpc('clients_with_sums'); // Suppose la présence d'une fonction SQL (on peut faire différemment, voir doc)
      if(error || !data) {
        // Plan B: calcul côté client
        const { data: c, error: errClients } = await supabase.from("clients").select("*");
        const { data: r, error: errResa } = await supabase
          .from("reservations")
          .select("id, id_client, prix_total, status")
          .neq("status", "Annulé"); // Exclure les réservations annulées
        const { data: p, error: errPay } = await supabase.from("reglements_clients").select("id, montant, id_reservation");
        if(errClients || errResa || errPay || !c || !r || !p) {
          toast.error("Erreur lors du chargement des clients.");
          setLoading(false);
          return;
        }
        // On conserve seulement les clients ayant une réservation (filtrage)
        const clientsMap: {[id: string]: ClientRow} = {};
        c.forEach(client => {
          const resas = r.filter(resa => resa.id_client === client.id);
          if(resas.length > 0) {
            const total_reservations = resas.reduce((sum, resa) => sum + (resa.prix_total || 0), 0);
            // On cherche tous les paiements pour toutes ses réservations:
            const resaIds = resas.map(resa => resa.id);
            const payments = p.filter(pay => resaIds.includes(pay.id_reservation));
            const total_paye = payments.reduce((sum, pay) => sum + (pay.montant || 0), 0);
            clientsMap[client.id] = {
              id: client.id,
              nom: client.nom,
              prenom: client.prenom,
              telephone: client.telephone,
              cin_passport: client.cin_passport,
              total_reservations,
              total_paye,
              reste_a_payer: total_reservations - total_paye,
            };
          }
        });
        setClients(Object.values(clientsMap));
        setLoading(false);
        return;
      }
      setClients(data); // format attendu depuis la fonction SQL
      setLoading(false);
    };
    fetchClients();
  }, [reload]);

  const filteredClients = useMemo(() =>
    clients.filter(client =>
      [client.nom, client.prenom, client.telephone, client.cin_passport].some(
        field => field && field.toLowerCase().includes(search.toLowerCase())
      )
    ), [search, clients]
  );

  return (
    <div>
      <div className="mb-4 flex flex-col sm:flex-row gap-2 items-center">
        <Input
          placeholder="Rechercher par nom, téléphone ou CIN/passeport"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="text-gray-500 ml-auto">{filteredClients.length} client{filteredClients.length > 1 ? "s" : ""}</div>
      </div>
      <div className="overflow-x-auto rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Prénom</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>CIN / Passeport</TableHead>
              <TableHead>Total des réservations (MAD)</TableHead>
              <TableHead>Total payé (MAD)</TableHead>
              <TableHead>Reste à payer (MAD)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6">Chargement…</TableCell>
              </TableRow>
            ) : filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6">Aucun client trouvé.</TableCell>
              </TableRow>
            ) : (
              filteredClients.map(client => (
                <TableRow key={client.id}>
                  <TableCell>{client.nom}</TableCell>
                  <TableCell>{client.prenom}</TableCell>
                  <TableCell>{client.telephone}</TableCell>
                  <TableCell>{client.cin_passport}</TableCell>
                  <TableCell className="text-blue-700 font-semibold">
                    {client.total_reservations.toLocaleString("fr-FR", { style: "currency", currency: "MAD" })}
                  </TableCell>
                  <TableCell className="text-green-600 font-semibold">
                    {client.total_paye.toLocaleString("fr-FR", { style: "currency", currency: "MAD" })}
                  </TableCell>
                  <TableCell className={`font-semibold ${client.reste_a_payer > 0 ? "text-red-600" : "text-gray-700"}`}>
                    {client.reste_a_payer.toLocaleString("fr-FR", { style: "currency", currency: "MAD" })}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap flex gap-1 justify-end">
                    {/* Fenêtre latérale fiche client */}
                    <Button variant="ghost" size="icon" aria-label="Voir fiche client"
                      onClick={() => setDetailsClientId(client.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {/* Paiement */}
                    <Button variant="ghost" size="icon" aria-label="Ajouter un paiement"
                      onClick={() => setPaymentClient({id: client.id, nom: client.nom, prenom: client.prenom})}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {/* Modale fiche client */}
      <ClientDetailsDialog
        clientId={detailsClientId}
        onClose={() => setDetailsClientId(null)}
      />
      {/* Sheet latéral fiche client */}
      <ClientAddPaymentDialog
        client={paymentClient}
        onClose={() => setPaymentClient(null)}
        onPaid={() => setReload(r => r + 1)}
      />
    </div>
  );
};

export default ClientTable;
