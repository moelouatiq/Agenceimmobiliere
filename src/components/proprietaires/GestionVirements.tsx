
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import TableauVirements from "./TableauVirements";
import FormulaireVirement from "./FormulaireVirement";
import HistoriqueVirements from "./HistoriqueVirements";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Propriete, Virement, BilanPropriete } from "@/types/proprietaires";

const GestionVirements = () => {
  const [proprietes, setProprietes] = useState<BilanPropriete[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPropriete, setSelectedPropriete] = useState<BilanPropriete | null>(null);
  const [showVirementForm, setShowVirementForm] = useState(false);
  const [showHistorique, setShowHistorique] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: proprietesData, error: proprietesError } = await supabase
        .from("proprietes")
        .select("*");

      if (proprietesError) throw proprietesError;

      const { data: reservationsData, error: reservationsError } = await supabase
        .from("reservations")
        .select("id_propriete, part_proprietaire, status")
        .neq("status", "Annulé"); // Exclure les réservations avec le statut "Annulé"

      if (reservationsError) throw reservationsError;

      const { data: virementsData, error: virementsError } = await supabase
        .from("virements_proprietaires")
        .select("id_propriete, montant");

      if (virementsError) throw virementsError;

      // Récupérer les dépenses remboursables
      const { data: depensesData, error: depensesError } = await supabase
        .from("depenses")
        .select("id_propriete, montant, nature")
        .eq("nature", "remboursable");

      if (depensesError) throw depensesError;

      const proprietesAvecBilan = proprietesData.map((propriete: Propriete) => {
        const reservationsPropriete = reservationsData.filter(
          (r) => r.id_propriete === propriete.id
        );
        const montantTotalAVerser = reservationsPropriete.reduce(
          (sum, reservation) => sum + (Number(reservation.part_proprietaire) || 0),
          0
        );

        const virementsPropriete = virementsData.filter(
          (v) => v.id_propriete === propriete.id
        );
        const montantDejaVerse = virementsPropriete.reduce(
          (sum, virement) => sum + (Number(virement.montant) || 0),
          0
        );

        // Calculer le total des dépenses remboursables pour cette propriété
        const depensesPropriete = depensesData.filter(
          (d) => d.id_propriete === propriete.id
        );
        const depensesRemboursables = depensesPropriete.reduce(
          (sum, depense) => sum + (Number(depense.montant) || 0),
          0
        );

        // Nouveau calcul du solde disponible incluant les dépenses remboursables
        const soldeDisponible = montantTotalAVerser - montantDejaVerse - depensesRemboursables;

        return {
          ...propriete,
          montantTotalAVerser,
          montantDejaVerse,
          depensesRemboursables,
          soldeDisponible,
        };
      });

      setProprietes(proprietesAvecBilan);
    } catch (error: any) {
      console.error("Erreur lors du chargement des données:", error);
      setError("Une erreur est survenue lors du chargement des données.");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProprietes = proprietes.filter(
    (propriete) =>
      propriete.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      propriete.nom_proprietaire.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleVirementClick = (propriete: BilanPropriete) => {
    setSelectedPropriete(propriete);
    setShowVirementForm(true);
    setShowHistorique(false);
  };

  const handleHistoriqueClick = (propriete: BilanPropriete) => {
    setSelectedPropriete(propriete);
    setShowHistorique(true);
    setShowVirementForm(false);
    console.log("Consultation de l'historique pour la propriété:", propriete.nom);
  };

  const handleVirementSubmit = async (virement: Virement) => {
    try {
      const { id_reservations, ...virementRow } = virement;

      const { data, error } = await supabase
        .from("virements_proprietaires")
        .insert([virementRow])
        .select("id")
        .single();

      if (error) throw error;

      if (id_reservations && id_reservations.length > 0) {
        const { error: jError } = await supabase
          .from("virement_reservations")
          .insert(
            id_reservations.map((id_reservation) => ({
              id_virement: data.id,
              id_reservation,
            }))
          );
        if (jError) throw jError;
      }

      fetchData();
      setShowVirementForm(false);
      setSelectedPropriete(null);
    } catch (error: any) {
      console.error("Erreur lors de l'enregistrement du virement:", error);
      setError("Une erreur est survenue lors de l'enregistrement du virement.");
    }
  };

  const handleCloseHistorique = () => {
    setShowHistorique(false);
    setSelectedPropriete(null);
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher par nom de propriété ou propriétaire..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button onClick={fetchData} variant="outline">
          Actualiser
        </Button>
      </div>

      {showVirementForm && selectedPropriete ? (
        <Card className="p-4">
          <FormulaireVirement
            propriete={selectedPropriete}
            onSubmit={handleVirementSubmit}
            onCancel={() => {
              setShowVirementForm(false);
              setSelectedPropriete(null);
            }}
          />
        </Card>
      ) : showHistorique && selectedPropriete ? (
        <HistoriqueVirements
          propriete={selectedPropriete}
          onClose={handleCloseHistorique}
        />
      ) : (
        <TableauVirements
          proprietes={filteredProprietes}
          isLoading={isLoading}
          onVirementClick={handleVirementClick}
          onHistoriqueClick={handleHistoriqueClick}
        />
      )}
    </div>
  );
};

export default GestionVirements;
