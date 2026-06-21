
import React, { useState, useEffect, useMemo } from "react";
import { format, isBefore, parseISO, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale/fr";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";

type Propriete = { id: string; nom: string; };

type Client = { nom: string; prenom: string; telephone: string; };

type Reservation = {
  id: string;
  id_propriete: string;
  date_arrivee: string; // yyyy-MM-dd
  date_depart: string;  // yyyy-MM-dd
  clients: Client;      // single client object
  proprietes: Propriete; // single property object
};

type ReservationWithDates = Reservation & {
  range: Date[];
};

type ReservationsCalendarProps = {
  onlyProprietes?: Propriete[];
};

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(date.getDate() + days);
  return copy;
}

const getReservationRange = (res: Reservation): Date[] => {
  // On inclut date_arrivee mais exclut date_depart
  const from = parseISO(res.date_arrivee);
  const to = parseISO(res.date_depart);
  const days = [];
  let day = from;
  while (isBefore(day, to)) {
    days.push(day);
    day = addDays(day, 1);
  }
  return days;
};

const ReservationsCalendar: React.FC<ReservationsCalendarProps> = ({ onlyProprietes }) => {
  const today = new Date();
  const [proprietes, setProprietes] = useState<Propriete[]>([]);
  const [reservations, setReservations] = useState<ReservationWithDates[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(today));

  useEffect(() => {
    (async () => {
      const { data: props, error: errProps } = await supabase
        .from('proprietes')
        .select('id, nom')
        .order('nom');
      if (!errProps) setProprietes(props ?? []);

      const rangeBegin = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const rangeEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      const { data: resvs, error: errRes } = await supabase
        .from('reservations')
        .select(`
          id,
          id_propriete,
          date_arrivee,
          date_depart,
          clients!inner(nom, prenom, telephone),
          proprietes!inner(id, nom)
        `)
        .gte('date_depart', rangeBegin)
        .lte('date_arrivee', rangeEnd);
      if (!errRes && Array.isArray(resvs)) {
        const mappedReservations: ReservationWithDates[] = resvs.map((res: any) => {
          const clientObj: Client = Array.isArray(res.clients) ? res.clients[0] : res.clients;
          const proprieteObj: Propriete = Array.isArray(res.proprietes) ? res.proprietes[0] : res.proprietes;
          return {
            id: res.id,
            id_propriete: res.id_propriete,
            date_arrivee: res.date_arrivee,
            date_depart: res.date_depart,
            clients: clientObj,
            proprietes: proprieteObj,
            range: getReservationRange({
              id: res.id,
              id_propriete: res.id_propriete,
              date_arrivee: res.date_arrivee,
              date_depart: res.date_depart,
              clients: clientObj,
              proprietes: proprieteObj,
            }),
          };
        });
        setReservations(mappedReservations);
      }
    })();
  }, [currentMonth]);

  const prevMonth = () => setCurrentMonth(m => subMonths(m, 1));
  const nextMonth = () => setCurrentMonth(m => addMonths(m, 1));

  const shownProprietes = onlyProprietes
    ? proprietes.filter(p => onlyProprietes.some(o => o.id === p.id))
    : proprietes;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-violet-900">Calendrier des réservations</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="font-medium px-2 select-none text-gray-600">
            {format(currentMonth, "MMMM yyyy", { locale: fr })}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-6">
        {shownProprietes.map((propriete) => (
          <div key={propriete.id} className="rounded-xl border shadow bg-white p-4">
            <div className="font-semibold mb-2 text-purple-800">{propriete.nom}</div>
            <ProprieteCalendar 
              proprieteId={propriete.id} 
              reservations={reservations.filter(r => r.id_propriete === propriete.id)} 
              currentMonth={currentMonth} 
            />
          </div>
        ))}
        {shownProprietes.length === 0 && (
          <div className="text-center text-gray-400 py-12">Aucune propriété trouvée.</div>
        )}
      </div>
    </div>
  );
};

function ProprieteCalendar({
  proprieteId,
  reservations,
  currentMonth
}: {
  proprieteId: string;
  reservations: ReservationWithDates[];
  currentMonth: Date;
}) {
  const reservMap: Record<string, ReservationWithDates> = useMemo(() => {
    const map: Record<string, ReservationWithDates> = {};
    reservations.forEach(r => {
      r.range.forEach(date => {
        map[format(date, "yyyy-MM-dd")] = r;
      });
    });
    return map;
  }, [reservations]);

  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  const dates = eachDayOfInterval({ start, end });

  const firstDay = start.getDay() || 7;
  const emptyCells = Array(firstDay - 1).fill(null);

  const baseCellStyle = "min-w-[42px] min-h-[44px] flex flex-col items-center justify-center rounded cursor-pointer relative select-none group";

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-7 mb-2 w-max min-w-full text-xs text-center text-gray-500">
        <div>Lun</div>
        <div>Mar</div>
        <div>Mer</div>
        <div>Jeu</div>
        <div>Ven</div>
        <div>Sam</div>
        <div>Dim</div>
      </div>
      <div className="grid grid-cols-7 gap-1 w-max min-w-full">
        {emptyCells.map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {dates.map(date => {
          const res = reservMap[format(date, "yyyy-MM-dd")];
          const isReserved = !!res;

          if (isReserved) {
            return (
              <HoverCard key={format(date, "yyyy-MM-dd")}>
                <HoverCardTrigger asChild>
                  <div
                    className={cn(
                      baseCellStyle, 
                      "bg-[#FEC6A1] text-purple-900 font-semibold hover:ring-2 hover:ring-orange-400 transition-shadow"
                    )}
                    style={{ border: "2px solid #FEC6A1" }}
                  >
                    <span>{date.getDate()}</span>
                    <span className="block text-[10px] mt-0.5">Réservé</span>
                  </div>
                </HoverCardTrigger>
                <HoverCardContent className="p-3 text-xs min-w-[170px]">
                  <div><strong>Client&nbsp;:</strong> {res.clients.nom} {res.clients.prenom}</div>
                  <div><strong>Tél&nbsp;:</strong> {res.clients.telephone || <i>n/a</i>}</div>
                  <div>
                    <strong>Séjour&nbsp;:</strong> du {format(parseISO(res.date_arrivee), 'dd/MM/yyyy')}
                    &nbsp;au {format(parseISO(res.date_depart), 'dd/MM/yyyy')}
                  </div>
                  <div><strong>Propriété&nbsp;:</strong> {res.proprietes.nom}</div>
                </HoverCardContent>
              </HoverCard>
            );
          } else {
            return (
              <div
                key={format(date, "yyyy-MM-dd")}
                className={cn(baseCellStyle, "bg-[#F1F0FB] text-gray-400 hover:bg-violet-50 transition-colors")}
              >
                <span>{date.getDate()}</span>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}

export default ReservationsCalendar;
