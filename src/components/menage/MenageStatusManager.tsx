import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { MenageStatut, MENAGE_LABELS } from "@/types/menage";
import { Check, Clock, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";

interface MenageStatusManagerProps {
  propertyId: string;
  date: Date;
  currentStatus?: MenageStatut;
  onStatusUpdate?: (newStatus: MenageStatut) => void;
}

export const MenageStatusManager = ({ 
  propertyId, 
  date, 
  currentStatus, 
  onStatusUpdate 
}: MenageStatusManagerProps) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateStatus = async (newStatus: MenageStatut) => {
    setIsUpdating(true);
    try {
      const dateString = format(date, 'yyyy-MM-dd');
      
      const { error } = await supabase
        .from('menage_statuts')
        .upsert({
          id_propriete: propertyId,
          date: dateString,
          statut: newStatus
        }, {
          onConflict: 'id_propriete,date'
        });

      if (error) throw error;

      onStatusUpdate?.(newStatus);
      toast({
        title: "Succès",
        description: `Statut mis à jour: ${MENAGE_LABELS[newStatus]}`,
      });
    } catch (error) {
      console.error('Error updating menage status:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusIcon = (status: MenageStatut) => {
    switch (status) {
      case 'termine':
        return <Check className="h-3 w-3" />;
      case 'en_cours':
        return <Clock className="h-3 w-3" />;
      case 'non_fait':
        return <X className="h-3 w-3" />;
    }
  };

  const getButtonClasses = (status?: MenageStatut) => {
    switch (status) {
      case 'termine':
        return 'opacity-100 bg-success text-success-foreground hover:bg-success/90';
      case 'en_cours':
        return 'opacity-100 bg-warning text-warning-foreground hover:bg-warning/90';
      default:
        return 'opacity-0 group-hover:opacity-100 hover:opacity-100';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`absolute top-1 right-1 h-6 w-6 p-0 rounded-md shadow-sm transition-opacity ${getButtonClasses(currentStatus)}`}
          disabled={isUpdating}
        >
          {currentStatus ? getStatusIcon(currentStatus) : <Clock className="h-3 w-3" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuItem 
          onClick={() => updateStatus('termine')}
          className="text-success hover:text-success"
        >
          <Check className="h-3 w-3 mr-2" />
          {MENAGE_LABELS.termine}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => updateStatus('en_cours')}
          className="text-warning hover:text-warning"
        >
          <Clock className="h-3 w-3 mr-2" />  
          {MENAGE_LABELS.en_cours}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => updateStatus('non_fait')}
          className="text-destructive hover:text-destructive"
        >
          <X className="h-3 w-3 mr-2" />
          {MENAGE_LABELS.non_fait}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};