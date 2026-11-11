# Foil Drive Battery Rental

Community-Karte für Foil Drive Owner: Die Batterien dürfen nicht ins Flugzeug, also leiht man sich im Urlaub eine bei einem Local vor Ort.
Die Seite bringt nur Reisende (ohne Batterie) und Locals (mit Batterie) zusammen. Kontakt, Preis und Bezahlung laufen außerhalb.

- **Zweisprachig** (Deutsch / Englisch), Umschalter oben rechts und im Footer. Die Startsprache folgt dem Browser.
- **Karte** mit allen freigegebenen Standorten (Leaflet + OpenStreetMap), Preis direkt am Pin
- **Filter** nach Batterie: Max HP, Max Power, Max Sport, Max Sport 396, FM650, FM450, F860
- **Reiseziel-Suche** (Ortssuche über Nominatim)
- **Konto** für Verleiher (E-Mail + Passwort), ein Angebot pro Konto
- **Angebot**: Batterien, Preis pro Tag und/oder Woche, Kaution, „Ausweis wird vorgezeigt“, Standort, WhatsApp und/oder E-Mail, Hinweise
- **Freigabe von Hand**: Neue Angebote erscheinen erst, nachdem du sie freigegeben hast. Du bekommst eine Mail und gibst auf `admin.html` frei oder lehnst ab
- **Verifizierung**: Profil-Link (Instagram oder Facebook) ist Pflicht, eine Rechnung von Foil Drive oder dem Händler ist optional und wird nach der Prüfung gelöscht
- **Kontaktdaten nur für angemeldete Mitglieder**, Pin auf Wunsch um 200–600 m versetzt
- Reines HTML/CSS/JS, kein Build-Schritt. Bibliotheken und Schriften liegen im Repo (`assets/vendor`, `assets/fonts`)

## Sofort ausprobieren (Demo-Modus)

Ohne Einstellungen läuft die Seite im Demo-Modus: erfundene Beispiel-Standorte, Login nur simuliert, Eingaben bleiben im Browser, Anträge werden sofort „freigegeben“. Die Admin-Seite gibt es nur im Echtbetrieb.

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Die Karte lädt zuverlässig über `https://` (GitHub Pages). Beim Öffnen per Doppelklick (`file://`) oder in manchen Vorschau-Fenstern blockiert OpenStreetMap die Kacheln, weil der Browser keine Herkunft (Referer) mitschickt. Das ist kein Fehler der Seite.

## Echtbetrieb mit Supabase

Supabase liefert Konten, Datenbank, privaten Datei-Speicher und die Mail-Funktion. Die Seite selbst bleibt statisch. Dauert ca. 20 Minuten, kostenlos.

### 1. Projekt und Datenbank

