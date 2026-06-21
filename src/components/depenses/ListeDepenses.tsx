import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious, PaginationLink } from "@/components/ui/pagination";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";

const NATURES = [{
  value: "all",
  label: "Toutes les natures"
},
// Changed empty string to "all"
{
  value: "remboursable",
  label: "Remboursable"
}, {
  value: "non remboursable",
  label: "Non remboursable"
}];
const MODES_PAIEMENT = ["Espèces", "Virement", "Chèque", "Carte bancaire", "Autre"];
const PAGE_SIZE = 10;

// Chargement des types de dépense pour le filtre
function useTypesDepenses() {
  return useQuery({
    queryKey: ["types_depenses"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("types_depense").select("*").order("nom", {
        ascending: true
      });
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10
  });
}

// Chargement propriétés pour l'autocomplétion
function useProprietes() {
  return useQuery({
    queryKey: ["proprietes_list"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("proprietes").select("id, nom").order("nom", {
        ascending: true
      });
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10
  });
}

// Remove dateMin and dateMax from query and signature
async function fetchDepenses({
  page = 1,
  search = "",
  typeDepense = "",
  nature = "",
  proprieteId = ""
}: {
  page?: number;
  search?: string;
  typeDepense?: string;
  nature?: string;
  proprieteId?: string;
}): Promise<any[]> {
  // On effectue la jointure et les différents filtres côté serveur
  let query = supabase.from("depenses").select("*, proprietes:proprietes(id, nom)").order("date", {
    ascending: false
  });
  if (typeDepense && typeDepense !== "all") query = query.eq("type_depense", typeDepense);
  if (nature && nature !== "all") query = query.eq("nature", nature);
  if (proprieteId) query = query.eq("id_propriete", proprieteId);

  // Pagination logic
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);
  const {
    data,
    error
  } = await query;
  if (error) throw error;

  // Filtrer côté client par recherche sur propriété
  let filtered = data;
  if (search) {
    filtered = data.filter((row: any) => row.proprietes?.nom && row.proprietes.nom.toLowerCase().includes(search.toLowerCase()));
  }
  return filtered;
}

export default function ListeDepenses() {
  const [search, setSearch] = useState("");
  const [typeDepense, setTypeDepense] = useState("all");
  const [nature, setNature] = useState("all");
  const [page, setPage] = useState(1);
  const [proprieteId, setProprieteId] = useState<string>("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editDepense, setEditDepense] = useState<any | null>(null);
  
  const queryClient = useQueryClient();
  const {
    data: typesDepenses
  } = useTypesDepenses();
  const {
    data: proprietes
  } = useProprietes();
  const {
    data: depenses,
    isLoading,
    error
  } = useQuery({
    queryKey: ["depenses", {
      page,
      search,
      typeDepense,
      nature,
      proprieteId
    }],
    queryFn: () => fetchDepenses({
      page,
      search,
      typeDepense,
      nature,
      proprieteId
    }),
    gcTime: 5 * 60 * 1000,
    // keep cache for 5 minutes
    staleTime: 30 * 1000 // mark as not-stale quickly
  });

  // Mutation pour supprimer une dépense
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('depenses').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      toast({
        title: 'Dépense supprimée',
        description: 'La dépense a été supprimée avec succès',
      });
      queryClient.invalidateQueries({ queryKey: ["depenses"] });
      setDeleteId(null);
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: `Erreur lors de la suppression: ${error.message}`,
        variant: 'destructive',
      });
    }
  });

  // Mutation pour mettre à jour une dépense
  const updateMutation = useMutation({
    mutationFn: async (depense: any) => {
      const { error } = await supabase
        .from('depenses')
        .update({
          id_propriete: depense.id_propriete,
          type_depense: depense.type_depense,
          nature: depense.nature,
          montant: depense.montant,
          mode_paiement: depense.mode_paiement,
          reference: depense.reference,
          date: depense.date,
        })
        .eq('id', depense.id);
      
      if (error) throw error;
      return depense;
    },
    onSuccess: () => {
      toast({
        title: 'Dépense modifiée',
        description: 'La dépense a été modifiée avec succès',
      });
      queryClient.invalidateQueries({ queryKey: ["depenses"] });
      setEditDepense(null);
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: `Erreur lors de la modification: ${error.message}`,
        variant: 'destructive',
      });
    }
  });

  // Pour autocomplétion propriété
  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setPage(1);
  }
  function handleProprieteSelect(nom: string) {
    // Trouver l'id correspondant à ce nom
    const item = proprietes?.find(p => p.nom === nom);
    setProprieteId(item?.id ?? "");
    setSearch(nom);
    setPage(1);
  }

  // Gestion filtre pagination
  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  // Gestionnaire de suppression
  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
    }
  };

  // Gestionnaire de modification
  const handleEdit = (depense: any) => {
    setEditDepense({...depense});
  };

  const handleUpdateDepense = () => {
    if (editDepense) {
      updateMutation.mutate(editDepense);
    }
  };

  // Nombre de pages (dépend si page suivante trop courte)
  const hasResults = depenses && depenses.length > 0;
  return <div>
      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Recherche par propriété</label>
          <Input type="text" placeholder="Nom de propriété" value={search} className="w-44" onChange={handleSearchChange} list="proprietes-list" autoComplete="off" />
          {proprietes && <datalist id="proprietes-list">
              {proprietes.filter(p => p.nom.toLowerCase().includes(search.toLowerCase())).map(p => <option key={p.id} value={p.nom} />)}
            </datalist>}
          {/* On sélectionne la propriété au OnBlur */}
          
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type de dépense</label>
          <Select onValueChange={v => {
          setTypeDepense(v);
          setPage(1);
        }} value={typeDepense}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Tous les types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {typesDepenses?.map((t: any) => <SelectItem key={t.nom} value={t.nom}>
                  {t.nom}
                </SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nature</label>
          <Select onValueChange={v => {
          setNature(v);
          setPage(1);
        }} value={nature}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Toutes les natures" />
            </SelectTrigger>
            <SelectContent>
              {NATURES.map(n => <SelectItem key={n.value} value={n.value}>
                  {n.label}
                </SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {/* Les filtres par date (Date min / Date max) ont été enlevés */}
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Propriété</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type de dépense</TableHead>
              <TableHead>Nature</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Mode de paiement</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow>
                <TableCell colSpan={8} className="text-center">Chargement…</TableCell>
              </TableRow>}
            {error && <TableRow>
                <TableCell colSpan={8} className="text-destructive text-center">
                  Erreur lors du chargement des dépenses
                </TableCell>
              </TableRow>}
            {!isLoading && !hasResults && <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground text-center">
                  Aucune dépense ne correspond à votre recherche.
                </TableCell>
              </TableRow>}
            {hasResults && depenses!.map((row: any) => <TableRow key={row.id}>
                <TableCell>{row.proprietes?.nom ?? "-"}</TableCell>
                <TableCell>{format(parseISO(row.date), "dd/MM/yyyy")}</TableCell>
                <TableCell>{row.type_depense}</TableCell>
                <TableCell>{row.nature}</TableCell>
                <TableCell>
                  {row.montant !== null ? Number(row.montant).toLocaleString("fr-FR", {
                style: "currency",
                currency: "MAD"
              }) : "-"}
                </TableCell>
                <TableCell>{row.mode_paiement}</TableCell>
                <TableCell>{row.reference || "-"}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleEdit(row)} 
                      className="h-8 w-8"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setDeleteId(row.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                          <AlertDialogDescription>
                            Êtes-vous sûr de vouloir supprimer cette dépense ? Cette action ne peut pas être annulée.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDeleteId(null)}>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">Supprimer</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>)}
          </TableBody>
          <TableCaption>Liste paginée des dépenses</TableCaption>
        </Table>
      </div>
      <div className="mt-4 flex justify-between items-center">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={() => handlePageChange(page - 1)} className="cursor-pointer" aria-disabled={page === 1} tabIndex={page === 1 ? -1 : 0} />
            </PaginationItem>
            {/* Simple pagination */}
            <PaginationItem>
              <PaginationLink isActive>{page}</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext onClick={() => handlePageChange(page + 1)} className="cursor-pointer" aria-disabled={!hasResults || depenses && depenses.length < PAGE_SIZE} tabIndex={depenses && depenses.length < PAGE_SIZE ? -1 : 0} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
        <div className="text-sm text-muted-foreground">
          Affichage page {page}
        </div>
      </div>

      {/* Modal pour ��diter une dépense */}
      <Dialog open={!!editDepense} onOpenChange={(open) => !open && setEditDepense(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la dépense</DialogTitle>
          </DialogHeader>
          
          {editDepense && (
            <>
              <div className="grid gap-4 py-4">
                {/* Propriété */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="edit-propriete" className="text-right font-medium">Propriété</label>
                  <div className="col-span-3">
                    <Select 
                      value={editDepense.id_propriete || ""} 
                      onValueChange={(v) => setEditDepense({...editDepense, id_propriete: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez une propriété" />
                      </SelectTrigger>
                      <SelectContent>
                        {proprietes?.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Type de dépense */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="edit-type" className="text-right font-medium">Type</label>
                  <div className="col-span-3">
                    <Select 
                      value={editDepense.type_depense || ""} 
                      onValueChange={(v) => setEditDepense({...editDepense, type_depense: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un type" />
                      </SelectTrigger>
                      <SelectContent>
                        {typesDepenses?.map((t: any) => (
                          <SelectItem key={t.nom} value={t.nom}>{t.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Nature */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="edit-nature" className="text-right font-medium">Nature</label>
                  <div className="col-span-3">
                    <Select 
                      value={editDepense.nature || ""} 
                      onValueChange={(v) => setEditDepense({...editDepense, nature: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez la nature" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="remboursable">Remboursable</SelectItem>
                        <SelectItem value="non remboursable">Non remboursable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Montant */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="edit-montant" className="text-right font-medium">Montant</label>
                  <Input 
                    id="edit-montant"
                    type="number" 
                    value={editDepense.montant || ""}
                    onChange={(e) => setEditDepense({...editDepense, montant: e.target.value})}
                    className="col-span-3"
                  />
                </div>
                
                {/* Mode de paiement */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="edit-mode" className="text-right font-medium">Mode de paiement</label>
                  <div className="col-span-3">
                    <Select 
                      value={editDepense.mode_paiement || ""}
                      onValueChange={(v) => setEditDepense({...editDepense, mode_paiement: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Mode de paiement" />
                      </SelectTrigger>
                      <SelectContent>
                        {MODES_PAIEMENT.map((mode) => (
                          <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Référence */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="edit-reference" className="text-right font-medium">Référence</label>
                  <Input 
                    id="edit-reference"
                    value={editDepense.reference || ""}
                    onChange={(e) => setEditDepense({...editDepense, reference: e.target.value})}
                    className="col-span-3"
                  />
                </div>
                
                {/* Date */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="edit-date" className="text-right font-medium">Date</label>
                  <Input 
                    id="edit-date"
                    type="date"
                    value={editDepense.date ? editDepense.date.substring(0, 10) : ""}
                    onChange={(e) => setEditDepense({...editDepense, date: e.target.value})}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDepense(null)}>Annuler</Button>
                <Button onClick={handleUpdateDepense}>Enregistrer</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>;
}
