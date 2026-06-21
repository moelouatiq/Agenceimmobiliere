
import React, { useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download } from 'lucide-react';

// Type for receipt data
type ReceiptData = {
  clientNom: string;
  clientPrenom: string;
  clientTelephone: string;
  proprieteNom: string;
  residenceNom: string;
  typeAppartement: string;
  dateArrivee: Date;
  dateDepart: Date;
  nombreJours: number;
  prixParNuit: number;
  prixTotal: number;
  paiementAvance: number;
  resteAPayer: number;
};

// Props for the receipt generator component
interface ReceiptGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  data: ReceiptData;
}

// Pre-load stamp image to improve performance - this would need to be updated to SHD's stamp
const stampImg = new Image();
stampImg.src = '/lovable-uploads/7a09b4c4-fcea-4bc7-9a98-c8ebead4ac5c.png';

// Pre-load SHD logo with proper handling
const logoImg = new Image();
logoImg.src = '/lovable-uploads/b055d24c-dddf-4cef-9dc7-c7e18da4955c.png';
logoImg.onload = () => {
  // This ensures the image is properly loaded before use
  console.log('Logo image loaded successfully');
};

const ReceiptGenerator: React.FC<ReceiptGeneratorProps> = ({ isOpen, onClose, data }) => {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const today = new Date();

  // Function to format currency values
  const formatMontant = (montant: number): string => {
    const montantNumber = typeof montant === 'number' ? montant : parseFloat(String(montant));
    const numberParts = montantNumber.toFixed(2).split('.');
    const integerPart = numberParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const formattedNumber = `${integerPart},${numberParts[1]} MAD`;
    return formattedNumber;
  };

  // Generate the receipt when the component mounts
  useEffect(() => {
    if (isOpen && !pdfUrl) {
      generateReceipt();
    }
    
    // Cleanup when component unmounts
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [isOpen]);

  // Generate the receipt PDF with improved performance
  const generateReceipt = async () => {
    try {
      setIsGenerating(true);
      
      // Create a new PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      // Add company logo on the left with proper aspect ratio preservation
      try {
        // Set fixed width and calculate height based on natural aspect ratio
        const logoWidth = 40;
        // Get the natural aspect ratio from the loaded image
        const logoRatio = logoImg.naturalHeight / logoImg.naturalWidth || 0.35; // fallback ratio if image not loaded
        const logoHeight = logoWidth * logoRatio;
        
        // Position logo on the left side
        const logoX = 20;
        const logoY = 20;
        
        // Use the preloaded image with correct dimensions
        doc.addImage(logoImg, 'PNG', logoX, logoY, logoWidth, logoHeight);
      } catch (err) {
        console.warn('Could not add logo image:', err);
      }
      
      // Set font styles for company name (bold)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0, 51, 102);
      
      // Company info positioned on right side (two-column layout)
      const rightColumnX = 105;
      const startY = 20;
      
      // Company name in bold
      doc.text('SUD HOWS DISTRIBUTION', rightColumnX, startY, { align: 'left' });
      
      // Switch to normal font for contact details
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      // Contact information with proper spacing
      doc.text('Agence Immobilière Et Conciergerie', rightColumnX, startY + 6, { align: 'left' });
      doc.text('N°1850, Mosquée Attowba, Imiouadar, Commune Tamri', rightColumnX, startY + 12, { align: 'left' });
      doc.text('Téléphone : 07 70 74 54 44 / 05 28 20 09 22', rightColumnX, startY + 18, { align: 'left' });
      
      // Business registration info in smaller font
      doc.setFontSize(8);
      doc.text('RC : 58239 – IF : 48588455 – ICE : 002716399000091', rightColumnX, startY + 30, { align: 'left' });
      
      // Add horizontal line with improved styling
      doc.setDrawColor(0, 51, 102);
      doc.setLineWidth(0.7);
      doc.line(20, startY + 40, 190, startY + 40);
      
      // Set font styles for title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      
      // Add title with improved spacing and clear separation
      doc.setTextColor(0, 51, 102);
      doc.text('RÉCÉPISSÉ DE RÉSERVATION', 105, startY + 55, { align: 'center' });
      
      // Reset font for content
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      
      // Add client information with improved spacing
      const contentStartY = startY + 70; // More space after title
      doc.text(`Client : ${data.clientNom} ${data.clientPrenom}`, 20, contentStartY);
      doc.text(`Téléphone : ${data.clientTelephone}`, 20, contentStartY + 7);
      doc.text(`Résidence : ${data.residenceNom}`, 20, contentStartY + 14);
      doc.text(`Type d'appartement : ${data.typeAppartement}`, 20, contentStartY + 21);
      doc.text(`Numéro de l'appartement : ${data.proprieteNom}`, 20, contentStartY + 28);
      
      // IMPROVED LAYOUT: Tighter horizontal spacing between tables
      // Improved alignment for values with right-aligned numbers
      
      // Constants for better layout control
      const tableStartY = contentStartY + 40;
      const leftTableX = 20;            // Left table X position
      const rightTableX = 105;          // Reduced gap between tables (was 110)
      const tableWidth = 75;            // Width of each table (slightly reduced)
      const leftLabelCol = leftTableX + 5;  // Labels start position in left table
      const leftValueCol = leftTableX + 70; // Values end position in left table (right-aligned)
      const rightLabelCol = rightTableX + 5; // Labels start position in right table
      const rightValueCol = rightTableX + 70; // Values end position in right table (right-aligned)
      
      // Left Table: Période de séjour
      doc.setFillColor(240, 249, 255); // Light blue background
      doc.roundedRect(leftTableX, tableStartY, tableWidth, 37, 3, 3, 'F');
      
      // Title with blue color
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 51, 102);
      doc.text('Période de séjour', leftLabelCol, tableStartY + 7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      
      // Table content with consistent padding and improved right-aligned values
      doc.text('Date de check-in :', leftLabelCol, tableStartY + 15);
      doc.text(`${format(data.dateArrivee, 'dd/MM/yyyy', { locale: fr })}`, leftValueCol, tableStartY + 15, { align: 'right' });
      
      doc.text('Date de check-out :', leftLabelCol, tableStartY + 23);
      doc.text(`${format(data.dateDepart, 'dd/MM/yyyy', { locale: fr })}`, leftValueCol, tableStartY + 23, { align: 'right' });
      
      doc.text('Nombre de nuitées :', leftLabelCol, tableStartY + 31);
      doc.text(`${data.nombreJours}`, leftValueCol, tableStartY + 31, { align: 'right' });
      
      // Right Table: Détails tarifaires
      doc.setFillColor(240, 249, 255); // Light blue background
      doc.roundedRect(rightTableX, tableStartY, tableWidth, 53, 3, 3, 'F');
      
      // Title with blue color
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 51, 102);
      doc.text('Détails tarifaires', rightLabelCol, tableStartY + 7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      
      // Improved right-aligned monetary values with consistent padding
      doc.text('Prix par nuitée :', rightLabelCol, tableStartY + 15);
      doc.text(formatMontant(data.prixParNuit), rightValueCol, tableStartY + 15, { align: 'right' });
      
      doc.text('Total séjour :', rightLabelCol, tableStartY + 23);
      doc.text(formatMontant(data.prixTotal), rightValueCol, tableStartY + 23, { align: 'right' });
      
      doc.text('Avance reçue :', rightLabelCol, tableStartY + 31);
      doc.text(formatMontant(data.paiementAvance), rightValueCol, tableStartY + 31, { align: 'right' });
      
      // Highlight remaining balance
      doc.setFont('helvetica', 'bold');
      doc.text('Solde à régler :', rightLabelCol, tableStartY + 39);
      doc.text(formatMontant(data.resteAPayer), rightValueCol, tableStartY + 39, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      
      // Add general booking conditions with improved styling
      const conditionsY = tableStartY + 65;
      doc.setFont('helvetica', 'bold');
      doc.text('Conditions générales de réservation :', 20, conditionsY);
      doc.setFont('helvetica', 'normal');
      doc.text('• La réservation est confirmée dès réception de l\'avance mentionnée.', 25, conditionsY + 7);
      doc.text('• Le solde est à régler lors du check-in.', 25, conditionsY + 14);
      doc.text('• Une pièce d\'identité valide est exigée à l\'arrivée.', 25, conditionsY + 21);
      doc.text('• Toute dégradation ou non-respect du règlement intérieur sera facturée au client.', 25, conditionsY + 28);
      
      // Add cancellation conditions with improved styling
      const cancellationY = conditionsY + 40;
      doc.setFont('helvetica', 'bold');
      doc.text('Conditions d\'annulation :', 20, cancellationY);
      doc.setFont('helvetica', 'normal');
      doc.text('• Plus de 7 jours avant l\'arrivée : remboursement intégral de l\'avance.', 25, cancellationY + 7);
      doc.text('• Entre 7 et 3 jours : 50 % de l\'avance retenue.', 25, cancellationY + 14);
      doc.text('• Moins de 3 jours ou non-présentation : avance non remboursable.', 25, cancellationY + 21);
      
      // Add signature area with improved styling
      doc.setFont('helvetica', 'bold');
      doc.text('Signature de l\'agence :', 20, contentStartY + 188);
      
      // Add stamp image with proper positioning
      try {
        // Calculate aspect ratio for stamp
        const stampWidth = 70;
        const stampRatio = stampImg.naturalHeight / stampImg.naturalWidth || 0.425; // Use natural dimensions for ratio
        const stampHeight = stampWidth * stampRatio || 30; // Fallback height
        
        doc.addImage(stampImg, 'PNG', 110, contentStartY + 180, stampWidth, stampHeight);
      } catch (err) {
        console.warn('Could not add stamp image:', err);
      }
      
      // The company info image at the bottom right has been removed as requested
      
      // Generate the output
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);
      
    } catch (error) {
      console.error('Erreur lors de la génération du récépissé:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle download of the PDF
  const handleDownload = () => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `recepisse-${data.clientNom}-${format(today, 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Récépissé de Réservation</DialogTitle>
          <DialogDescription>
            Généré pour {data.clientNom} {data.clientPrenom} - {format(data.dateArrivee, 'dd/MM/yyyy')} au {format(data.dateDepart, 'dd/MM/yyyy')}
          </DialogDescription>
        </DialogHeader>

        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-sm text-gray-500">Génération en cours...</p>
          </div>
        ) : (
          <div className="space-y-6 text-sm bg-white p-6 rounded-lg shadow-sm">
            {/* Two-column header layout */}
            <div className="flex justify-between items-start mb-8">
              {/* Logo on the left */}
              <div className="w-1/4">
                <img 
                  src="/lovable-uploads/b055d24c-dddf-4cef-9dc7-c7e18da4955c.png" 
                  alt="SUD HOWS DISTRIBUTION" 
                  className="h-16 w-auto object-contain" 
                />
              </div>
              
              {/* Company information on the right */}
              <div className="w-3/5 text-right">
                <p className="font-bold text-lg text-shd-primary">SUD HOWS DISTRIBUTION</p>
                <p>Agence Immobilière Et Conciergerie</p>
                <p>N°1850, Mosquée Attowba, Imiouadar, Commune Tamri</p>
                <p>Téléphone : 07 70 74 54 44 / 05 28 20 09 22</p>
                <p className="text-xs mt-1 text-gray-600">RC : 58239 – IF : 48588455 – ICE : 002716399000091</p>
              </div>
            </div>
            
            <div className="border-t border-shd-primary pt-4"></div>

            <div className="text-center font-bold py-4">
              <h1 className="text-xl text-shd-primary">RÉCÉPISSÉ DE RÉSERVATION</h1>
            </div>

            <div className="space-y-5 mt-4">
              <div className="bg-gray-50 p-4 rounded-md">
                <p><span className="font-medium">Client :</span> {data.clientNom} {data.clientPrenom}</p>
                <p><span className="font-medium">Téléphone :</span> {data.clientTelephone}</p>
                <p><span className="font-medium">Résidence :</span> {data.residenceNom}</p>
                <p><span className="font-medium">Type d'appartement :</span> {data.typeAppartement}</p>
                <p><span className="font-medium">Numéro de l'appartement :</span> {data.proprieteNom}</p>
              </div>

              {/* Reorganized into two-column table layout */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Période de séjour section */}
                <div className="p-4 bg-blue-50 rounded-md">
                  <h3 className="font-bold text-shd-primary mb-3">Période de séjour</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr>
                        <td className="py-1 pr-2 font-medium">Date de check-in :</td>
                        <td className="py-1">{format(data.dateArrivee, 'dd/MM/yyyy', { locale: fr })}</td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-2 font-medium">Date de check-out :</td>
                        <td className="py-1">{format(data.dateDepart, 'dd/MM/yyyy', { locale: fr })}</td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-2 font-medium">Nombre de nuitées :</td>
                        <td className="py-1">{data.nombreJours}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Détails tarifaires section */}
                <div className="p-4 bg-blue-50 rounded-md">
                  <h3 className="font-bold text-shd-primary mb-3">Détails tarifaires</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr>
                        <td className="py-1 pr-2 font-medium">Prix par nuitée :</td>
                        <td className="py-1">{formatMontant(data.prixParNuit)}</td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-2 font-medium">Total séjour :</td>
                        <td className="py-1">{formatMontant(data.prixTotal)}</td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-2 font-medium">Avance reçue :</td>
                        <td className="py-1">{formatMontant(data.paiementAvance)}</td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-2 font-bold">Solde à régler :</td>
                        <td className="py-1 font-bold">{formatMontant(data.resteAPayer)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add general booking conditions with improved styling */}
              <div className="space-y-3 mt-6">
                <h3 className="font-bold text-shd-primary">Conditions générales de réservation :</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>La réservation est confirmée dès réception de l'avance mentionnée.</li>
                  <li>Le solde est à régler lors du check-in.</li>
                  <li>Une pièce d'identité valide est exigée à l'arrivée.</li>
                  <li>Toute dégradation ou non-respect du règlement intérieur sera facturée au client.</li>
                </ul>
              </div>

              {/* Add cancellation conditions with improved styling */}
              <div className="space-y-3 mt-6">
                <h3 className="font-bold text-shd-primary">Conditions d'annulation :</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Plus de 7 jours avant l'arrivée : remboursement intégral de l'avance.</li>
                  <li>Entre 7 et 3 jours : 50 % de l'avance retenue.</li>
                  <li>Moins de 3 jours ou non-présentation : avance non remboursable.</li>
                </ul>
              </div>

              <div className="mt-10">
                <h3 className="font-bold text-shd-primary">Signature de l'agence :</h3>
                <div className="mt-2 flex items-end justify-end">
                  <img 
                    src="/lovable-uploads/7a09b4c4-fcea-4bc7-9a98-c8ebead4ac5c.png" 
                    alt="Tampon de l'agence" 
                    className="max-w-[150px] w-auto h-auto object-contain ml-auto" 
                  />
                </div>
              </div>
              
              {/* Company info image at the bottom right has been removed as requested */}
            </div>
          </div>
        )}
        
        <div className="flex justify-end gap-4 mt-6">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Télécharger le PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptGenerator;
