import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock, Loader2, Trash2 } from 'lucide-react';

export type BlockedPeriod = {
  id: string;
  date_arrivee: string;
  date_depart: string;
  blocked_reason: string | null;
  proprieteNom: string;
};

type Props = {
  period: BlockedPeriod | null;
  onClose: () => void;
};

const BlockedPeriodDetailDialog: React.FC<Props> = ({ period, onClose }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const handleClose = () => { setConfirmDelete(false); onClose(); };

  const handleDelete = async () => {
    if (!period) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('reservations').delete().eq('id', period.id);
      if (error) throw error;
      toast.success('Blocage supprimé');
      queryClient.invalidateQueries({ queryKey: ['occupancy'] });
      handleClose();
    } catch (err: unknown) {
      toast.error('Erreur lors de la suppression du blocage');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Dialog open={!!period} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-700">
            <Lock className="h-4 w-4" />
            Période bloquée
          </DialogTitle>
          <DialogDescription>
            Cette période n'est pas une réservation client.
          </DialogDescription>
        </DialogHeader>

        {period && (
          <div className="space-y-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium text-gray-500">Propriété</span>
              <span>{period.proprieteNom}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-500">Du</span>
              <span>{format(parseISO(period.date_arrivee), 'dd MMMM yyyy', { locale: fr })}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-500">Au</span>
              <span>{format(parseISO(period.date_depart), 'dd MMMM yyyy', { locale: fr })}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-500">Motif</span>
              <span className="font-semibold">{period.blocked_reason ?? '—'}</span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={deleting}>
            Fermer
          </Button>
          {!confirmDelete ? (
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer le blocage
            </Button>
          ) : (
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Suppression…</>
                : 'Confirmer la suppression'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BlockedPeriodDetailDialog;
