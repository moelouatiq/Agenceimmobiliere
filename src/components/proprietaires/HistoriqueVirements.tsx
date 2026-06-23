
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { BilanPropriete, Virement } from "@/types/proprietaires";
import { toast } from "@/hooks/use-toast";
import { Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface HistoriqueVirementsProps {
  propriete: BilanPropriete;
  onClose: () => void;
}

// Type spécifique pour le formulaire d'édition
interface VirementFormState {
  date: string | Date;
  montant: number;
  mode_paiement: string;
  reference: string;
  remarque: string;
}

const HistoriqueVirements: React.FC<HistoriqueVirementsProps> = ({
  propriete,
  onClose,
}) => {
  const [virements, setVirements] = useState<Virement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editVirement, setEditVirement] = useState<Virement | null>(null);
  // Delete state
  const [deleteVirement, setDeleteVirement] = useState<Virement | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchVirements();
    // eslint-disable-next-line
  }, [propriete.id]);

  const fetchVirements = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from("virements_proprietaires")
        .select(`
          *,
          virement_reservations(
            id_reservation,
            reservations(date_arrivee, date_depart, proprietes(nom))
          )
        `)
        .eq("id_propriete", propriete.id)
        .order("date", { ascending: false });

      if (error) throw error;

      setVirements(data || []);
    } catch (error: any) {
      console.error("Erreur lors du chargement des virements:", error);
      setError("Une erreur est survenue lors du chargement des virements.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatMontant = (montant: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(montant);
  };

  const formatDate = (dateString: string | Date) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return format(date, "dd MMMM yyyy", { locale: fr });
  };

  // Supprimer un virement
  const handleDelete = async () => {
    if (!deleteVirement) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from("virements_proprietaires")
        .delete()
        .eq("id", deleteVirement.id);
      if (error) throw error;
      toast({
        title: "Virement supprimé",
        description: "Le virement a bien été supprimé."
      });
      setDeleteVirement(null);
      fetchVirements();
    } catch (err) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le virement.",
        variant: "destructive"
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  // --- Edit form component ---
  const EditVirementDialog = () => {
    const [form, setForm] = useState<VirementFormState>({
      date: editVirement?.date ? new Date(editVirement.date) : new Date(),
      montant: editVirement?.montant || 0,
      mode_paiement: editVirement?.mode_paiement || "",
      reference: editVirement?.reference || "",
      remarque: editVirement?.remarque || ""
    });
    const [saving, setSaving] = useState(false);

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setForm(prev => ({
        ...prev,
        [name]: name === "montant" ? Number(value) : value
      }));
    };

    const handleDate = (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({
        ...prev,
        date: e.target.value
      }));
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      try {
        // Mettre à jour en BDD
        const { error } = await supabase
          .from("virements_proprietaires")
          .update({
            date: form.date,
            montant: form.montant,
            mode_paiement: form.mode_paiement,
            reference: form.reference,
            remarque: form.remarque
          })
          .eq("id", editVirement!.id);
        if (error) throw error;
        toast({
          title: "Virement modifié",
          description: "Les détails du virement ont été mis à jour."
        });
        setEditVirement(null);
        fetchVirements();
      } catch {
        toast({
          title: "Erreur",
          description: "Échec de la mise à jour.",
          variant: "destructive"
        });
      } finally {
        setSaving(false);
      }
    };

    // Format date pour l'input date
    const formattedDate = form.date instanceof Date 
      ? form.date.toISOString().substring(0, 10)
      : typeof form.date === 'string' ? form.date.substring(0, 10) : '';

    return (
      <Dialog open={!!editVirement} onOpenChange={(o) => !o && setEditVirement(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le virement</DialogTitle>
            <DialogDescription>
              Ajustez les informations pour ce virement.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <Input
                type="date"
                name="date"
                value={formattedDate}
                onChange={handleDate}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Montant</label>
              <Input
                type="number"
                name="montant"
                value={form.montant}
                onChange={handleInput}
                min={0}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Mode de paiement</label>
              <Input
                type="text"
                name="mode_paiement"
                value={form.mode_paiement}
                onChange={handleInput}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Référence</label>
              <Input
                type="text"
                name="reference"
                value={form.reference}
                onChange={handleInput}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Remarque</label>
              <Input
                type="text"
                name="remarque"
                value={form.remarque}
                onChange={handleInput}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={saving}>
                  Annuler
                </Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>
                {saving ? "Sauvegarde..." : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          Historique des virements - {propriete.nom}
        </CardTitle>
        <Button variant="outline" onClick={onClose}>
          Retour
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center">Chargement des virements...</div>
        ) : error ? (
          <div className="py-4 text-red-500">{error}</div>
        ) : virements.length === 0 ? (
          <div className="py-4 text-center">
            Aucun virement n'a été effectué pour cette propriété.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Mode de paiement</TableHead>
                  <TableHead>Réservation</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Remarque</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {virements.map((virement: any) => (
                  <TableRow key={virement.id}>
                    <TableCell>{formatDate(virement.date)}</TableCell>
                    <TableCell>{formatMontant(virement.montant)}</TableCell>
                    <TableCell>{virement.mode_paiement}</TableCell>
                    <TableCell>
                      {virement.virement_reservations?.length > 0 ? (
                        <div className="space-y-1">
                          {virement.virement_reservations.map((jr: any) =>
                            jr.reservations ? (
                              <div key={jr.id_reservation} className="text-sm">
                                <span className="font-medium">
                                  {format(new Date(jr.reservations.date_arrivee), "dd/MM/yyyy", { locale: fr })}
                                  {" – "}
                                  {format(new Date(jr.reservations.date_depart), "dd/MM/yyyy", { locale: fr })}
                                </span>
                                {jr.reservations.proprietes?.nom && (
                                  <span className="text-muted-foreground ml-1">
                                    ({jr.reservations.proprietes.nom})
                                  </span>
                                )}
                              </div>
                            ) : null
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Virement général</span>
                      )}
                    </TableCell>
                    <TableCell>{virement.reference}</TableCell>
                    <TableCell>{virement.remarque}</TableCell>
                    <TableCell className="text-right flex gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Modifier"
                        onClick={() => setEditVirement(virement)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Supprimer"
                        onClick={() => setDeleteVirement(virement)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      {editVirement && <EditVirementDialog />}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteVirement} onOpenChange={open => !open && setDeleteVirement(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce virement ?</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Voulez-vous vraiment supprimer ce virement ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deleteLoading}>Annuler</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deleteLoading}
              onClick={handleDelete}
            >
              {deleteLoading ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default HistoriqueVirements;
