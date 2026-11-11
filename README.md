# Foil Assist Battery Rental

Community-Karte für Foil-Assist-Fahrer (Foil Drive, Manta, RIIFT, Duotone, Flite, Waydoo und andere): Die Batterien dürfen nicht ins Flugzeug, also leiht man sich im Urlaub eine bei einem Local, einer Foil-Schule oder einem Rental vor Ort.
Die Seite bringt nur Reisende (ohne Batterie) und Anbieter (mit Batterie) zusammen. Kontakt, Preis und Bezahlung laufen außerhalb.

- **Zweisprachig** (Deutsch / Englisch), Umschalter oben rechts und im Footer. Die Startsprache folgt dem Browser.
- **Karte** mit allen freigegebenen Standorten (Leaflet + OpenStreetMap), Preis direkt am Pin
- **Filter** nach Anbietertyp (Alle / Privat / Schule & Verleih), dann nach **Marke** und danach nach **Modell**
- **Zwei Anbietertypen**: Privat (dunkelblaue Pins mit Blitz) und Schule / Verleih (violette Pins mit Haus-Symbol). Schulen und Rentals geben Website und Öffnungszeiten an, beides ist öffentlich sichtbar
- **Reiseziel-Suche** (Ortssuche über Nominatim)
- **Konto** für Anbieter (E-Mail + Passwort), ein Angebot pro Konto
- **Angebot**: Batterien (Marke + Modell, jederzeit auch „Anderes Modell“ / „Andere Marke“ als Freitext), Preis pro Tag und/oder Woche, Kaution, „Ausweis wird vorgezeigt“, Standort, WhatsApp und/oder E-Mail, Hinweise
- **Freigabe von Hand**: Neue Angebote erscheinen erst, nachdem du sie freigegeben hast. Du bekommst eine Mail und gibst auf `admin.html` frei oder lehnst ab
- **Verifizierung**: Privat: Profil-Link (Instagram oder Facebook) ist Pflicht. Schule / Verleih: Website und Öffnungszeiten sind Pflicht, ein Profil ist optional. Eine Rechnung ist für alle optional und wird nach der Prüfung gelöscht
- **Kontaktdaten nur für angemeldete Mitglieder**, Pin auf Wunsch um 200–600 m versetzt
- Reines HTML/CSS/JS, kein Build-Schritt. Bibliotheken und Schriften liegen im Repo (`assets/vendor`, `assets/fonts`)

**Live:** https://foilbattery.com (GitHub Pages aus `main`, Domain bei IONOS). Kontakt: mail@foilbattery.com. Betreiber: Ola Vibes S.L.

## Sofort ausprobieren (Demo-Modus)

Ohne Einstellungen läuft die Seite im Demo-Modus: erfundene Beispiel-Standorte, Login nur simuliert, Eingaben bleiben im Browser, Anträge werden sofort „freigegeben“. Die Admin-Seite gibt es nur im Echtbetrieb.

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Die Karte lädt zuverlässig über `https://` (GitHub Pages). Beim Öffnen per Doppelklick (`file://`) oder in manchen Vorschau-Fenstern blockiert OpenStreetMap die Kacheln, weil der Browser keine Herkunft (Referer) mitschickt. Das ist kein Fehler der Seite.

## Echtbetrieb mit Supabase

Supabase liefert Konten, Datenbank, privaten Datei-Speicher und die Mail-Funktion. Die Seite selbst bleibt statisch. Die folgenden Schritte sind für das Live-Projekt erledigt und dienen als Referenz, falls man es neu aufsetzen muss.

### 1. Projekt und Datenbank

