/*
 * Demo-Speicher: läuft komplett im Browser. Wird benutzt, solange in config.js
 * kein Supabase eingetragen ist. Beispiel-Standorte sind erfunden und ohne Kontaktdaten.
 * Anträge werden hier sofort freigegeben, damit man den Ablauf ausprobieren kann.
 */
(function () {
  'use strict';

  /* Beispieltexte gibt es in beiden Sprachen; sie werden beim Laden in der aktuellen Sprache geliefert. */
  var SEEDS = [
    { id: 'demo-tarifa', name: 'Tarifa', placeLabel: 'Tarifa, Spanien|Tarifa, Spain', lat: 36.0143, lng: -5.6044,
      batteries: [{ model: 'max-hp', priceDay: 60, priceWeek: 350 }, { model: 'max-sport', priceDay: 45, priceWeek: 260 }],
      depositAmount: 200, idCheck: true,
      notes: 'Beispieltext: Abholung in Tarifa-Stadt, Ladegerät ist dabei.|Sample text: pick-up in Tarifa town, charger included.' },
    { id: 'demo-mallorca', name: 'Mallorca', placeLabel: 'Port de Pollença, Spanien|Port de Pollença, Spain', lat: 39.9, lng: 3.08,
      batteries: [{ model: 'max-power', priceDay: 55, priceWeek: null }, { model: 'fm650', priceDay: null, priceWeek: 300 }],
      depositAmount: 150, idCheck: false,
      notes: 'Beispieltext: Lieferung zum Strand möglich.|Sample text: delivery to the beach possible.' },
    { id: 'demo-algarve', name: 'Algarve', placeLabel: 'Lagos, Portugal', lat: 37.1, lng: -8.67,
      batteries: [{ model: 'max-sport-396', priceDay: 50, priceWeek: 290 }],
      depositAmount: 0, idCheck: true, notes: '' },
    { id: 'demo-gardasee', name: 'Gardasee', placeLabel: 'Torbole, Italien|Torbole, Italy', lat: 45.87, lng: 10.87,
      batteries: [{ model: 'fm450', priceDay: 35, priceWeek: 200 }, { model: 'fm650', priceDay: 45, priceWeek: 250 }, { model: 'f860', priceDay: 65, priceWeek: null }],
      depositAmount: null, idCheck: false,
      notes: 'Beispieltext: Ab Mai bis Oktober verfügbar.|Sample text: available May to October.' },
    { id: 'demo-fuerte', name: 'Fuerteventura', placeLabel: 'Corralejo, Spanien|Corralejo, Spain', lat: 28.74, lng: -13.87,
      batteries: [{ model: 'max-hp', priceDay: null, priceWeek: null }],
      depositAmount: 300, idCheck: true,
      notes: 'Beispieltext: Preis nach Absprache.|Sample text: price by arrangement.' },
    { id: 'demo-sylt', name: 'Sylt', placeLabel: 'Sylt, Deutschland|Sylt, Germany', lat: 54.91, lng: 8.31,
      batteries: [{ model: 'max-sport', priceDay: 40, priceWeek: 220 }, { model: 'max-power', priceDay: 50, priceWeek: 280 }],
      depositAmount: 100, idCheck: false, notes: '' },
    { id: 'demo-split', name: 'Split', placeLabel: 'Split, Kroatien|Split, Croatia', lat: 43.51, lng: 16.44,
      batteries: [{ model: 'f860', priceDay: 70, priceWeek: 400 }, { model: 'fm450', priceDay: 30, priceWeek: null }],
      depositAmount: 250, idCheck: true,
      notes: 'Beispieltext: Übergabe nach 17 Uhr.|Sample text: handover after 5 pm.' }
  ];

  window.createDemoStore = function () {
    var KEY_MINE = 'fdbr.demo.mine.v2';
    var KEY_USER = 'fdbr.demo.user.v1';
    var mem = {};
    var listeners = [];

    function get(k) {
      try { var v = window.localStorage.getItem(k); return v ? JSON.parse(v) : null; }
      catch (e) { return mem[k] || null; }
    }
    function set(k, v) {
      try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { mem[k] = v; }
    }
    function del(k) {
      try { window.localStorage.removeItem(k); } catch (e) { delete mem[k]; }
    }

    var user = get(KEY_USER);
    function emit(ev) { listeners.forEach(function (cb) { cb(ev, user); }); }

    function pickLang(s) {
      if (s.indexOf('|') < 0) return s;
      var parts = s.split('|');
      return window.I18N && window.I18N.lang() === 'en' ? parts[1] : parts[0];
    }

    function seedListing(s) {
      var en = window.I18N && window.I18N.lang() === 'en';
      return {
        id: s.id, name: (en ? 'Demo ' : 'Demo ') + s.name, placeLabel: pickLang(s.placeLabel), lat: s.lat, lng: s.lng, approximate: true,
        batteries: s.batteries.slice(), currency: 'EUR', depositAmount: s.depositAmount, idCheck: s.idCheck,
        notes: pickLang(s.notes), active: true, whatsapp: '', email: '', status: 'approved', demo: true
      };
    }

    function login(email) {
      user = { id: 'demo-user', email: email };
      set(KEY_USER, user);
      setTimeout(function () { emit('SIGNED_IN'); }, 0);
      return Promise.resolve({ needsConfirm: false });
    }

    return {
      mode: 'demo',
      init: function () { return Promise.resolve(); },
      getUser: function () { return user; },
      onAuth: function (cb) { listeners.push(cb); },
      signIn: function (email) { return login(email); },
      signUp: function (email) { return login(email); },
      signOut: function () {
        user = null; del(KEY_USER);
        setTimeout(function () { emit('SIGNED_OUT'); }, 0);
        return Promise.resolve();
      },
      resetPassword: function () { return Promise.resolve(); },
      updatePassword: function () { return Promise.resolve(); },
      listListings: function () {
        var out = SEEDS.map(seedListing);
        var mine = get(KEY_MINE);
        if (mine && mine.active && mine.status === 'approved') out.push(mine);
        return Promise.resolve(out);
      },
      getMyListing: function () { return Promise.resolve(user ? get(KEY_MINE) : null); },
      /* Demo: Antrag wird sofort freigegeben; die Datei wird nicht gespeichert. */
      saveListing: function (data, file) {
        var l = Object.assign({}, data, {
          id: 'demo-mine', status: 'approved', rejectReason: '',
          proofFile: file ? file.name : (data.proofFile || '')
        });
        set(KEY_MINE, l);
        return Promise.resolve(l);
      },
      deleteListing: function () { del(KEY_MINE); return Promise.resolve(); },
      notifySubmitted: function () { return Promise.resolve(); },
      admin: null
    };
  };
})();
