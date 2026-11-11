/*
 * Supabase-Speicher: echte Konten (E-Mail + Passwort) und Datenbank.
 * Tabelle, Rechte und Zeilenregeln stehen in supabase/schema.sql.
 */
(function () {
  'use strict';

  var CURRENCIES = ['EUR', 'CHF', 'GBP', 'USD', 'NOK', 'SEK', 'DKK', 'PLN'];

  // Diese Spalten darf auch ein nicht angemeldeter Besucher lesen (Kontaktdaten gehören nicht dazu).
  var PUBLIC_COLUMNS = 'id,display_name,place_label,lat,lng,approximate,batteries,currency,notes,active,updated_at';

  function friendly(err) {
    var m = (err && err.message) || '';
    var text;
    if (/invalid login credentials/i.test(m)) text = 'E-Mail oder Passwort stimmt nicht.';
    else if (/email not confirmed/i.test(m)) text = 'Bitte bestätige zuerst deine E-Mail-Adresse. Den Link findest du in der Mail, die wir dir geschickt haben.';
    else if (/already registered|already been registered/i.test(m)) text = 'Zu dieser E-Mail gibt es schon ein Konto. Melde dich stattdessen an.';
    else if (/password should be at least|weak password/i.test(m)) text = 'Das Passwort ist zu kurz oder zu einfach. Nimm mindestens 8 Zeichen.';
    else if (/rate limit|too many/i.test(m)) text = 'Zu viele Versuche in kurzer Zeit. Warte ein paar Minuten und versuch es noch einmal.';
    else if (/failed to fetch|network/i.test(m)) text = 'Keine Verbindung zum Server. Prüfe dein Internet und versuch es noch einmal.';
    else if (/row-level security|violates/i.test(m)) text = 'Das Angebot konnte nicht gespeichert werden. Prüfe deine Eingaben und melde dich ggf. neu an.';
    else text = 'Das hat nicht geklappt (' + (m || 'unbekannter Fehler') + ').';
    var e = new Error(text);
    e.original = err;
    return e;
  }

  function fromRow(r) {
    return {
      id: r.id,
      name: r.display_name,
      placeLabel: r.place_label || '',
      lat: r.lat,
      lng: r.lng,
      approximate: r.approximate !== false,
      batteries: Array.isArray(r.batteries) ? r.batteries : [],
      currency: CURRENCIES.indexOf(r.currency) > -1 ? r.currency : 'EUR',
      notes: r.notes || '',
      active: r.active !== false,
      whatsapp: r.whatsapp || '',
      email: r.email || '',
      ownerId: r.owner_id || null,
      updatedAt: r.updated_at || null
    };
  }

  function toRow(l) {
    return {
      display_name: l.name,
      place_label: l.placeLabel || '',
      lat: l.lat,
      lng: l.lng,
      approximate: !!l.approximate,
      batteries: l.batteries,
      currency: l.currency,
      whatsapp: l.whatsapp || null,
      email: l.email || null,
      notes: l.notes || '',
      active: l.active !== false
    };
  }

  window.createSupabaseStore = function (cfg) {
    var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    var user = null;
    var listeners = [];
    var redirect = window.location.origin + window.location.pathname;

    return {
      mode: 'live',

      init: function () {
        sb.auth.onAuthStateChange(function (event, session) {
          user = session ? session.user : null;
          // Nicht direkt im Callback weiterarbeiten (Supabase-Empfehlung, sonst Deadlock-Gefahr).
          setTimeout(function () { listeners.forEach(function (cb) { cb(event, user); }); }, 0);
        });
        return sb.auth.getSession().then(function (r) {
          user = r.data && r.data.session ? r.data.session.user : null;
        });
      },

      getUser: function () { return user; },
      onAuth: function (cb) { listeners.push(cb); },

      signIn: function (email, password) {
        return sb.auth.signInWithPassword({ email: email, password: password }).then(function (r) {
          if (r.error) throw friendly(r.error);
          return { needsConfirm: false };
        });
      },
      signUp: function (email, password) {
        return sb.auth.signUp({ email: email, password: password, options: { emailRedirectTo: redirect } }).then(function (r) {
          if (r.error) throw friendly(r.error);
          return { needsConfirm: !r.data.session };
        });
      },
      signOut: function () {
        return sb.auth.signOut().then(function (r) { if (r.error) throw friendly(r.error); });
      },
      resetPassword: function (email) {
        return sb.auth.resetPasswordForEmail(email, { redirectTo: redirect }).then(function (r) {
          if (r.error) throw friendly(r.error);
        });
      },
      updatePassword: function (password) {
        return sb.auth.updateUser({ password: password }).then(function (r) {
          if (r.error) throw friendly(r.error);
        });
      },

      listListings: function () {
        var cols = user ? '*' : PUBLIC_COLUMNS;
        return sb.from('listings').select(cols).eq('active', true).limit(2000).then(function (r) {
          if (r.error) throw friendly(r.error);
          return (r.data || []).map(fromRow);
        });
      },

      getMyListing: function () {
        if (!user) return Promise.resolve(null);
        return sb.from('listings').select('*').eq('owner_id', user.id).maybeSingle().then(function (r) {
          if (r.error) throw friendly(r.error);
          return r.data ? fromRow(r.data) : null;
        });
      },

      saveListing: function (data) {
        if (!user) return Promise.reject(new Error('Bitte melde dich zuerst an.'));
        var row = toRow(data);
        row.owner_id = user.id;
        return sb.from('listings').upsert(row, { onConflict: 'owner_id' }).select('*').single().then(function (r) {
          if (r.error) throw friendly(r.error);
          return fromRow(r.data);
        });
      },

      deleteListing: function () {
        if (!user) return Promise.reject(new Error('Bitte melde dich zuerst an.'));
        return sb.from('listings').delete().eq('owner_id', user.id).then(function (r) {
          if (r.error) throw friendly(r.error);
        });
      }
    };
  };
})();
