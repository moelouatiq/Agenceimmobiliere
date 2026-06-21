import { cn } from "@/lib/utils";
import { MenageStatut, MENAGE_COLORS } from "@/types/menage";

interface MenageStatusBandProps {
  statut?: MenageStatut;
  className?: string;
}

export const MenageStatusBand = ({ statut, className }: MenageStatusBandProps) => {
  if (!statut || statut === 'non_fait') return null;

  const getStatusColor = (status: MenageStatut) => {
    switch (status) {
      case 'termine':
        return 'bg-success';
      case 'en_cours':
        return 'bg-warning';
      case 'non_fait':
        return 'bg-destructive';
      default:
        return 'bg-muted';
    }
  };

  return (
    <div 
      className={cn(
        "absolute bottom-0 left-0 right-0 h-1 rounded-b-sm",
        getStatusColor(statut),
        className
      )}
    />
  );
};