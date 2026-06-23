// supabase/functions/sync-reservation-to-sheets/index.ts
//
// Déclenchée par un Database Webhook Supabase à chaque INSERT sur la table `reservations`.
// Récupère la réservation + le client + la propriété liés, puis ajoute une ligne dans
// l'onglet "Réponses au formulaire 1" du Google Sheet IntelStay via l'API Google Sheets.
//
// Colonnes écrites dans le Sheet (dans cet ordre, colonnes A à J) :
//   A=Horodateur  B=Bien - Appartement  C=Entrée  D=Sortie  E=Prix par nuit
//   F=AVANCE  G=Nom du client  H=CIN  I=Téléphone  J=Source
// Note : Montant Net n'est PAS dans cette liste — il a sa propre colonne dédiée K,
// envoyée directement depuis prix_total (pas recalculée dans le Sheet).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- Config via secrets Supabase (à définir avec `supabase secrets set`) ----
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")!;
const GOOGLE_PRIVATE_KEY = Deno.env.get("GOOGLE_PRIVATE_KEY")!.replace(/\\n/g, "\n");
const GOOGLE_SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID")!;
const GOOGLE_SHEET_TAB = Deno.env.get("GOOGLE_SHEET_TAB") ?? "Réponses au formulaire 1";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---- Minimal JWT signing for a Google service account (no external deps needed) ----
async function getGoogleAccessToken(): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const unsigned = `${encode(header)}.${encode(claimSet)}`;

  const keyData = GOOGLE_PRIVATE_KEY
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned),
  );

  const encodedSig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const jwt = `${unsigned}.${encodedSig}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed: ${await tokenRes.text()}`);
  }

  const tokenJson = await tokenRes.json();
  return tokenJson.access_token as string;
}

function formatDate(d: string | null): string {
  if (!d) return "";
  // d is "YYYY-MM-DD" from Postgres date column -> convert to "MM/DD/YYYY" serial-friendly
  // Google Sheets API accepts plain strings; using ISO keeps it unambiguous and the
  // Sheet's own DD/MM/YYYY number format will display it correctly once parsed as a date.
  return d;
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    // Supabase Database Webhooks send { type: "INSERT", table, record, ... }
    const record = payload.record;
    if (!record || !record.id) {
      return new Response(JSON.stringify({ error: "No record in payload" }), { status: 400 });
    }

    // Fetch the propriete row (always needed for column B)
    const { data: propriete, error: propErr } = await supabase
      .from("proprietes").select("*").eq("id", record.id_propriete).single();
    if (propErr) throw new Error(`Propriete fetch failed: ${propErr.message}`);

    const bienAppartement = `${propriete.nom_residence ?? ""} - ${propriete.nom ?? ""}`.trim();

    let row: unknown[];

    if (record.is_blocked) {
      // Blocked period: write a placeholder row with no client or financial data
      row = [
        new Date().toISOString(),        // A: Horodateur
        bienAppartement,                  // B: Bien - Appartement
        formatDate(record.date_arrivee),  // C: Entrée
        formatDate(record.date_depart),   // D: Sortie
        0,                                // E: Prix par nuit
        0,                                // F: AVANCE
        "Blocked",                        // G: Nom du client
        "",                               // H: CIN
        "",                               // I: Téléphone
        record.blocked_reason ?? "",      // J: Source (motif du blocage)
        0,                                // K: Montant Net
      ];
    } else {
      // Normal reservation: fetch client and build full row
      const { data: client, error: clientErr } = await supabase
        .from("clients").select("*").eq("id", record.id_client).single();
      if (clientErr) throw new Error(`Client fetch failed: ${clientErr.message}`);

      const clientNomComplet = `${client.prenom ?? ""} ${client.nom ?? ""}`.trim();

      // Row order must match the sheet's raw columns A..K
      row = [
        new Date().toISOString(),        // A: Horodateur
        bienAppartement,                  // B: Bien - Appartement
        formatDate(record.date_arrivee),  // C: Entrée
        formatDate(record.date_depart),   // D: Sortie
        record.prix_par_nuit ?? "",       // E: Prix par nuit
        record.paiement_avance ?? "",     // F: AVANCE
        clientNomComplet,                 // G: Nom du client
        client.cin_passport ?? "",        // H: CIN
        client.telephone ?? "",           // I: Téléphone
        record.source ?? "",              // J: Source
        record.prix_total ?? "",          // K: Montant Net
      ];
    }

    const accessToken = await getGoogleAccessToken();

    const range = `'${GOOGLE_SHEET_TAB}'!A:K`;
    const appendUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}:append` +
      `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const sheetsRes = await fetch(appendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [row] }),
    });

    if (!sheetsRes.ok) {
      const errText = await sheetsRes.text();
      throw new Error(`Google Sheets append failed: ${errText}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sync-reservation-to-sheets error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
