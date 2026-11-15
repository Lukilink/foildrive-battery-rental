/* Foil Battery Rental – App-Logik */
(function () {
  'use strict';

  var CFG = window.BATTERY_RENTAL_CONFIG || {};
  var I18N = window.I18N;
  function t(key, params) { return I18N.t(key, params); }

  /* Marken und Modelle stehen in assets/js/catalog.js */
  var CAT = window.BATTERY_CATALOG;
  var PARTNERS = CFG.partnerProgram === true;   // Partner-Programm an/aus (config.js)
  function bName(b) { return CAT.fullName(b); }
  var MAX_BAT_ROWS = 20;
  var CURRENCIES = ['EUR', 'CHF', 'GBP', 'USD', 'NOK', 'SEK', 'DKK', 'PLN'];

  var NOMINATIM = 'https://nominatim.openstreetmap.org';
  var HALO_METERS = 800;
  var MAX_FILE = 5 * 1024 * 1024;
  var FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  // Gleiche Regel wie in schema.sql (proof_url)
  var WEB_RE = /^https:\/\/[^\s\/]+\.[^\s\/]+(\/\S*)?$/i;
  var PROOF_RE = /^https:\/\/([a-z0-9-]+\.)*(instagram\.com|facebook\.com|fb\.com|fb\.me)\/.+/i;

  var ICON = {
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.4 2 4.5 13.6H11L10 22l9.5-12H13z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 21.5s-7-6.1-7-11.7a7 7 0 0 1 14 0c0 5.6-7 11.7-7 11.7z"/><circle cx="12" cy="9.8" r="2.4" fill="currentColor"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>',
    locate: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="6.5"/><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22"/></g><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 20l1.5-4.3A8.3 8.3 0 1 1 8.4 18.6z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/></g></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>',
    school: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3 2.5 11H5v9h5.5v-6h3v6H19v-9h2.5z"/></svg>',
    partner: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69z"/><path fill="#fff" d="M10.09 16.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48z"/></svg>',
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
      return new Intl.NumberFormat(I18N.locale(), { style: 'currency', currency: cur, minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(value);
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
    filters: { kind: '', brands: {}, models: {} },
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
  function selBrands() { return Object.keys(state.filters.brands).filter(function (k) { return state.filters.brands[k]; }); }
  function selModels() { return Object.keys(state.filters.models).filter(function (k) { return state.filters.models[k]; }); }
  function filterActive() { return !!(state.filters.kind || selBrands().length || selModels().length); }

  /* Eine Batterie passt, wenn ihre Marke gewählt ist (und kein Modell dieser Marke gewählt wurde)
     oder ihr Modell gewählt ist. Ohne Marken-/Modellfilter passt jede Batterie. */
  function batteryMatches(b) {
    var brands = selBrands(), models = selModels();
    if (!brands.length && !models.length) return true;
    var brand = b.brand || 'foil-drive';
    if (models.indexOf(brand + '/' + b.model) > -1) return true;
    if (brands.indexOf(brand) > -1) {
      return !models.some(function (k) { return k.indexOf(brand + '/') === 0; });
    }
    return false;
  }
  function matchesFilter(l) {
    if (state.filters.kind && (l.kind || 'private') !== state.filters.kind) return false;
    return l.batteries.some(batteryMatches);
  }
  function visibleListings() { return state.listings.filter(matchesFilter); }

  /* Günstigster Preis unter den (ggf. gefilterten) Batterien; field = 'priceDay' | 'priceWeek' */
  function isPartner(l) { return PARTNERS && l.partner === true; }

  /* Blauer Haken mit Text für Screenreader */
  function partnerBadge(withText) {
    return h('span', { class: 'partner-badge' + (withText ? ' with-text' : ''), title: t('partner.title'), html: ICON.partner },
      h('span', { class: withText ? null : 'sr-only', text: t('partner.badge') }));
  }

  function lowest(l, field) {
    var prices = l.batteries
      .filter(batteryMatches)
      .map(function (b) { return b[field]; })
      .filter(isNum);
    return prices.length ? Math.min.apply(null, prices) : null;
  }

  /* ---------- Karte ---------- */

  function pinIcon(l, selected) {
    var p = lowest(l, 'priceDay');
    var label = p == null ? t('request') : t('pin.from', { p: money(p, l.currency) });
    var pro = l.kind === 'pro';
    var partner = isPartner(l);
    return L.divIcon({
      className: 'pin-icon',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      html: '<div class="pin' + (pro ? ' is-pro' : '') + (partner ? ' is-partner' : '') + (selected ? ' is-selected' : '') + '"><span class="pin-bolt">' + (pro ? ICON.school : ICON.bolt) + '</span><span>' + esc(label) + '</span>' +
        (partner ? '<span class="pin-check" title="' + esc(t('partner.title')) + '">' + ICON.partner + '</span>' : '') + '</div>'
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
        title: l.name + (l.placeLabel ? ', ' + l.placeLabel : '') + (isPartner(l) ? ' (' + t('partner.badge') + ')' : ''),
        zIndexOffset: isPartner(l) ? 500 : 0,
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

  function filterBrands() {
    return CAT.brands.concat([{ id: CAT.OTHER, name: t('brand.other'), models: [] }]);
  }

  function chip(label, checked, onchange) {
    var input = h('input', { type: 'checkbox', checked: checked ? true : null, onchange: function () { onchange(input.checked); } });
    return h('label', { class: 'chip' }, input, h('span', { text: label }));
  }

  function renderFilters() {
    var box = $('#brand-chips');
    box.innerHTML = '';
    filterBrands().forEach(function (br) {
      box.appendChild(chip(br.name, !!state.filters.brands[br.id], function (on) {
        state.filters.brands[br.id] = on;
        if (!on) Object.keys(state.filters.models).forEach(function (k) { if (k.indexOf(br.id + '/') === 0) delete state.filters.models[k]; });
        renderModelChips();
        onFiltersChanged();
      }));
    });
    renderModelChips();
  }

  /* Modell-Chips erscheinen erst, wenn mindestens eine Marke gewählt ist. */
  function renderModelChips() {
    var box = $('#model-chips');
    box.innerHTML = '';
    var brands = CAT.brands.filter(function (b) { return state.filters.brands[b.id]; });
    box.hidden = !brands.length;
    var multi = brands.length > 1;
    brands.forEach(function (br) {
      br.models.concat([{ id: CAT.OTHER, name: t('model.other') }]).forEach(function (m) {
        var key = br.id + '/' + m.id;
        box.appendChild(chip((multi ? br.name + ' ' : '') + m.name, !!state.filters.models[key], function (on) {
          state.filters.models[key] = on;
          onFiltersChanged();
        }));
      });
    });
  }

  function bindFilters() {
    $$('input[name="kind-filter"]').forEach(function (r) {
      r.addEventListener('change', function () { if (r.checked) { state.filters.kind = r.value; onFiltersChanged(); } });
    });
    $('#reset-filters').addEventListener('click', function () {
      state.filters = { kind: '', brands: {}, models: {} };
      $$('input[name="kind-filter"]').forEach(function (r) { r.checked = (r.value === ''); });
      renderFilters();
      onFiltersChanged();
    });
  }

  function onFiltersChanged() {
    $('#reset-filters').hidden = !filterActive();
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
      // Partner zuerst (wenn das Programm an ist), sonst nach Entfernung
      .sort(function (a, b2) { return (isPartner(b2.l) - isPartner(a.l)) || (a.d - b2.d); });

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
        return h('span', { class: 'tag' + (filterActive() && batteryMatches(bt) ? ' is-match' : ''), text: bName(bt) });
      }));

      var btn = h('button', {
        type: 'button', class: 'row', 'data-id': l.id,
        'aria-current': l.id === state.selectedId ? 'true' : null,
        onclick: function () { if (isMobile()) setView('map'); selectListing(l.id); }
      },
        h('span', { class: 'row-main' },
          h('span', { class: 'row-name' }, l.name, isPartner(l) ? partnerBadge(false) : null, l.kind === 'pro' ? h('span', { class: 'kind-badge', text: t('kind.pro') }) : null),
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

  function safeHttps(u) { return typeof u === 'string' && /^https:\/\//i.test(u); }
  function hostOf(u) {
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; }
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
        h('td', { text: bName(b) }),
        h('td', isNum(b.priceDay) ? { text: money(b.priceDay, l.currency) } : { class: 'none', text: '–' }),
        h('td', isNum(b.priceWeek) ? { text: money(b.priceWeek, l.currency) } : { class: 'none', text: '–' }));
    });
    var anyMissing = l.batteries.some(function (b) { return !isNum(b.priceDay) || !isNum(b.priceWeek); });

    var contact = h('div', { class: 'contact' });
    var names = l.batteries.map(bName).join(', ');
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
      (l.kind === 'pro' || isPartner(l)) ? h('p', { class: 'detail-kind' },
        l.kind === 'pro' ? h('span', { class: 'kind-badge', text: t('kind.pro') }) : null,
        isPartner(l) ? partnerBadge(true) : null) : null,
      isPartner(l) ? h('p', { class: 'detail-partner muted' }, t('partner.detail'), ' ', h('a', { href: '#know-partner', text: t('partner.more'), onclick: closeDetail })) : null,
      h('p', { class: 'detail-place', html: ICON.pin }, l.placeLabel || t('detail.no_place')),
      l.kind === 'pro' && safeHttps(l.website) ? h('p', { class: 'detail-web' },
        h('a', { href: l.website, target: '_blank', rel: 'noopener noreferrer nofollow', text: hostOf(l.website), 'aria-label': t('detail.website_open') + ': ' + hostOf(l.website) })) : null,
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
      l.kind === 'pro' && l.openingHours ? h('h3', { text: t('detail.hours_h') }) : null,
      l.kind === 'pro' && l.openingHours ? h('p', { class: 'notes', text: l.openingHours }) : null,
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
  }

  function onLangChange() {
    applyMeta();
    updateAuthUI();
    labelViewToggle();
    renderFilters();
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
    deposit: 'f-deposit', proof: 'f-proof', file: 'f-file', website: 'f-website', hours: 'f-hours'
  };
  var OFFER_ERR_KEYS = ['name', 'place', 'wa', 'mail', 'notes', 'batteries', 'location', 'contact', 'deposit', 'proof', 'file', 'website', 'hours'];

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

  var batSeq = 0;

  function buildOfferForm() {
    var sel = $('#f-currency');
    CURRENCIES.forEach(function (c) { sel.appendChild(h('option', { value: c, text: c + ' (' + currencySymbol(c) + ')' })); });
    sel.addEventListener('change', updateUnits);
    $('#bat-add').addEventListener('click', function () { addBatRow(null); });
    $$('input[name="offer-kind"]').forEach(function (r) {
      r.addEventListener('change', function () { applyKindUI(); setErr('proof', ''); setErr('website', ''); });
    });
    updateUnits();
  }

  function offerKind() {
    var r = $('input[name="offer-kind"]:checked');
    return r ? r.value : 'private';
  }

  /* Privat oder Schule/Verleih: blendet Betriebs-Angaben ein und passt Beschriftungen an. */
  function applyKindUI() {
    var pro = offerKind() === 'pro';
    $('#sect-pro').hidden = !pro;
    $('#proof-opt').hidden = !pro;
    $('#proof-hint').textContent = t(pro ? 'offer.proof.hint_pro' : 'offer.proof.hint');
    $('#lbl-name').textContent = t(pro ? 'offer.name.label_pro' : 'offer.name.label');
    $('#f-name').setAttribute('placeholder', t(pro ? 'offer.name.ph_pro' : 'offer.name.ph'));
  }

  function batRows() { return $$('#bat-rows .bat'); }

  function brandOptions(sel, keep) {
    sel.innerHTML = '';
    sel.appendChild(h('option', { value: '', text: t('offer.bat.pick_brand') }));
    CAT.brands.forEach(function (b) { sel.appendChild(h('option', { value: b.id, text: b.name })); });
    sel.appendChild(h('option', { value: CAT.OTHER, text: t('brand.other') }));
    sel.value = keep || '';
  }

  function modelOptions(sel, brandId, keep) {
    sel.innerHTML = '';
    sel.appendChild(h('option', { value: '', text: t('offer.bat.pick_model') }));
    var br = CAT.brand(brandId);
    if (br) {
      br.models.forEach(function (m) { sel.appendChild(h('option', { value: m.id, text: m.name })); });
      sel.appendChild(h('option', { value: CAT.OTHER, text: t('model.other') }));
    }
    sel.value = keep || '';
  }

  /* Eine Zeile pro Batterie: Marke, Modell (bei "Anderes" ein Namensfeld), Preise, Entfernen. */
  function addBatRow(item) {
    if (batRows().length >= MAX_BAT_ROWS) return null;
    var id = ++batSeq;
    var brandSel = h('select', { class: 'input', id: 'bb-' + id, 'data-f': 'brand' });
    var modelSel = h('select', { class: 'input', id: 'bm-' + id, 'data-f': 'model' });
    var otherInp = h('input', { class: 'input', type: 'text', id: 'bo-' + id, 'data-f': 'other', maxlength: '60', autocomplete: 'off', hidden: true });
    var day = h('input', { class: 'input', type: 'text', inputmode: 'decimal', id: 'pd-' + id, 'data-f': 'day', autocomplete: 'off' });
    var week = h('input', { class: 'input', type: 'text', inputmode: 'decimal', id: 'pw-' + id, 'data-f': 'week', autocomplete: 'off' });
    var rm = h('button', { type: 'button', class: 'btn btn-quiet btn-small bat-rm', 'data-f': 'remove', text: t('offer.bat.remove') });
    var pickBox = h('div', { class: 'bat-pick' }, brandSel, modelSel);
    var row = h('div', { class: 'bat' },
      pickBox,
      otherInp,
      h('div', { class: 'bat-prices' },
        h('div', { class: 'money' }, day, h('span', { 'data-unit': 'day' })),
        h('div', { class: 'money' }, week, h('span', { 'data-unit': 'week' })),
        rm));

    function sync() {
      var brand = brandSel.value;
      var isOtherBrand = brand === CAT.OTHER;
      var needName = isOtherBrand || modelSel.value === CAT.OTHER;
      modelSel.hidden = isOtherBrand;
      pickBox.classList.toggle('is-single', isOtherBrand);
      modelSel.disabled = !brand || isOtherBrand;
      otherInp.hidden = !needName;
      otherInp.setAttribute('placeholder', isOtherBrand ? t('offer.bat.other_ph') : t('offer.bat.other_name'));
      otherInp.setAttribute('aria-label', isOtherBrand ? t('offer.bat.other_name_brand') : t('offer.bat.other_name'));
    }
    brandSel.addEventListener('change', function () { modelOptions(modelSel, brandSel.value, ''); sync(); });
    modelSel.addEventListener('change', sync);
    rm.addEventListener('click', function () {
      row.remove();
      if (!batRows().length) addBatRow(null);
      $('#bat-add').disabled = batRows().length >= MAX_BAT_ROWS;
      setErr('batteries', '');
    });

    brandOptions(brandSel, item ? item.brand : '');
    modelOptions(modelSel, item ? item.brand : '', item && item.brand !== CAT.OTHER ? item.model : '');
    if (item && item.name) otherInp.value = item.name;
    if (item) {
      day.value = fmtNum(item.priceDay);
      week.value = fmtNum(item.priceWeek);
    }
    sync();
    $('#bat-rows').appendChild(row);
    labelBatRow(row);
    updateUnits();
    $('#bat-add').disabled = batRows().length >= MAX_BAT_ROWS;
    return row;
  }

  function labelBatRow(row) {
    var f = function (n) { return row.querySelector('[data-f="' + n + '"]'); };
    f('brand').setAttribute('aria-label', t('offer.bat.brand'));
    f('model').setAttribute('aria-label', t('offer.bat.model'));
    f('day').setAttribute('aria-label', t('offer.aria.day', { m: t('offer.bat.model') }));
    f('week').setAttribute('aria-label', t('offer.aria.week', { m: t('offer.bat.model') }));
    f('day').setAttribute('placeholder', t('offer.ph.day'));
    f('week').setAttribute('placeholder', t('offer.ph.week'));
    f('remove').textContent = t('offer.bat.remove');
  }

  /* Beschriftungen (sprachabhängig) neu setzen, Auswahl bleibt erhalten */
  function updateBatLabels() {
    batRows().forEach(function (row) {
      var f = function (n) { return row.querySelector('[data-f="' + n + '"]'); };
      var brand = f('brand').value, model = f('model').value;
      brandOptions(f('brand'), brand);
      modelOptions(f('model'), brand, model);
      var isOtherBrand = brand === CAT.OTHER;
      f('other').setAttribute('placeholder', isOtherBrand ? t('offer.bat.other_ph') : t('offer.bat.other_name'));
      f('other').setAttribute('aria-label', isOtherBrand ? t('offer.bat.other_name_brand') : t('offer.bat.other_name'));
      labelBatRow(row);
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

  function fmtNum(n) {
    if (!isNum(n)) return '';
    var s = String(n);
    return s;
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
    applyKindUI();
    updateUnits();
  }

  function fillOfferForm(l) {
    $('#f-name').value = l ? l.name : '';
    $('#f-currency').value = l ? l.currency : 'EUR';
    updateUnits();
    var kindRadio = $('input[name="offer-kind"][value="' + (l && l.kind === 'pro' ? 'pro' : 'private') + '"]');
    kindRadio.checked = true;
    $('#f-website').value = l ? l.website || '' : '';
    $('#f-hours').value = l ? l.openingHours || '' : '';
    $('#bat-rows').innerHTML = '';
    if (l && l.batteries.length) l.batteries.forEach(function (b) { addBatRow(b.brand ? b : Object.assign({ brand: 'foil-drive' }, b)); });
    else addBatRow(null);
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

    var kind = offerKind();
    var pro = kind === 'pro';

    // Reihenfolge wie im Formular, damit der erste Fehler oben fokussiert wird
    var batteries = [];
    var seen = {};
    var batErr = null;
    function batFail(msg, el) { if (!batErr) batErr = { msg: msg, el: el }; }
    batRows().forEach(function (row) {
      var f = function (n) { return row.querySelector('[data-f="' + n + '"]'); };
      var brand = f('brand').value;
      var model = brand === CAT.OTHER ? CAT.OTHER : f('model').value;
      var other = f('other').value.trim();
      var dRaw = f('day').value, wRaw = f('week').value;
      if (!brand && !model && !other && !dRaw.trim() && !wRaw.trim()) return;   // leere Zeile ignorieren
      if (!brand || !model) { batFail(t('offer.err.bat_pick'), !brand ? f('brand') : f('model')); return; }
      var needName = brand === CAT.OTHER || model === CAT.OTHER;
      if (needName && (other.length < 2 || other.length > 60)) { batFail(t('offer.err.bat_other'), f('other')); return; }
      var label = CAT.labelFor(brand, model, other);
      var d = parsePrice(dRaw), w = parsePrice(wRaw);
      if (d.error || w.error) { batFail(t('offer.err.bat_price', { m: label }), d.error ? f('day') : f('week')); return; }
      var dupKey = needName ? brand + '/' + model + '/' + other.toLowerCase() : brand + '/' + model;
      if (seen[dupKey]) { batFail(t('offer.err.bat_dup', { m: label }), f('brand')); return; }
      seen[dupKey] = true;
      var item = { brand: brand, model: model };
      if (needName) item.name = other;
      item.label = label;
      item.priceDay = d.value;
      item.priceWeek = w.value;
      batteries.push(item);
    });
    if (batErr) fail('batteries', batErr.msg, batErr.el);
    else if (!batteries.length) fail('batteries', t('offer.err.bat_none'), batRows()[0].querySelector('[data-f="brand"]'));

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

    var website = '', hours = '';
    if (pro) {
      website = normalizeProofUrl($('#f-website').value);
      if (!WEB_RE.test(website) || website.length > 300) fail('website', t('offer.err.website'), $('#f-website'));
      hours = $('#f-hours').value.trim();
      if (hours.length < 2 || hours.length > 300) fail('hours', t('offer.err.hours'), $('#f-hours'));
    }

    // Privat: Instagram/Facebook ist Pflicht. Schule/Verleih: Website genügt, ein Profil ist optional.
    var proof = normalizeProofUrl($('#f-proof').value);
    if (pro) {
      if (!$('#f-proof').value.trim()) proof = website;
      else if (!WEB_RE.test(proof) || proof.length > 300) fail('proof', t('offer.err.proof_pro'), $('#f-proof'));
    } else if (!PROOF_RE.test(proof) || proof.length > 300) fail('proof', t('offer.err.proof'), $('#f-proof'));

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
        kind: kind, website: website, openingHours: hours,
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

    $$('input[name="auth-mode"]').forEach(function (r) { r.addEventListener('change', function () { if (r.checked) setAuthMode(r.value); }); });
    $('#auth-forgot').addEventListener('click', function () { setAuthMode('forgot'); });
    $('#auth-form').addEventListener('submit', onAuthSubmit);

    $('#offer-form').addEventListener('submit', onOfferSubmit);
    $('#offer-delete').addEventListener('click', onDeleteClick);
    $('#btn-pick-search').addEventListener('click', pickSearch);
    $('#btn-pick-locate').addEventListener('click', pickLocate);
    $('#f-search').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); pickSearch(); } });
    $('#f-place').addEventListener('input', function () { pick.labelTouched = true; });
    bindFilters();

    // Fehlermeldungen verschwinden, sobald man das Feld anfasst
    [['f-name', 'name'], ['f-place', 'place'], ['f-wa', 'wa'], ['f-mail', 'mail'], ['f-notes', 'notes'],
     ['f-deposit', 'deposit'], ['f-proof', 'proof'], ['f-file', 'file'], ['f-website', 'website'], ['f-hours', 'hours']].forEach(function (p) {
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
      $('#report-link').href = 'mailto:' + CFG.contactEmail + '?subject=' + encodeURIComponent('Foil Battery Rental: report a listing');
    }

    if (PARTNERS) {
      $('#know-partner').hidden = false;
      $('#partner-note').hidden = false;
      $('#partner-note-icon').innerHTML = ICON.partner;
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
    renderFilters();
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
