/* Foil Drive Battery Rental – App-Logik */
(function () {
  'use strict';

  var CFG = window.BATTERY_RENTAL_CONFIG || {};
  var I18N = window.I18N;
  function t(key, params) { return I18N.t(key, params); }

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
  var MAX_FILE = 5 * 1024 * 1024;
  var FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  // Gleiche Regel wie in schema.sql (proof_url)
  var PROOF_RE = /^https:\/\/([a-z0-9-]+\.)*(instagram\.com|facebook\.com|fb\.com|fb\.me)\/.+/i;

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
      return new Intl.NumberFormat(I18N.locale(), { style: 'currency', currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
    } catch (e) { return value + ' ' + cur; }
  }
  function currencySymbol(cur) {
    try {
      var parts = new Intl.NumberFormat(I18N.locale(), { style: 'currency', currency: cur }).formatToParts(0);
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
  function fmtKm(d) {
    var v = d < 10 ? Math.round(d * 10) / 10 : Math.round(d);
    return new Intl.NumberFormat(I18N.locale(), { maximumFractionDigits: 1 }).format(v) + ' km';
  }
  function debounce(fn, ms) {
    var timer;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }
  function isMobile() { return window.matchMedia('(max-width: 860px)').matches; }

  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 4800);
  }

  /* ---------- Zustand ---------- */

  var store;
  var state = {
    mode: 'demo',
    user: null,
    listings: [],
    loaded: false,
    failed: false,
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

  /* Günstigster Preis unter den (ggf. gefilterten) Batterien; field = 'priceDay' | 'priceWeek' */
  function lowest(l, field) {
    var f = activeFilterIds();
    var prices = l.batteries
      .filter(function (b) { return !f.length || f.indexOf(b.model) > -1; })
      .map(function (b) { return b[field]; })
      .filter(isNum);
    return prices.length ? Math.min.apply(null, prices) : null;
  }

  /* ---------- Karte ---------- */

  function pinIcon(l, selected) {
    var p = lowest(l, 'priceDay');
    var label = p == null ? t('request') : t('pin.from', { p: money(p, l.currency) });
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
    if (!navigator.geolocation) { toast(t('geo.unsupported')); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      state.anchor = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      map.flyTo([pos.coords.latitude, pos.coords.longitude], 9);
    }, function () {
      toast(t('geo.denied'));
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

  function setStatus(content) {
    var el = $('#list-status');
    el.innerHTML = '';
    if (!content) { el.hidden = true; return; }
    el.hidden = false;
    append(el, content);
  }

  function renderList() {
    var list = $('#list');
    var count = $('#count');

    if (state.failed) {
      count.textContent = t('list.error_title');
      list.innerHTML = '';
      setStatus([
        h('p', { text: t('list.error') }),
        h('button', { type: 'button', class: 'btn btn-primary', text: t('list.retry'), onclick: function () { state.failed = false; count.textContent = t('list.loading'); setStatus(null); reload(); } })
      ]);
      return;
    }
    if (!state.loaded) { count.textContent = t('list.loading'); return; }

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
      count.textContent = t('list.none_title');
      setStatus([
        h('p', { text: t('list.none_p') }),
        h('button', { type: 'button', class: 'btn btn-accent', text: t('nav.offer'), onclick: openOffer })
      ]);
      return;
    }
    if (!all.length) {
      count.textContent = t('list.nomatch_title');
      setStatus(h('p', { text: t('list.nomatch_p') }));
      return;
    }

    count.textContent = listOnly
      ? I18N.t2('count.all', all.length, { m: all.length })
      : I18N.t2('count.in_view', all.length, { n: shown.length, m: all.length });

    if (!shown.length) {
      setStatus(h('p', { text: t('list.empty_view') }));
      return;
    }

    var f = activeFilterIds();
    shown.slice(0, 150).forEach(function (item) {
      var l = item.l;
      var day = lowest(l, 'priceDay'), week = lowest(l, 'priceWeek');
      var priceBox = h('span', { class: 'row-price' });
      if (day != null) { priceBox.appendChild(h('strong', { text: t('pin.from', { p: money(day, l.currency) }) })); priceBox.appendChild(h('small', { text: t('per_day') })); }
      else if (week != null) { priceBox.appendChild(h('strong', { text: t('pin.from', { p: money(week, l.currency) }) })); priceBox.appendChild(h('small', { text: t('per_week') })); }
      else { priceBox.appendChild(h('strong', { text: t('request') })); }

      var place = l.placeLabel || '';
      if (state.anchor) place += (place ? ' · ' : '') + fmtKm(item.d);

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
    return fetch(NOMINATIM + '/search?format=jsonv2&limit=1&accept-language=' + I18N.lang() + '&q=' + encodeURIComponent(q))
      .then(function (r) { if (!r.ok) throw new Error('geocode'); return r.json(); });
  }
  function reverseGeocode(lat, lng) {
    return fetch(NOMINATIM + '/reverse?format=jsonv2&zoom=10&accept-language=' + I18N.lang() + '&lat=' + lat + '&lon=' + lng)
      .then(function (r) { if (!r.ok) throw new Error('reverse'); return r.json(); });
  }

  function onSearch(e) {
    e.preventDefault();
    var q = $('#q').value.trim();
    var msg = $('#search-msg');
    msg.hidden = true;
    if (!q) { msg.textContent = t('search.empty'); msg.hidden = false; return; }
    var btn = $('#search-btn');
    btn.disabled = true;
    geocode(q).then(function (res) {
      if (!res.length) { msg.textContent = t('search.notfound'); msg.hidden = false; return; }
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
      msg.textContent = t('search.error');
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

  function depositLine(l) {
    if (l.depositAmount == null) return t('detail.deposit_ask');
    if (l.depositAmount === 0) return t('detail.deposit_none');
    return t('detail.deposit_amount', { amount: money(l.depositAmount, l.currency) });
  }

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
    var text = t('msg.text', { name: l.name, bats: names });
    if (isMine) {
      contact.appendChild(h('p', { text: t('contact.mine') }));
      contact.appendChild(h('button', { type: 'button', class: 'btn btn-primary', text: t('contact.edit'), onclick: openOffer }));
    } else if (l.demo) {
      contact.appendChild(h('p', { class: 'muted', text: t('contact.demo') }));
    } else if (!state.user) {
      contact.appendChild(h('p', { text: t('contact.login_p') }));
      contact.appendChild(h('button', { type: 'button', class: 'btn btn-primary', text: t('contact.login_btn'),
        onclick: function () { openAuth('login', t('login.hint_contact')); } }));
    } else {
      if (l.whatsapp) {
        contact.appendChild(h('a', { class: 'btn btn-primary', target: '_blank', rel: 'noopener',
          href: 'https://wa.me/' + whatsappDigits(l.whatsapp) + '?text=' + encodeURIComponent(text), html: ICON.chat + '<span>' + esc(t('contact.wa')) + '</span>' }));
      }
      if (l.email) {
        contact.appendChild(h('a', { class: 'btn btn-quiet',
          href: 'mailto:' + l.email + '?subject=' + encodeURIComponent(t('msg.subject')) + '&body=' + encodeURIComponent(text),
          html: ICON.mail + '<span>' + esc(t('contact.mail')) + '</span>' }));
      }
      if (!l.whatsapp && !l.email) contact.appendChild(h('p', { class: 'muted', text: t('contact.none') }));
    }

    el.appendChild(h('div', { class: 'detail-head' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('detail.close'), html: ICON.close, onclick: closeDetail })));

    var body = h('div', { class: 'detail-body' },
      h('h2', { id: 'detail-title', tabindex: '-1', text: l.name }),
      h('p', { class: 'detail-place', html: ICON.pin }, l.placeLabel || t('detail.no_place')),
      l.approximate ? h('p', { class: 'note-approx', text: t('detail.approx') }) : null,
      h('table', { class: 'bat-table' },
        h('caption', { class: 'sr-only', text: t('detail.caption') }),
        h('thead', null, h('tr', null,
          h('th', { scope: 'col', text: t('detail.th_bat') }),
          h('th', { scope: 'col', text: t('detail.th_day') }),
          h('th', { scope: 'col', text: t('detail.th_week') }))),
        h('tbody', null, bodyRows)),
      anyMissing ? h('p', { class: 'table-hint', text: t('detail.price_hint') }) : null,
      h('div', { class: 'deposit' },
        h('p', { class: 'deposit-main', text: depositLine(l) }),
        l.idCheck ? h('p', { class: 'deposit-id', text: t('detail.id_check') }) : null),
      l.notes ? h('h3', { text: t('detail.notes_h') }) : null,
      l.notes ? h('p', { class: 'notes', text: l.notes }) : null,
      contact,
      h('p', { class: 'deal-note', text: t('detail.deal') }));
    el.appendChild(body);

    el.hidden = false;
    if (focus) $('#detail-title').focus({ preventScroll: true });
  }

  /* ---------- Ansicht (mobil: Karte / Liste) ---------- */

  function labelViewToggle() {
    var btn = $('#view-toggle');
    btn.innerHTML = '';
    btn.insertAdjacentHTML('beforeend', state.view === 'map' ? ICON.list : ICON.map);
    btn.appendChild(h('span', { text: state.view === 'map' ? t('view.list') : t('view.map') }));
  }

  function setView(v) {
    state.view = v;
    $('.shell').setAttribute('data-view', v);
    labelViewToggle();
    if (v === 'map') map.invalidateSize();
    renderList();
  }

  /* ---------- Laden ---------- */

  function reload() {
    return store.listListings().then(function (ls) {
      state.listings = ls;
      state.loaded = true;
      state.failed = false;
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
      state.failed = true;
      renderList();
    });
  }

  /* ---------- Sprache ---------- */

  function applyMeta() {
    document.title = t('meta.title');
    var d = document.querySelector('meta[name="description"]');
    if (d) d.setAttribute('content', t('meta.desc'));
    var other = I18N.other();
    ['#btn-lang', '#footer-lang'].forEach(function (s) { var b = $(s); if (b) b.setAttribute('lang', other); });
  }

  function onLangChange() {
    applyMeta();
    updateAuthUI();
    labelViewToggle();
    updateBatLabels();
    if ($('#dlg-auth').open) setAuthMode(authMode);
    if ($('#dlg-offer').open) refreshOfferTexts();
    if (state.mode === 'demo') { reload(); return; }   // Demo-Beispieltexte gibt es pro Sprache
    rebuildMarkers();
    if (state.selectedId) { var cur = byId(state.selectedId); if (cur) openDetail(cur, false); }
    renderList();
  }

  /* ---------- Konto ---------- */

  function updateAuthUI() {
    var u = state.user;
    $('#btn-account').textContent = u ? t('nav.logout') : t('nav.login');
    var offerBtn = $('#btn-offer');
    offerBtn.querySelector('.long').textContent = u && state.mine ? t('nav.mine') : t('nav.offer');
    offerBtn.querySelector('.short').textContent = u && state.mine ? t('nav.mine_s') : t('nav.offer_s');
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
    $('#auth-title').textContent = t('auth.title.' + mode);
    $('#auth-seg').hidden = (mode === 'recover' || mode === 'forgot');
    $('#fld-email').hidden = (mode === 'recover');
    $('#fld-pw').hidden = (mode === 'forgot');
    $('#fld-terms').hidden = (mode !== 'signup');
    $('#auth-forgot').hidden = (mode !== 'login');
    $('#hint-auth-pw').hidden = (mode === 'login');
    $('#auth-pw-label').textContent = mode === 'recover' ? t('auth.pw_new') : t('auth.pw');
    $('#auth-pw').setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
    $('#auth-submit').textContent = t('auth.submit.' + mode);
    if (mode === 'login' || mode === 'signup') $$('input[name="auth-mode"]').forEach(function (r) { r.checked = (r.value === mode); });
    setAuthMsg('');
    setErr('auth-email', ''); setErr('auth-pw', ''); setErr('auth-terms', '');
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
    $('#auth-terms').checked = false;
    if (!dlg.open) dlg.showModal();
    setTimeout(function () { (mode === 'recover' ? $('#auth-pw') : $('#auth-email')).focus(); }, 0);
  }

  var INPUT_OF = {
    'auth-email': 'auth-email', 'auth-pw': 'auth-pw', 'auth-terms': 'auth-terms',
    name: 'f-name', place: 'f-place', wa: 'f-wa', mail: 'f-mail', notes: 'f-notes',
    deposit: 'f-deposit', proof: 'f-proof', file: 'f-file'
  };
  var OFFER_ERR_KEYS = ['name', 'place', 'wa', 'mail', 'notes', 'batteries', 'location', 'contact', 'deposit', 'proof', 'file'];

  function setErr(key, msg) {
    var e = $('#err-' + key);
    if (!e) return;
    e.textContent = msg || '';
    e.hidden = !msg;
    var input = INPUT_OF[key] && document.getElementById(INPUT_OF[key]);
    if (input) { if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
  }

  function validEmail(s) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) && s.length <= 254; }

  function onAuthSubmit(e) {
    e.preventDefault();
    var email = $('#auth-email').value.trim();
    var pw = $('#auth-pw').value;
    setErr('auth-email', ''); setErr('auth-pw', ''); setErr('auth-terms', ''); setAuthMsg('');

    if (authMode !== 'recover' && !validEmail(email)) { setErr('auth-email', t('auth.err.email')); $('#auth-email').focus(); return; }
    if (authMode !== 'forgot' && (authMode === 'login' ? !pw : pw.length < 8)) {
      setErr('auth-pw', authMode === 'login' ? t('auth.err.pw_login') : t('auth.err.pw_short'));
      $('#auth-pw').focus(); return;
    }
    if (authMode === 'signup' && !$('#auth-terms').checked) { setErr('auth-terms', t('auth.err.terms')); $('#auth-terms').focus(); return; }

    var btn = $('#auth-submit');
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = t('auth.busy');

    var job;
    if (authMode === 'login') job = store.signIn(email, pw).then(function () { closeAuthOk(); toast(t('auth.ok.login')); });
    else if (authMode === 'signup') job = store.signUp(email, pw).then(function (r) {
      if (r.needsConfirm) setAuthMsg(t('auth.confirm_sent'));
      else { closeAuthOk(); toast(t('auth.ok.signup')); }
    });
    else if (authMode === 'forgot') job = store.resetPassword(email).then(function () { setAuthMsg(t('auth.reset_sent')); });
    else job = store.updatePassword(pw).then(function () { closeAuthOk(); toast(t('auth.pw_changed')); });

    job.catch(function (err) { setAuthMsg(err.message, true); })
      .then(function () { btn.disabled = false; btn.textContent = label; });
  }

  /* ---------- Angebot anlegen / bearbeiten ---------- */

  var pick = { map: null, marker: null, lat: null, lng: null, dirty: false, labelTouched: false, wasApprox: true };

  function buildOfferForm() {
    var rows = $('#bat-rows');
    MODELS.forEach(function (m) {
      var cb = h('input', { type: 'checkbox', name: 'model', value: m.id, onchange: function () { syncBatRow(m.id); } });
      var day = h('input', { class: 'input', type: 'text', inputmode: 'decimal', id: 'pd-' + m.id, 'data-model': m.id, 'data-kind': 'day', disabled: true, autocomplete: 'off' });
      var week = h('input', { class: 'input', type: 'text', inputmode: 'decimal', id: 'pw-' + m.id, 'data-model': m.id, 'data-kind': 'week', disabled: true, autocomplete: 'off' });
      rows.appendChild(h('div', { class: 'bat is-off', id: 'bat-' + m.id },
        h('label', { class: 'bat-check' }, cb, m.name),
        h('div', { class: 'money' }, day, h('span', { 'data-unit': 'day' })),
        h('div', { class: 'money' }, week, h('span', { 'data-unit': 'week' }))));
    });
    var sel = $('#f-currency');
    CURRENCIES.forEach(function (c) { sel.appendChild(h('option', { value: c, text: c + ' (' + currencySymbol(c) + ')' })); });
    sel.addEventListener('change', updateUnits);
    updateBatLabels();
    updateUnits();
  }

  /* Beschriftungen der Preisfelder (sprachabhängig) */
  function updateBatLabels() {
    $$('#bat-rows input[data-model]').forEach(function (inp) {
      var day = inp.getAttribute('data-kind') === 'day';
      inp.setAttribute('aria-label', t(day ? 'offer.aria.day' : 'offer.aria.week', { m: MODEL_NAME[inp.getAttribute('data-model')] }));
      inp.setAttribute('placeholder', t(day ? 'offer.ph.day' : 'offer.ph.week'));
    });
    updateUnits();
  }

  function updateUnits() {
    var cur = $('#f-currency').value;
    var sym = currencySymbol(cur);
    $$('#bat-rows [data-unit]').forEach(function (s) {
      s.textContent = t(s.getAttribute('data-unit') === 'day' ? 'offer.unit.day' : 'offer.unit.week', { c: sym });
    });
    $('#deposit-unit').textContent = sym;
  }

  function syncBatRow(id) {
    var on = $('#bat-' + id + ' input[type=checkbox]').checked;
    $('#bat-' + id).classList.toggle('is-off', !on);
    $('#pd-' + id).disabled = !on;
    $('#pw-' + id).disabled = !on;
  }

  function fmtNum(n) {
    if (!isNum(n)) return '';
    var s = String(n);
    return I18N.lang() === 'de' ? s.replace('.', ',') : s;
  }

  function fileLabel(path) { return String(path || '').split('/').pop().replace(/^\d{10,}-/, ''); }

  /* Statusfeld oben im Dialog: Antrag wird geprüft / freigegeben / abgelehnt */
  function renderOfferStatus() {
    var box = $('#offer-status');
    var l = state.mine;
    box.innerHTML = '';
    box.className = 'status-box';
    if (!l) { box.hidden = true; return; }
    box.hidden = false;
    if (l.status === 'pending') {
      box.classList.add('is-pending');
      box.appendChild(h('p', { text: t('offer.status.pending') }));
    } else if (l.status === 'rejected') {
      box.classList.add('is-rejected');
      box.appendChild(h('p', null, h('strong', { text: t('offer.status.rejected') })));
      if (l.rejectReason) box.appendChild(h('p', { text: t('offer.status.reason', { reason: l.rejectReason }) }));
      box.appendChild(h('p', { text: t('offer.status.rejected_hint') }));
    } else {
      box.classList.add('is-approved');
      box.appendChild(h('p', { text: t(l.active ? 'offer.status.approved' : 'offer.status.approved_paused') }));
    }
  }

  function saveLabel() {
    var l = state.mine;
    return t(!l || l.status === 'rejected' ? 'offer.save.new' : 'offer.save.edit');
  }

  function refreshOfferTexts() {
    $('#offer-title').textContent = t(state.mine ? 'offer.title.edit' : 'offer.title.new');
    renderOfferStatus();
    var btn = $('#offer-save');
    if (!btn.disabled) btn.textContent = saveLabel();
    var cur = state.mine && state.mine.proofFile;
    var fc = $('#file-current');
    fc.hidden = !cur;
    fc.textContent = cur ? t('offer.proof.file.current', { name: fileLabel(cur) }) : '';
    updateUnits();
  }

  function fillOfferForm(l) {
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
    $('#f-deposit').value = l ? fmtNum(l.depositAmount) : '';
    $('#f-idcheck').checked = l ? l.idCheck : false;
    $('#f-place').value = l ? l.placeLabel : '';
    $('#f-approx').checked = l ? l.approximate : true;
    $('#f-wa').value = l ? l.whatsapp : '';
    $('#f-mail').value = l ? l.email : (state.user ? state.user.email : '');
    $('#f-proof').value = l ? l.proofUrl : '';
    $('#f-file').value = '';
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
    OFFER_ERR_KEYS.forEach(function (k) { setErr(k, ''); });
    var oe = $('#offer-error'); oe.hidden = true; oe.textContent = '';
    var pm = $('#pick-msg'); pm.hidden = true;
    refreshOfferTexts();
  }

  function pickIcon() {
    return L.divIcon({
      className: 'pin-icon', iconSize: [0, 0], iconAnchor: [0, 0],
      html: '<div class="pin is-selected"><span class="pin-bolt">' + ICON.bolt + '</span><span>' + esc(t('offer.pin_label')) + '</span></div>'
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
      pick.marker = L.marker([lat, lng], { draggable: true, icon: pickIcon(), title: t('offer.pin_title') }).addTo(pick.map);
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
      openAuth('signup', t('auth.intro.offer'));
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
    if (!q) { pm.textContent = t('offer.loc.empty'); pm.hidden = false; return; }
    var btn = $('#btn-pick-search');
    btn.disabled = true;
    geocode(q).then(function (res) {
      if (!res.length) { pm.textContent = t('offer.loc.notfound'); pm.hidden = false; return; }
      var lat = parseFloat(res[0].lat), lng = parseFloat(res[0].lon);
      setPick(lat, lng, true);
      pick.map.setView([lat, lng], 12);
    }).catch(function () {
      pm.textContent = t('offer.loc.search_fail'); pm.hidden = false;
    }).then(function () { btn.disabled = false; });
  }

  function pickLocate() {
    var pm = $('#pick-msg');
    pm.hidden = true;
    if (!navigator.geolocation) { pm.textContent = t('geo.unsupported'); pm.hidden = false; return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      setPick(pos.coords.latitude, pos.coords.longitude, true);
      pick.map.setView([pos.coords.latitude, pos.coords.longitude], 12);
    }, function () {
      pm.textContent = t('geo.denied'); pm.hidden = false;
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

  function parseDeposit(raw) {
    var s = String(raw || '').trim().replace(/\s/g, '').replace(',', '.');
    if (s === '') return { value: null };
    if (!/^\d{1,5}(\.\d{1,2})?$/.test(s)) return { error: true };
    return { value: parseFloat(s) };
  }

  function normalizeWhatsapp(raw) {
    var s = String(raw || '').trim().replace(/[\s().\-]/g, '');
    if (!s) return { value: '' };
    if (s.slice(0, 2) === '00') s = '+' + s.slice(2);
    if (!/^\+[1-9]\d{6,14}$/.test(s)) return { error: true };
    return { value: s };
  }

  /* "instagram.com/name" ohne https:// ergänzen */
  function normalizeProofUrl(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    if (/^http:\/\//i.test(s)) s = 'https://' + s.slice(7);
    else if (!/^https:\/\//i.test(s)) s = 'https://' + s;
    return s;
  }

  function readOfferForm() {
    var errors = {};
    var first = null;
    function fail(key, msg, focusEl) { errors[key] = msg; if (!first) first = focusEl; }

    // Reihenfolge wie im Formular, damit der erste Fehler oben fokussiert wird
    var batteries = [];
    var priceError = null;
    MODELS.forEach(function (m) {
      if (!$('#bat-' + m.id + ' input[type=checkbox]').checked) return;
      var d = parsePrice($('#pd-' + m.id).value), w = parsePrice($('#pw-' + m.id).value);
      if (d.error || w.error) { priceError = priceError || { id: m.id, name: m.name }; return; }
      batteries.push({ model: m.id, priceDay: d.value, priceWeek: w.value });
    });
    if (priceError) fail('batteries', t('offer.err.bat_price', { m: priceError.name }), $('#pd-' + priceError.id));
    else if (!batteries.length) fail('batteries', t('offer.err.bat_none'), $('#bat-' + MODELS[0].id + ' input[type=checkbox]'));

    var dep = parseDeposit($('#f-deposit').value);
    if (dep.error) fail('deposit', t('offer.err.dep'), $('#f-deposit'));

    if (pick.lat == null) fail('location', t('offer.err.loc'), $('#f-search'));

    var place = $('#f-place').value.trim();
    if (place.length > 120) fail('place', t('offer.err.place'), $('#f-place'));

    var wa = normalizeWhatsapp($('#f-wa').value);
    if (wa.error) fail('wa', t('offer.err.wa'), $('#f-wa'));
    var mail = $('#f-mail').value.trim();
    if (mail && !validEmail(mail)) fail('mail', t('offer.err.mail'), $('#f-mail'));
    if (!wa.error && !wa.value && !mail) fail('contact', t('offer.err.contact'), $('#f-wa'));

    var proof = normalizeProofUrl($('#f-proof').value);
    if (!PROOF_RE.test(proof) || proof.length > 300) fail('proof', t('offer.err.proof'), $('#f-proof'));

    var file = $('#f-file').files && $('#f-file').files[0] || null;
    if (file) {
      var okType = FILE_TYPES.indexOf(file.type) > -1 || (!file.type && /\.(pdf|jpe?g|png)$/i.test(file.name));
      if (!okType) fail('file', t('offer.err.file_type'), $('#f-file'));
      else if (file.size > MAX_FILE) fail('file', t('offer.err.file_size'), $('#f-file'));
    }

    var name = $('#f-name').value.trim();
    if (name.length < 2 || name.length > 60) fail('name', t('offer.err.name'), $('#f-name'));

    var notes = $('#f-notes').value.trim();
    if (notes.length > 600) fail('notes', t('offer.err.notes'), $('#f-notes'));

    if (first) return { errors: errors, focus: first };

    var lat = pick.lat, lng = pick.lng;
    var approx = $('#f-approx').checked;
    if (approx && (pick.dirty || !pick.wasApprox)) { var f = fuzz(lat, lng); lat = f.lat; lng = f.lng; }
    else { lat = Math.round(lat * 1e5) / 1e5; lng = Math.round(lng * 1e5) / 1e5; }

    return {
      file: file,
      data: {
        name: name, placeLabel: place, lat: lat, lng: lng, approximate: approx,
        batteries: batteries, currency: $('#f-currency').value,
        depositAmount: dep.value, idCheck: $('#f-idcheck').checked,
        whatsapp: wa.value, email: mail, notes: notes, active: $('#f-active').checked,
        proofUrl: proof, proofFile: state.mine ? state.mine.proofFile : ''
      }
    };
  }

  function onOfferSubmit(e) {
    e.preventDefault();
    OFFER_ERR_KEYS.forEach(function (k) { setErr(k, ''); });
    var oe = $('#offer-error'); oe.hidden = true;

    var res = readOfferForm();
    if (res.errors) {
      Object.keys(res.errors).forEach(function (k) { setErr(k, res.errors[k]); });
      res.focus.focus();
      return;
    }
    var btn = $('#offer-save');
    var prevStatus = state.mine && state.mine.status;
    btn.disabled = true; btn.textContent = t('offer.saving');

    store.saveListing(res.data, res.file).then(function (saved) {
      state.mine = saved;
      $('#dlg-offer').close();
      updateAuthUI();

      if (saved.status === 'pending') {
        toast(t(prevStatus === 'rejected' ? 'toast.resubmitted' : (prevStatus === 'pending' ? 'toast.saved' : 'toast.sent')));
        store.notifySubmitted();          // Mail an den Admin (die Datenbank sorgt dafür, dass es nur einmal pro Antrag passiert)
        return reload();
      }
      toast(t(saved.active ? 'toast.saved' : 'toast.saved_paused'));
      return reload().then(function () {
        if (saved.active && saved.status === 'approved') {
          state.anchor = null;
          if (isMobile()) setView('map');
          map.setView([saved.lat, saved.lng], 10, { animate: false });
          selectListing(saved.id);
        }
      });
    }).catch(function (err) {
      oe.textContent = err.message || t('offer.err.save');
      oe.hidden = false;
      oe.scrollIntoView({ block: 'nearest' });
    }).then(function () { btn.disabled = false; btn.textContent = saveLabel(); });
  }

  var deleteTimer;
  function resetDeleteButton() {
    clearTimeout(deleteTimer);
    var b = $('#offer-delete');
    b.classList.remove('is-armed');
    b.textContent = t('offer.delete');
  }
  function onDeleteClick() {
    var b = $('#offer-delete');
    if (!b.classList.contains('is-armed')) {
      b.classList.add('is-armed');
      b.textContent = t('offer.delete_confirm');
      deleteTimer = setTimeout(resetDeleteButton, 5000);
      return;
    }
    resetDeleteButton();
    b.disabled = true;
    store.deleteListing(state.mine).then(function () {
      state.mine = null;
      $('#dlg-offer').close();
      updateAuthUI();
      toast(t('toast.deleted'));
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
        store.signOut().then(function () { toast(t('auth.logout_ok')); }).catch(function (e) { toast(e.message); });
      } else openAuth('login');
    });
    ['#btn-lang', '#footer-lang'].forEach(function (s) {
      $(s).addEventListener('click', function () { I18N.setLang(I18N.other()); });
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
    [['f-name', 'name'], ['f-place', 'place'], ['f-wa', 'wa'], ['f-mail', 'mail'], ['f-notes', 'notes'],
     ['f-deposit', 'deposit'], ['f-proof', 'proof'], ['f-file', 'file']].forEach(function (p) {
      var ev = p[0] === 'f-file' ? 'change' : 'input';
      $('#' + p[0]).addEventListener(ev, function () {
        setErr(p[1], '');
        if (p[1] === 'wa' || p[1] === 'mail') setErr('contact', '');
      });
    });
    $('#bat-rows').addEventListener('input', function () { setErr('batteries', ''); });
    $('#bat-rows').addEventListener('change', function () { setErr('batteries', ''); });
    $('#auth-email').addEventListener('input', function () { setErr('auth-email', ''); });
    $('#auth-pw').addEventListener('input', function () { setErr('auth-pw', ''); });
    $('#auth-terms').addEventListener('change', function () { setErr('auth-terms', ''); });

    // Schließen-Buttons in Dialogen; Klick neben das Anmelde-Fenster schließt es
    $$('dialog [data-close]').forEach(function (b) {
      if (b.classList.contains('icon-btn')) b.innerHTML = ICON.close;
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
      $('#report-link').href = 'mailto:' + CFG.contactEmail + '?subject=' + encodeURIComponent('Foil Drive Battery Rental: report a listing');
    }

    I18N.onChange(onLangChange);
  }

  function measureBanner() {
    var b = $('#demo-banner');
    document.documentElement.style.setProperty('--banner', (b.hidden ? 0 : b.offsetHeight) + 'px');
  }

  function boot() {
    var live = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase && window.createSupabaseStore);
    store = live ? window.createSupabaseStore(CFG) : window.createDemoStore();
    state.mode = store.mode;

    I18N.apply(document);
    applyMeta();
    renderChips();
    buildOfferForm();
    initMap();
    bindEvents();
    updateAuthUI();
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
      $('#count').textContent = t('list.error_title');
      setStatus(h('p', { text: t('list.db_error') }));
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
