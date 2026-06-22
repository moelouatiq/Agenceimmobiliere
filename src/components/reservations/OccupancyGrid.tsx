import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import ReservationDetailsDialog from './ReservationDetailsDialog';

type Propriete = {
  id: string;
  nom: string;
  nom_residence: string | null;
};

type Reservation = {
  id: string;
  date_arrivee: string;
  date_depart: string;
  source: string | null;
  id_propriete: string;
  clients: { nom: string; prenom: string } | null;
};

const fetchOccupancy = async (from: string, to: string) => {
  const [propRes, resRes] = await Promise.all([
    supabase
      .from('proprietes')
      .select('id, nom, nom_residence')
      .order('ordre', { ascending: true, nullsFirst: false })
      .order('nom', { ascending: true }),
    supabase
      .from('reservations')
      .select('id, date_arrivee, date_depart, source, id_propriete, clients(nom, prenom)')
      .lte('date_arrivee', to)
      .gte('date_depart', from)
      .or('status.is.null,status.neq.Annulé'),
  ]);

  if (propRes.error) throw propRes.error;
  if (resRes.error) throw resRes.error;

  return {
    proprietes: (propRes.data ?? []) as Propriete[],
    reservations: (resRes.data ?? []) as Reservation[],
  };
};

const cellColor = (source: string | null): string => {
  if (source === 'Airbnb') return 'bg-red-500 hover:bg-red-400';
  if (source && source.trim() !== '') return 'bg-green-500 hover:bg-green-400';
  return 'bg-yellow-400 hover:bg-yellow-300';
};

