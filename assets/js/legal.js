/* Impressum und Datenschutz: Sprachumschalter. Beide Sprachen stehen im HTML, CSS blendet eine aus. */
(function () {
  'use strict';
  var I18N = window.I18N;
  var btn = document.getElementById('legal-lang');
  var TITLES = {
    impressum: { de: 'Impressum – Foil Drive Battery Rental', en: 'Legal notice – Foil Drive Battery Rental' },
    datenschutz: { de: 'Datenschutz – Foil Drive Battery Rental', en: 'Privacy – Foil Drive Battery Rental' }
  };
  var page = /datenschutz/.test(location.pathname) ? 'datenschutz' : 'impressum';

  function refresh() {
    var other = I18N.other();
    btn.firstElementChild.textContent = other.toUpperCase();
    btn.setAttribute('lang', other);
    btn.setAttribute('aria-label', other === 'en' ? 'Switch to English' : 'Auf Deutsch wechseln');
    document.title = TITLES[page][I18N.lang()];
  }
  btn.addEventListener('click', function () { I18N.setLang(I18N.other()); });
  I18N.onChange(refresh);
  refresh();
})();