1. Auf [supabase.com](https://supabase.com) ein Projekt anlegen. Region **Frankfurt** (EU).
2. **SQL Editor → New query**: Inhalt von [`supabase/schema.sql`](supabase/schema.sql) einfügen und ausführen. Das Skript kann mehrfach laufen.
3. **Project Settings → API**: `Project URL` und den `anon`- bzw. `publishable`-Key kopieren und in [`assets/js/config.js`](assets/js/config.js) eintragen (`supabaseUrl`, `supabaseAnonKey`). Dieser Key ist für den Browser gedacht und darf im Repo stehen. Die Sicherheit kommt aus den Regeln in `schema.sql`.

### 2. Anmeldung und Mails an Nutzer

1. **Authentication → URL Configuration**: `Site URL` auf die Adresse der Seite setzen (z. B. `https://lukilink.github.io/foildrive-battery-rental/`) und dieselbe Adresse bei „Redirect URLs“ eintragen. Sonst führen die Links in den Bestätigungs-Mails ins Leere.
2. **Authentication → Providers → Email**: „Confirm email“ bleibt **an** (gegen Fake-Konten).
3. **Authentication → SMTP Settings → Custom SMTP**: Die eingebauten Supabase-Mails sind auf ganz wenige pro Stunde begrenzt, das reicht nicht für Tests mit Freunden. Trag dort dein Gmail-Konto ein: Host `smtp.gmail.com`, Port `465`, Benutzer = Gmail-Adresse, Passwort = **App-Passwort** (siehe unten).

**Gmail-App-Passwort:** Im Google-Konto die Bestätigung in zwei Schritten einschalten, dann unter *Sicherheit → App-Passwörter* eines anlegen (16 Zeichen). Das normale Passwort funktioniert nicht und gehört nie in das Repo.

### 3. Dich selbst als Admin eintragen

1. Auf der Seite ein Konto mit deiner E-Mail anlegen und die Bestätigungs-Mail anklicken.
2. Im **SQL Editor** ausführen (E-Mail anpassen):

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'schulerlukas+batteryrental@gmail.com';
```

Danach zeigt `admin.html` die Anträge. Weitere Admins trägst du genauso ein.

### 4. Mail an dich bei neuen Anträgen (Edge Function)

Eine kleine Funktion verschickt die Mail „Neuer Antrag“ an dich und die Mail „freigegeben / abgelehnt“ an den Verleiher. Sie braucht keinen geheimen Supabase-Schlüssel, alle Rechte kommen vom Login des Aufrufers. Ob jemand Admin ist, entscheidet die Datenbank.

1. **Edge Functions → Deploy a new function → Via Editor**, Name genau `application`.
2. Den Inhalt von [`supabase/functions/application/index.ts`](supabase/functions/application/index.ts) einfügen und deployen. „Verify JWT“ bleibt **an**.
3. **Edge Functions → Secrets** anlegen:

| Secret | Wert |
| --- | --- |
| `SMTP_USER` | Gmail-Adresse, von der gesendet wird |
| `SMTP_PASS` | Gmail-App-Passwort (16 Zeichen) |
| `ADMIN_EMAIL` | Adresse, die die Antrags-Mails bekommt (z. B. `schulerlukas+batteryrental@gmail.com`) |
| `SITE_URL` | `https://lukilink.github.io/foildrive-battery-rental` (ohne `/` am Ende) |
| `FROM_NAME` | optional, Absendername, z. B. `Foil Drive Battery Rental` |

`SUPABASE_URL` und `SUPABASE_ANON_KEY` stellt Supabase selbst bereit.

> **Wichtig, bitte beim Testen prüfen:** Supabase dokumentiert, dass ausgehende SMTP-Verbindungen (Ports 25, 465, 587) aus Edge Functions blockiert sein können. Es gibt Berichte, dass Gmail über Port 465 trotzdem klappt, zugesichert ist es nicht. Wenn die Mail an dich nicht ankommt: in **Edge Functions → application → Logs** nachsehen. Fällt der Versand aus, bleibt der Antrag trotzdem sichtbar, du findest ihn auf `admin.html` unter „Offen“. Als Ausweg tauscht man `sendMail()` in der Funktion gegen einen Mail-Dienst per HTTPS aus (z. B. Resend, kostenlose Stufe). Dann melde ich mich gern beim Umbau.

Schau in der ersten Zeit regelmäßig auf `admin.html`, damit kein Antrag liegen bleibt.

### 5. Veröffentlichen

**Settings → Pages → Build and deployment**: Source `Deploy from a branch`, Branch `main`, Ordner `/ (root)`. Die Seite ist danach unter `https://<account>.github.io/<repo>/` erreichbar, die Admin-Seite unter `…/admin.html`.

### Test mit Freunden und Kollegen

Wenn die Schritte 1 bis 5 erledigt sind:

1. Du legst selbst ein Test-Angebot an und prüfst: kommt die Mail bei dir an, funktioniert „Freigeben“, erscheint der Pin?
2. Freunde registrieren sich (Bestätigungs-Mail anklicken), stellen ein Angebot ein und warten auf deine Freigabe.
3. Andere Freunde sehen nach dem Login die Kontaktdaten der freigegebenen Angebote.

Die Impressum- und Datenschutz-Seiten sind mit deinen Firmendaten gefüllt. Es fehlen noch die Angaben zum Handelsregister (Registro Mercantil) und die Region des Supabase-Projekts. Die gelben Hinweiskästen danach löschen.

## Was die Datenbank-Regeln erzwingen

| Wer | Darf |
| --- | --- |
| Besucher ohne Login | **freigegebene**, aktive Angebote lesen, ohne WhatsApp, E-Mail, Status und Nachweise |
| Angemeldete Mitglieder | zusätzlich WhatsApp und E-Mail der freigegebenen Angebote lesen |
| Verleiher | sein eigenes Angebot anlegen, ändern, pausieren, löschen und den eigenen Status sehen. Den Status auf „freigegeben“ setzen kann nur der Admin |
| Admin | Anträge sehen, Nachweise ansehen, freigeben oder ablehnen |

Geschrieben wird nur über Datenbank-Funktionen (`save_my_listing`, `admin_decide` …), nie direkt in die Tabelle. Das Schema prüft außerdem Modelle, Preise, Kaution, WhatsApp-Format (`+49…`), E-Mail, Währung, Profil-Link (nur https://instagram.com, facebook.com, fb.com, fb.me) und Textlängen. Die Rechnung liegt in einem privaten Speicher (PDF/JPG/PNG, höchstens 5 MB), den nur der Besitzer und der Admin lesen können. Bei Freigabe oder Ablehnung wird sie gelöscht.

> Hinweis: Jedes registrierte Mitglied kann über die API alle Kontaktdaten der freigegebenen Angebote lesen. Das ist der Preis dafür, dass Kontakt für Reisende einfach bleibt. Wer mehr Schutz will, kann in Supabase ein Captcha für die Registrierung aktivieren (Authentication → Attack Protection).

## Anpassen

| Was | Wo |
| --- | --- |
| Batterie-Modelle | `MODELS` in `assets/js/app.js`, die Liste in `batteries_valid` in `supabase/schema.sql` und `MODEL_NAMES` in der Edge Function |
| Währungen | `CURRENCIES` in `assets/js/app.js` und die `currency`-Prüfung in `schema.sql` |
| Texte (Deutsch/Englisch) | `assets/js/i18n.js`. Eine weitere Sprache ergänzt man als Kopie des `en`-Blocks |
| Farben, Schrift, Abstände | `:root` in `assets/css/app.css` |
| Kartenstil / Kachel-Anbieter | `tileUrl` und `tileAttribution` in `assets/js/config.js` |
| Radius des ungefähren Standorts | `fuzz()` und `HALO_METERS` in `assets/js/app.js` |
| „Angebot melden“-Link im Footer | `contactEmail` in `assets/js/config.js` |
| Texte der Mails | `supabase/functions/application/index.ts` |

## Vor dem öffentlichen Start

- [ ] Impressum und Datenschutz prüfen (Handelsregister, Supabase-Region), Hinweiskästen löschen. Das sind **Vorlagen** und keine Rechtsberatung.
- [ ] Supabase, SMTP und Edge Function einrichten (siehe oben) und `config.js` füllen.
- [ ] Die OpenStreetMap-Standardkacheln sind für kleine Projekte in Ordnung ([Nutzungsrichtlinie](https://operations.osmfoundation.org/policies/tiles/)). Bei viel Traffic einen eigenen Kachel-Anbieter in `config.js` eintragen.
- [ ] Ortssuche und Orts-Vorschlag nutzen den öffentlichen Nominatim-Dienst. Er ist auf wenige Anfragen pro Sekunde begrenzt, die Seite fragt nur nach einem Klick auf „Suchen“.

## Projektstruktur

```
index.html              Karte, Dialoge, Infotexte
admin.html              Anträge prüfen (nur für Admins, Deutsch)
impressum.html          Impressum (DE/EN)
datenschutz.html        Datenschutz (DE/EN)
assets/
  css/                  app.css (Design), fonts.css
  js/
    app.js              Oberfläche und Logik
    i18n.js             Texte Deutsch/Englisch
    admin.js            Admin-Seite
    legal.js            Sprachumschalter für Impressum/Datenschutz
    config.js           Einstellungen (Supabase-Zugang, Karte)
    store-demo.js       Demo-Speicher (Browser)
    store-supabase.js   Konten, Datenbank, Upload, Admin-Aufrufe
  vendor/               Leaflet, MarkerCluster, supabase-js (lokal, mit Lizenzen)
  fonts/                Bricolage Grotesque, Instrument Sans (SIL OFL)
supabase/
  schema.sql            Tabellen, Rechte, Funktionen, Datei-Speicher
  functions/application/index.ts   Mails an dich und an die Verleiher
```

## Lizenzen der Bestandteile

Leaflet (BSD-2), Leaflet.markercluster (MIT), supabase-js (MIT), Bricolage Grotesque und Instrument Sans (SIL Open Font License). Kartendaten © OpenStreetMap-Mitwirkende (ODbL).