1. Auf [supabase.com](https://supabase.com) ein Projekt anlegen. Region in der EU oder UK wählen (das Live-Projekt liegt in London, `eu-west-2`).
2. **SQL Editor → New query**: Inhalt von [`supabase/schema.sql`](supabase/schema.sql) einfügen und ausführen. Das Skript kann mehrfach laufen.
3. **Project Settings → API**: `Project URL` und den `anon`- bzw. `publishable`-Key kopieren und in [`assets/js/config.js`](assets/js/config.js) eintragen (`supabaseUrl`, `supabaseAnonKey`). Dieser Key ist für den Browser gedacht und darf im Repo stehen. Die Sicherheit kommt aus den Regeln in `schema.sql`.

### 2. Anmeldung und Mails an Nutzer

1. **Authentication → URL Configuration**: `Site URL` auf die Adresse der Seite setzen (`https://foilbattery.com`) und dieselbe Adresse bei „Redirect URLs“ eintragen. Sonst führen die Links in den Bestätigungs-Mails ins Leere.
2. **Authentication → Providers → Email**: „Confirm email“ bleibt **an** (gegen Fake-Konten).
3. **Authentication → SMTP Settings → Custom SMTP**: Die eingebauten Supabase-Mails sind auf ganz wenige pro Stunde begrenzt, das reicht nicht für Tests mit Freunden. Live: Postfach `mail@foilbattery.com` bei IONOS, Host `smtp.ionos.es`, Port `465`, Benutzer = Mail-Adresse, Passwort = Postfach-Passwort. Mit Gmail ginge es genauso (Host `smtp.gmail.com`, Passwort = App-Passwort). Passwörter gehören nie ins Repo.

### 3. Dich selbst als Admin eintragen

1. Auf der Seite ein Konto mit deiner E-Mail anlegen und die Bestätigungs-Mail anklicken.
2. Im **SQL Editor** ausführen (E-Mail anpassen):

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'deine@mail.adresse';
```

Danach zeigt `admin.html` die Anträge. Weitere Admins trägst du genauso ein.

### 4. Mail an dich bei neuen Anträgen (Edge Function)

Eine kleine Funktion verschickt die Mail „Neuer Antrag“ an dich und die Mail „freigegeben / abgelehnt“ an den Verleiher. Sie braucht keinen geheimen Supabase-Schlüssel, alle Rechte kommen vom Login des Aufrufers. Ob jemand Admin ist, entscheidet die Datenbank.

1. **Edge Functions → Deploy a new function → Via Editor**, Name genau `application`.
2. Den Inhalt von [`supabase/functions/application/index.ts`](supabase/functions/application/index.ts) einfügen und deployen. „Verify JWT“ bleibt **an**.
3. **Edge Functions → Secrets** anlegen:

| Secret | Wert |
| --- | --- |
| `SMTP_HOST` | Mail-Server, live `smtp.ionos.es` (ohne Angabe: `smtp.gmail.com`) |
| `SMTP_PORT` | `465` (SSL) oder `587` (STARTTLS) |
| `SMTP_USER` | Absender-Adresse, live `mail@foilbattery.com` |
| `SMTP_PASS` | Postfach-Passwort (bei Gmail: App-Passwort) |
| `ADMIN_EMAIL` | Adresse, die die Antrags-Mails bekommt |
| `SITE_URL` | `https://foilbattery.com` (ohne `/` am Ende) |
| `FROM_NAME` | optional, Absendername, z. B. `Foil Assist Battery Rental` |

`SUPABASE_URL` und `SUPABASE_ANON_KEY` stellt Supabase selbst bereit.

> **Hinweis:** Supabase dokumentiert, dass ausgehende SMTP-Verbindungen aus Edge Functions blockiert sein können. Port 465 funktioniert derzeit. Kommt keine Mail an: **Edge Functions → application → Logs** prüfen. Der Antrag bleibt trotzdem auf `admin.html` unter „Offen“ sichtbar. Ausweg wäre ein Mail-Dienst per HTTPS (z. B. Resend) statt SMTP in `sendMail()`.

Schau in der ersten Zeit regelmäßig auf `admin.html`, damit kein Antrag liegen bleibt.

### 5. Veröffentlichen

**Settings → Pages → Build and deployment**: Source `Deploy from a branch`, Branch `main`, Ordner `/ (root)`. Eigene Domain: Datei `CNAME` im Repo (`foilbattery.com`), bei IONOS vier A-Einträge (`185.199.108.153` bis `185.199.111.153`), vier AAAA-Einträge (`2606:50c0:8000::153` bis `8003::153`) und `www` auf GitHub, in den Pages-Einstellungen „Enforce HTTPS“ an. Die Admin-Seite liegt unter `https://foilbattery.com/admin.html`.

### Ablauf testen

1. Du legst selbst ein Test-Angebot an und prüfst: kommt die Mail bei dir an, funktioniert „Freigeben“, erscheint der Pin?
2. Freunde registrieren sich (Bestätigungs-Mail anklicken), stellen ein Angebot ein und warten auf deine Freigabe.
3. Andere Freunde sehen nach dem Login die Kontaktdaten der freigegebenen Angebote.

## Was die Datenbank-Regeln erzwingen

| Wer | Darf |
| --- | --- |
| Besucher ohne Login | **freigegebene**, aktive Angebote lesen, ohne WhatsApp, E-Mail, Status und Nachweise |
| Angemeldete Mitglieder | zusätzlich WhatsApp und E-Mail der freigegebenen Angebote lesen |
| Anbieter | sein eigenes Angebot anlegen, ändern, pausieren, löschen und den eigenen Status sehen. Den Status auf „freigegeben“ setzen kann nur der Admin |
| Admin | Anträge sehen, Nachweise ansehen, freigeben oder ablehnen |

Geschrieben wird nur über Datenbank-Funktionen (`save_my_listing`, `admin_decide` …), nie direkt in die Tabelle. Das Schema prüft außerdem Modelle, Preise, Kaution, WhatsApp-Format (`+49…`), E-Mail, Währung, Profil-Link (nur https://instagram.com, facebook.com, fb.com, fb.me) und Textlängen. Die Rechnung liegt in einem privaten Speicher (PDF/JPG/PNG, höchstens 5 MB), den nur der Besitzer und der Admin lesen können. Bei Freigabe oder Ablehnung wird sie gelöscht.

> Hinweis: Jedes registrierte Mitglied kann über die API alle Kontaktdaten der freigegebenen Angebote lesen. Das ist der Preis dafür, dass Kontakt für Reisende einfach bleibt. Wer mehr Schutz will, kann in Supabase ein Captcha für die Registrierung aktivieren (Authentication → Attack Protection).

## Anpassen

| Was | Wo |
| --- | --- |
| Marken und Batterie-Modelle | nur `assets/js/catalog.js` (siehe „Marken und Modelle ergänzen“) |
| Währungen | `CURRENCIES` in `assets/js/app.js` und die `currency`-Prüfung in `schema.sql` |
| Texte (Deutsch/Englisch) | `assets/js/i18n.js`. Eine weitere Sprache ergänzt man als Kopie des `en`-Blocks |
| Farben, Schrift, Abstände | `:root` in `assets/css/app.css` |
| Kartenstil / Kachel-Anbieter | `tileUrl` und `tileAttribution` in `assets/js/config.js` |
| Radius des ungefähren Standorts | `fuzz()` und `HALO_METERS` in `assets/js/app.js` |
| „Angebot melden“-Link im Footer | `contactEmail` in `assets/js/config.js` |
| Texte der Mails | `supabase/functions/application/index.ts` |

## Betrieb

- Die OpenStreetMap-Standardkacheln sind für kleine Projekte in Ordnung ([Nutzungsrichtlinie](https://operations.osmfoundation.org/policies/tiles/)). Bei viel Traffic einen eigenen Kachel-Anbieter in `config.js` eintragen.
- Ortssuche und Orts-Vorschlag nutzen den öffentlichen Nominatim-Dienst (wenige Anfragen pro Sekunde). Die Seite fragt nur nach einem Klick auf „Suchen“.
- Impressum und Datenschutz sind Vorlagen und keine Rechtsberatung.

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
    catalog.js          Marken und Batteriemodelle
    admin.js            Admin-Seite
    legal.js            Sprachumschalter für Impressum/Datenschutz
    config.js           Einstellungen (Supabase-Zugang, Karte)
    store-demo.js       Demo-Speicher (Browser)
    store-supabase.js   Konten, Datenbank, Upload, Admin-Aufrufe
  vendor/               Leaflet, MarkerCluster, supabase-js (lokal, mit Lizenzen)
  fonts/                Bricolage Grotesque, Instrument Sans (SIL OFL)
supabase/
  schema.sql            Tabellen, Rechte, Funktionen, Datei-Speicher
  functions/application/index.ts   Mails an dich und an die Anbieter
```

## Lizenzen der Bestandteile

Leaflet (BSD-2), Leaflet.markercluster (MIT), supabase-js (MIT), Bricolage Grotesque und Instrument Sans (SIL Open Font License). Kartendaten © OpenStreetMap-Mitwirkende (ODbL).

## Marken und Modelle ergänzen

Die Auswahl steht in [`assets/js/catalog.js`](assets/js/catalog.js). Eine neue Marke oder ein neues Modell ist ein Eintrag in der Liste (`id` in Kleinbuchstaben/Ziffern/Bindestrich, `name` wie angezeigt). Die IDs später nicht mehr ändern, sie stecken in gespeicherten Angeboten. Die Datenbank prüft nur das Format der IDs, du musst dort nichts anpassen. Wer sein Modell nicht findet, wählt „Anderes Modell“ bzw. „Andere Marke“ und tippt den Namen ein.

## Update einer älteren Version

Hast du die Datenbank schon mit einer früheren Version von `schema.sql` angelegt, führst du die aktuelle Datei im SQL Editor einfach noch einmal aus. Sie ergänzt die neuen Spalten (Anbietertyp, Website, Öffnungszeiten), setzt bei bestehenden Batterien die Marke „Foil Drive“ und ändert nichts an vorhandenen Daten. Danach die Edge Function `application` mit dem aktuellen Code neu bereitstellen (Mail-Texte).

