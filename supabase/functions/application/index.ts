// Edge Function "application": verschickt die Mails rund um Anträge von Verleihern, Schulen und Rentals.
//
//   { action: "submitted" }                      vom Verleiher nach dem Speichern  → Mail an dich (Admin)
//   { action: "decide", id, decision, reason? }  von dir auf der Admin-Seite        → Mail an den Verleiher
//
// Es werden KEINE Service-Schlüssel gebraucht: Alle Datenbank-Zugriffe laufen mit dem Login des Aufrufers.
// Ob jemand Admin ist, entscheidet die Datenbank (Funktion admin_decide).
//
// Secrets (Supabase → Edge Functions → Secrets):
//   SMTP_USER   Absender-Adresse / SMTP-Benutzer (z. B. mail@foilbattery.com)
//   SMTP_PASS   Passwort des Postfachs (bei Gmail: App-Passwort)
//   ADMIN_EMAIL Adresse, die die Antrags-Mails bekommt
//   SITE_URL    z. B. https://foilbattery.com
//   FROM_NAME   optional, Absendername
//   SMTP_HOST, SMTP_PORT   Mail-Server, z. B. smtp.ionos.es und 465 (ohne Angabe: smtp.gmail.com, 465)

import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.16';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Lang = 'de' | 'en';
type Mail = { to: string; subject: string; text: string };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

// Header-Injection verhindern: keine Zeilenumbrüche in Betreff und Namen
function oneLine(s: unknown): string {
  return String(s ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
}

async function sendMail(mail: Mail): Promise<void> {
  const user = Deno.env.get('SMTP_USER');
  const pass = Deno.env.get('SMTP_PASS');
  if (!user || !pass) throw new Error('SMTP_USER/SMTP_PASS fehlen');
  // Standard: Gmail über Port 465 (SSL). SMTP_HOST/SMTP_PORT sind optional, falls du später den Anbieter wechselst.
  const port = Number(Deno.env.get('SMTP_PORT') ?? 465);
  const transport = nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST') ?? 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: Deno.env.get('SMTP_INSECURE_TEST') !== '1' },
  });
  const fromName = oneLine(Deno.env.get('FROM_NAME') ?? 'Foil Assist Battery Rental');
  await transport.sendMail({ from: `"${fromName}" <${user}>`, to: mail.to, subject: mail.subject, text: mail.text });
}

function adminMail(d: Record<string, any>): Mail {
  const site = (Deno.env.get('SITE_URL') ?? '').replace(/\/$/, '');
  // Jede Batterie bringt ihren Anzeigenamen mit (label), ältere Einträge nur das Modell
  const batteries = (Array.isArray(d.batteries) ? d.batteries : [])
    .map((b: any) => oneLine(b.label ?? b.name ?? `${b.brand ?? ''} ${b.model ?? ''}`)).join(', ');
  const pro = d.kind === 'pro';
  const lines = [
    'Neuer Antrag wartet auf deine Prüfung.',
    '',
    `Art:         ${pro ? 'Schule / Verleih' : 'Privat'}`,
    `Name:        ${oneLine(d.name)}`,
    `Ort:         ${oneLine(d.place)}`,
    `Batterien:   ${batteries}`,
    `Konto-Mail:  ${oneLine(d.applicant_email)}`,
    `WhatsApp:    ${oneLine(d.whatsapp) || '-'}`,
    `E-Mail:      ${oneLine(d.email) || '-'}`,
    ...(pro ? [`Website:     ${oneLine(d.website) || '-'}`, `Öffnungszeiten: ${oneLine(d.opening_hours) || '-'}`] : []),
    `Profil:      ${oneLine(d.proof_url)}`,
    `Rechnung:    ${d.has_file ? 'ja, hochgeladen (in der Admin-Seite ansehen)' : 'nein'}`,
    '',
    `Prüfen und freigeben oder ablehnen: ${site}/admin.html`,
  ];
  return {
    to: Deno.env.get('ADMIN_EMAIL') ?? '',
    subject: `Neuer ${pro ? 'Schul-/Verleih-Antrag' : 'Verleiher-Antrag'}: ${oneLine(d.name)} (${oneLine(d.place) || 'ohne Ort'})`,
    text: lines.join('\n'),
  };
}

