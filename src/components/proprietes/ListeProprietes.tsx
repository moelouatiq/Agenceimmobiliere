
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Edit, Trash } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export type Propriete = {
  id: string;
  nom: string;
  nom_proprietaire: string;
  contact_proprietaire: string;
  adresse: string;
  nom_residence?: string;
  type_appartement: string;
  groupe?: string;
  taux_commission: number;
  autre_info?: string;
};

interface ListeProprietesProps {
  onEdit?: (propriete: Propriete) => void;
  onEditClick?: (propriete: Propriete) => void; // Nouvelle prop pour changer l'onglet
}

export default function ListeProprietes({ onEdit, onEditClick }: ListeProprietesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [proprieteToDelete, setProprieteToDelete] = useState<Propriete | null>(null);
  const queryClient = useQueryClient();

  const { data: proprietes = [], isLoading } = useQuery({
    queryKey: ["proprietes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proprietes")
        .select("*")
        .order("nom");
      
      if (error) throw error;
      return data as Propriete[];
    }
  });

  const handleDelete = async () => {
    if (!proprieteToDelete) return;

    try {
      const { error } = await supabase
        .from("proprietes")
        .delete()
        .eq("id", proprieteToDelete.id);

      if (error) throw error;

      toast.success("Propriété supprimée avec succès");
      queryClient.invalidateQueries({ queryKey: ["proprietes"] });
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression de la propriété");
    } finally {
      setProprieteToDelete(null);
    }
  };

  const handleEdit = (propriete: Propriete) => {
    // Si onEditClick est fourni, l'appeler (pour changer l'onglet)
    if (onEditClick) {
      onEditClick(propriete);
    } else if (onEdit) {
      // Sinon, utiliser onEdit comme avant
      onEdit(propriete);
    }
  };

  const proprietesFiltrees = proprietes.filter((propriete) =>
    propriete.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    propriete.nom_proprietaire.toLowerCase().includes(searchTerm.toLowerCase()) ||
    propriete.adresse.toLowerCase().includes(searchTerm.toLowerCase()) ||
    propriete.nom_residence?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    propriete.type_appartement.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher une propriété..."
          className="pl-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p>Chargement des propriétés...</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Propriétaire</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Résidence</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Groupe</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proprietesFiltrees.map((propriete) => (
                <TableRow key={propriete.id}>
                  <TableCell>{propriete.nom}</TableCell>
                  <TableCell>{propriete.nom_proprietaire}</TableCell>
                  <TableCell>{propriete.contact_proprietaire}</TableCell>
                  <TableCell>{propriete.adresse}</TableCell>
                  <TableCell>{propriete.nom_residence || "-"}</TableCell>
                  <TableCell>{propriete.type_appartement}</TableCell>
                  <TableCell>{propriete.groupe || "-"}</TableCell>
                  <TableCell>{propriete.taux_commission}%</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEdit(propriete)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setProprieteToDelete(propriete)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Confirmer la suppression
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Êtes-vous sûr de vouloir supprimer la propriété "{propriete.nom}" ?
                            Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setProprieteToDelete(null)}>
                            Annuler
                          </AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete}>
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