const OccupancyGrid: React.FC = () => {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const [monthRef, setMonthRef] = useState(() => startOfMonth(today));
  const [useCustom, setUseCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const [filterDisponible, setFilterDisponible] = useState(false);
  const [toPopoverOpen, setToPopoverOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const dateFrom = useCustom && customFrom ? customFrom : monthRef;
  const dateTo = useCustom && customTo ? customTo : endOfMonth(monthRef);

  const fromStr = format(dateFrom, 'yyyy-MM-dd');
  const toStr = format(dateTo, 'yyyy-MM-dd');

  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['occupancy', fromStr, toStr],
    queryFn: () => fetchOccupancy(fromStr, toStr),
    staleTime: 60_000,
  });

  const proprietes = data?.proprietes ?? [];
  const reservations = data?.reservations ?? [];
  const days = eachDayOfInterval({ start: dateFrom, end: dateTo });

  // Build map: `${propId}|${dayStr}` → Reservation (for O(1) cell lookup)
  const cellMap = useMemo(() => {
    const map = new Map<string, Reservation>();
    for (const res of reservations) {
      for (const day of days) {
        const dayStr = format(day, 'yyyy-MM-dd');
        if (dayStr >= res.date_arrivee && dayStr < res.date_depart) {
          const key = `${res.id_propriete}|${dayStr}`;
          if (!map.has(key)) map.set(key, res);
        }
      }
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservations, fromStr, toStr]);

  // IDs des propriétés occupées : date_arrivee < toStr ET date_depart > fromStr
  // La date de départ est exclusive (un départ le 19 libère la nuit du 19)
  const occupiedPropIds = useMemo(
    () =>
      new Set(
        reservations
          .filter(r => r.date_arrivee < toStr && r.date_depart > fromStr)
          .map(r => r.id_propriete)
      ),
    [reservations, fromStr, toStr]
  );

  const displayProprietes =
    filterDisponible && useCustom && customFrom && customTo
      ? proprietes.filter(p => !occupiedPropIds.has(p.id))
      : proprietes;

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['occupancy'] });
  };

  return (
    <div className="space-y-3">
      {/* Period controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {!useCustom && (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonthRef(m => subMonths(m, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-sm min-w-[140px] text-center capitalize">
              {format(monthRef, 'MMMM yyyy', { locale: fr })}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonthRef(m => addMonths(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {useCustom && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date arrivée */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[130px] pl-3 text-left font-normal',
                    !customFrom && 'text-muted-foreground'
                  )}
                >
                  {customFrom ? format(customFrom, 'dd/MM/yyyy') : <span>Arrivée</span>}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customFrom}
                  onSelect={date => {
                    setCustomFrom(date);
                    // Réinitialiser la date de sortie si elle devient invalide
                    if (date && customTo && customTo <= date) setCustomTo(undefined);
                    // Ouvrir automatiquement le picker de sortie
                    setTimeout(() => setToPopoverOpen(true), 100);
                  }}
                  locale={fr}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <span className="text-gray-400">→</span>

            {/* Date sortie — s'ouvre automatiquement après la sélection de l'arrivée */}
            <Popover open={toPopoverOpen} onOpenChange={setToPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[130px] pl-3 text-left font-normal',
                    !customTo && 'text-muted-foreground'
                  )}
                >
                  {customTo ? format(customTo, 'dd/MM/yyyy') : <span>Sortie</span>}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customTo}
                  onSelect={date => { setCustomTo(date); setToPopoverOpen(false); }}
                  locale={fr}
                  className="pointer-events-auto"
                  disabled={date => !!customFrom && date <= customFrom}
                  defaultMonth={customFrom ?? undefined}
                />
              </PopoverContent>
            </Popover>

            {customFrom && customTo && (
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium ml-2">
                <input
                  type="checkbox"
                  checked={filterDisponible}
                  onChange={e => setFilterDisponible(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer"
                />
                Disponible uniquement
                {filterDisponible && (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({displayProprietes.length} bien{displayProprietes.length !== 1 ? 's' : ''})
                  </span>
                )}
              </label>
            )}
          </div>
        )}

        <Button
          variant={useCustom ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => { setUseCustom(v => !v); setFilterDisponible(false); }}
        >
          {useCustom ? 'Retour au mois' : 'Plage personnalisée'}
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 rounded bg-red-500" />
          Airbnb
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 rounded bg-green-500" />
          Autre source
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 rounded bg-yellow-400" />
          Source inconnue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 rounded border border-gray-200" />
          Libre
        </span>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-500 text-sm">Chargement...</div>
      ) : isError ? (
        <div className="text-center py-16 text-red-500 text-sm">
          Erreur lors du chargement des données.
        </div>
      ) : (
        <div className="overflow-auto rounded-md border" style={{ maxHeight: '65vh' }}>
          <table className="border-collapse text-xs" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr>
                {/* top-left sticky corner */}
                <th className="sticky left-0 top-0 z-30 bg-gray-50 border border-gray-200 px-2 py-1 min-w-[90px]" />
                {displayProprietes.map(prop => (
                  <th
                    key={prop.id}
                    className="sticky top-0 z-20 bg-gray-50 border border-gray-200 px-1 py-1 text-center font-medium"
                    title={[prop.nom_residence, prop.nom].filter(Boolean).join(' – ')}
                  >
                    <div className="w-[90px]">
                      {prop.nom_residence && (
                        <div className="text-[9px] text-gray-400 truncate leading-tight">
                          {prop.nom_residence}
                        </div>
                      )}
                      <div className="truncate leading-tight">{prop.nom}</div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map(day => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const isToday = dayStr === todayStr;

                return (
                  <tr key={dayStr}>
                    {/* sticky day label */}
                    <td
                      className={cn(
                        'sticky left-0 z-10 border border-gray-200 px-2 py-0.5 whitespace-nowrap font-medium',
                        isToday ? 'bg-blue-100 text-blue-700' : 'bg-gray-50'
                      )}
                    >
                      <span className="capitalize">
                        {format(day, 'EEE dd/MM', { locale: fr })}
                      </span>
                    </td>

                    {displayProprietes.map(prop => {
                      const res = cellMap.get(`${prop.id}|${dayStr}`);
                      const client = res?.clients;
                      const tooltipText = res
                        ? [
                            client ? `${client.nom} ${client.prenom}` : null,
                            res.source || 'Source inconnue',
                            `${res.date_arrivee} → ${res.date_depart}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        : undefined;

                      const clientLabel =
                        client ? `${client.nom} ${client.prenom}` : res?.source ?? '';

                      return (
                        <td
                          key={prop.id}
                          className={cn(
                            'border border-gray-200 h-7 w-[90px] transition-colors overflow-hidden',
                            res
                              ? cn(cellColor(res.source ?? null), 'cursor-pointer')
                              : isToday
                              ? 'bg-blue-50'
                              : ''
                          )}
                          title={tooltipText}
                          onClick={() => res && setSelectedId(res.id)}
                        >
                          {res && (
                            <span className="block px-1 text-[10px] font-medium text-white leading-7 truncate drop-shadow-sm select-none">
                              {clientLabel}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ReservationDetailsDialog
        reservationId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdate={handleUpdate}
      />
    </div>
  );
};

export default OccupancyGrid;
