// Types pour la gestion des statuts de ménage

export type MenageStatut = 'non_fait' | 'en_cours' | 'termine';

export interface MenageStatus {
  id: string;
  id_propriete: string;
  date: string; // Format: YYYY-MM-DD
  statut: MenageStatut;
}

export interface MenageStatusWithDetails extends MenageStatus {
  proprietes?: {
    nom: string;
  };
}

// Couleurs pour les statuts
export const MENAGE_COLORS = {
  non_fait: 'hsl(var(--destructive))', // Black/dark
  en_cours: 'hsl(var(--warning))',     // Orange  
  termine: 'hsl(var(--success))'       // Green
} as const;

// Labels pour les statuts
export const MENAGE_LABELS = {
  non_fait: 'Non fait',
  en_cours: 'En cours', 
  termine: 'Terminé'
} as const;