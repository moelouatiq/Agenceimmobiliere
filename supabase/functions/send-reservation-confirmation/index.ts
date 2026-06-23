// Edge Function — envoi email de confirmation de réservation via Resend
// Secrets Supabase requis :
//   RESEND_API_KEY     — clé API Resend (https://resend.com)
//   RESEND_FROM_EMAIL  — expéditeur vérifié, ex: "reservations@votredomaine.com"
//                        (laisser vide pour utiliser le domaine de test Resend)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL =
  Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";

function fmtDate(d: string): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtMAD(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n) + " MAD";
}

function buildHtml(p: Record<string, unknown>): string {
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const clientEmail = body.clientEmail as string | undefined;
  if (!clientEmail) {
    return new Response(JSON.stringify({ skipped: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const html = buildHtml(body);

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [clientEmail],
      subject: `Confirmation de réservation — ${body.proprieteNom ?? ""}`,
      html,
    }),
  });

  if (!resendRes.ok) {
    const err = await resendRes.text();
    console.error("Resend error:", err);
    return new Response(JSON.stringify({ error: err }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await resendRes.json();
  return new Response(JSON.stringify({ sent: true, id: result.id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
