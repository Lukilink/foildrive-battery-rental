/*
 * Katalog: Marken und Batteriemodelle.
 *
 * Hier pflegst du, welche Marken und Modelle auf der Seite zur Auswahl stehen. Neue Marke oder neues
 * Modell = einen Eintrag ergänzen, sonst nichts. Die Datenbank prüft nur das Format der IDs
 * (Kleinbuchstaben, Ziffern, Bindestrich), nicht die Liste.
 *
 * Regeln:
 *   - id: kurz, Kleinbuchstaben/Ziffern/Bindestrich, später NICHT mehr ändern (steckt in gespeicherten Angeboten).
 *   - name: so wird es angezeigt.
 *   - Jede Marke hat zusätzlich automatisch "Anderes Modell" (Freitext), und es gibt "Andere Marke" (Freitext).
 *   - Eine Marke ohne Modelle ist erlaubt, dann gibt es nur "Anderes Modell".
 */
(function () {
  'use strict';

  var BRANDS = [
    { id: 'foil-drive', name: 'Foil Drive', models: [
      { id: 'max-hp', name: 'Max HP' },
      { id: 'max-power', name: 'Max Power' },
      { id: 'max-sport', name: 'Max Sport' },
      { id: 'max-sport-396', name: 'Max Sport 396' },
      { id: 'max-travel', name: 'Max Travel' },
      { id: 'fm650', name: 'FM650' },
      { id: 'fm450', name: 'FM450' },
      { id: 'f860', name: 'F860' }
    ] },
    { id: 'manta', name: 'Manta Foils', models: [
      { id: 'takeoff-evo-endurance', name: 'TakeOff Evo Endurance' },
      { id: 'takeoff-evo-air', name: 'TakeOff Evo Air' }
    ] },
    { id: 'riift', name: 'RIIFT', models: [
      { id: 'power-pack', name: 'Power Pack' }
    ] },
    { id: 'duotone', name: 'Duotone', models: [
      { id: 'battery-7a', name: 'Battery 7A' }
    ] },
    { id: 'flow-customs', name: 'Flow Customs', models: [] },
    { id: 'flite', name: 'Flite', models: [
      { id: 'flitecell-nano', name: 'Flitecell Nano' },
      { id: 'flitecell-sport', name: 'Flitecell Sport' },
      { id: 'flitecell-explore', name: 'Flitecell Explore' }
    ] },
    { id: 'waydoo', name: 'Waydoo', models: [
      { id: 'foilboost', name: 'FoilBoost' },
      { id: 'flyer-one', name: 'Flyer ONE / ONE+' },
      { id: 'flyer-evo', name: 'Flyer EVO' }
    ] }
  ];

  var OTHER = 'other';
  var byId = {};
  BRANDS.forEach(function (b) {
    var models = {};
    b.models.forEach(function (m) { models[m.id] = m; });
    byId[b.id] = { brand: b, models: models };
  });

  /* Vollständiger Anzeigename einer gespeicherten Batterie.
     Bekannte Marke + bekanntes Modell: aus dem Katalog. Sonst der gespeicherte Name/Label. */
  function fullName(b) {
    var e = byId[b.brand];
    if (e && e.models[b.model]) return e.brand.name + ' ' + e.models[b.model].name;
    if (b.label) return b.label;
    if (b.name) return (e ? e.brand.name + ' ' : '') + b.name;
    // alte Einträge ohne Marke: waren immer Foil Drive
    var fd = byId['foil-drive'];
    if (!b.brand && fd.models[b.model]) return fd.brand.name + ' ' + fd.models[b.model].name;
    return String(b.model || '?');
  }

  window.BATTERY_CATALOG = {
    brands: BRANDS,
    OTHER: OTHER,
    brand: function (id) { return byId[id] ? byId[id].brand : null; },
    model: function (brandId, modelId) { return byId[brandId] ? (byId[brandId].models[modelId] || null) : null; },
    /* eindeutiger Schlüssel für Filter: "marke/modell" */
    key: function (b) { return (b.brand || 'foil-drive') + '/' + b.model; },
    fullName: fullName,
    /* Label, das beim Speichern mitgegeben wird (für Mails und Admin-Seite) */
    labelFor: function (brandId, modelId, otherName) {
      var e = byId[brandId];
      if (brandId === OTHER) return otherName;
      if (modelId === OTHER) return e.brand.name + ' ' + otherName;
      return e.brand.name + ' ' + e.models[modelId].name;
    }
  };
})();
