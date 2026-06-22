import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Edit, Trash, GripVertical } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
  ordre?: number;
};

interface ListeProprietesProps {
  onEdit?: (propriete: Propriete) => void;
  onEditClick?: (propriete: Propriete) => void;
}

export default function ListeProprietes({ onEdit, onEditClick }: ListeProprietesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [proprieteToDelete, setProprieteToDelete] = useState<Propriete | null>(null);
  const [localList, setLocalList] = useState<Propriete[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndex = useRef<number | null>(null);
  const queryClient = useQueryClient();

  const { data: proprietes = [], isLoading } = useQuery({
    queryKey: ["proprietes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proprietes")
        .select("*")
        .order("ordre", { ascending: true, nullsFirst: false })
        .order("nom");
      if (error) throw error;
      return data as Propriete[];
    },
  });

  // Keep local list in sync with server data
  useEffect(() => {
    setLocalList(proprietes);
  }, [proprietes]);

  const isSearching = searchTerm.trim() !== "";

  const displayList = isSearching
    ? localList.filter(
        (p) =>
          p.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.nom_proprietaire.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.adresse.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.nom_residence?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.type_appartement.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : localList;

  // ── Drag handlers ──────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) setDragOverIndex(index);
  };

  const handleDrop = async (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const fromIdx = dragIndex.current;
    setDragOverIndex(null);
    dragIndex.current = null;

    if (fromIdx === null || fromIdx === dropIdx) return;

    // Reorder locally
    const reordered = [...localList];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setLocalList(reordered);

    // Persist new ordre values sequentially to catch the first error clearly
    setIsSaving(true);
    try {
      for (let i = 0; i < reordered.length; i++) {
        const { error } = await supabase
          .from("proprietes")
          .update({ ordre: i + 1 })
          .eq("id", reordered[i].id);

        if (error) {
          const hint =
            error.message?.includes("ordre") || error.code === "PGRST204"
              ? ' — Avez-vous exécuté le SQL pour ajouter la colonne "ordre" ?'
              : "";
          throw new Error(error.message + hint);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["proprietes"] });
      toast.success("Ordre sauvegardé");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Erreur lors de la sauvegarde de l'ordre:", msg);
      toast.error(msg, { duration: 6000 });
      setLocalList(proprietes); // revert
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
    dragIndex.current = null;
  };

  // ── Delete ─────────────────────────────────────────────────────
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
    if (onEditClick) onEditClick(propriete);
    else if (onEdit) onEdit(propriete);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une propriété..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {isSaving && (
          <span className="text-xs text-muted-foreground animate-pulse">
            Sauvegarde…
          </span>
        )}
        {!isSearching && (
          <span className="text-xs text-muted-foreground">
            Glissez&nbsp;
            <GripVertical className="inline h-3 w-3" />
            &nbsp;pour réordonner
          </span>
        )}
      </div>

      {isLoading ? (
        <p>Chargement des propriétés...</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {!isSearching && <TableHead className="w-8" />}
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
              {displayList.map((propriete, index) => (
                <TableRow
                  key={propriete.id}
                  draggable={!isSearching}
                  onDragStart={(e) => !isSearching && handleDragStart(e, index)}
                  onDragOver={(e) => !isSearching && handleDragOver(e, index)}
                  onDrop={(e) => !isSearching && handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    !isSearching && "cursor-default",
                    dragOverIndex === index && !isSearching
                      ? "border-t-2 border-primary bg-primary/5"
                      : ""
                  )}
                >
                  {!isSearching && (
                    <TableCell className="w-8 px-2 text-muted-foreground cursor-grab active:cursor-grabbing">
                      <GripVertical className="h-4 w-4" />
                    </TableCell>
                  )}
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
                          <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
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
