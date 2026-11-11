/*
 * Einstellungen der Seite.
 *
 * Solange supabaseUrl und supabaseAnonKey leer sind, läuft die Seite im DEMO-MODUS:
 * Beispiel-Standorte, Login nur simuliert, Eingaben bleiben im Browser (localStorage).
 *
 * Für den echten Betrieb: Supabase-Projekt anlegen, supabase/schema.sql ausführen und
 * hier URL + "anon"/"publishable" Key eintragen (siehe README.md).
 * Dieser Key ist für den Browser gedacht und darf im Repo stehen – die Sicherheit
 * kommt von den Row-Level-Security-Regeln in schema.sql.
 */
window.BATTERY_RENTAL_CONFIG = {
  supabaseUrl: 'https://eciowftziduuvwrjajrn.supabase.co',      // z. B. 'https://abcdefghijkl.supabase.co'
  supabaseAnonKey: 'sb_publishable_R8Mjj4mRd5N_-gLghtcmdg_LtS8bk0i',  // 'anon' oder 'publishable' Key aus Project Settings → API

  // Optional: Adresse für "Angebot melden" im Footer (leer = Link wird nicht angezeigt)
  contactEmail: 'mail@foilbattery.com',

  /* Partner-Programm: true = Partner-Badge, größerer Pin und Partner zuerst in der Liste.
     Vor dem Einschalten muss supabase/schema.sql (Version 4) in Supabase gelaufen sein. */
  partnerProgram: true,

  // Kartenkacheln. OpenStreetMap-Standard ist für kleine Community-Projekte okay
  // (https://operations.osmfoundation.org/policies/tiles/). Bei viel Traffic bitte
  // auf einen eigenen Kachel-Anbieter wechseln (MapTiler, Stadia, Thunderforest …).
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',

  // Startansicht der Karte, bevor Standorte geladen sind
  defaultCenter: [43.5, 8],
  defaultZoom: 4
};
