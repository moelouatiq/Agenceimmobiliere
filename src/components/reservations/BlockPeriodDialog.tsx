import React, { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Lock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const MOTIFS = ['Visite propriétaire', 'Travaux', 'Autre'] as const;
type Motif = typeof MOTIFS[number];

export type ProprieteLight = { id: string; nom: string; nom_residence?: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  proprietes: ProprieteLight[];
};

async function getOrCreateBlockedClient(motif: Motif): Promise<string> {
  const prenom = `(${motif})`;
  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('nom', 'Blocked')
    .eq('prenom', prenom)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const id = uuidv4();
  const { error } = await supabase.from('clients').insert({
    id,
    nom: 'Blocked',
    prenom,
    telephone: '',
  });
  if (error) throw new Error(`Impossible de créer le client bloqué : ${error.message}`);
  return id;
}

const BlockPeriodDialog: React.FC<Props> = ({ open, onClose, proprietes }) => {
  const [proprieteId, setProprieteId] = useState('');
  const [motif, setMotif] = useState<Motif | ''>('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [toPopoverOpen, setToPopoverOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const reset = () => {
    setProprieteId('');
    setMotif('');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const handleClose = () => { reset(); onClose(); };

  const canSubmit = proprieteId && motif && dateFrom && dateTo;

  const handleSubmit = async () => {
    if (!proprieteId || !motif || !dateFrom || !dateTo) return;
    setSubmitting(true);
    try {
      const clientId = await getOrCreateBlockedClient(motif as Motif);
      const nombreJours = differenceInDays(dateTo, dateFrom);

      const { error } = await supabase.from('reservations').insert({
        id: uuidv4(),
        id_propriete: proprieteId,
        id_client: clientId,
        date_reservation: format(new Date(), 'yyyy-MM-dd'),
        date_arrivee: format(dateFrom, 'yyyy-MM-dd'),
        date_depart: format(dateTo, 'yyyy-MM-dd'),
        nombre_jours: nombreJours,
        is_blocked: true,
        blocked_reason: motif,
        source: motif,
        status: 'Bloqué',
        prix_par_nuit: 0,
        prix_total: 0,
        paiement_avance: 0,
        reste_a_payer: 0,
        taux_commission: 0,
        montant_commission: 0,
        part_proprietaire: 0,
      });

      if (error) throw error;

      toast.success('Période bloquée avec succès');
      queryClient.invalidateQueries({ queryKey: ['occupancy'] });
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur : ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Bloquer une période
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Propriété */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Propriété</label>
            <Select value={proprieteId} onValueChange={setProprieteId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une propriété" />
              </SelectTrigger>
              <SelectContent>
                {proprietes.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nom_residence ? `${p.nom_residence} – ${p.nom}` : p.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Période */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Période</label>
            <div className="flex items-center gap-2 flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-[130px] pl-3 text-left font-normal', !dateFrom && 'text-muted-foreground')}>
                    {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : <span>Arrivée</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={d => {
                      setDateFrom(d);
                      if (d && dateTo && dateTo <= d) setDateTo(undefined);
                      setTimeout(() => setToPopoverOpen(true), 100);
                    }}
                    locale={fr}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <span className="text-gray-400">→</span>

              <Popover open={toPopoverOpen} onOpenChange={setToPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-[130px] pl-3 text-left font-normal', !dateTo && 'text-muted-foreground')}>
                    {dateTo ? format(dateTo, 'dd/MM/yyyy') : <span>Sortie</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={d => { setDateTo(d); setToPopoverOpen(false); }}
                    locale={fr}
                    className="pointer-events-auto"
                    disabled={d => !!dateFrom && d <= dateFrom}
                    defaultMonth={dateFrom ?? undefined}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Motif */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Motif du blocage</label>
            <Select value={motif} onValueChange={v => setMotif(v as Motif)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un motif" />
              </SelectTrigger>
              <SelectContent>
                {MOTIFS.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Blocage…</>
              : 'Bloquer la période'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BlockPeriodDialog;
