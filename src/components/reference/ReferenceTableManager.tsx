
import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableRow, TableCell, TableHead, TableHeader } from "@/components/ui/table";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

type Props = {
  table: string;
  label: string;
  placeholder?: string;
};

function ReferenceTableManager({ table, label, placeholder }: Props) {
  const [newVal, setNewVal] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const queryClient = useQueryClient();

  // Charger les lignes existantes
  const { data: rows, isLoading } = useQuery({
    queryKey: [table],
    queryFn: async () => {
      let { data, error } = await supabase
        .from(table)
        .select("id, nom")
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  // Ajout
  const addMutation = useMutation({
    mutationFn: async (val: string) => {
      const id = uuidv4();
      let { error } = await supabase.from(table).insert({ id, nom: val });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewVal("");
      queryClient.invalidateQueries({ queryKey: [table] });
      toast.success("Ajouté !");
    },
    meta: { onError: (err: Error) => toast.error(err.message) },
  });

  // Suppression
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      let { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] });
      toast.success("Supprimé !");
    },
    meta: { onError: (err: Error) => toast.error(err.message) },
  });

  // Modification
  const editMutation = useMutation({
    mutationFn: async ({ id, nom }: { id: string; nom: string }) => {
      let { error } = await supabase.from(table).update({ nom }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditId(null);
      setEditVal("");
      queryClient.invalidateQueries({ queryKey: [table] });
      toast.success("Modifié !");
    },
    meta: { onError: (err: Error) => toast.error(err.message) },
  });

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (newVal.trim() === "") return;
    addMutation.mutate(newVal.trim());
  }

  function onUpdate(id: string) {
    if (editVal.trim() === "") return;
    editMutation.mutate({ id, nom: editVal.trim() });
  }

  return (
    <div>
      <form
        onSubmit={onAdd}
        className="flex items-center gap-2 mb-4"
        autoComplete="off"
      >
        <Input
          value={newVal}
          onChange={e => setNewVal(e.target.value)}
          placeholder={placeholder || "Nom…"}
          className="max-w-xs"
        />
        <Button type="submit" size="sm" variant="default" disabled={addMutation.isPending || !newVal.trim()}>
          <Plus className="mr-1" size={18} /> Ajouter
        </Button>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead className="w-32 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={2}>Chargement…</TableCell>
            </TableRow>
          )}
          {!!rows && rows.length === 0 && !isLoading && (
            <TableRow>
              <TableCell colSpan={2} className="italic text-gray-400">
                Aucun enregistrement
              </TableCell>
            </TableRow>
          )}
          {!!rows &&
            rows.map((row: { id: string; nom: string }) => (
              <TableRow key={row.id}>
                <TableCell>
                  {editId === row.id ? (
                    <Input
                      value={editVal}
                      autoFocus
                      onChange={e => setEditVal(e.target.value)}
                      onBlur={() => setEditId(null)}
                      onKeyDown={e => {
                        if (e.key === "Enter") onUpdate(row.id);
                        if (e.key === "Escape") setEditId(null);
                      }}
                      className="max-w-xs"
                    />
                  ) : (
                    row.nom
                  )}
                </TableCell>
                <TableCell className="flex gap-2 justify-end">
                  {editId === row.id ? (
                    <Button size="sm" variant="secondary" onClick={() => onUpdate(row.id)}>
                      <Edit size={16} className="mr-1" /> Valider
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditId(row.id);
                          setEditVal(row.nom);
                        }}
                        aria-label="Modifier"
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(row.id)}
                        aria-label="Supprimer"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default ReferenceTableManager;
