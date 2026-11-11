/* Foil Drive Battery Rental – App-Logik */
(function () {
  'use strict';

  var CFG = window.BATTERY_RENTAL_CONFIG || {};

  /* Ändern oder erweitern: auch die Liste in supabase/schema.sql (Funktion batteries_valid) anpassen. */
  var MODELS = [
    { id: 'max-hp', name: 'Max HP' },
    { id: 'max-power', name: 'Max Power' },
    { id: 'max-sport', name: 'Max Sport' },
    { id: 'max-sport-396', name: 'Max Sport 396' },
    { id: 'fm650', name: 'FM650' },
    { id: 'fm450', name: 'FM450' },
    { id: 'f860', name: 'F860' }
  ];
  var MODEL_NAME = {};
  MODELS.forEach(function (m) { MODEL_NAME[m.id] = m.name; });
  var CURRENCIES = ['EUR', 'CHF', 'GBP', 'USD', 'NOK', 'SEK', 'DKK', 'PLN'];

  var NOMINATIM = 'https://nominatim.openstreetmap.org';
  var HALO_METERS = 800;

  var ICON = {
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.4 2 4.5 13.6H11L10 22l9.5-12H13z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 21.5s-7-6.1-7-11.7a7 7 0 0 1 14 0c0 5.6-7 11.7-7 11.7z"/><circle cx="12" cy="9.8" r="2.4" fill="currentColor"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>',
    locate: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="6.5"/><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22"/></g><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 20l1.5-4.3A8.3 8.3 0 1 1 8.4 18.6z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/></g></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>',
    map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20zM9 4v13.5M15 6.5V20"/></svg>'
  };

  /* ---------- Helfer ---------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function append(el, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(el, c); }); return; }
    el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  /* Baut DOM-Elemente. Nutzer-Text immer über text/Kinder (textContent), nie über html. */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  function money(value, cur) {
    cur = CURRENCIES.indexOf(cur) > -1 ? cur : 'EUR';
    try {
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
    } catch (e) { return value + ' ' + cur; }
  }
  function currencySymbol(cur) {
    try {
      var parts = new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur }).formatToParts(0);
      for (var i = 0; i < parts.length; i++) if (parts[i].type === 'currency') return parts[i].value;
    } catch (e) { /* ignorieren */ }
    return cur;
  }
  function distKm(lat1, lng1, lat2, lng2) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }
  function isMobile() { return window.matchMedia('(max-width: 860px)').matches; }

  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 4200);
  }

  /* ---------- Zustand ---------- */

  var store;
  var state = {
    mode: 'demo',
    user: null,
    listings: [],
    loaded: false,
    filters: {},
    selectedId: null,
    mine: null,
    anchor: null,
    pendingAfterAuth: null,
    view: 'map',
    firstFit: true
  };

  var map, cluster, halo, markers = {};

  function byId(id) {
    for (var i = 0; i < state.listings.length; i++) if (state.listings[i].id === id) return state.listings[i];
    return null;
  }
  function activeFilterIds() { return MODELS.filter(function (m) { return state.filters[m.id]; }).map(function (m) { return m.id; }); }
  function matchesFilter(l) {
    var f = activeFilterIds();
    if (!f.length) return true;
    return l.batteries.some(function (b) { return f.indexOf(b.model) > -1; });
  }
  function visibleListings() { return state.listings.filter(matchesFilter); }

  /* Günstigster Tagespreis unter den (ggf. gefilterten) Batterien */
  function lowestDay(l) {
    var f = activeFilterIds();
    var prices = l.batteries
      .filter(function (b) { return !f.length || f.indexOf(b.model) > -1; })
      .map(function (b) { return b.priceDay; })
      .filter(isNum);
    return prices.length ? Math.min.apply(null, prices) : null;
  }
  function lowestWeek(l) {
    var f = activeFilterIds();
    var prices = l.batteries
      .filter(function (b) { return !f.length || f.indexOf(b.model) > -1; })
      .map(function (b) { return b.priceWeek; })
      .filter(isNum);
    return prices.length ? Math.min.apply(null, prices) : null;
  }

  /* ---------- Karte ---------- */

  function pinIcon(l, selected) {
    var p = lowestDay(l);
    var label = p == null ? 'Anfrage' : 'ab ' + money(p, l.currency);
    return L.divIcon({
      className: 'pin-icon',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      html: '<div class="pin' + (selected ? ' is-selected' : '') + '"><span class="pin-bolt">' + ICON.bolt + '</span><span>' + esc(label) + '</span></div>'
    });
  }

  function initMap() {
    map = L.map('map', { worldCopyJump: true, minZoom: 2, maxZoom: 18 })
      .setView(CFG.defaultCenter || [43.5, 8], CFG.defaultZoom || 4);
    L.tileLayer(CFG.tileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: CFG.tileAttribution || '&copy; OpenStreetMap'
    }).addTo(map);

    cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 46,
      iconCreateFunction: function (c) {
        return L.divIcon({ html: '<div class="cluster">' + c.getChildCount() + '</div>', className: 'cluster-icon', iconSize: [42, 42] });
      }
    });
    map.addLayer(cluster);

    halo = L.circle([0, 0], { radius: HALO_METERS, className: 'halo', interactive: false });

    map.on('moveend', debounce(renderList, 120));
    map.on('click', function () { if (state.selectedId) closeDetail(); });

    $('#locate').innerHTML = ICON.locate;
    $('#locate').addEventListener('click', locateMe);
  }

  function rebuildMarkers() {
    cluster.clearLayers();
    markers = {};
    var layers = visibleListings().map(function (l) {
      var m = L.marker([l.lat, l.lng], {
        icon: pinIcon(l, l.id === state.selectedId),
        title: l.name + (l.placeLabel ? ', ' + l.placeLabel : ''),
        riseOnHover: true
      });
      m.on('click', function (e) { if (e.originalEvent) L.DomEvent.stopPropagation(e); selectListing(l.id); });
      markers[l.id] = m;
      return m;
    });
    cluster.addLayers(layers);
  }

  function showHalo(l) {
    if (l && l.approximate) { halo.setLatLng([l.lat, l.lng]); if (!map.hasLayer(halo)) halo.addTo(map); }
    else if (map.hasLayer(halo)) map.removeLayer(halo);
  }

  function fitAll() {
    var vis = visibleListings();
    if (!vis.length) return;
    var b = L.latLngBounds(vis.map(function (l) { return [l.lat, l.lng]; }));
    map.fitBounds(b.pad(0.25), { maxZoom: vis.length === 1 ? 8 : 6 });
  }

  function locateMe() {
    if (!navigator.geolocation) { toast('Dein Browser kann den Standort nicht bestimmen.'); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      state.anchor = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      map.flyTo([pos.coords.latitude, pos.coords.longitude], 9);
    }, function () {
      toast('Standort nicht verfügbar. Erlaube den Zugriff im Browser oder such einen Ort.');
    }, { timeout: 10000, maximumAge: 300000 });
  }

  /* ---------- Liste ---------- */

  function renderChips() {
    var box = $('#chips');
    MODELS.forEach(function (m) {
      var input = h('input', { type: 'checkbox', value: m.id, onchange: function () {
        state.filters[m.id] = input.checked;
        onFiltersChanged();
      } });
      box.appendChild(h('label', { class: 'chip' }, input, h('span', { text: m.name })));
    });
    $('#reset-filters').addEventListener('click', function () {
      state.filters = {};
      $$('#chips input').forEach(function (i) { i.checked = false; });
      onFiltersChanged();
    });
  }

  function onFiltersChanged() {
    $('#reset-filters').hidden = !activeFilterIds().length;
    if (state.selectedId && !matchesFilter(byId(state.selectedId) || { batteries: [] })) closeDetail();
    rebuildMarkers();
    renderList();
  }

  function setStatus(html) {
    var el = $('#list-status');
    el.innerHTML = '';
    if (!html) { el.hidden = true; return; }
    el.hidden = false;
    append(el, html);
  }

  function renderList() {
    var list = $('#list');
    var count = $('#count');
    if (!state.loaded) return;

    var all = visibleListings();
    var listOnly = isMobile() && state.view === 'list';
    var shown = all;
    if (!listOnly) {
      var b = map.getBounds();
      shown = all.filter(function (l) { return b.contains([l.lat, l.lng]); });
    }
    var c = state.anchor || map.getCenter();
    shown = shown.map(function (l) { return { l: l, d: distKm(c.lat, c.lng, l.lat, l.lng) }; })
      .sort(function (a, b2) { return a.d - b2.d; });

    list.innerHTML = '';
    setStatus(null);

    if (!state.listings.length) {
      count.textContent = 'Noch keine Standorte';
      setStatus([
        h('p', { text: 'Hier ist noch niemand eingetragen. Sei der Erste und biete deine Batterie an.' }),
        h('button', { type: 'button', class: 'btn btn-accent', text: 'Batterie anbieten', onclick: openOffer })
      ]);
      return;
    }
    if (!all.length) {
      count.textContent = 'Keine Treffer';
      setStatus(h('p', { text: 'Für diese Batterien ist noch kein Standort eingetragen. Nimm einen Filter heraus oder schau später noch einmal vorbei.' }));
      return;
    }

    var noun = all.length === 1 ? 'Standort' : 'Standorte';
    count.textContent = listOnly
      ? all.length + ' ' + noun
      : shown.length + ' von ' + all.length + ' ' + (all.length === 1 ? 'Standort' : 'Standorten') + ' im Kartenausschnitt';

    if (!shown.length) {
      setStatus(h('p', { text: 'In diesem Kartenausschnitt gibt es keinen Standort. Zoom heraus oder such ein anderes Reiseziel.' }));
      return;
    }

    var f = activeFilterIds();
    shown.slice(0, 150).forEach(function (item) {
      var l = item.l;
      var day = lowestDay(l), week = lowestWeek(l);
      var priceBox = h('span', { class: 'row-price' });
      if (day != null) { priceBox.appendChild(h('strong', { text: 'ab ' + money(day, l.currency) })); priceBox.appendChild(h('small', { text: 'pro Tag' })); }
      else if (week != null) { priceBox.appendChild(h('strong', { text: 'ab ' + money(week, l.currency) })); priceBox.appendChild(h('small', { text: 'pro Woche' })); }
      else { priceBox.appendChild(h('strong', { text: 'Anfrage' })); }

      var place = l.placeLabel || '';
      if (state.anchor) place += (place ? ' · ' : '') + (item.d < 10 ? Math.round(item.d * 10) / 10 : Math.round(item.d)).toString().replace('.', ',') + ' km';

      var tags = h('span', { class: 'tags' }, l.batteries.map(function (bt) {
        return h('span', { class: 'tag' + (f.indexOf(bt.model) > -1 ? ' is-match' : ''), text: MODEL_NAME[bt.model] || bt.model });
      }));

      var btn = h('button', {
        type: 'button', class: 'row', 'data-id': l.id,
        'aria-current': l.id === state.selectedId ? 'true' : null,
        onclick: function () { if (isMobile()) setView('map'); selectListing(l.id); }
      },
        h('span', { class: 'row-main' },
          h('span', { class: 'row-name', text: l.name }),
          h('span', { class: 'row-place', text: place }),
          tags),
        priceBox);
      list.appendChild(h('li', null, btn));
    });
  }

  function markActiveRow() {
    $$('#list .row').forEach(function (r) {
      if (r.getAttribute('data-id') === state.selectedId) r.setAttribute('aria-current', 'true');
      else r.removeAttribute('aria-current');
    });
  }

  /* ---------- Suche (Nominatim) ---------- */

  function geocode(q) {
    return fetch(NOMINATIM + '/search?format=jsonv2&limit=1&accept-language=de&q=' + encodeURIComponent(q))
      .then(function (r) { if (!r.ok) throw new Error('geocode'); return r.json(); });
  }
  function reverseGeocode(lat, lng) {
    return fetch(NOMINATIM + '/reverse?format=jsonv2&zoom=10&accept-language=de&lat=' + lat + '&lon=' + lng)
      .then(function (r) { if (!r.ok) throw new Error('reverse'); return r.json(); });
  }

  function onSearch(e) {
    e.preventDefault();
    var q = $('#q').value.trim();
    var msg = $('#search-msg');
    msg.hidden = true;
    if (!q) { msg.textContent = 'Gib ein Reiseziel ein, z. B. Tarifa oder Gardasee.'; msg.hidden = false; return; }
    var btn = $('#search-btn');
    btn.disabled = true;
    geocode(q).then(function (res) {
      if (!res.length) { msg.textContent = 'Ort nicht gefunden. Versuch es mit Stadt und Land.'; msg.hidden = false; return; }
      var r = res[0];
      var lat = parseFloat(r.lat), lng = parseFloat(r.lon);
      state.anchor = { lat: lat, lng: lng };
      if (isMobile()) setView('map');
      if (r.boundingbox) {
        var bb = r.boundingbox.map(parseFloat); // S, N, W, E
        map.flyToBounds([[bb[0], bb[2]], [bb[1], bb[3]]], { maxZoom: 11 });
      } else {
        map.flyTo([lat, lng], 10);
      }
      renderList();
    }).catch(function () {
      msg.textContent = 'Die Ortssuche ist gerade nicht erreichbar. Versuch es gleich noch einmal oder zieh die Karte selbst.';
      msg.hidden = false;
    }).then(function () { btn.disabled = false; });
  }

  /* ---------- Detailansicht ---------- */

  function selectListing(id) {
    var l = byId(id);
    if (!l) return;
    var prev = state.selectedId;
    state.selectedId = id;
    if (prev && prev !== id && markers[prev]) markers[prev].setIcon(pinIcon(byId(prev), false));
    var m = markers[id];
    showHalo(l);
    openDetail(l, true);
    if (m) {
      m.setIcon(pinIcon(l, true));
      cluster.zoomToShowLayer(m, function () { revealAboveSheet(l); });
    } else {
      map.flyTo([l.lat, l.lng], Math.max(map.getZoom(), 9));
    }
    markActiveRow();
  }

  /* Mobil verdeckt das Detail-Blatt die untere Kartenhälfte: Pin in den sichtbaren Teil schieben. */
  function revealAboveSheet(l) {
    if (!isMobile() || state.selectedId !== l.id) return;
    var sheet = $('#detail');
    if (sheet.hidden) return;
    var visibleH = map.getSize().y - sheet.offsetHeight;
    if (visibleH < 80) return;
    var pt = map.latLngToContainerPoint([l.lat, l.lng]);
    var dy = pt.y - visibleH * 0.55;
    if (Math.abs(dy) > 8) map.panBy([0, dy], { animate: true });
  }

  function closeDetail() {
    var id = state.selectedId;
    state.selectedId = null;
    if (id && markers[id] && byId(id)) markers[id].setIcon(pinIcon(byId(id), false));
    if (map.hasLayer(halo)) map.removeLayer(halo);
    $('#detail').hidden = true;
    markActiveRow();
  }

  function whatsappDigits(num) { return String(num).replace(/\D/g, ''); }

  function openDetail(l, focus) {
    var el = $('#detail');
    el.innerHTML = '';

    var isMine = state.mine && state.mine.id === l.id;
    var bodyRows = l.batteries.map(function (b) {
      return h('tr', null,
        h('td', { text: MODEL_NAME[b.model] || b.model }),
        h('td', isNum(b.priceDay) ? { text: money(b.priceDay, l.currency) } : { class: 'none', text: '–' }),
        h('td', isNum(b.priceWeek) ? { text: money(b.priceWeek, l.currency) } : { class: 'none', text: '–' }));
    });
    var anyMissing = l.batteries.some(function (b) { return !isNum(b.priceDay) || !isNum(b.priceWeek); });

    var contact = h('div', { class: 'contact' });
    var names = l.batteries.map(function (b) { return MODEL_NAME[b.model] || b.model; }).join(', ');
    var text = 'Hallo ' + l.name + ', ich habe dein Angebot auf der Foil Drive Battery Rental Karte gesehen (' + names + '). ' +
      'Ist deine Batterie bei meinem Aufenthalt frei? Ich bin vom [Datum] bis [Datum] vor Ort.';
    if (isMine) {
      contact.appendChild(h('p', { text: 'Das ist dein Angebot.' }));
      contact.appendChild(h('button', { type: 'button', class: 'btn btn-primary', text: 'Angebot bearbeiten', onclick: openOffer }));
    } else if (l.demo) {
      contact.appendChild(h('p', { class: 'muted', text: 'Das ist ein Beispiel-Eintrag ohne Kontaktdaten.' }));
    } else if (!state.user) {
      contact.appendChild(h('p', { text: 'Die Kontaktdaten sehen nur angemeldete Mitglieder. Das hält Spam fern und schützt die Verleiher.' }));
      contact.appendChild(h('button', { type: 'button', class: 'btn btn-primary', text: 'Anmelden oder registrieren',
        onclick: function () { openAuth('login', 'Melde dich an, um die Kontaktdaten zu sehen.'); } }));
    } else {
      if (l.whatsapp) {
        contact.appendChild(h('a', { class: 'btn btn-primary', target: '_blank', rel: 'noopener',
          href: 'https://wa.me/' + whatsappDigits(l.whatsapp) + '?text=' + encodeURIComponent(text), html: ICON.chat + '<span>Per WhatsApp schreiben</span>' }));
      }
      if (l.email) {
        contact.appendChild(h('a', { class: 'btn btn-quiet',
          href: 'mailto:' + l.email + '?subject=' + encodeURIComponent('Anfrage: Foil Drive Batterie leihen') + '&body=' + encodeURIComponent(text),
          html: ICON.mail + '<span>Per E-Mail schreiben</span>' }));
      }
      if (!l.whatsapp && !l.email) contact.appendChild(h('p', { class: 'muted', text: 'Hier sind keine Kontaktdaten hinterlegt.' }));
    }

    el.appendChild(h('div', { class: 'detail-head' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Schließen', html: ICON.close, onclick: closeDetail })));

    var body = h('div', { class: 'detail-body' },
      h('h2', { id: 'detail-title', tabindex: '-1', text: l.name }),
      h('p', { class: 'detail-place', html: ICON.pin }, l.placeLabel || 'Ort nicht angegeben'),
      l.approximate ? h('p', { class: 'note-approx', text: 'Der Pin zeigt nur die ungefähre Gegend. Den genauen Treffpunkt klärt ihr im Chat.' }) : null,
      h('table', { class: 'bat-table' },
        h('caption', { class: 'sr-only', text: 'Batterien und Preise' }),
        h('thead', null, h('tr', null,
          h('th', { scope: 'col', text: 'Batterie' }),
          h('th', { scope: 'col', text: 'pro Tag' }),
          h('th', { scope: 'col', text: 'pro Woche' }))),
        h('tbody', null, bodyRows)),
      anyMissing ? h('p', { class: 'table-hint', text: '– heißt: Preis auf Anfrage.' }) : null,
      l.notes ? h('h3', { text: 'Hinweise vom Verleiher' }) : null,
      l.notes ? h('p', { class: 'notes', text: l.notes }) : null,
      contact,
      h('p', { class: 'deal-note', text: 'Preis, Übergabe und Bezahlung klärt ihr direkt. Diese Seite vermittelt nur den Kontakt.' }));
    el.appendChild(body);

    el.hidden = false;
    if (focus) $('#detail-title').focus({ preventScroll: true });
  }

  /* ---------- Ansicht (mobil: Karte / Liste) ---------- */

  function setView(v) {
    state.view = v;
    $('.shell').setAttribute('data-view', v);
    var btn = $('#view-toggle');
    btn.innerHTML = '';
    btn.insertAdjacentHTML('beforeend', v === 'map' ? ICON.list : ICON.map);
    btn.appendChild(h('span', { text: v === 'map' ? 'Liste anzeigen' : 'Karte anzeigen' }));
    if (v === 'map') map.invalidateSize();
    renderList();
  }

  /* ---------- Laden ---------- */

  function reload() {
    return store.listListings().then(function (ls) {
      state.listings = ls;
      state.loaded = true;
      rebuildMarkers();
      if (state.firstFit) { state.firstFit = false; fitAll(); }
      if (state.selectedId) {
        var cur = byId(state.selectedId);
        if (cur) { showHalo(cur); openDetail(cur, false); } else closeDetail();
      }
      renderList();
    }).catch(function (err) {
      console.error(err);
      state.loaded = false;
      $('#count').textContent = 'Standorte nicht geladen';
      $('#list').innerHTML = '';
      setStatus([
        h('p', { text: 'Die Standorte konnten nicht geladen werden. Prüfe deine Verbindung und versuch es noch einmal.' }),
        h('button', { type: 'button', class: 'btn btn-primary', text: 'Erneut laden', onclick: function () { $('#count').textContent = 'Lade Standorte …'; setStatus(null); reload(); } })
      ]);
    });
  }

  /* ---------- Konto ---------- */

  function updateAuthUI() {
    var u = state.user;
    $('#btn-account').textContent = u ? 'Abmelden' : 'Anmelden';
    var offerBtn = $('#btn-offer');
    offerBtn.querySelector('.long').textContent = u && state.mine ? 'Mein Angebot' : 'Batterie anbieten';
    offerBtn.querySelector('.short').textContent = u && state.mine ? 'Angebot' : 'Anbieten';
    var who = $('#who');
    who.hidden = !u;
    who.textContent = u ? u.email : '';
  }

  function onAuthChange(event, user) {
    var changed = (state.user && state.user.id) !== (user && user.id);
    state.user = user;
    if (event === 'PASSWORD_RECOVERY') { openAuth('recover'); return; }
    if (!changed) { updateAuthUI(); return; }
    var p = user ? store.getMyListing().catch(function () { return null; }) : Promise.resolve(null);
    p.then(function (mine) {
      state.mine = mine;
      updateAuthUI();
      return reload();
    }).then(function () {
      if (user && state.pendingAfterAuth === 'offer') { state.pendingAfterAuth = null; openOffer(); }
    });
  }

  var authMode = 'login';

  function setAuthMode(mode) {
    authMode = mode;
    var title = { login: 'Anmelden', signup: 'Konto anlegen', recover: 'Neues Passwort', forgot: 'Passwort zurücksetzen' }[mode];
    $('#auth-title').textContent = title;
    $('#auth-seg').hidden = (mode === 'recover' || mode === 'forgot');
    $('#fld-email').hidden = (mode === 'recover');
    $('#fld-pw').hidden = (mode === 'forgot');
    $('#auth-forgot').hidden = (mode !== 'login');
    $('#hint-auth-pw').hidden = (mode === 'login');
    $('#auth-pw-label').textContent = mode === 'recover' ? 'Neues Passwort' : 'Passwort';
    $('#auth-pw').setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
    $('#auth-submit').textContent = { login: 'Anmelden', signup: 'Konto anlegen', recover: 'Passwort speichern', forgot: 'Link zum Zurücksetzen senden' }[mode];
    if (mode === 'login' || mode === 'signup') $$('input[name="auth-mode"]').forEach(function (r) { r.checked = (r.value === mode); });
    setAuthMsg('');
    setErr('auth-email', ''); setErr('auth-pw', '');
  }

  function setAuthMsg(text, isError) {
    var m = $('#auth-msg');
    m.hidden = !text;
    m.textContent = text || '';
    m.classList.toggle('is-error', !!isError);
  }

  var authDone = false;
  function closeAuthOk() { authDone = true; $('#dlg-auth').close(); }

  function openAuth(mode, intro) {
    var dlg = $('#dlg-auth');
    setAuthMode(mode || 'login');
    var p = $('#auth-intro');
    p.hidden = !intro;
    p.textContent = intro || '';
    $('#auth-pw').value = '';
    if (!dlg.open) dlg.showModal();
    setTimeout(function () { (mode === 'recover' ? $('#auth-pw') : $('#auth-email')).focus(); }, 0);
  }

  function setErr(key, msg) {
    var e = $('#err-' + key);
    if (!e) return;
    e.textContent = msg || '';
    e.hidden = !msg;
    var map2 = { 'auth-email': 'auth-email', 'auth-pw': 'auth-pw', name: 'f-name', place: 'f-place', wa: 'f-wa', mail: 'f-mail', notes: 'f-notes' };
    var input = map2[key] && document.getElementById(map2[key]);
    if (input) { if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
  }

  function validEmail(s) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) && s.length <= 254; }

  function onAuthSubmit(e) {
    e.preventDefault();
    var email = $('#auth-email').value.trim();
    var pw = $('#auth-pw').value;
    setErr('auth-email', ''); setErr('auth-pw', ''); setAuthMsg('');

    if (authMode !== 'recover' && !validEmail(email)) { setErr('auth-email', 'Gib eine gültige E-Mail-Adresse ein.'); $('#auth-email').focus(); return; }
    if (authMode !== 'forgot' && (authMode === 'login' ? !pw : pw.length < 8)) {
      setErr('auth-pw', authMode === 'login' ? 'Gib dein Passwort ein.' : 'Das Passwort braucht mindestens 8 Zeichen.');
      $('#auth-pw').focus(); return;
    }

    var btn = $('#auth-submit');
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Einen Moment …';

    var job;
    if (authMode === 'login') job = store.signIn(email, pw).then(function () { closeAuthOk(); toast('Angemeldet.'); });
    else if (authMode === 'signup') job = store.signUp(email, pw).then(function (r) {
      if (r.needsConfirm) setAuthMsg('Fast geschafft: Wir haben dir eine E-Mail geschickt. Klick auf den Link darin, dann bist du dabei. Schau auch im Spam-Ordner nach.');
      else { closeAuthOk(); toast('Konto angelegt. Willkommen!'); }
    });
    else if (authMode === 'forgot') job = store.resetPassword(email).then(function () {
      setAuthMsg('Wenn es zu dieser Adresse ein Konto gibt, kommt gleich eine E-Mail mit einem Link zum Zurücksetzen.');
    });
    else job = store.updatePassword(pw).then(function () { closeAuthOk(); toast('Passwort geändert.'); });

    job.catch(function (err) { setAuthMsg(err.message, true); })
      .then(function () { btn.disabled = false; btn.textContent = label; });
  }

  /* ---------- Angebot anlegen / bearbeiten ---------- */

  var pick = { map: null, marker: null, lat: null, lng: null, dirty: false, labelTouched: false, wasApprox: true };

  function buildOfferForm() {
    var rows = $('#bat-rows');
    MODELS.forEach(function (m) {
      var cb = h('input', { type: 'checkbox', name: 'model', value: m.id, onchange: function () { syncBatRow(m.id); } });
      var day = h('input', { class: 'input', type: 'text', inputmode: 'decimal', id: 'pd-' + m.id, 'aria-label': m.name + ': Preis pro Tag', placeholder: 'Tag', disabled: true, autocomplete: 'off' });
      var week = h('input', { class: 'input', type: 'text', inputmode: 'decimal', id: 'pw-' + m.id, 'aria-label': m.name + ': Preis pro Woche', placeholder: 'Woche', disabled: true, autocomplete: 'off' });
      rows.appendChild(h('div', { class: 'bat is-off', id: 'bat-' + m.id },
        h('label', { class: 'bat-check' }, cb, m.name),
        h('div', { class: 'money' }, day, h('span', { 'data-unit': 'day' })),
        h('div', { class: 'money' }, week, h('span', { 'data-unit': 'week' }))));
    });
    var sel = $('#f-currency');
    CURRENCIES.forEach(function (c) { sel.appendChild(h('option', { value: c, text: c + ' (' + currencySymbol(c) + ')' })); });
    sel.addEventListener('change', updateUnits);
    updateUnits();
  }

  function updateUnits() {
    var sym = currencySymbol($('#f-currency').value);
    $$('#bat-rows [data-unit]').forEach(function (s) { s.textContent = sym + ' / ' + (s.getAttribute('data-unit') === 'day' ? 'Tag' : 'Woche'); });
  }

  function syncBatRow(id) {
    var on = $('#bat-' + id + ' input[type=checkbox]').checked;
    $('#bat-' + id).classList.toggle('is-off', !on);
    $('#pd-' + id).disabled = !on;
    $('#pw-' + id).disabled = !on;
  }

  function fmtNum(n) { return isNum(n) ? String(n).replace('.', ',') : ''; }

  function fillOfferForm(l) {
    $('#offer-title').textContent = l ? 'Dein Angebot' : 'Batterie anbieten';
    $('#f-name').value = l ? l.name : '';
    $('#f-currency').value = l ? l.currency : 'EUR';
    updateUnits();
    MODELS.forEach(function (m) {
      var b = l && l.batteries.filter(function (x) { return x.model === m.id; })[0];
      $('#bat-' + m.id + ' input[type=checkbox]').checked = !!b;
      $('#pd-' + m.id).value = b ? fmtNum(b.priceDay) : '';
      $('#pw-' + m.id).value = b ? fmtNum(b.priceWeek) : '';
      syncBatRow(m.id);
    });
    $('#f-place').value = l ? l.placeLabel : '';
    $('#f-approx').checked = l ? l.approximate : true;
    $('#f-wa').value = l ? l.whatsapp : '';
    $('#f-mail').value = l ? l.email : (state.user ? state.user.email : '');
    $('#f-notes').value = l ? l.notes : '';
    $('#f-active').checked = l ? l.active : true;
    $('#f-search').value = '';
    $('#offer-delete').hidden = !l;
    resetDeleteButton();
    pick.lat = l ? l.lat : null;
    pick.lng = l ? l.lng : null;
    pick.dirty = false;
    pick.labelTouched = !!(l && l.placeLabel);
    pick.wasApprox = l ? l.approximate : true;
    ['name', 'place', 'wa', 'mail', 'notes', 'batteries', 'location', 'contact'].forEach(function (k) { setErr(k, ''); });
    var oe = $('#offer-error'); oe.hidden = true; oe.textContent = '';
    var pm = $('#pick-msg'); pm.hidden = true;
  }

  function pickIcon() {
    return L.divIcon({
      className: 'pin-icon', iconSize: [0, 0], iconAnchor: [0, 0],
      html: '<div class="pin is-selected"><span class="pin-bolt">' + ICON.bolt + '</span><span>Dein Pin</span></div>'
    });
  }

  function ensurePickMap() {
    if (pick.map) return;
    pick.map = L.map('pick-map', { worldCopyJump: true, minZoom: 2, maxZoom: 18 }).setView(CFG.defaultCenter || [43.5, 8], CFG.defaultZoom || 4);
    L.tileLayer(CFG.tileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: CFG.tileAttribution || '&copy; OpenStreetMap' }).addTo(pick.map);
    pick.map.on('click', function (e) { setPick(e.latlng.lat, e.latlng.lng, true); });
  }

  var reverseLater = debounce(function () {
    if (pick.labelTouched || pick.lat == null) return;
    reverseGeocode(pick.lat, pick.lng).then(function (d) {
      var a = (d && d.address) || {};
      var place = a.city || a.town || a.village || a.municipality || a.county || a.state || '';
      var label = [place, a.country].filter(Boolean).join(', ');
      if (label && !pick.labelTouched) $('#f-place').value = label;
    }).catch(function () { /* Ortsname bleibt leer, Nutzer kann ihn selbst eintragen */ });
  }, 500);

  function setPick(lat, lng, dirty) {
    pick.lat = lat; pick.lng = lng;
    if (dirty) pick.dirty = true;
    if (!pick.marker) {
      pick.marker = L.marker([lat, lng], { draggable: true, icon: pickIcon(), title: 'Dein Pin, ziehbar' }).addTo(pick.map);
      pick.marker.on('dragend', function () { var p = pick.marker.getLatLng(); setPick(p.lat, p.lng, true); });
    } else {
      pick.marker.setLatLng([lat, lng]);
    }
    setErr('location', '');
    if (dirty) reverseLater();
  }

  function openOffer() {
    if (!state.user) {
      state.pendingAfterAuth = 'offer';
      openAuth('signup', 'Lege ein kostenloses Konto an, um deine Batterien anzubieten. Hast du schon eins, wechsle auf „Anmelden“.');
      return;
    }
    var dlg = $('#dlg-offer');
    fillOfferForm(state.mine);
    if (!dlg.open) dlg.showModal();
    ensurePickMap();
    requestAnimationFrame(function () {
      pick.map.invalidateSize();
      if (pick.lat != null) { setPick(pick.lat, pick.lng, false); pick.map.setView([pick.lat, pick.lng], 11); }
      else if (pick.marker) { pick.map.removeLayer(pick.marker); pick.marker = null; pick.map.setView(CFG.defaultCenter || [43.5, 8], CFG.defaultZoom || 4); }
    });
    $('#f-name').focus({ preventScroll: true });
  }

  function pickSearch() {
    var q = $('#f-search').value.trim();
    var pm = $('#pick-msg');
    pm.hidden = true;
    if (!q) { pm.textContent = 'Gib einen Ort oder eine Adresse ein.'; pm.hidden = false; return; }
    var btn = $('#btn-pick-search');
    btn.disabled = true;
    geocode(q).then(function (res) {
      if (!res.length) { pm.textContent = 'Ort nicht gefunden. Versuch es mit Stadt und Land oder tippe direkt auf die Karte.'; pm.hidden = false; return; }
      var lat = parseFloat(res[0].lat), lng = parseFloat(res[0].lon);
      setPick(lat, lng, true);
      pick.map.setView([lat, lng], 12);
    }).catch(function () {
      pm.textContent = 'Die Ortssuche ist gerade nicht erreichbar. Tippe direkt auf die Karte, um den Pin zu setzen.'; pm.hidden = false;
    }).then(function () { btn.disabled = false; });
  }

  function pickLocate() {
    var pm = $('#pick-msg');
    pm.hidden = true;
    if (!navigator.geolocation) { pm.textContent = 'Dein Browser kann den Standort nicht bestimmen.'; pm.hidden = false; return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      setPick(pos.coords.latitude, pos.coords.longitude, true);
      pick.map.setView([pos.coords.latitude, pos.coords.longitude], 12);
    }, function () {
      pm.textContent = 'Standort nicht verfügbar. Erlaube den Zugriff im Browser oder such einen Ort.'; pm.hidden = false;
    }, { timeout: 10000, maximumAge: 300000 });
  }

  /* Zufälliger Versatz von 200–600 m, damit die Haustür nicht auf der Karte steht */
  function fuzz(lat, lng) {
    var dist = 200 + Math.random() * 400;
    var ang = Math.random() * 2 * Math.PI;
    var dLat = (dist * Math.cos(ang)) / 111320;
    var dLng = (dist * Math.sin(ang)) / (111320 * Math.cos(lat * Math.PI / 180));
    return { lat: Math.round((lat + dLat) * 1e5) / 1e5, lng: Math.round((lng + dLng) * 1e5) / 1e5 };
  }

  function parsePrice(raw) {
    var s = String(raw || '').trim().replace(/\s/g, '').replace(',', '.');
    if (s === '') return { value: null };
    if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return { error: true };
    return { value: parseFloat(s) };
  }

  function normalizeWhatsapp(raw) {
    var s = String(raw || '').trim().replace(/[\s().\-]/g, '');
    if (!s) return { value: '' };
    if (s.slice(0, 2) === '00') s = '+' + s.slice(2);
    if (!/^\+[1-9]\d{6,14}$/.test(s)) return { error: true };
    return { value: s };
  }

  function readOfferForm() {
    var errors = {};
    var first = null;
    function fail(key, msg, focusEl) { errors[key] = msg; if (!first) first = focusEl; }

    var name = $('#f-name').value.trim();
    if (name.length < 2 || name.length > 60) fail('name', 'Gib einen Namen mit 2 bis 60 Zeichen ein.', $('#f-name'));

    var batteries = [];
    var priceError = null;
    MODELS.forEach(function (m) {
      if (!$('#bat-' + m.id + ' input[type=checkbox]').checked) return;
      var d = parsePrice($('#pd-' + m.id).value), w = parsePrice($('#pw-' + m.id).value);
      if (d.error || w.error) { priceError = priceError || { id: m.id, name: m.name }; return; }
      batteries.push({ model: m.id, priceDay: d.value, priceWeek: w.value });
    });
    if (priceError) fail('batteries', priceError.name + ': Gib den Preis als Zahl ein, z. B. 45 oder 45,50.', $('#pd-' + priceError.id));
    else if (!batteries.length) fail('batteries', 'Wähle mindestens eine Batterie aus.', $('#bat-' + MODELS[0].id + ' input[type=checkbox]'));

    if (pick.lat == null) fail('location', 'Setze deinen Pin: Ort suchen oder auf die Karte tippen.', $('#f-search'));

    var place = $('#f-place').value.trim();
    if (place.length > 120) fail('place', 'Der Ortsname darf höchstens 120 Zeichen haben.', $('#f-place'));

    var wa = normalizeWhatsapp($('#f-wa').value);
    if (wa.error) fail('wa', 'Bitte mit Ländervorwahl eingeben, z. B. +49 170 1234567.', $('#f-wa'));
    var mail = $('#f-mail').value.trim();
    if (mail && !validEmail(mail)) fail('mail', 'Das ist keine gültige E-Mail-Adresse.', $('#f-mail'));
    if (!wa.error && !wa.value && !mail) fail('contact', 'Gib mindestens WhatsApp oder E-Mail an, sonst kann dich niemand erreichen.', $('#f-wa'));

    var notes = $('#f-notes').value.trim();
    if (notes.length > 600) fail('notes', 'Die Hinweise dürfen höchstens 600 Zeichen haben.', $('#f-notes'));

    if (first) return { errors: errors, focus: first };

    var lat = pick.lat, lng = pick.lng;
    var approx = $('#f-approx').checked;
    if (approx && (pick.dirty || !pick.wasApprox)) { var f = fuzz(lat, lng); lat = f.lat; lng = f.lng; }
    else { lat = Math.round(lat * 1e5) / 1e5; lng = Math.round(lng * 1e5) / 1e5; }

    return {
      data: {
        name: name, placeLabel: place, lat: lat, lng: lng, approximate: approx,
        batteries: batteries, currency: $('#f-currency').value,
        whatsapp: wa.value, email: mail, notes: notes, active: $('#f-active').checked
      }
    };
  }

  function onOfferSubmit(e) {
    e.preventDefault();
    ['name', 'place', 'wa', 'mail', 'notes', 'batteries', 'location', 'contact'].forEach(function (k) { setErr(k, ''); });
    var oe = $('#offer-error'); oe.hidden = true;

    var res = readOfferForm();
    if (res.errors) {
      Object.keys(res.errors).forEach(function (k) { setErr(k, res.errors[k]); });
      res.focus.focus();
      return;
    }
    var btn = $('#offer-save');
    btn.disabled = true; btn.textContent = 'Speichert …';

    store.saveListing(res.data).then(function (saved) {
      state.mine = saved;
      $('#dlg-offer').close();
      updateAuthUI();
      toast(saved.active ? 'Angebot gespeichert. Es ist jetzt auf der Karte.' : 'Angebot gespeichert, aber pausiert: Es ist nicht auf der Karte zu sehen.');
      return reload().then(function () {
        if (saved.active) {
          state.anchor = null;
          if (isMobile()) setView('map');
          map.setView([saved.lat, saved.lng], 10, { animate: false });
          selectListing(saved.id);
        }
      });
    }).catch(function (err) {
      oe.textContent = err.message || 'Das Angebot konnte nicht gespeichert werden.';
      oe.hidden = false;
    }).then(function () { btn.disabled = false; btn.textContent = 'Angebot speichern'; });
  }

  var deleteTimer;
  function resetDeleteButton() {
    clearTimeout(deleteTimer);
    var b = $('#offer-delete');
    b.classList.remove('is-armed');
    b.textContent = 'Angebot löschen';
  }
  function onDeleteClick() {
    var b = $('#offer-delete');
    if (!b.classList.contains('is-armed')) {
      b.classList.add('is-armed');
      b.textContent = 'Wirklich löschen? Nochmal klicken';
      deleteTimer = setTimeout(resetDeleteButton, 5000);
      return;
    }
    resetDeleteButton();
    b.disabled = true;
    store.deleteListing().then(function () {
      state.mine = null;
      $('#dlg-offer').close();
      updateAuthUI();
      toast('Angebot gelöscht.');
      return reload();
    }).catch(function (err) {
      var oe = $('#offer-error'); oe.textContent = err.message; oe.hidden = false;
    }).then(function () { b.disabled = false; });
  }

  /* ---------- Start ---------- */

  function bindEvents() {
    $('#search').addEventListener('submit', onSearch);
    $('#view-toggle').addEventListener('click', function () { setView(state.view === 'map' ? 'list' : 'map'); });

    $('#btn-offer').addEventListener('click', openOffer);
    $('#btn-account').addEventListener('click', function () {
      if (state.user) {
        store.signOut().then(function () { toast('Abgemeldet.'); }).catch(function (e) { toast(e.message); });
      } else openAuth('login');
    });

    $$('input[name="auth-mode"]').forEach(function (r) { r.addEventListener('change', function () { if (r.checked) setAuthMode(r.value); }); });
    $('#auth-forgot').addEventListener('click', function () { setAuthMode('forgot'); });
    $('#auth-form').addEventListener('submit', onAuthSubmit);

    $('#offer-form').addEventListener('submit', onOfferSubmit);
    $('#offer-delete').addEventListener('click', onDeleteClick);
    $('#btn-pick-search').addEventListener('click', pickSearch);
    $('#btn-pick-locate').addEventListener('click', pickLocate);
    $('#f-search').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); pickSearch(); } });
    $('#f-place').addEventListener('input', function () { pick.labelTouched = true; });

    // Fehlermeldungen verschwinden, sobald man das Feld anfasst
    [['f-name', 'name'], ['f-place', 'place'], ['f-wa', 'wa'], ['f-mail', 'mail'], ['f-notes', 'notes']].forEach(function (p) {
      $('#' + p[0]).addEventListener('input', function () {
        setErr(p[1], '');
        if (p[1] === 'wa' || p[1] === 'mail') setErr('contact', '');
      });
    });
    $('#bat-rows').addEventListener('input', function () { setErr('batteries', ''); });
    $('#bat-rows').addEventListener('change', function () { setErr('batteries', ''); });
    $('#auth-email').addEventListener('input', function () { setErr('auth-email', ''); });
    $('#auth-pw').addEventListener('input', function () { setErr('auth-pw', ''); });

    // Schließen-Buttons in Dialogen; Klick neben das Anmelde-Fenster schließt es
    $$('dialog [data-close]').forEach(function (b) {
      b.innerHTML = b.classList.contains('icon-btn') ? ICON.close : b.innerHTML;
      b.addEventListener('click', function () { b.closest('dialog').close(); });
    });
    $('#dlg-auth').addEventListener('click', function (e) { if (e.target === this) this.close(); });
    // Wurde das Fenster ohne Anmeldung geschlossen, verfällt der gemerkte "Angebot öffnen"-Wunsch.
    $('#dlg-auth').addEventListener('close', function () {
      if (!authDone) state.pendingAfterAuth = null;
      authDone = false;
    });
    $('#dlg-offer').addEventListener('close', resetDeleteButton);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.selectedId && !document.querySelector('dialog[open]')) closeDetail();
    });

    window.addEventListener('resize', debounce(function () { map.invalidateSize(); measureBanner(); renderList(); }, 150));

    var close = $('#demo-close');
    close.addEventListener('click', function () { $('#demo-banner').hidden = true; measureBanner(); setTimeout(function () { map.invalidateSize(); }, 0); });

    if (CFG.contactEmail) {
      $('#report-li').hidden = false;
      $('#report-link').href = 'mailto:' + CFG.contactEmail + '?subject=' + encodeURIComponent('Foil Drive Battery Rental: Angebot melden');
    }
  }

  function measureBanner() {
    var b = $('#demo-banner');
    document.documentElement.style.setProperty('--banner', (b.hidden ? 0 : b.offsetHeight) + 'px');
  }

  function boot() {
    var live = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase && window.createSupabaseStore);
    store = live ? window.createSupabaseStore(CFG) : window.createDemoStore();
    state.mode = store.mode;

    renderChips();
    buildOfferForm();
    initMap();
    bindEvents();
    setView('map');

    if (state.mode === 'demo') { $('#demo-banner').hidden = false; measureBanner(); setTimeout(function () { map.invalidateSize(); }, 0); }

    store.init().then(function () {
      state.user = store.getUser();
      store.onAuth(onAuthChange);
      return state.user ? store.getMyListing().catch(function () { return null; }) : null;
    }).then(function (mine) {
      state.mine = mine;
      updateAuthUI();
      return reload();
    }).catch(function (err) {
      console.error(err);
      $('#count').textContent = 'Standorte nicht geladen';
      setStatus(h('p', { text: 'Die Verbindung zur Datenbank hat nicht geklappt. Prüfe die Einstellungen in config.js und lade die Seite neu.' }));
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
