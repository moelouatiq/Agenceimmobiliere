import { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, endOfWeek, addWeeks, subWeeks, isWithinInterval, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Download, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toast } from "@/hooks/use-toast";
import { MenageStatus, MenageStatut } from '@/types/menage';
import { MenageStatusBand } from '@/components/menage/MenageStatusBand';
import { MenageStatusManager } from '@/components/menage/MenageStatusManager';

// Define proper types for Supabase data structure
type SupabaseReservation = {
  id: string;
  date_arrivee: string;
  date_depart: string;
  clients: {
    nom: string;
    prenom: string;
  } | null;
  proprietes: {
    id: string;
    nom: string;
  } | null;
}

// Define the Reservation type to match our application structure
type Reservation = {
  id: string;
  date_arrivee: string;
  date_depart: string;
  client: {
    nom: string;
    prenom: string;
  } | null;
  proprietes: {
    id: string;
    nom: string;
  } | null;
};

type Property = {
  id: string;
  nom: string;
  nom_residence?: string;
  type_appartement?: string;
  groupe?: string;
};

const WeeklyOverview = ({ 
  onlyProprietes 
}: { 
  onlyProprietes?: Property[] 
}) => {
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [menageStatuses, setMenageStatuses] = useState<MenageStatus[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Generate week days (Monday to Sunday)
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const date = addDays(startOfWeek(currentWeek, { weekStartsOn: 1 }), i);
    return {
      date,
      dayName: format(date, 'EEE', { locale: fr }),
      dayNumber: format(date, 'd'),
      monthName: format(date, 'MMM', { locale: fr })
    };
  });

  // Calculate week range for display
  const weekStart = format(weekDays[0].date, 'dd/MM/yyyy');
  const weekEnd = format(weekDays[6].date, 'dd/MM/yyyy');

  // Navigation functions
  const previousWeek = () => setCurrentWeek(subWeeks(currentWeek, 1));
  const nextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));
  const currentWeekReset = () => setCurrentWeek(new Date());

  // Set properties from provided properties or fetch them if not provided
  useEffect(() => {
    const fetchProperties = async () => {
      // If filtered properties are provided, use them directly
      if (onlyProprietes) {
        console.log("Using filtered properties:", onlyProprietes);
        setProperties(onlyProprietes);
        return;
      }
      
      // Otherwise, fetch all properties from Supabase
      try {
        const { data, error } = await supabase
          .from('proprietes')
          .select('id, nom, nom_residence, type_appartement, groupe')
          .order('nom');
          
        if (error) throw error;
        
        console.log("Fetched properties:", data);
        setProperties(data || []);
      } catch (error) {
        console.error("Error fetching properties:", error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les propriétés",
          variant: "destructive"
        });
      }
    };
    
    fetchProperties();
  }, [onlyProprietes]);
  
  // Fetch reservations for the selected week
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      try {
        const startDate = format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const endDate = format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        
        // Fetch reservations
        const { data: reservationsData, error: reservationsError } = await supabase
          .from('reservations')
          .select(`
            id,
            date_arrivee,
            date_depart,
            clients:id_client (nom, prenom),
            proprietes:id_propriete (id, nom)
          `)
          .or(`date_arrivee.lte.${endDate},date_depart.gte.${startDate}`)
          .order('date_arrivee', { ascending: true });
          
        if (reservationsError) throw reservationsError;
        
        // Fetch housekeeping statuses for the week
        const { data: menageData, error: menageError } = await supabase
          .from('menage_statuts')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate);
          
        if (menageError) throw menageError;
        
        // The data from Supabase doesn't exactly match our SupabaseReservation type
        // We need to explicitly cast and transform it
        const rawData = reservationsData as any[] || [];
        
        console.log("Fetched raw reservations:", rawData);
        console.log("Fetched menage statuses:", menageData);
        
        // Filter to only include relevant properties if specified
        let filteredData = rawData;
        if (properties.length > 0) {
          const propertyIds = properties.map(p => p.id);
          filteredData = filteredData.filter(r => r.proprietes && propertyIds.includes(r.proprietes.id));
        }

        // Transform the data structure to match our Reservation type
        const transformedData: Reservation[] = filteredData.map(item => ({
          id: item.id,
          date_arrivee: item.date_arrivee,
          date_depart: item.date_depart,
          client: item.clients ? {
            nom: item.clients.nom || 'Client inconnu',
            prenom: item.clients.prenom || ''
          } : null,
          proprietes: item.proprietes ? {
            id: item.proprietes.id || '',
            nom: item.proprietes.nom || 'Propriété inconnue'
          } : null
        }));

        console.log("Transformed reservations:", transformedData);
        setReservations(transformedData);
        setMenageStatuses(menageData || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les données",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [currentWeek, properties]);
  
  // Generate PDF of the weekly overview with enhanced styling
  const generatePDF = () => {
    try {
      // Create a new PDF document with landscape orientation
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm'
      });

      // Define colors
      const colors = {
        primary: '#7E69AB', // Primary Purple
        background: '#F1F0FB', // Soft Gray
        text: '#1A1F2C', // Dark Purple
        arrival: '#4CAF50', // Green
        stay: '#FFF9C4', // Soft Yellow
        departure: '#FF5252', // Red
        border: '#D6BCFA', // Light Purple
        header: '#6E59A5', // Tertiary Purple
      };

      // Set font styles
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.setTextColor(colors.primary);
      
      // Add title with better positioning
      pdf.text(`Planning semaine du ${weekStart} au ${weekEnd}`, pdf.internal.pageSize.width / 2, 20, { align: 'center' });
      
      // Add date of generation
      pdf.setFontSize(10);
      pdf.setTextColor(colors.text);
      pdf.text(`Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm')}`, pdf.internal.pageSize.width - 15, 10, { align: 'right' });
      
      // Calculate table dimensions
      const margin = 10;
      const tableTop = 30;
      const tableWidth = pdf.internal.pageSize.width - (margin * 2);
      // Adjust column widths - make property column wider since we removed address
      const propertyColWidth = tableWidth / 4; // 1/4 of width for property name
      const daysColWidth = (tableWidth - propertyColWidth) / 7; // Remaining space divided by 7 days
      const rowHeight = 12;
      
      // Draw table header background
      pdf.setFillColor(colors.header);
      pdf.rect(margin, tableTop, tableWidth, rowHeight, 'F');
      
      // Add headers with white text
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(255, 255, 255);
      
      // Property name column
      pdf.text("PROPRIÉTÉ", margin + 5, tableTop + 8);
      
      // Add day headers
      weekDays.forEach((day, i) => {
        const x = margin + propertyColWidth + (i * daysColWidth);
        pdf.text(`${day.dayName.toUpperCase()}`, x + daysColWidth/2, tableTop + 5, { align: 'center' });
        pdf.text(`${day.dayNumber} ${day.monthName}`, x + daysColWidth/2, tableTop + 10, { align: 'center' });
      });
      
      // Draw data rows
      let currentY = tableTop + rowHeight;
      
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(colors.text);
      
      properties.forEach((property, rowIndex) => {
        // Alternate row background for better readability
        const isEvenRow = rowIndex % 2 === 0;
        if (isEvenRow) {
          pdf.setFillColor(colors.background);
          pdf.rect(margin, currentY, tableWidth, rowHeight, 'F');
        }
        
        // Add borders
        pdf.setDrawColor(colors.border);
        pdf.rect(margin, currentY, tableWidth, rowHeight);
        
        // Property name - limit to available space
        const propertyName = property.nom || "Propriété inconnue";
        const truncatedPropertyName = propertyName.length > 20 ? propertyName.substring(0, 18) + "..." : propertyName;
        pdf.text(truncatedPropertyName, margin + 2, currentY + 8);
        
        // Days with reservations
        weekDays.forEach((day, dayIndex) => {
          const cellX = margin + propertyColWidth + (dayIndex * daysColWidth);
          const cellY = currentY;
          
          // Draw cell border
          pdf.line(cellX, cellY, cellX, cellY + rowHeight);
          
          const reservation = getReservationForDay(property.id, day.date);
          if (reservation) {
            const isArrival = format(day.date, 'yyyy-MM-dd') === reservation.date_arrivee;
            const isDeparture = format(day.date, 'yyyy-MM-dd') === reservation.date_depart;
            
            // Fill cell background for stay
            pdf.setFillColor(hexToRgb(colors.stay).r, hexToRgb(colors.stay).g, hexToRgb(colors.stay).b);
            pdf.rect(cellX, cellY, daysColWidth, rowHeight, 'F');
            
             // Add client name
             if (reservation.client) {
               // Ensure text is always black for client names
               pdf.setFont("helvetica", "normal");
               pdf.setFontSize(10);
               pdf.setTextColor(0, 0, 0); // Black text
               const clientName = `${reservation.client.nom.substring(0, 10)}${reservation.client.nom.length > 10 ? ".." : ""}`;
               pdf.text(clientName, cellX + daysColWidth/2, cellY + 8, { align: 'center' });
             }
            
            // Check for turnover day first
            const isTurnover = isTurnoverDay(property.id, day.date);
            if (isTurnover) {
              // Orange background for turnover
              pdf.setFillColor(255, 165, 0); // Orange
              pdf.rect(cellX, cellY, daysColWidth, rowHeight, 'F');
              
              // Add turnover icon (simplified as text)
              pdf.setFont("helvetica", "bold");
              pdf.setFontSize(8);
               pdf.setTextColor(0, 0, 0); // Black text
              pdf.text("⟲", cellX + daysColWidth/2, cellY + 8, { align: 'center' });
            } else {
              // Add arrival/departure indicators
              if (isArrival) {
                pdf.setFillColor(hexToRgb(colors.arrival).r, hexToRgb(colors.arrival).g, hexToRgb(colors.arrival).b);
                pdf.circle(cellX + 3, cellY + 3, 2, 'F');
              }
              
              if (isDeparture) {
                pdf.setFillColor(hexToRgb(colors.departure).r, hexToRgb(colors.departure).g, hexToRgb(colors.departure).b);
                pdf.circle(cellX + daysColWidth - 3, cellY + 3, 2, 'F');
              }
            }
          }
        });
        
        currentY += rowHeight;
      });
      
      // Add legend at the bottom
      const legendY = currentY + 10;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(colors.text);
      pdf.text("Légende:", margin, legendY);
      
      // Legend items
      const legendItems = [
        { color: colors.arrival, text: "Arrivée" },
        { color: colors.stay, text: "Séjour" },
        { color: colors.departure, text: "Départ" },
        { color: '#FFA500', text: "Rotation" }
      ];
      
      legendItems.forEach((item, i) => {
        const x = margin + 20 + (i * 35);
        
        // Draw colored box
        pdf.setFillColor(hexToRgb(item.color).r, hexToRgb(item.color).g, hexToRgb(item.color).b);
        pdf.rect(x, legendY - 3, 5, 5, 'F');
        
        // Add text
        pdf.setFont("helvetica", "normal");
        pdf.text(item.text, x + 8, legendY);
      });
      
      // Footer with page number
      const pageCount = pdf.internal.pages.length;
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Page ${pageCount}`, pdf.internal.pageSize.width - 20, pdf.internal.pageSize.height - 10);
      
      pdf.save(`Planning_Semaine_${weekStart}_${weekEnd}.pdf`);
      toast({
        title: "Succès",
        description: "PDF généré avec succès",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la génération du PDF",
        variant: "destructive"
      });
    }
  };
  
  // Helper function to convert hex color to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };
  
  // Check if a date has a reservation for a specific property
  const getReservationForDay = (propertyId: string, day: Date) => {
    return reservations.find(reservation => {
      if (!reservation.proprietes || reservation.proprietes.id !== propertyId) return false;
      
      const arrivalDate = parseISO(reservation.date_arrivee);
      const departureDate = parseISO(reservation.date_depart);
      
      return isWithinInterval(day, { start: arrivalDate, end: departureDate });
    });
  };
  
  // Check if a day is an arrival or departure day
  const isArrivalDay = (reservation: Reservation, day: Date) => {
    return format(day, 'yyyy-MM-dd') === reservation.date_arrivee;
  };
  
  const isDepartureDay = (reservation: Reservation, day: Date) => {
    return format(day, 'yyyy-MM-dd') === reservation.date_depart;
  };

  // Check if a day is a turnover day (departure and arrival on same day for same property)
  const isTurnoverDay = (propertyId: string, day: Date) => {
    const dayString = format(day, 'yyyy-MM-dd');
    
    // Find a departure on this day
    const departureReservation = reservations.find(reservation => 
      reservation.proprietes?.id === propertyId && 
      reservation.date_depart === dayString
    );
    
    // Find an arrival on this day
    const arrivalReservation = reservations.find(reservation => 
      reservation.proprietes?.id === propertyId && 
      reservation.date_arrivee === dayString
    );
    
    // It's a turnover day if both exist and they're different reservations
    return departureReservation && arrivalReservation && departureReservation.id !== arrivalReservation.id;
  };

  // Get both departing and arriving reservations for a turnover day
  const getTurnoverReservations = (propertyId: string, day: Date) => {
    const dayString = format(day, 'yyyy-MM-dd');
    
    const departureReservation = reservations.find(reservation => 
      reservation.proprietes?.id === propertyId && 
      reservation.date_depart === dayString
    );
    
    const arrivalReservation = reservations.find(reservation => 
      reservation.proprietes?.id === propertyId && 
      reservation.date_arrivee === dayString
    );
    
    return { departure: departureReservation, arrival: arrivalReservation };
  };

  // Get housekeeping status for a specific property and date
  const getMenageStatus = (propertyId: string, date: Date): MenageStatut | undefined => {
    const dateString = format(date, 'yyyy-MM-dd');
    const status = menageStatuses.find(s => s.id_propriete === propertyId && s.date === dateString);
    return status?.statut;
  };

  // Handle housekeeping status updates
  const handleMenageStatusUpdate = (propertyId: string, date: Date, newStatus: MenageStatut) => {
    const dateString = format(date, 'yyyy-MM-dd');
    setMenageStatuses(prev => {
      const existing = prev.find(s => s.id_propriete === propertyId && s.date === dateString);
      if (existing) {
        return prev.map(s => 
          s.id_propriete === propertyId && s.date === dateString 
            ? { ...s, statut: newStatus }
            : s
        );
      } else {
        return [...prev, {
          id: `temp-${Date.now()}`, // Temporary ID
          id_propriete: propertyId,
          date: dateString,
          statut: newStatus
        }];
      }
    });
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={previousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={currentWeekReset}>
              Cette semaine
            </Button>
            <Button variant="outline" onClick={nextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="font-medium">
            Semaine du {weekStart} au {weekEnd}
          </div>
          <Button variant="outline" onClick={generatePDF}>
            <Download className="h-4 w-4 mr-2" /> Télécharger PDF
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border p-2 bg-gray-100 min-w-36">Propriété</th>
                {weekDays.map((day) => (
                  <th key={day.date.toISOString()} className="border p-2 bg-gray-100 min-w-20 text-center">
                    <div>{day.dayName}</div>
                    <div>{day.dayNumber} {day.monthName}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="border p-4 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-progest-primary"></div>
                    </div>
                  </td>
                </tr>
              ) : properties.length === 0 ? (
                <tr>
                  <td colSpan={8} className="border p-4 text-center">
                    Aucune propriété ne correspond à vos critères de filtrage
                  </td>
                </tr>
              ) : (
                properties.map((property) => (
                  <tr key={property.id}>
                    <td className="border p-2 font-medium">{property.nom}</td>
                    {weekDays.map((day) => {
                       const isTurnover = isTurnoverDay(property.id, day.date);
                       const reservation = getReservationForDay(property.id, day.date);
                       const menageStatus = getMenageStatus(property.id, day.date);
                       
                       if (isTurnover) {
                         const { departure, arrival } = getTurnoverReservations(property.id, day.date);
                         
                         return (
                           <td key={day.date.toISOString()} className="border p-0 h-12 relative bg-orange-200 group">
                             <TooltipProvider>
                               <Tooltip>
                                 <TooltipTrigger asChild>
                                   <div className="w-full h-full cursor-help relative">
                                     <RefreshCw className="h-4 w-4 text-orange-600 absolute top-1 left-1" />
                                     <MenageStatusManager
                                       propertyId={property.id}
                                       date={day.date}
                                       currentStatus={menageStatus}
                                       onStatusUpdate={(newStatus) => handleMenageStatusUpdate(property.id, day.date, newStatus)}
                                     />
                                   </div>
                                 </TooltipTrigger>
                                 <TooltipContent>
                                   <p className="font-medium text-orange-600">🔄 ROTATION</p>
                                   {departure && departure.client && (
                                     <div className="mt-1">
                                       <p className="text-xs font-medium">Départ:</p>
                                       <p className="text-xs">{departure.client.nom} {departure.client.prenom}</p>
                                     </div>
                                   )}
                                   {arrival && arrival.client && (
                                     <div className="mt-1">
                                       <p className="text-xs font-medium">Arrivée:</p>
                                       <p className="text-xs">{arrival.client.nom} {arrival.client.prenom}</p>
                                     </div>
                                   )}
                                 </TooltipContent>
                               </Tooltip>
                             </TooltipProvider>
                             <MenageStatusBand statut={menageStatus} />
                           </td>
                         );
                       }
                       
                       const isArrival = reservation && isArrivalDay(reservation, day.date);
                       const isDeparture = reservation && isDepartureDay(reservation, day.date);
                       
                       let cellClass = "border p-0 h-12 relative group";
                       if (reservation) {
                         cellClass += " bg-amber-100";
                         if (isArrival) cellClass += " border-l-4 border-l-green-500";
                         if (isDeparture) cellClass += " border-r-4 border-r-red-500";
                       }
                       
                       return (
                         <td key={day.date.toISOString()} className={cellClass}>
                           {reservation && reservation.client ? (
                             <TooltipProvider>
                               <Tooltip>
                                 <TooltipTrigger asChild>
                                   <div className="w-full h-full flex items-center justify-center cursor-help relative">
                                     {isArrival && <div className="absolute left-0 top-0 w-3 h-3 bg-green-500 rounded-full m-1"></div>}
                                     {isDeparture && <div className="absolute right-0 top-0 w-3 h-3 bg-red-500 rounded-full m-1"></div>}
                                     <div className="text-xs text-center">
                                       {reservation.client.nom.substring(0, 10)}
                                       {reservation.client.nom.length > 10 && "..."}
                                     </div>
                                     <MenageStatusManager
                                       propertyId={property.id}
                                       date={day.date}
                                       currentStatus={menageStatus}
                                       onStatusUpdate={(newStatus) => handleMenageStatusUpdate(property.id, day.date, newStatus)}
                                     />
                                   </div>
                                 </TooltipTrigger>
                                 <TooltipContent>
                                   <p className="font-medium">{reservation.client.nom} {reservation.client.prenom}</p>
                                   <p className="text-xs">Arrivée: {format(parseISO(reservation.date_arrivee), 'dd/MM/yyyy')}</p>
                                   <p className="text-xs">Départ: {format(parseISO(reservation.date_depart), 'dd/MM/yyyy')}</p>
                                 </TooltipContent>
                               </Tooltip>
                             </TooltipProvider>
                           ) : (
                             <div className="w-full h-full relative">
                               <MenageStatusManager
                                 propertyId={property.id}
                                 date={day.date}
                                 currentStatus={menageStatus}
                                 onStatusUpdate={(newStatus) => handleMenageStatusUpdate(property.id, day.date, newStatus)}
                               />
                             </div>
                           )}
                           <MenageStatusBand statut={menageStatus} />
                         </td>
                       );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 flex justify-end gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Arrivée</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-amber-100"></div>
            <span>Séjour</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Départ</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-200 rounded-full flex items-center justify-center relative">
              <RefreshCw className="h-2 w-2 text-orange-600 absolute top-0 left-0" />
            </div>
            <span>Rotation</span>
          </div>
          <div className="border-l border-gray-300 mx-2 h-4"></div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-1 bg-success rounded-sm"></div>
            <span>Ménage terminé</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-1 bg-warning rounded-sm"></div>
            <span>Ménage en cours</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-1 bg-destructive rounded-sm"></div>
            <span>Ménage non fait</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyOverview;
