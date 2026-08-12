// Edge Function — envoi email de confirmation (client) et de notification (propriétaire) via Resend
// Secrets Supabase requis :
//   RESEND_API_KEY         — clé API Resend (https://resend.com)
//   RESEND_FROM_EMAIL      — expéditeur vérifié, ex: "reservations@votredomaine.com"
//                            (laisser vide pour utiliser le domaine de test Resend)
//   EMAIL_TEST_OVERRIDE_TO — FACULTATIF. Si définie, TOUS les emails sortants (client ET
//                            propriétaire) sont redirigés vers cette adresse au lieu du
//                            destinataire réel, avec le destinataire d'origine indiqué dans
//                            le sujet et le corps du mail. À utiliser uniquement pour des
//                            tests en production, et à retirer des secrets une fois le test
//                            terminé — ne jamais laisser cette variable active durablement.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL =
  Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
const TEST_OVERRIDE_TO = Deno.env.get("EMAIL_TEST_OVERRIDE_TO")?.trim() || null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fmtDate(d: string): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} à ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtMAD(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n) + " MAD";
}

function buildClientHtml(p: Record<string, unknown>): string {
  const {
    clientNom,
    clientPrenom,
    proprieteNom,
    residenceNom,
    dateArrivee,
    dateDepart,
    nombreJours,
    prixTotal,
    paiementAvance,
    resteAPayer,
  } = p as Record<string, string | number>;

  const restStyle =
    Number(resteAPayer) > 0
      ? 'color:#b45309;font-weight:600;'
      : 'color:#16a34a;font-weight:600;';

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Confirmation de réservation</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#4f46e5;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:.5px;">
              Confirmation de réservation
            </h1>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:32px 40px 0;">
            <p style="margin:0;font-size:16px;color:#374151;">
              Bonjour <strong>${clientPrenom} ${clientNom}</strong>,
            </p>
            <p style="margin:12px 0 0;font-size:15px;color:#6b7280;line-height:1.6;">
              Nous avons le plaisir de vous confirmer votre réservation.
              Voici le récapitulatif de votre séjour :
            </p>
          </td>
        </tr>

        <!-- Summary card -->
        <tr>
          <td style="padding:24px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">

                    <tr>
                      <td colspan="2" style="padding-bottom:16px;border-bottom:1px solid #e5e7eb;">
                        <p style="margin:0;font-size:13px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">Logement</p>
                        <p style="margin:4px 0 0;font-size:17px;color:#111827;font-weight:700;">
                          ${proprieteNom}${residenceNom ? ` — ${residenceNom}` : ""}
                        </p>
                      </td>
                    </tr>

                    <tr><td colspan="2" style="height:16px;"></td></tr>

                    <tr>
                      <td style="width:50%;vertical-align:top;">
                        <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">Arrivée</p>
                        <p style="margin:4px 0 0;font-size:16px;color:#111827;font-weight:600;">${fmtDate(String(dateArrivee))}</p>
                      </td>
                      <td style="width:50%;vertical-align:top;">
                        <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">Départ</p>
                        <p style="margin:4px 0 0;font-size:16px;color:#111827;font-weight:600;">${fmtDate(String(dateDepart))}</p>
                      </td>
                    </tr>

                    <tr><td colspan="2" style="height:16px;"></td></tr>

                    <tr>
                      <td colspan="2" style="border-top:1px solid #e5e7eb;padding-top:16px;">
                        <table width="100%" cellpadding="0" cellspacing="6">
                          <tr>
                            <td style="color:#6b7280;font-size:14px;">Durée du séjour</td>
                            <td style="text-align:right;color:#111827;font-size:14px;font-weight:600;">${nombreJours} nuit${Number(nombreJours) > 1 ? "s" : ""}</td>
                          </tr>
                          <tr>
                            <td style="color:#6b7280;font-size:14px;">Montant total</td>
                            <td style="text-align:right;color:#111827;font-size:14px;font-weight:700;">${fmtMAD(Number(prixTotal))}</td>
                          </tr>
                          <tr>
                            <td style="color:#6b7280;font-size:14px;">Avance versée</td>
                            <td style="text-align:right;color:#16a34a;font-size:14px;font-weight:600;">${fmtMAD(Number(paiementAvance))}</td>
                          </tr>
                          <tr>
                            <td style="color:#6b7280;font-size:14px;">Reste à payer</td>
                            <td style="text-align:right;font-size:14px;${restStyle}">${fmtMAD(Number(resteAPayer))}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer note -->
        <tr>
          <td style="padding:0 40px 32px;">
            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
              Pour toute question concernant votre réservation, n'hésitez pas à nous contacter.
            </p>
            <p style="margin:16px 0 0;font-size:14px;color:#6b7280;">Merci de votre confiance et à bientôt !</p>
          </td>
        </tr>

        <!-- Bottom bar -->
        <tr>
          <td style="background:#f3f4f6;padding:16px 40px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">Cet email de confirmation a été généré automatiquement.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildOwnerHtml(p: Record<string, unknown>): string {
  const {
    proprieteNom,
    residenceNom,
    clientNom,
    clientPrenom,
    clientEmail,
    clientTelephone,
    dateArrivee,
    dateDepart,
    prixTotal,
    status,
    createdAt,
  } = p as Record<string, string | number>;

  const clientFullName = `${clientPrenom ?? ""} ${clientNom ?? ""}`.trim() || "Non renseigné";
  const etablissement = `${proprieteNom ?? ""}${residenceNom ? ` — ${residenceNom}` : ""}`.trim() || "Non renseigné";

  const rows: [string, string][] = [
    ["Établissement", etablissement],
    ["Client", clientFullName],
    ["Email client", clientEmail ? String(clientEmail) : "Non renseigné"],
    ["Téléphone client", clientTelephone ? String(clientTelephone) : "Non renseigné"],
    ["Date d'arrivée", fmtDate(String(dateArrivee ?? "")) || "Non renseigné"],
    ["Date de départ", fmtDate(String(dateDepart ?? "")) || "Non renseigné"],
    ["Montant total", fmtMAD(Number(prixTotal ?? 0))],
    ["Statut", status ? String(status) : "Non renseigné"],
    ["Date de création", fmtDateTime(String(createdAt ?? "")) || "Non renseigné"],
  ];

  const rowsHtml = rows.map(([label, value]) => `
                    <tr>
                      <td style="padding:8px 0;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">${label}</td>
                      <td style="padding:8px 0;text-align:right;color:#111827;font-size:14px;font-weight:600;border-bottom:1px solid #f3f4f6;">${value}</td>
                    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Nouvelle réservation</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1e293b;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:.5px;">
              Nouvelle réservation
            </h1>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:32px 40px 0;">
            <p style="margin:0;font-size:16px;color:#374151;">Bonjour,</p>
            <p style="margin:12px 0 0;font-size:15px;color:#6b7280;line-height:1.6;">
              Une nouvelle réservation vient d'être créée pour votre établissement.
            </p>
          </td>
        </tr>

        <!-- Summary card -->
        <tr>
          <td style="padding:24px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${rowsHtml}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer note -->
        <tr>
          <td style="padding:0 40px 32px;">
            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
              Vous pouvez consulter les détails depuis l'espace d'administration.
            </p>
            <p style="margin:16px 0 0;font-size:14px;color:#6b7280;">Cordialement,<br/>SHD Immobilier &amp; Conciergerie</p>
          </td>
        </tr>

        <!-- Bottom bar -->
        <tr>
          <td style="background:#f3f4f6;padding:16px 40px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">Cet email a été généré automatiquement.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendVia(to: string, subject: string, html: string): Promise<{ sent: boolean; id?: string; error?: string; overridden?: boolean; originalTo?: string }> {
  let actualTo = to;
  let actualSubject = subject;
  let actualHtml = html;
  let overridden = false;

  if (TEST_OVERRIDE_TO) {
    overridden = true;
    console.log(`[EMAIL_TEST_OVERRIDE_TO actif] Email destiné à "${to}" redirigé vers "${TEST_OVERRIDE_TO}" (aucun envoi au destinataire réel).`);
    actualTo = TEST_OVERRIDE_TO;
    actualSubject = `[TEST — destinataire réel : ${to}] ${subject}`;
    const banner = `<div style="background:#fef3c7;border-bottom:2px solid #f59e0b;color:#92400e;padding:14px 24px;font:14px Arial,Helvetica,sans-serif;">⚠️ MODE TEST (EMAIL_TEST_OVERRIDE_TO actif) — cet email devait être envoyé à <strong>${to}</strong> et a été redirigé ici.</div>`;
    actualHtml = /<body[^>]*>/.test(actualHtml)
      ? actualHtml.replace(/(<body[^>]*>)/, `$1${banner}`)
      : `${banner}${actualHtml}`;
  }

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [actualTo], subject: actualSubject, html: actualHtml }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      return { sent: false, error: err, overridden, originalTo: overridden ? to : undefined };
    }

    const result = await resendRes.json();
    return { sent: true, id: result.id, overridden, originalTo: overridden ? to : undefined };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e), overridden, originalTo: overridden ? to : undefined };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  if (TEST_OVERRIDE_TO) {
    console.log(`[EMAIL_TEST_OVERRIDE_TO ACTIF] Tous les emails de cette invocation seront redirigés vers "${TEST_OVERRIDE_TO}". Pensez à retirer ce secret une fois les tests terminés.`);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const clientEmail = body.clientEmail as string | undefined;
  const ownerEmail = body.ownerEmail as string | undefined;

  const result: { client: Record<string, unknown>; owner: Record<string, unknown> } = {
    client: { skipped: true },
    owner: { skipped: true },
  };

  // Les deux envois sont indépendants : l'échec de l'un ne bloque jamais l'autre,
  // et aucun des deux ne doit jamais empêcher la réservation (déjà enregistrée) de rester valide.
  if (clientEmail && EMAIL_RE.test(clientEmail)) {
    const html = buildClientHtml(body);
    const subject = `Confirmation de réservation — ${body.proprieteNom ?? ""}`;
    const outcome = await sendVia(clientEmail, subject, html);
    if (!outcome.sent) console.error("Resend error (client confirmation):", outcome.error);
    result.client = outcome;
  }

  if (ownerEmail && EMAIL_RE.test(ownerEmail)) {
    const html = buildOwnerHtml(body);
    const subject = `Nouvelle réservation - ${body.proprieteNom ?? ""}`;
    const outcome = await sendVia(ownerEmail, subject, html);
    if (!outcome.sent) console.error("Resend error (owner notification):", outcome.error);
    result.owner = outcome;
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
