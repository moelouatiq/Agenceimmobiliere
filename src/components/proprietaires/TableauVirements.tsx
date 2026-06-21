
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowRight, Eye } from "lucide-react";
import { BilanPropriete } from "@/types/proprietaires";

interface TableauVirementsProps {
  proprietes: BilanPropriete[];
  isLoading: boolean;
  onVirementClick: (propriete: BilanPropriete) => void;
  onHistoriqueClick: (propriete: BilanPropriete) => void;
}

const TableauVirements: React.FC<TableauVirementsProps> = ({
  proprietes,
  isLoading,
  onVirementClick,
  onHistoriqueClick,
}) => {
  const formatMontant = (montant: number) => {
    return new Intl.NumberFormat("fr-MA", {
      style: "currency",
      currency: "MAD",
    }).format(montant);
  };

  if (isLoading) {
    return <div className="py-8 text-center">Chargement des données...</div>;
  }

  if (proprietes.length === 0) {
    return (
      <div className="py-8 text-center">
        Aucune propriété trouvée. Veuillez ajuster vos critères de recherche.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom de la propriété</TableHead>
            <TableHead>Propriétaire</TableHead>
            <TableHead className="text-right">Montant total à verser</TableHead>
            <TableHead className="text-right">Dépenses remboursables</TableHead>
            <TableHead className="text-right">Montant déjà versé</TableHead>
            <TableHead className="text-right">Solde disponible</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {proprietes.map((propriete) => (
            <TableRow key={propriete.id}>
              <TableCell className="font-medium">{propriete.nom}</TableCell>
              <TableCell>{propriete.nom_proprietaire}</TableCell>
              <TableCell className="text-right">
                {formatMontant(propriete.montantTotalAVerser)}
              </TableCell>
              <TableCell className="text-right text-orange-600">
                {formatMontant(propriete.depensesRemboursables)}
              </TableCell>
              <TableCell className="text-right">
                {formatMontant(propriete.montantDejaVerse)}
              </TableCell>
              <TableCell
                className={`text-right font-medium ${
                  propriete.soldeDisponible > 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatMontant(propriete.soldeDisponible)}
              </TableCell>
              <TableCell className="text-right flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onHistoriqueClick(propriete)}
                  aria-label={`Consulter l'historique des virements pour la propriété ${propriete.nom}`}
                >
                  <Eye className="h-5 w-5" />
                </Button>
                <Button
                  size="sm"
                  disabled={propriete.soldeDisponible <= 0}
                  onClick={() => onVirementClick(propriete)}
                  aria-label={`Effectuer un virement pour la propriété ${propriete.nom}`}
                >
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default TableauVirements;