function decisionMail(d: Record<string, any>): Mail {
  const lang: Lang = d.lang === 'de' ? 'de' : 'en';
  const site = (Deno.env.get('SITE_URL') ?? '').replace(/\/$/, '');
  const name = oneLine(d.name);
  const approved = d.status === 'approved';
  const reason = oneLine(d.reason);

  if (lang === 'de') {
    return {
      to: d.applicant_email,
      subject: approved ? 'Dein Angebot ist freigegeben' : 'Dein Angebot wurde nicht freigegeben',
      text: approved
        ? `Hallo ${name},\n\ndein Angebot wurde geprüft und ist jetzt auf der Karte sichtbar:\n${site}/\n\nViel Spaß beim Verleihen!\nFoil Assist Battery Rental`
        : `Hallo ${name},\n\nleider konnten wir dein Angebot noch nicht freigeben.${reason ? `\n\nGrund: ${reason}` : ''}\n\nDu kannst dein Angebot jederzeit anpassen (z. B. einen besseren Profil-Link oder eine Rechnung hinzufügen) und neu absenden:\n${site}/\n\nFoil Assist Battery Rental`,
    };
  }
  return {
    to: d.applicant_email,
    subject: approved ? 'Your listing is approved' : 'Your listing was not approved',
    text: approved
      ? `Hi ${name},\n\nyour listing has been reviewed and is now visible on the map:\n${site}/\n\nEnjoy lending!\nFoil Assist Battery Rental`
      : `Hi ${name},\n\nunfortunately we could not approve your listing yet.${reason ? `\n\nReason: ${reason}` : ''}\n\nYou can edit your listing at any time (for example add a clearer profile link or an invoice) and submit it again:\n${site}/\n\nFoil Assist Battery Rental`,
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const auth = req.headers.get('Authorization') ?? '';
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: 'not authenticated' }, 401);

    const body = await req.json().catch(() => ({}));

    // 1) Verleiher hat einen Antrag gesendet → Admin informieren (genau einmal pro Antrag)
    if (body.action === 'submitted') {
      const { data, error } = await supabase.rpc('claim_notification');
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ ok: true, sent: false });
      const mail = adminMail(data);
      if (!mail.to) return json({ error: 'ADMIN_EMAIL fehlt' }, 500);
      try {
        await sendMail(mail);
        return json({ ok: true, sent: true });
      } catch (e) {
        console.error('mail failed', e);
        return json({ ok: false, sent: false, error: 'mail failed' }, 502);
      }
    }

    // 2) Admin entscheidet → Status setzen (die Datenbank prüft Admin-Rechte), Rechnung löschen, Verleiher informieren
    if (body.action === 'decide') {
      if (typeof body.id !== 'string') return json({ error: 'id fehlt' }, 400);
      const { data, error } = await supabase.rpc('admin_decide', {
        p_id: body.id,
        p_decision: body.decision,
        p_reason: typeof body.reason === 'string' ? body.reason : null,
      });
      if (error) return json({ error: error.message }, error.code === '42501' ? 403 : 400);

      if (data.proof_file) {
        const { error: rmError } = await supabase.storage.from('proofs').remove([data.proof_file]);
        if (rmError) console.error('could not delete proof file', rmError);
      }

      let mailed = false;
      if (data.applicant_email) {
        try {
          await sendMail(decisionMail(data));
          mailed = true;
        } catch (e) {
          console.error('mail failed', e);
        }
      }
      return json({ ok: true, status: data.status, mailed });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: 'internal error' }, 500);
  }
});
