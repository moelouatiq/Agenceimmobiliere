import React, { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const today = () => format(new Date(), "yyyy-MM-dd");

const downloadWorkbook = (wb: XLSX.WorkBook, filename: string) => {
  XLSX.writeFile(wb, filename);
};

const autoFitColumns = (ws: XLSX.WorkSheet) => {
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  const colWidths: number[] = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    let max = 10;
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v != null) {
        const len = String(cell.v).length;
        if (len > max) max = len;
      }
    }
    colWidths.push(Math.min(max + 2, 60));
  }
  ws["!cols"] = colWidths.map((w) => ({ wch: w }));
};

// ─── Export 1 : Réservations ──────────────────────────────────────────────────

const exportReservations = async () => {
  const { data, error } = await supabase
    .from("reservations")
    .select(`
      id,
      date_reservation,
      date_arrivee,
      date_depart,
      nombre_jours,
      prix_par_nuit,
      prix_total,
      paiement_avance,
      reste_a_payer,
      mode_paiement,
      source,
      reference,
      taux_commission,
      montant_commission,
      part_proprietaire,
      status,
      is_blocked,
      blocked_reason,
      clients(nom, prenom, telephone, cin_passport, autre_info),
      proprietes(nom, nom_residence, type_appartement)
    `)
    .eq("is_blocked", false)
    .order("date_reservation", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((r: any) => {
    const c = Array.isArray(r.clients) ? r.clients[0] : r.clients;
    const p = Array.isArray(r.proprietes) ? r.proprietes[0] : r.proprietes;
    return {
      "ID":                   r.id,
      "Date réservation":     r.date_reservation ?? "",
      "Nom client":           c?.nom ?? "",
      "Prénom client":        c?.prenom ?? "",
      "Téléphone":            c?.telephone ?? "",
      "CIN / Passeport":      c?.cin_passport ?? "",
      "Autres infos client":  c?.autre_info ?? "",
      "Résidence":            p?.nom_residence ?? "",
      "Appartement":          p?.nom ?? "",
      "Type":                 p?.type_appartement ?? "",
      "Date arrivée":         r.date_arrivee ?? "",
      "Date départ":          r.date_depart ?? "",
      "Nuits":                r.nombre_jours ?? "",
      "Prix / nuit (MAD)":    r.prix_par_nuit ?? "",
      "Prix total (MAD)":     r.prix_total ?? "",
      "Avance (MAD)":         r.paiement_avance ?? "",
      "Reste à payer (MAD)":  r.reste_a_payer ?? "",
      "Mode paiement":        r.mode_paiement ?? "",
      "Source":               r.source ?? "",
      "Référence":            r.reference ?? "",
      "Taux commission (%)":  r.taux_commission ?? "",
      "Commission (MAD)":     r.montant_commission ?? "",
      "Part propriétaire (MAD)": r.part_proprietaire ?? "",
      "Statut":               r.status ?? "",
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Réservations");
  downloadWorkbook(wb, `reservations_${today()}.xlsx`);
};

// ─── Export 2 : Paiements propriétaires ──────────────────────────────────────

const exportVirements = async () => {
  const { data, error } = await supabase
    .from("virements_proprietaires")
    .select(`
      id,
      date,
      montant,
      mode_paiement,
      reference,
      remarque,
      proprietes(nom, nom_residence, nom_proprietaire),
      virement_reservations(
        id_reservation,
        reservations(date_arrivee, date_depart, prix_total, part_proprietaire)
      )
    `)
    .order("date", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((v: any) => {
    const p = Array.isArray(v.proprietes) ? v.proprietes[0] : v.proprietes;
    const junctions: any[] = v.virement_reservations ?? [];

    const resaDates = junctions
      .map((j: any) => {
        const r = Array.isArray(j.reservations) ? j.reservations[0] : j.reservations;
        return r ? `${r.date_arrivee} → ${r.date_depart}` : null;
      })
      .filter(Boolean)
      .join(" | ");

    const totalResas = junctions.reduce((sum: number, j: any) => {
      const r = Array.isArray(j.reservations) ? j.reservations[0] : j.reservations;
      return sum + (r?.part_proprietaire ?? 0);
    }, 0);

    return {
      "ID virement":              v.id,
      "Date virement":            v.date ?? "",
      "Propriétaire":             p?.nom_proprietaire ?? "",
      "Résidence":                p?.nom_residence ?? "",
      "Appartement":              p?.nom ?? "",
      "Montant versé (MAD)":      v.montant ?? "",
      "Mode paiement":            v.mode_paiement ?? "",
      "Référence":                v.reference ?? "",
      "Remarque":                 v.remarque ?? "",
      "Nb réservations couvertes": junctions.length,
      "Total part prop. couverte (MAD)": totalResas || "",
      "Réservations (dates)":     resaDates || "Virement général",
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Virements propriétaires");
  downloadWorkbook(wb, `virements_proprietaires_${today()}.xlsx`);
};

// ─── Component ────────────────────────────────────────────────────────────────

type ExportStatus = "idle" | "loading" | "done";

const ExportCard: React.FC<{
  title: string;
  description: string;
  onExport: () => Promise<void>;
  filename: string;
}> = ({ title, description, onExport, filename }) => {
  const [status, setStatus] = useState<ExportStatus>("idle");

  const handle = async () => {
    setStatus("loading");
    try {
      await onExport();
      setStatus("done");
      toast.success(`Fichier "${filename}" téléchargé`);
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur : ${msg}`);
      setStatus("idle");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-5 w-5 text-green-600" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handle}
          disabled={status === "loading"}
          className="gap-2"
          variant="outline"
        >
          {status === "loading" ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Génération…</>
          ) : (
            <><Download className="h-4 w-4" />Télécharger .xlsx</>
          )}
        </Button>
        {status === "done" && (
          <p className="mt-2 text-xs text-green-600">Fichier téléchargé ✓</p>
        )}
      </CardContent>
    </Card>
  );
};

const BackupManager: React.FC = () => (
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">
      Téléchargez une copie Excel de vos données à tout moment.
    </p>

    <div className="grid gap-4 md:grid-cols-2">
      <ExportCard
        title="Réservations + détails clients"
        description="Toutes les réservations avec informations client, propriété, dates, prix et commissions."
        filename={`reservations_${today()}.xlsx`}
        onExport={exportReservations}
      />

      <ExportCard
        title="Paiements propriétaires"
        description="Tous les virements effectués aux propriétaires avec les réservations couvertes."
        filename={`virements_proprietaires_${today()}.xlsx`}
        onExport={exportVirements}
      />
    </div>
  </div>
);

export default BackupManager;
