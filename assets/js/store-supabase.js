/*
 * Supabase-Speicher: echte Konten (E-Mail + Passwort), Datenbank, Nachweis-Upload, Admin-Funktionen.
 * Tabelle, Rechte und Funktionen stehen in supabase/schema.sql.
 * Geschrieben wird nur über Datenbank-Funktionen (rpc), nie direkt in die Tabelle.
 */
(function () {
  'use strict';

  var CURRENCIES = ['EUR', 'CHF', 'GBP', 'USD', 'NOK', 'SEK', 'DKK', 'PLN'];

  // Spalten, die auch ein nicht angemeldeter Besucher lesen darf (Kontaktdaten gehören nicht dazu).
  var PUBLIC_COLUMNS = 'id,kind,website,opening_hours,display_name,place_label,lat,lng,approximate,batteries,currency,deposit_amount,id_check,notes,active,updated_at';
  var MEMBER_COLUMNS = PUBLIC_COLUMNS + ',whatsapp,email';

  function t(key, params) { return window.I18N ? window.I18N.t(key, params) : key; }

  function friendly(err) {
    var m = (err && err.message) || '';
    var text;
    if (/invalid login credentials/i.test(m)) text = t('err.invalid_login');
    else if (/email not confirmed/i.test(m)) text = t('err.email_unconfirmed');
    else if (/already registered|already been registered/i.test(m)) text = t('err.already_registered');
    else if (/password should be at least|weak password/i.test(m)) text = t('err.weak_password');
    else if (/rate limit|too many/i.test(m)) text = t('err.rate_limit');
    else if (/failed to fetch|network/i.test(m)) text = t('err.network');
    else if (/not authenticated/i.test(m)) text = t('err.not_authenticated');
    else if (/row-level security|violates|invalid proof_file/i.test(m)) text = t('err.rls');
    else text = t('err.generic', { m: m || '?' });
    var e = new Error(text);
    e.original = err;
    return e;
  }

  function fromRow(r) {
    return {
      id: r.id,
      kind: r.kind === 'pro' ? 'pro' : 'private',
      website: r.website || '',
      openingHours: r.opening_hours || '',
      name: r.display_name,
      placeLabel: r.place_label || '',
      lat: r.lat,
      lng: r.lng,
      approximate: r.approximate !== false,
      // ältere Einträge ohne Marke waren alle Foil Drive
      batteries: (Array.isArray(r.batteries) ? r.batteries : []).map(function (b) {
        return b && !b.brand ? Object.assign({ brand: 'foil-drive' }, b) : b;
      }),
      currency: CURRENCIES.indexOf(r.currency) > -1 ? r.currency : 'EUR',
      depositAmount: r.deposit_amount == null ? null : Number(r.deposit_amount),
      idCheck: r.id_check === true,
      notes: r.notes || '',
      active: r.active !== false,
      whatsapp: r.whatsapp || '',
      email: r.email || '',
      // nur im eigenen Angebot (my_listing) vorhanden:
      status: r.status || 'approved',
      proofUrl: r.proof_url || '',
      proofFile: r.proof_file || '',
      rejectReason: r.reject_reason || '',
      updatedAt: r.updated_at || null
    };
  }

  function safeFileName(name) {
    var n = String(name || 'proof').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '');
    if (n.length > 80) {
      var dot = n.lastIndexOf('.');
      var ext = dot > -1 ? n.slice(dot).slice(0, 8) : '';
      n = n.slice(0, 72) + ext;
    }
    return n || 'proof';
  }

  window.createSupabaseStore = function (cfg) {
    var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    var user = null;
    var listeners = [];
    var redirect = window.location.origin + window.location.pathname;

    function uploadProof(file) {
      var path = user.id + '/' + Date.now() + '-' + safeFileName(file.name);
      return sb.storage.from('proofs').upload(path, file, { contentType: file.type, upsert: false }).then(function (r) {
        if (r.error) { var e = new Error(t('offer.err.upload')); e.original = r.error; throw e; }
        return path;
      });
    }
    function removeProof(path) {
      if (!path) return Promise.resolve();
      return sb.storage.from('proofs').remove([path]).then(function () { /* Fehler egal: Aufräumen */ }, function () {});
    }

    return {
      mode: 'live',
      client: sb,

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
        return sb.auth.signUp({
          email: email, password: password,
          options: { emailRedirectTo: redirect, data: { terms_accepted_at: new Date().toISOString() } }
        }).then(function (r) {
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

      // Freigegebene, aktive Angebote. Die Datenbank filtert selbst (Zeilenregel); Spalten ausdrücklich nennen.
      listListings: function () {
        var cols = user ? MEMBER_COLUMNS : PUBLIC_COLUMNS;
        return sb.from('listings').select(cols).eq('active', true).limit(2000).then(function (r) {
          if (r.error) throw friendly(r.error);
          return (r.data || []).map(fromRow);
        });
      },

      getMyListing: function () {
        if (!user) return Promise.resolve(null);
        return sb.rpc('my_listing').then(function (r) {
          if (r.error) throw friendly(r.error);
          var row = Array.isArray(r.data) ? r.data[0] : r.data;
          return row ? fromRow(row) : null;
        });
      },

      /* data: Formularwerte (camelCase). file: optionale Rechnung (File) oder null. */
      saveListing: function (data, file) {
        if (!user) return Promise.reject(new Error(t('err.not_authenticated')));
        var old = data.proofFile || '';
        var step = file ? uploadProof(file) : Promise.resolve(old);
        var uploaded = !!file;
        var newPath;
        return step.then(function (path) {
          newPath = path;
          return sb.rpc('save_my_listing', { p: {
            kind: data.kind === 'pro' ? 'pro' : 'private',
            website: data.website || null,
            opening_hours: data.openingHours || '',
            display_name: data.name,
            place_label: data.placeLabel || '',
            lat: data.lat,
            lng: data.lng,
            approximate: !!data.approximate,
            batteries: data.batteries,
            currency: data.currency,
            deposit_amount: data.depositAmount == null ? null : data.depositAmount,
            id_check: !!data.idCheck,
            whatsapp: data.whatsapp || null,
            email: data.email || null,
            notes: data.notes || '',
            active: data.active !== false,
            proof_url: data.proofUrl,
            proof_file: path || null,
            lang: window.I18N ? window.I18N.lang() : 'en'
          } });
        }).then(function (r) {
          if (r.error) {
            if (uploaded) removeProof(newPath);
            throw friendly(r.error);
          }
          if (uploaded && old && old !== newPath) removeProof(old);
          return fromRow(r.data);
        });
      },

      deleteListing: function (current) {
        if (!user) return Promise.reject(new Error(t('err.not_authenticated')));
        var file = current && current.proofFile;
        return sb.rpc('delete_my_listing').then(function (r) {
          if (r.error) throw friendly(r.error);
          return removeProof(file);
        });
      },

      /* Nach dem Senden eines Antrags: Edge Function schickt dem Admin die Mail (einmal pro Antrag). */
      notifySubmitted: function () {
        return sb.functions.invoke('application', { body: { action: 'submitted' } }).then(function (r) {
          if (r.error) console.warn('notify failed', r.error);
        }, function (e) { console.warn('notify failed', e); });
      },

      admin: {
        isAdmin: function () {
          if (!user) return Promise.resolve(false);
          return sb.rpc('is_admin').then(function (r) { return !r.error && r.data === true; });
        },
        list: function (status) {
          return sb.rpc('admin_applications', { p_status: status }).then(function (r) {
            if (r.error) throw friendly(r.error);
            return r.data || [];
          });
        },
        proofLink: function (path) {
          return sb.storage.from('proofs').createSignedUrl(path, 300).then(function (r) {
            if (r.error) throw friendly(r.error);
            return r.data.signedUrl;
          });
        },
        decide: function (id, decision, reason) {
          return sb.functions.invoke('application', { body: { action: 'decide', id: id, decision: decision, reason: reason || null } })
            .then(function (r) {
              if (r.error) {
                // Bei Fehlern liefert die Function einen JSON-Body mit "error"
                var ctx = r.error.context;
                if (ctx && typeof ctx.json === 'function') {
                  return ctx.json().then(function (b) { throw new Error((b && b.error) || r.error.message); },
                    function () { throw new Error(r.error.message); });
                }
                throw new Error(r.error.message);
              }
              return r.data;
            });
        }
      }
    };
  };
})();
