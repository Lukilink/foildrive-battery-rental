/*
 * Demo-Speicher: läuft komplett im Browser. Wird benutzt, solange in config.js
 * kein Supabase eingetragen ist. Beispiel-Standorte sind erfunden und ohne Kontaktdaten.
 */
(function () {
  'use strict';

  var SEEDS = [
    { id: 'demo-tarifa', name: 'Demo-Eintrag Tarifa', placeLabel: 'Tarifa, Spanien', lat: 36.0143, lng: -5.6044,
      batteries: [{ model: 'max-hp', priceDay: 60, priceWeek: 350 }, { model: 'max-sport', priceDay: 45, priceWeek: 260 }],
      notes: 'Beispieltext: Abholung in Tarifa-Stadt, Ladegerät ist dabei, Kaution in bar.' },
    { id: 'demo-mallorca', name: 'Demo-Eintrag Mallorca', placeLabel: 'Port de Pollença, Spanien', lat: 39.9, lng: 3.08,
      batteries: [{ model: 'max-power', priceDay: 55, priceWeek: null }, { model: 'fm650', priceDay: null, priceWeek: 300 }],
      notes: 'Beispieltext: Lieferung zum Strand möglich.' },
    { id: 'demo-algarve', name: 'Demo-Eintrag Algarve', placeLabel: 'Lagos, Portugal', lat: 37.1, lng: -8.67,
      batteries: [{ model: 'max-sport-396', priceDay: 50, priceWeek: 290 }],
      notes: '' },
    { id: 'demo-gardasee', name: 'Demo-Eintrag Gardasee', placeLabel: 'Torbole, Italien', lat: 45.87, lng: 10.87,
      batteries: [{ model: 'fm450', priceDay: 35, priceWeek: 200 }, { model: 'fm650', priceDay: 45, priceWeek: 250 }, { model: 'f860', priceDay: 65, priceWeek: null }],
      notes: 'Beispieltext: Ab Mai bis Oktober verfügbar.' },
    { id: 'demo-fuerte', name: 'Demo-Eintrag Fuerteventura', placeLabel: 'Corralejo, Spanien', lat: 28.74, lng: -13.87,
      batteries: [{ model: 'max-hp', priceDay: null, priceWeek: null }],
      notes: 'Beispieltext: Preis nach Absprache.' },
    { id: 'demo-sylt', name: 'Demo-Eintrag Sylt', placeLabel: 'Sylt, Deutschland', lat: 54.91, lng: 8.31,
      batteries: [{ model: 'max-sport', priceDay: 40, priceWeek: 220 }, { model: 'max-power', priceDay: 50, priceWeek: 280 }],
      notes: '' },
    { id: 'demo-split', name: 'Demo-Eintrag Kroatien', placeLabel: 'Split, Kroatien', lat: 43.51, lng: 16.44,
      batteries: [{ model: 'f860', priceDay: 70, priceWeek: 400 }, { model: 'fm450', priceDay: 30, priceWeek: null }],
      notes: 'Beispieltext: Übergabe nach 17 Uhr.' }
  ];

  window.createDemoStore = function () {
    var KEY_MINE = 'fdbr.demo.mine.v1';
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

    function seedListing(s) {
      return {
        id: s.id, name: s.name, placeLabel: s.placeLabel, lat: s.lat, lng: s.lng, approximate: true,
        batteries: s.batteries.slice(), currency: 'EUR', notes: s.notes, active: true,
        whatsapp: '', email: '', demo: true
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
        if (mine && mine.active) out.push(mine);
        return Promise.resolve(out);
      },
      getMyListing: function () { return Promise.resolve(user ? get(KEY_MINE) : null); },
      saveListing: function (data) {
        var l = Object.assign({}, data, { id: 'demo-mine', ownerId: 'demo-user' });
        set(KEY_MINE, l);
        return Promise.resolve(l);
      },
      deleteListing: function () { del(KEY_MINE); return Promise.resolve(); }
    };
  };
})();
