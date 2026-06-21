
import React, { useCallback, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import jsPDF from 'jspdf';

type ContractProps = {
  clientNom: string;
  clientPrenom: string;
  clientCinPassport: string;
  clientTelephone: string;
  dateReservation: Date;
  dateArrivee: Date;
  dateDepart: Date;
  nombreJours: number;
  prixParNuit: number;
  prixTotal: number;
  paiementAvance: number;
  resteAPayer: number;
};

const ContractGenerator = ({
  isOpen,
  onClose,
  data
}: {
  isOpen: boolean;
  onClose: () => void;
  data: ContractProps;
}) => {
  const today = new Date();

  const sections = [
    {
      title: "1. Objet de la location",
      content: "Le logement est loué exclusivement à usage d'habitation temporaire et touristique. Toute sous-location ou usage commercial est strictement interdit."
    },
    {
      title: "2. Accès à la résidence",
      content: "L'accès à la résidence est réservé aux locataires enregistrés. Le client doit communiquer à l'agence le nombre exact d'occupants dès la réservation. Toute personne non déclarée à la sécurité pourra se voir refuser l'accès."
    },
    {
      title: "3. Durée de la location",
      content: "La durée est convenue à l'avance, mentionnée dans le contrat. Aucun prolongement ne pourra être accordé sans l'accord écrit de l'agence."
    },
    {
      title: "4. Caution",
      content: "Une caution est exigée à l'entrée dans les lieux. Elle couvre les éventuels dommages ou manquements. Elle sera restituée après état des lieux, sous réserve d'aucun dégât."
    },
    {
      title: "5. Règlement intérieur de la résidence",
      content: "Le locataire s'engage à respecter les règles de la copropriété :",
      bulletPoints: [
        "Fiche locataire obligatoire : Identité du locataire, membres accompagnants, durée du séjour, immatriculation du véhicule.",
        "Location réservée aux familles : Couples mariés avec enfants uniquement. Location aux célibataires interdite.",
        "Engagement signé : Le locataire doit signer un engagement de respect du règlement de copropriété.",
        "Une seule voiture autorisée par locataire dans la résidence.",
        "Aucun invité n'est autorisé chez le locataire.",
        "Limite d'occupation : Maximum 6 personnes.",
        "Utilisation réglementée des espaces communs (piscine, jardins, parkings)",
        "Animaux interdits (sauf autorisation spéciale)."
      ]
    },
    {
      title: "6. Propreté et entretien",
      content: "Le locataire doit maintenir le logement propre. En cas de salissures excessives ou de non-respect du ménage de sortie, un forfait ménage pourra être facturé."
    },
    {
      title: "7. Intervention technique",
      content: "En cas de panne ou dysfonctionnement, le locataire doit prévenir l'agence immédiatement. Aucune intervention extérieure ne doit être engagée sans autorisation."
    },
    {
      title: "8. Annulation & Remboursement",
      content: "En cas d'annulation par le locataire :",
      bulletPoints: [
        "L'acompte reste acquis à l'agence.",
        "Aucun remboursement ne sera effectué en cas de départ anticipé."
      ]
    },
    {
      title: "9. Respect du voisinage et des lieux",
      content: "Tout comportement irrespectueux ou nuisible (bruits, dégradations, incivilités) peut entraîner une expulsion immédiate sans remboursement."
    }
  ];

  // Fixed formatMontant function to properly handle number formatting
  const formatMontant = (montant: number): string => {
    // Ensure the montant is a number
    const montantNumber = typeof montant === 'number' ? montant : parseFloat(String(montant));
    
    // Format the number manually to avoid slash issues
    // First convert to string with 2 decimal places
    const numberParts = montantNumber.toFixed(2).split('.');
    
    // Format the integer part with space as thousand separator
    const integerPart = numberParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    
    // Combine with decimal part
    const formattedNumber = `${integerPart},${numberParts[1]} MAD`;
    
    return formattedNumber;
  };

  const handleDownload = useCallback(() => {
    const doc = new jsPDF({
      format: 'a4',
      unit: 'mm',
    });
    
    // Paramètres pour la première page 
    const margin = 20;
    const pageWidth = 210;
    const pageHeight = 297;
    const contentWidth = pageWidth - (2 * margin);
    const baseLineHeight = 5;

    // Paramètres optimisés pour la deuxième page
    const dispositionsMargin = 15;
    const dispositionsContentWidth = pageWidth - (2 * dispositionsMargin);
    // Increase base line height slightly for clauses
    const dispositionsBaseLineHeight = 4.5; // Increased from 4.2 to 4.5
    const sectionSpacing = 1;

    const getTextHeight = (text: string, maxWidth: number, lineHeight = baseLineHeight) => {
      const lines = doc.splitTextToSize(text, maxWidth);
      return lines.length * lineHeight;
    };

    const ensureSpace = (neededHeight: number, currentY: number, currentPageMargin = margin) => {
      if (currentY + neededHeight > pageHeight - currentPageMargin) {
        doc.addPage();
        return currentPageMargin;
      }
      return currentY;
    }

    // PREMIÈRE PAGE - Entête, parties au contrat et détails financiers
    doc.setFont("times", "normal");
    
    doc.setFontSize(16);
    doc.setFont("times", "bold");
    doc.text("SUD HOWS DISTRIBUTION", pageWidth/2, margin + 5, { align: "center" });
    
    doc.setFontSize(12);
    doc.setFont("times", "normal");
    doc.text("Agence Immobilière Et Conciergerie", pageWidth/2, margin + 12, { align: "center" });
    doc.text("N°1850, Mosquée Attowba, Imiouadar, Commune Tamri", pageWidth/2, margin + 18, { align: "center" });
    doc.text("Téléphone : 07 70 74 54 44 / 05 28 20 09 22", pageWidth/2, margin + 24, { align: "center" });
    doc.text("RC : 58239 – IF : 48588455 – ICE : 002716399000091", pageWidth/2, margin + 30, { align: "center" });

    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(margin, margin + 42, pageWidth - margin, margin + 42);

    doc.setFontSize(14);
    doc.setFont("times", "bold");
    doc.text("CONTRAT DE RÉSERVATION SAISONNIÈRE", pageWidth/2, margin + 52, { align: "center" });

    let y = margin + 65;
    
    // Ajout des parties au contrat sur la première page
    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text("PARTIES AU CONTRAT", margin, y);
    y += baseLineHeight * 2;

    doc.setFont("times", "normal");
    doc.setFontSize(11);
    
    const text1 = "L'Agence PROGEST REAL ESTATE, représentée par son gestionnaire, ci-après désignée par « l'Agence »,";
    doc.text(text1, margin, y);
    y += baseLineHeight * 1.5;
    
    doc.text("Et", margin, y);
    y += baseLineHeight * 1.5;
    
    const text2 = `M. ${data.clientNom} ${data.clientPrenom}, porteur de la carte d'identité nationale n° ${data.clientCinPassport || "[Non fourni]"},`;
    doc.text(text2, margin, y);
    y += baseLineHeight;
    
    doc.text(`joignable au ${data.clientTelephone}`, margin, y);
    y += baseLineHeight;
    
    doc.text("Ci-après désigné par « le Client »,", margin, y);
    y += baseLineHeight * 2;
    
    // Détails de la réservation
    doc.setFont("times", "normal");
    doc.text("Objet du contrat : Location saisonnière d'un appartement meublé pour une durée déterminée.", margin, y);
    y += baseLineHeight * 3;

    doc.setFont("times", "bold");
    doc.text("Détails de la réservation :", margin, y);
    y += baseLineHeight * 2;

    doc.setFont("times", "normal");
    const details = [
      [`Date de réservation`, format(data.dateReservation, 'dd/MM/yyyy')],
      [`Date d'entrée (Check-in)`, format(data.dateArrivee, 'dd/MM/yyyy')],
      [`Date de sortie (Check-out)`, format(data.dateDepart, 'dd/MM/yyyy')],
      [`Durée totale du séjour`, `${data.nombreJours} nuits`],
      [`Prix par nuitée`, formatMontant(data.prixParNuit)],
      [`Montant total de la réservation`, formatMontant(data.prixTotal)],
      [`Acompte versé`, formatMontant(data.paiementAvance)],
      [`Solde restant dû à l'entrée`, formatMontant(data.resteAPayer)]
    ];

    details.forEach(([label, value]) => {
      doc.text("•", margin + 2, y);
      doc.text(label + " :", margin + 8, y);
      doc.text(value, margin + 90, y);
      y += baseLineHeight * 2;
    });

    // DEUXIÈME PAGE - Entête de la société, parties au contrat, clauses puis signatures
    doc.addPage();
    y = margin;

    // 1. Entête de la société (plus compact sur la deuxième page)
    doc.setFontSize(14); // Réduction de la taille de police
    doc.setFont("times", "bold");
    doc.text("SUD HOWS DISTRIBUTION", pageWidth/2, y, { align: "center" });
    y += 5; // Espacement réduit
    
    doc.setFontSize(10); // Taille encore plus réduite pour les informations secondaires
    doc.setFont("times", "normal");
    doc.text("Agence Immobilière Et Conciergerie", pageWidth/2, y, { align: "center" });
    y += 3.5; // Espacement très réduit
    doc.text("N°1850, Mosquée Attowba, Imiouadar, Commune Tamri", pageWidth/2, y, { align: "center" });
    y += 3.5;
    doc.text("Téléphone : 07 70 74 54 44 / 05 28 20 09 22", pageWidth/2, y, { align: "center" });
    y += 3.5;
    doc.text("RC : 58239 – IF : 48588455 – ICE : 002716399000091", pageWidth/2, y, { align: "center" });
    y += 5;

    doc.setDrawColor(0);
    doc.setLineWidth(0.3); // Ligne plus fine
    doc.line(margin, y, pageWidth - margin, y);
    y += 6; // Espacement réduit après la ligne

    // 2. Parties au contrat - avec espacement optimisé
    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text("PARTIES AU CONTRAT", pageWidth/2, y, { align: "center" });
    y += dispositionsBaseLineHeight * 2;

    doc.setFontSize(10);
    doc.setFont("times", "normal");
    const text1Again = "L'Agence PROGEST REAL ESTATE, représentée par son gestionnaire, ci-après désignée par « l'Agence »,";
    doc.text(text1Again, margin, y, { align: 'justify', maxWidth: contentWidth });
    y += dispositionsBaseLineHeight * 1.5;

    doc.text("Et", margin, y);
    y += dispositionsBaseLineHeight * 1.5;

    const text2Again = `M. ${data.clientNom} ${data.clientPrenom}, porteur de la carte d'identité nationale n° ${data.clientCinPassport || "[Non fourni]"},`;
    doc.text(text2Again, margin, y, { align: 'justify', maxWidth: contentWidth });
    y += dispositionsBaseLineHeight;
    
    doc.text(`joignable au ${data.clientTelephone}`, margin, y);
    y += dispositionsBaseLineHeight;
    
    doc.text("Ci-après désigné par « le Client »,", margin, y);
    y += dispositionsBaseLineHeight * 1.5;

    // 3. Clauses (Dispositions générales) - avec une taille de police légèrement plus grande
    doc.setFontSize(11); // Keep this size for the title
    doc.setFont("times", "bold");
    const title = "Dispositions Générales – Location Saisonnière";
    doc.text(title, pageWidth/2, y, { align: "center" });
    y += dispositionsBaseLineHeight * 1.5;

    // Contenu des dispositions générales - avec une police légèrement plus grande
    doc.setFontSize(9.5); // Increased from 9 to 9.5 for clauses
    sections.forEach((section, index) => {
      y = ensureSpace(dispositionsBaseLineHeight * 1.5, y, dispositionsMargin);
      
      doc.setFont("times", "bold");
      doc.text(section.title, dispositionsMargin, y);
      y += dispositionsBaseLineHeight * 0.8;

      doc.setFont("times", "normal");
      const contentHeight = getTextHeight(section.content, dispositionsContentWidth - 5, dispositionsBaseLineHeight * 0.8);
      y = ensureSpace(contentHeight, y, dispositionsMargin);
      doc.text(section.content, dispositionsMargin + 5, y, { 
        align: 'justify',
        maxWidth: dispositionsContentWidth - 5 
      });
      y += contentHeight + sectionSpacing * 0.5;

      if (section.bulletPoints) {
        section.bulletPoints.forEach(point => {
          const bulletHeight = getTextHeight(point, dispositionsContentWidth - 13, dispositionsBaseLineHeight * 0.8);
          y = ensureSpace(bulletHeight, y, dispositionsMargin);
          
          doc.text("•", dispositionsMargin + 5, y);
          doc.text(point, dispositionsMargin + 10, y, { 
            align: 'justify',
            maxWidth: dispositionsContentWidth - 15
          });
          y += bulletHeight + sectionSpacing * 0.3;
        });
      }

      y += sectionSpacing * 0.3;
    });

    // 4. Signatures (à la fin du document, après les clauses)
    y = ensureSpace(baseLineHeight * 6, y, margin);
    y += baseLineHeight * 3; // Add more space here to separate signatures from clauses
    
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    
    doc.text(`Fait à Imiouadar, le ${format(today, 'dd/MM/yyyy', { locale: fr })}`, margin, y);
    y += baseLineHeight;
    doc.text("En deux exemplaires originaux, dont un remis au client.", margin, y);
    y += baseLineHeight * 2;

    doc.text("Signature du Client :", margin, y);
    doc.text("Signature de l'Agence :", pageWidth - margin - 50, y);

    // Numérotation des pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8); // Plus petit pour économiser de l'espace
      doc.text(`Page ${i} / ${pageCount}`, pageWidth/2, pageHeight - 5, { align: "center" });
    }

    doc.save(`contrat-${data.clientNom}-${format(today, 'yyyy-MM-dd')}.pdf`);
  }, [data]);

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contrat de Réservation</DialogTitle>
        </DialogHeader>
        <div className="contract-content space-y-6 text-sm">
          {/* Première page - Entête + Parties au contrat + Détails financiers */}
          <div className="border-b pb-6 mb-8">
            <div className="text-center font-bold space-y-1">
              <h1 className="text-xl">SUD HOWS DISTRIBUTION</h1>
              <p>Agence Immobilière Et Conciergerie</p>
              <p>Adresse : N°1850, Mosquée Attowba, Imiouadar, Commune Tamri</p>
              <p>Téléphone : 07 70 74 54 44 / 05 28 20 09 22</p>
              <p>RC : 58239 – IF : 48588455 – ICE : 002716399000091</p>
            </div>

            <h2 className="text-center text-lg font-bold mt-8">CONTRAT DE RÉSERVATION SAISONNIÈRE</h2>

            {/* Parties au contrat - Ajouté à la première page */}
            <div className="mt-6">
              <h3 className="font-bold">PARTIES AU CONTRAT</h3>
              <p className="mt-2">L'Agence PROGEST REAL ESTATE, représentée par son gestionnaire, ci-après désignée par « l'Agence »,</p>
              <p className="mt-1">Et</p>
              <p className="mt-1">
                M. {data.clientNom} {data.clientPrenom}, porteur de la carte d'identité nationale n° {data.clientCinPassport || "[Non fourni]"}, 
                joignable au {data.clientTelephone}
              </p>
              <p className="mt-1">Ci-après désigné par « le Client »,</p>
            </div>

            <p className="mt-4">Objet du contrat : Location saisonnière d'un appartement meublé pour une durée déterminée.</p>

            <div className="mt-6 space-y-2">
              <h3 className="font-bold">Détails de la réservation :</h3>
              <p>Date de réservation : {format(data.dateReservation, 'dd/MM/yyyy')}</p>
              <p>Date d'entrée (Check-in) : {format(data.dateArrivee, 'dd/MM/yyyy')}</p>
              <p>Date de sortie (Check-out) : {format(data.dateDepart, 'dd/MM/yyyy')}</p>
              <p>Durée totale du séjour : {data.nombreJours} nuits</p>
              <p>Prix par nuitée : {formatMontant(data.prixParNuit)}</p>
              <p>Montant total de la réservation : {formatMontant(data.prixTotal)}</p>
              <p>Acompte versé : {formatMontant(data.paiementAvance)}</p>
              <p>Solde restant dû à l'entrée : {formatMontant(data.resteAPayer)}</p>
            </div>
          </div>

          {/* Deuxième page - Structure réorganisée avec espacement optimisé */}
          <div className="border-b pb-6 mb-8">
            <div className="text-center font-bold space-y-0.5"> {/* Espacement réduit */}
              <h1 className="text-xl">SUD HOWS DISTRIBUTION</h1>
              <p className="text-sm">Agence Immobilière Et Conciergerie</p>
              <p className="text-sm">N°1850, Mosquée Attowba, Imiouadar, Commune Tamri</p>
              <p className="text-sm">Téléphone : 07 70 74 54 44 / 05 28 20 09 22</p>
              <p className="text-sm">RC : 58239 – IF : 48588455 – ICE : 002716399000091</p>
            </div>

            <h3 className="text-center font-bold mt-4">PARTIES AU CONTRAT</h3> {/* Espacement réduit */}

            <div className="mt-2 space-y-1.5"> {/* Espacement réduit */}
              <p>L'Agence PROGEST REAL ESTATE, représentée par son gestionnaire, ci-après désignée par « l'Agence »,</p>
              <p>Et</p>
              <p>M. {data.clientNom} {data.clientPrenom}, porteur de la carte d'identité nationale n° {data.clientCinPassport || "[Non fourni]"}, joignable au {data.clientTelephone}</p>
              <p>Ci-après désigné par « le Client »,</p>
            </div>

            {/* Dispositions générales / clauses avec une taille légèrement plus grande */}
            <div className="mt-4 space-y-3"> {/* Espacement réduit */}
              <h3 className="font-bold">Dispositions Générales – Location Saisonnière</h3>
              <div className="space-y-1.5"> {/* Espacement réduit */}
                {sections.map((section) => (
                  <div key={section.title} className="space-y-1"> {/* Espacement réduit */}
                    <p className="font-semibold text-sm">{section.title}</p> 
                    {/* Increase font size for clauses content */}
                    <p className="text-xs sm:text-[11px]">{section.content}</p>
                    {section.bulletPoints && (
                      <ul className="list-disc pl-6 space-y-0.5 text-xs sm:text-[11px]">
                        {section.bulletPoints.map((point, index) => (
                          <li key={index}>{point}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Signatures à la fin du document - With increased spacing */}
            <div className="mt-12"> {/* Increased from mt-8 to mt-12 for more space */}
              <p className="text-sm">Fait à Imiouadar, le {format(today, 'dd/MM/yyyy', { locale: fr })}</p>
              <p className="text-sm">En deux exemplaires originaux, dont un remis au client.</p>

              <div className="grid grid-cols-2 gap-4 my-4">
                <div>
                  <p className="mb-2 text-sm">Signature du Client :</p>
                  <div className="border-b border-black h-8"></div>
                </div>
                <div>
                  <p className="mb-2 text-sm">Signature de l'Agence :</p>
                  <div className="border-b border-black h-8"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => onClose()}>
            Fermer
          </Button>
          <Button onClick={handleDownload}>
            <FileText className="mr-2 h-4 w-4" />
            Télécharger PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContractGenerator;
