/* Admin-Seite: Anträge von Verleihern, Schulen und Rentals prüfen, freigeben oder ablehnen. Nur Deutsch. */
(function () {
  'use strict';

  var CFG = window.BATTERY_RENTAL_CONFIG || {};
  var STATUS_LABEL = { pending: 'Offen', approved: 'Freigegeben', rejected: 'Abgelehnt' };

  function $(s) { return document.querySelector(s); }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  // Nutzer-Text nur über textContent / Textknoten, nie als HTML
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }

  var store, status = 'pending';

  function msg(el, text, isError) {
    el.hidden = !text;
    el.textContent = text || '';
    el.classList.toggle('is-error', !!isError);
  }

  function money(v, cur) {
    try { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur || 'EUR', maximumFractionDigits: 2 }).format(v); }
    catch (e) { return v + ' ' + cur; }
  }
  function date(s) {
    try { return new Date(s).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return s || ''; }
  }

  function row(label, content) {
    return [h('dt', { text: label }), h('dd', null, content)];
  }

  function batteryName(b) {
    return (window.BATTERY_CATALOG && window.BATTERY_CATALOG.fullName(b)) || b.label || b.model;
  }

  function batteryText(a) {
    return (a.batteries || []).map(function (b) {
      var p = [];
      if (typeof b.priceDay === 'number') p.push(money(b.priceDay, a.currency) + '/Tag');
      if (typeof b.priceWeek === 'number') p.push(money(b.priceWeek, a.currency) + '/Woche');
      return (batteryName(b)) + (p.length ? ' (' + p.join(', ') + ')' : '');
    }).join(', ');
  }

  function depositText(a) {
    var d = a.deposit_amount == null ? 'nach Absprache' : (Number(a.deposit_amount) === 0 ? 'keine' : money(Number(a.deposit_amount), a.currency));
    return d + (a.id_check ? ' · Ausweis wird vorgezeigt' : '');
  }

  function safeHttps(u) { return typeof u === 'string' && /^https:\/\//i.test(u); }

  function card(a) {
    var result = h('p', { class: 'msg', role: 'status', hidden: true });
    var reasonBox = h('div', { class: 'reason', hidden: true });
    var actions = h('div', { class: 'app-actions' });
    var busy = false;

    function decide(decision, reason) {
      if (busy) return;
      busy = true;
      actions.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
      msg(result, 'Einen Moment …');
      store.admin.decide(a.id, decision, reason).then(function (r) {
        var done = r.status === 'approved' ? 'freigegeben' : 'abgelehnt';
        var text = a.display_name + ' wurde ' + done + '. ' + (r.mailed ? 'Eine Mail ging an ' + a.applicant_email + '.' : 'Die Mail an ' + a.applicant_email + ' konnte nicht gesendet werden. Schreib bitte selbst kurz Bescheid.');
        showResult(text, !r.mailed);
        loadList();
      }).catch(function (e) {
        busy = false;
        actions.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
        msg(result, 'Das hat nicht geklappt: ' + e.message, true);
      });
    }

    var approve = h('button', { type: 'button', class: 'btn btn-primary', text: 'Freigeben', onclick: function () { decide('approve'); } });
    var rejectOpen = h('button', { type: 'button', class: 'btn btn-danger', text: a.status === 'approved' ? 'Sperren …' : 'Ablehnen …',
      onclick: function () { reasonBox.hidden = false; reasonInput.focus(); } });
    var reasonInput = h('textarea', { class: 'input', rows: '2', maxlength: '500', 'aria-label': 'Grund (wird dem Verleiher gemailt)', placeholder: 'Grund, z. B. „Profil zeigt keinen Foil Drive“ (optional, geht per Mail an den Verleiher)' });
    var rejectGo = h('button', { type: 'button', class: 'btn btn-danger is-armed', text: 'Jetzt ablehnen',
      onclick: function () { decide('reject', reasonInput.value.trim()); } });
    reasonBox.appendChild(reasonInput);
    reasonBox.appendChild(h('div', { class: 'app-actions' }, rejectGo,
      h('button', { type: 'button', class: 'btn btn-quiet', text: 'Abbrechen', onclick: function () { reasonBox.hidden = true; } })));

    if (a.status !== 'approved') actions.appendChild(approve);
    actions.appendChild(rejectOpen);

    var proofLink = safeHttps(a.proof_url)
      ? h('a', { href: a.proof_url, target: '_blank', rel: 'noopener noreferrer nofollow', text: a.proof_url })
      : h('span', { text: a.proof_url || '–' });

    var fileCell;
    if (a.proof_file) {
      fileCell = h('button', { type: 'button', class: 'btn btn-quiet btn-small', text: 'Rechnung ansehen', onclick: function (e) {
        var b = e.currentTarget;
        b.disabled = true;
        store.admin.proofLink(a.proof_file).then(function (url) { window.open(url, '_blank', 'noopener'); })
          .catch(function (err) { msg(result, err.message, true); })
          .then(function () { b.disabled = false; });
      } });
    } else fileCell = h('span', { class: 'muted', text: a.status === 'pending' ? 'keine hochgeladen' : 'keine (nach Prüfung gelöscht)' });

    var osm = 'https://www.openstreetmap.org/?mlat=' + encodeURIComponent(a.lat) + '&mlon=' + encodeURIComponent(a.lng) + '#map=11/' + encodeURIComponent(a.lat) + '/' + encodeURIComponent(a.lng);

    return h('article', { class: 'app-card' },
      h('header', null,
        h('h2', { text: a.display_name }),
        h('span', { class: 'badge badge-' + a.status, text: STATUS_LABEL[a.status] || a.status })),
      h('p', { class: 'muted', text: 'Eingereicht ' + date(a.created_at) + (a.reviewed_at ? ' · geprüft ' + date(a.reviewed_at) : '') + (a.active ? '' : ' · pausiert') }),
      h('dl', { class: 'app-dl' },
        row('Art', a.kind === 'pro' ? 'Schule / Verleih' : 'Privat'),
        row('Konto', a.applicant_email),
        row('Ort', [a.place_label || '–', ' ', h('a', { href: osm, target: '_blank', rel: 'noopener noreferrer', text: '(Karte)' })]),
        row('Batterien', batteryText(a)),
        row('Kaution', depositText(a)),
        row('WhatsApp', a.whatsapp || '–'),
        row('E-Mail', a.email || '–'),
        a.kind === 'pro' ? row('Website', safeHttps(a.website) ? h('a', { href: a.website, target: '_blank', rel: 'noopener noreferrer nofollow', text: a.website }) : (a.website || '–')) : null,
        a.kind === 'pro' ? row('Öffnungszeiten', a.opening_hours || '–') : null,
        row('Profil', proofLink),
        row('Rechnung', fileCell),
        a.notes ? row('Hinweise', a.notes) : null,
        a.reject_reason ? row('Grund', a.reject_reason) : null),
      actions, reasonBox, result);
  }

  function showResult(text, isError) { msg($('#result-msg'), text, isError); }

  function loadList() {
    var box = $('#apps');
    store.admin.list(status).then(function (rows) {
      box.innerHTML = '';
      if (status === 'pending') $('#n-pending').textContent = rows.length ? '(' + rows.length + ')' : '';
      if (!rows.length) {
        box.appendChild(h('p', { class: 'muted', text: status === 'pending' ? 'Keine offenen Anträge. 🎉' : 'Hier ist nichts.' }));
        return;
      }
      rows.forEach(function (a) { box.appendChild(card(a)); });
    }).catch(function (e) { msg($('#state-msg'), 'Laden fehlgeschlagen: ' + e.message, true); });
  }

  function enter() {
    store.admin.isAdmin().then(function (ok) {
      var user = store.getUser();
      $('#login-form').hidden = !!user;
      $('#btn-logout').hidden = !user;
      $('#who').hidden = !user;
      $('#who').textContent = user ? user.email : '';
      $('#panel').hidden = true;
      if (!user) { msg($('#state-msg'), 'Bitte melde dich an.'); return; }
      if (!ok) { msg($('#state-msg'), 'Dieses Konto ist kein Admin. Wie du dich als Admin einträgst, steht in der README.', true); return; }
      msg($('#state-msg'), '');
      $('#panel').hidden = false;
      loadList();
    });
  }

  function boot() {
    if (!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase && window.createSupabaseStore)) {
      msg($('#state-msg'), 'Die Admin-Seite funktioniert nur im Echtbetrieb. Trage zuerst Supabase in assets/js/config.js ein (siehe README).', true);
      return;
    }
    store = window.createSupabaseStore(CFG);
    store.init().then(function () {
      var lastId = store.getUser() && store.getUser().id;
      store.onAuth(function (event, user) {
        var id = user && user.id;
        if (id === lastId && event !== 'SIGNED_OUT') return;   // Token-Erneuerung usw. ignorieren
        lastId = id;
        enter();
      });
      enter();
    });

    document.querySelectorAll('input[name="status"]').forEach(function (r) {
      r.addEventListener('change', function () { if (r.checked) { status = r.value; showResult(''); loadList(); } });
    });

    $('#btn-logout').addEventListener('click', function () { store.signOut(); });

    $('#login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('#a-submit');
      var err = $('#a-err');
      err.hidden = true;
      btn.disabled = true;
      store.signIn($('#a-email').value.trim(), $('#a-pw').value).catch(function (ex) {
        err.textContent = ex.message; err.hidden = false;
      }).then(function () { btn.disabled = false; });
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
