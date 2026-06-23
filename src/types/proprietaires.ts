
// Types pour la gestion des propriétaires et des virements

export interface Propriete {
  id: string;
  nom: string;
  nom_proprietaire: string;
  contact_proprietaire: string;
  adresse: string;
  nom_residence: string;
  type_appartement: string;
  groupe: string;
  taux_commission: number;
  autre_info: string;
}

export interface BilanPropriete extends Propriete {
  montantTotalAVerser: number;
  montantDejaVerse: number;
  depensesRemboursables: number;
  soldeDisponible: number;
}

export interface Virement {
  id: string;
  id_propriete: string;
  id_reservations?: string[];
  date: Date | string;
  montant: number;
  mode_paiement: string;
  reference?: string;
  remarque?: string;
}

// Types pour le rapport de propriété
export interface Reservation {
  id: string;
  date_arrivee: Date | string;
  date_depart: Date | string;
  nombre_jours: number;
  prix_par_nuit: number;
  prix_total: number;
  taux_commission: number;
  montant_commission: number;
  part_proprietaire: number;
}

export interface Depense {
  id: string;
  date: Date | string;
  type_depense?: string;
  nature: string;
  montant: number;
  reference?: string;
  mode_paiement?: string;
}

export interface RapportPropriete {
  propriete: Propriete;
  dateDebut: Date;
  dateFin: Date;
  totalFacture: number;
  totalCommissions: number;
  totalPartProprietaire: number;
  depensesRemboursables: number;
  virements: number;
  soldeAVerser: number;
  reservations: Reservation[];
  depenses: Depense[];
  virementsList: Virement[];
}
