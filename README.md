# Foil Drive Battery Rental

Community-Karte für Foil Drive Owner: Die Batterien dürfen nicht ins Flugzeug, also leiht man sich im Urlaub eine bei einem anderen Owner vor Ort.

- **Karte** mit allen Verleih-Standorten (Leaflet + OpenStreetMap), Preis direkt am Pin
- **Filter** nach Batterie: Max HP, Max Power, Max Sport, Max Sport 396, FM650, FM450, F860
- **Reiseziel-Suche** (Ortssuche über Nominatim)
- **Konto** für Owner (E-Mail + Passwort), ein Angebot pro Konto
- **Angebot**: Batterien, Preis pro Tag und/oder Woche, Standort, WhatsApp und/oder E-Mail, Hinweise
- **Kontaktdaten nur für angemeldete Mitglieder**, Pin auf Wunsch um 200–600 m versetzt
- **Bezahlung und Deal laufen außerhalb der Seite**: Die Seite stellt nur den Kontakt her
- Reines HTML/CSS/JS, kein Build-Schritt. Bibliotheken und Schriften liegen im Repo (`assets/vendor`, `assets/fonts`)

## Sofort ausprobieren (Demo-Modus)

Ohne Einstellungen läuft die Seite im Demo-Modus: erfundene Beispiel-Standorte, Login nur simuliert, Eingaben bleiben im Browser.

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Die Seite funktioniert auch per Doppelklick auf `index.html`.

## Echtbetrieb mit Supabase (ca. 10 Minuten, kostenlos)

Supabase liefert Konten und Datenbank. Die Seite selbst bleibt statisch.

1. Auf [supabase.com](https://supabase.com) ein Projekt anlegen. Region am besten **Frankfurt** (EU).
2. **SQL Editor → New query**: Inhalt von [`supabase/schema.sql`](supabase/schema.sql) einfügen und ausführen.
3. **Project Settings → API**: `Project URL` und den `anon`- bzw. `publishable`-Key kopieren.
4. Beides in [`assets/js/config.js`](assets/js/config.js) eintragen (`supabaseUrl`, `supabaseAnonKey`). Dieser Key ist für den Browser gedacht und darf im Repo stehen. Die Sicherheit kommt aus den Regeln in `schema.sql`.
5. **Authentication → URL Configuration**: `Site URL` auf die Adresse der Seite setzen (z. B. `https://lukilink.github.io/foildrive-battery-rental/`). Sonst führen die Links in den Bestätigungs-Mails ins Leere.
6. Optional, **Authentication → Providers → Email**: „Confirm email“ bleibt am besten an (gegen Fake-Konten). Die eingebauten Supabase-Mails sind stark begrenzt. Für viele Nutzer lohnt sich ein eigener SMTP-Anbieter unter **Authentication → SMTP Settings**.
7. Committen und pushen. Der Demo-Hinweis verschwindet automatisch.

### Was die Datenbank-Regeln erzwingen

| Wer | Darf |
| --- | --- |
| Besucher ohne Login | aktive Angebote lesen, **ohne** WhatsApp, E-Mail und Besitzer-ID |
| Angemeldete Mitglieder | zusätzlich die Kontaktdaten aller aktiven Angebote lesen |
| Besitzer | sein eigenes Angebot anlegen, ändern, pausieren, löschen (auch wenn es pausiert ist) |

Das Schema prüft außerdem Modelle, Preise, WhatsApp-Format (`+49…`), E-Mail, Währung und Textlängen, damit auch direkte API-Aufrufe keine kaputten Daten schreiben können.

> Hinweis: Jedes registrierte Mitglied kann über die API alle Kontaktdaten lesen. Das ist der Preis dafür, dass Kontakt für Reisende einfach bleibt. Wer mehr Schutz will, kann in Supabase ein Captcha für die Registrierung aktivieren (Authentication → Attack Protection).

## Auf GitHub Pages veröffentlichen

**Settings → Pages → Build and deployment**: Source `Deploy from a branch`, Branch `main`, Ordner `/ (root)`. Die Seite ist danach unter `https://<account>.github.io/<repo>/` erreichbar.

## Anpassen

| Was | Wo |
| --- | --- |
| Batterie-Modelle | `MODELS` in `assets/js/app.js` **und** die Liste in `batteries_valid` in `supabase/schema.sql` |
| Währungen | `CURRENCIES` in `assets/js/app.js` und die `currency`-Prüfung in `schema.sql` |
| Farben, Schrift, Abstände | `:root` in `assets/css/app.css` |
| Kartenstil / Kachel-Anbieter | `tileUrl` und `tileAttribution` in `assets/js/config.js` |
| Radius des ungefähren Standorts | `fuzz()` und `HALO_METERS` in `assets/js/app.js` |
| „Angebot melden“-Link im Footer | `contactEmail` in `assets/js/config.js` |

## Vor dem öffentlichen Start

- [ ] `impressum.html` und `datenschutz.html` ausfüllen. Das sind **Vorlagen mit Platzhaltern** und keine Rechtsberatung.
- [ ] Supabase einrichten (siehe oben) und `config.js` füllen.
- [ ] Die OpenStreetMap-Standardkacheln sind für kleine Projekte in Ordnung ([Nutzungsrichtlinie](https://operations.osmfoundation.org/policies/tiles/)). Bei viel Traffic einen eigenen Kachel-Anbieter eintragen.
- [ ] Ortssuche und Orts-Vorschlag nutzen den öffentlichen Nominatim-Dienst. Er ist auf wenige Anfragen pro Sekunde begrenzt, die Seite fragt nur nach einem Klick auf „Suchen“.

## Projektstruktur

```
index.html            Seite mit Karte, Dialogen und Infotexten
impressum.html        Vorlage
datenschutz.html      Vorlage
assets/
  css/                app.css (Design), fonts.css
  js/
    app.js            Oberfläche und Logik
    config.js         Einstellungen (Supabase-Zugang, Karte)
    store-demo.js     Demo-Speicher (Browser)
    store-supabase.js Konten und Datenbank
  vendor/             Leaflet, MarkerCluster, supabase-js (lokal, mit Lizenzen)
  fonts/              Bricolage Grotesque, Instrument Sans (SIL OFL)
supabase/schema.sql   Tabelle, Rechte und Regeln
```

## Lizenzen der Bestandteile

Leaflet (BSD-2), Leaflet.markercluster (MIT), supabase-js (MIT), Bricolage Grotesque und Instrument Sans (SIL Open Font License). Kartendaten © OpenStreetMap-Mitwirkende (ODbL).
