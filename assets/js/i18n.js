/*
 * Texte der Seite (nur Englisch).
 * Statische Texte stehen im HTML mit data-i18n="schlüssel" (Text), data-i18n-html="schlüssel"
 * (Text mit einfachem, eigenem Markup) oder data-i18n-attr="attribut:schlüssel;…".
 * Dynamische Texte holt app.js mit I18N.t('schlüssel', {platzhalter: wert}).
 *
 * Die Seite ist bewusst nur Englisch. Die Mechanik (DICT, t(), apply()) bleibt, damit man
 * später eine Sprache ergänzen könnte.
 */
(function () {
  'use strict';


  var DICT = {};

  DICT.en = {
    'meta.title': 'Foil Battery Rental – borrow a foil assist battery at your destination',
    'meta.desc': 'Foil assist batteries can\'t go on a plane. Find verified owners, schools and rentals on this map who lend a battery at your holiday spot – Foil Drive, Manta, RIIFT, Duotone, Flite, Waydoo and more.',
    'skip': 'Skip to map',

    'brand.aria': 'Foil Battery Rental, home',
    'brand.sub': 'A Community Project ♥',
    'nav.aria': 'Main navigation',
    'nav.how': 'How it works',
    'nav.offer': 'Offer a battery',
    'nav.offer_s': 'Offer',
    'nav.mine': 'My listing',
    'nav.mine_s': 'Listing',
    'nav.login': 'Log in',
    'nav.logout': 'Log out',

    'demo.banner': '<strong>Demo mode.</strong> The locations are made up and your entries stay in this browser only. For live use, add Supabase to <code>assets/js/config.js</code>.',
    'demo.hide': 'Hide',

    'panel.aria': 'Search and results',
    'intro.h1': "Batteries can't fly. Borrow one when you get there.",
    'intro.p': 'Travellers without a battery find locals, schools and rentals with foil assist batteries here. You arrange contact, price and payment directly.',
    'search.label': 'Search destination',
    'search.ph': 'Search destination, e.g. Tarifa',
    'search.btn': 'Search',
    'search.empty': 'Enter a destination, e.g. Tarifa or Lake Garda.',
    'search.notfound': 'Place not found. Try city and country.',
    'search.error': 'Place search is unavailable right now. Try again in a moment or move the map yourself.',
    'filters.legend': 'Which battery do you need?',
    'filters.kind': 'Lender type',
    'kind.all': 'All',
    'kind.private': 'Private',
    'kind.pro': 'School / rental',
    'filters.brand': 'Brand',
    'filters.model': 'Model',
    'model.other': 'Other model',
    'brand.other': 'Other brand',
    'filters.reset': 'Reset filters',

    'list.loading': 'Loading locations …',
    'list.none_title': 'No locations yet',
    'list.none_p': 'Nobody is listed here yet. Be the first and offer your battery.',
    'list.nomatch_title': 'No matches',
    'list.nomatch_p': 'No location matches this selection yet. Remove a filter or check back later.',
    'list.empty_view': 'There is no location in this map area. Zoom out or search another destination.',
    'list.error_title': 'Locations not loaded',
    'list.error': 'Locations could not be loaded. Check your connection and try again.',
    'list.retry': 'Reload',
    'list.db_error': 'Could not connect to the database. Check the settings in config.js and reload the page.',
    'count.in_view_one': '{n} of {m} location in this map area',
    'count.in_view_other': '{n} of {m} locations in this map area',
    'count.all_one': '{m} location',
    'count.all_other': '{m} locations',
    'per_day': 'per day',
    'per_week': 'per week',
    'request': 'On request',
    'pin.from': 'from {p}',

    'map.aria': 'Map of rental locations',
    'map.label': 'Map',
    'map.locate': 'Jump to my location',
    'map.locate_title': 'My location',
    'view.list': 'Show list',
    'view.map': 'Show map',
    'geo.unsupported': 'Your browser cannot determine your location.',
    'geo.denied': 'Location unavailable. Allow access in your browser or search for a place.',

    'detail.close': 'Close',
    'detail.no_place': 'Place not specified',
    'detail.approx': 'The pin only shows the rough area. You agree the exact meeting point in chat.',
    'detail.caption': 'Batteries and prices',
    'detail.website': 'Website',
    'detail.hours_h': 'Opening hours',
    'detail.website_open': 'Open website',
    'detail.th_bat': 'Battery',
    'detail.th_day': 'per day',
    'detail.th_week': 'per week',
    'detail.price_hint': '– means: price on request.',
    'detail.deposit_h': 'Deposit',
    'detail.deposit_amount': 'Deposit: {amount}',
    'detail.deposit_none': 'No deposit',
    'detail.deposit_ask': 'Deposit: by arrangement',
    'detail.id_check': 'ID is shown at handover',
    'detail.notes_h': 'Notes from the lender',
    'detail.deal': 'You agree price, handover and payment directly. This site only connects you.',
    'contact.mine': 'This is your listing.',
    'contact.edit': 'Edit listing',
    'contact.demo': 'This is a sample entry without contact details.',
    'contact.login_p': 'Only logged-in members can see contact details. This keeps spam away and protects the lenders.',
    'contact.login_btn': 'Log in or sign up',
    'contact.wa': 'Message on WhatsApp',
    'contact.mail': 'Send an email',
    'contact.none': 'No contact details on file.',
    'msg.text': 'Hi {name}, I found your listing on the Foil Battery Rental map ({bats}). Is your battery free while I am there? I will be around from [date] to [date].',
    'msg.subject': 'Request: borrowing a foil assist battery',
    'login.hint_contact': 'Log in to see the contact details.',

    'info.title': 'How it works',
    'info.lead': 'Foil assist batteries are not allowed on planes. So travellers borrow one on site, from locals, schools and rentals at the spot. This site is only the map. Everything else you arrange directly.',
    'flow.travel.h': 'You are travelling',
    'flow.travel.1h': 'Find your destination.',
    'flow.travel.1p': 'Filter by the brand and battery model you need.',
    'flow.travel.2h': 'Log in and get in touch.',
    'flow.travel.2p': 'Logged-in members see the contact details. Write via WhatsApp or email.',
    'flow.travel.3h': 'Agree price, handover and deposit.',
    'flow.travel.3p': 'Payment and the deal happen entirely outside this site.',
    'flow.local.h': 'You have batteries to lend',
    'flow.local.1h': 'Create an account.',
    'flow.local.1p': 'Free. Email and password are enough.',
    'flow.local.2h': 'Submit your listing.',
    'flow.local.2p': 'Choose whether you lend privately or as a school / rental. Enter your batteries, location, contact and deposit. Private lenders add their Instagram or Facebook profile, schools and rentals their website and opening hours.',
    'flow.local.3h': 'Wait for approval.',
    'flow.local.3p': 'We review every listing briefly. You get an email, then your pin appears. You can pause or delete it any time.',
    'know.title': 'Good to know',
    'know.verified.dt': 'Verified lenders',
    'know.verified.dd': 'Every lender is checked briefly before approval: profile link or website and optionally an invoice. Only then does the pin appear on the map.',
    'know.deposit.dt': 'Deposit and handover',
    'know.deposit.dd': 'Each lender states a deposit and whether they want to see an ID. Still agree on the pick-up place and return time beforehand and take photos of the condition at handover.',
    'know.liability.dt': 'Liability',
    'know.liability.dd': 'This site only connects contacts. Lending and liability are solely between lender and borrower. Check beforehand whether your insurance applies.',
    'know.partner.dt': 'Partner badge',
    'know.partner.dd': 'Partners support this community project by linking to foilbattery.com on their website or social media. As a thank you they get the blue Partner badge, a slightly larger pin and are listed first. Want to become a partner? Add a link and send it to <a href="mailto:mail@foilbattery.com">mail@foilbattery.com</a>.',
    'partner.badge': 'Partner',
    'partner.title': 'Partner: supports this community project',
    'partner.detail': 'Supports this community project with a link.',
    'partner.more': 'What is a partner?',
    'partner.list_note': 'Partners are listed first.',
    'know.privacy.dt': 'Privacy',
    'know.privacy.dd': 'The pin can be shown roughly only. Contact details are visible to logged-in members only, and proofs only to us, only for the review.',

    'footer.tag': 'A community project by foil assist riders for foil assist riders. Operated by Ola Vibes S.L.',
    'footer.imprint': 'Legal notice',
    'footer.privacy': 'Privacy',
    'footer.terms': 'Terms of use',
    'footer.report': 'Report a listing',
    'footer.dedication': 'Idea and inspired by Tom Earl ♥',
    'footer.marks': 'Unofficial community project. Not affiliated with, endorsed or operated by any foil or battery manufacturer. All brand and model names belong to their respective owners.',
    'auth.close': 'Close',
    'auth.seg_aria': 'Log in or sign up',
    'auth.title.login': 'Log in',
    'auth.title.signup': 'Create account',
    'auth.title.recover': 'New password',
    'auth.title.forgot': 'Reset password',
    'auth.tab.login': 'Log in',
    'auth.tab.signup': 'Sign up',
    'auth.email': 'Email',
    'auth.pw': 'Password',
    'auth.pw_new': 'New password',
    'auth.pw_hint': 'At least 8 characters.',
    'auth.forgot': 'Forgot password?',
    'auth.terms': 'I understand: this site only connects contacts. Lending, payment and liability are solely between users, Ola Vibes S.L. is not involved. I accept the <a href="terms.html" target="_blank" rel="noopener">terms of use</a> and the <a href="datenschutz.html" target="_blank" rel="noopener">privacy policy</a>.',
    'auth.submit.login': 'Log in',
    'auth.submit.signup': 'Create account',
    'auth.submit.recover': 'Save password',
    'auth.submit.forgot': 'Send reset link',
    'auth.busy': 'One moment …',
    'auth.err.email': 'Enter a valid email address.',
    'auth.err.pw_login': 'Enter your password.',
    'auth.err.pw_short': 'The password needs at least 8 characters.',
    'auth.err.terms': 'Please accept the terms of use to create an account.',
    'auth.ok.login': 'Logged in.',
    'auth.ok.signup': 'Account created. Welcome!',
    'auth.confirm_sent': 'Almost done: we sent you an email. Click the link in it and you are in. Check your spam folder too.',
    'auth.reset_sent': 'If an account exists for this address, an email with a reset link is on its way.',
    'auth.pw_changed': 'Password changed.',
    'auth.logout_ok': 'Logged out.',
    'auth.intro.offer': 'Create a free account to offer your batteries. Already have one? Switch to "Log in".',

    'offer.title.new': 'Offer batteries',
    'offer.title.edit': 'Your listing',
    'offer.status.pending': 'Your application is being reviewed. You get an email as soon as it is approved. Your pin only appears on the map after that.',
    'offer.status.approved': 'Approved. Your listing is visible on the map.',
    'offer.status.approved_paused': 'Approved, but paused. Your listing is not shown on the map.',
    'offer.status.rejected': 'Your application was not approved.',
    'offer.status.reason': 'Reason: {reason}',
    'offer.status.rejected_hint': 'Adjust your listing and submit it again.',
    'offer.kind.h': 'Who is lending?',
    'offer.kind.private': 'Private',
    'offer.kind.private_hint': 'I lend my own batteries.',
    'offer.kind.pro': 'School / rental',
    'offer.kind.pro_hint': 'I run a foil school or a rental.',
    'offer.bat.h': 'Which batteries do you lend?',
    'offer.bat.hint': 'Choose brand and model. Prices are optional; without a price the map shows “On request”.',
    'offer.bat.brand': 'Brand',
    'offer.bat.model': 'Model',
    'offer.bat.other_name': 'Battery name',
    'offer.bat.other_name_brand': 'Brand and model',
    'offer.bat.other_ph': 'e.g. Fliteboard FoilAssist 2 kWh',
    'offer.bat.add': 'Add another battery',
    'offer.bat.remove': 'Remove',
    'offer.bat.pick_brand': 'Choose brand …',
    'offer.bat.pick_model': 'Choose model …',
    'offer.currency': 'Currency',
    'offer.ph.day': 'Day',
    'offer.ph.week': 'Week',
    'offer.unit.day': '{c} / day',
    'offer.unit.week': '{c} / week',
    'offer.aria.day': '{m}: price per day',
    'offer.aria.week': '{m}: price per week',
    'offer.err.bat_none': 'Choose brand and model for at least one battery.',
    'offer.err.bat_pick': 'Choose brand and model for every battery or remove the row.',
    'offer.err.bat_other': 'For “Other model” or “Other brand”, enter the battery name (2 to 60 characters).',
    'offer.err.bat_dup': '{m} is listed twice. Please use one row per model.',
    'offer.pro.h': 'Your business',
    'offer.pro.hint': 'Everyone can see these details.',
    'offer.pro.website': 'Website',
    'offer.pro.hours': 'Opening hours',
    'offer.pro.hours_ph': 'e.g. Mon–Sat 9 am – 6 pm, by arrangement in winter',
    'offer.err.website': 'Enter your website address, starting with https://.',
    'offer.err.hours': 'Enter your opening hours (2 to 300 characters).',
    'offer.err.bat_price': '{m}: Enter the price as a number, e.g. 45 or 45.50.',
    'offer.dep.h': 'Deposit',
    'offer.dep.hint': 'Leave empty = by arrangement. 0 = no deposit.',
    'offer.dep.amount': 'Deposit amount',
    'offer.dep.id': 'ID is shown at handover',
    'offer.dep.id_hint': 'The borrower shows their ID at handover. You do not keep it.',
    'offer.err.dep': 'Enter the deposit as a number between 0 and 99999.',
    'offer.loc.h': 'Where is it?',
    'offer.loc.hint': 'Search for a place or tap the map. Do not put the pin on your front door, the area is enough.',
    'offer.loc.search_label': 'Search place or address',
    'offer.loc.search_btn': 'Search',
    'offer.loc.locate': 'My location',
    'offer.loc.map_aria': 'Map for placing the pin',
    'offer.loc.empty': 'Enter a place or address.',
    'offer.loc.notfound': 'Place not found. Try city and country or tap the map directly.',
    'offer.loc.search_fail': 'Place search is unavailable right now. Tap the map to place the pin.',
    'offer.err.loc': 'Place your pin: search a place or tap the map.',
    'offer.pin_label': 'Your pin',
    'offer.pin_title': 'Your pin, draggable',
    'offer.place.label': 'Display name of the place',
    'offer.place.ph': 'e.g. Tarifa, Spain',
    'offer.err.place': 'The place name can have at most 120 characters.',
    'offer.approx.label': 'Show approximate location',
    'offer.approx.hint': 'On saving, the pin is moved randomly by 200 to 600 m. You share the exact meeting point in chat.',
    'offer.contact.h': 'How can people reach you?',
    'offer.contact.hint': 'At least one of the two. Only logged-in members see your contact details.',
    'offer.wa.label': 'WhatsApp number',
    'offer.err.wa': 'Enter it with country code, e.g. +49 170 1234567.',
    'offer.mail.label': 'Email',
    'offer.err.mail': 'That is not a valid email address.',
    'offer.err.contact': 'Enter at least WhatsApp or email, otherwise nobody can reach you.',
    'offer.proof.h': 'Verification',
    'offer.proof.hint': 'So we can see that you really have foil assist batteries. Only we see this, never other users.',
    'offer.proof.hint_pro': 'Schools and rentals: your website is enough. An Instagram or Facebook profile and an invoice help us with the review.',
    'offer.proof.url.label': 'Instagram or Facebook profile',
    'offer.proof.url.hint': 'Ideally a profile where you can be seen with your battery.',
    'offer.err.proof': 'Enter a link to your Instagram or Facebook profile, starting with https://.',
    'offer.err.proof_pro': 'That is not a valid link. It must start with https://.',
    'offer.proof.file.label': 'Invoice from the manufacturer or your dealer',
    'offer.opt': '(optional)',
    'offer.proof.file.hint': 'PDF, JPG or PNG, max. 5 MB. Your name must be on it. We delete the file after the review.',
    'offer.proof.file.current': 'Uploaded: {name}',
    'offer.err.file_type': 'Please choose a PDF, JPG or PNG file.',
    'offer.err.file_size': 'The file is larger than 5 MB.',
    'offer.err.upload': 'The invoice could not be uploaded. Try again or leave it out.',
    'offer.info.h': 'What should borrowers know?',
    'offer.name.label': 'Display name',
    'offer.name.label_pro': 'Name of the school / rental',
    'offer.name.ph': 'e.g. Lukas',
    'offer.name.ph_pro': 'e.g. Foil School Tarifa',
    'offer.err.name': 'Enter a name with 2 to 60 characters.',
    'offer.notes.label': 'Notes',
    'offer.notes.ph': 'Pick-up or delivery, times, charger, languages …',
    'offer.err.notes': 'The notes can have at most 600 characters.',
    'offer.active.label': 'Listing is visible',
    'offer.active.hint': 'Switch off while your batteries are not available.',
    'offer.delete': 'Delete listing',
    'offer.delete_confirm': 'Really delete? Click again',
    'offer.cancel': 'Cancel',
    'offer.save.new': 'Submit application',
    'offer.save.edit': 'Save',
    'offer.saving': 'Saving …',
    'offer.err.save': 'The listing could not be saved.',
    'toast.sent': 'Application sent. You get an email as soon as it has been reviewed.',
    'toast.saved': 'Listing saved.',
    'toast.saved_paused': 'Listing saved but paused: it is not shown on the map.',
    'toast.resubmitted': 'Listing sent again. It will be reviewed.',
    'toast.deleted': 'Listing deleted.',

    'err.invalid_login': 'Email or password is wrong.',
    'err.email_unconfirmed': 'Please confirm your email address first. You find the link in the email we sent you.',
    'err.already_registered': 'There is already an account for this email. Log in instead.',
    'err.weak_password': 'The password is too short or too weak. Use at least 8 characters.',
    'err.rate_limit': 'Too many attempts in a short time. Wait a few minutes and try again.',
    'err.network': 'No connection to the server. Check your internet and try again.',
    'err.rls': 'The listing could not be saved. Check your entries and log in again if needed.',
    'err.generic': 'That did not work ({m}).',
    'err.not_authenticated': 'Please log in first.'
  };

  /* ======================= Mechanik ======================= */

  var listeners = [];
  var lang = 'en';

  function t(key, params) {
    var s = DICT.en[key];
    if (s == null) return key;
    if (params) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) { return params[k] != null ? params[k] : m; });
    }
    return s;
  }

  /* Plural: t2('count.all', 3, {m: 3}) → 'count.all_other' */
  function t2(base, n, params) {
    return t(base + (n === 1 ? '_one' : '_other'), params);
  }

  function apply(root) {
    root = root || document;
    var i, el, nodes;
    nodes = root.querySelectorAll('[data-i18n]');
    for (i = 0; i < nodes.length; i++) { el = nodes[i]; el.textContent = t(el.getAttribute('data-i18n')); }
    nodes = root.querySelectorAll('[data-i18n-html]');
    for (i = 0; i < nodes.length; i++) { el = nodes[i]; el.innerHTML = t(el.getAttribute('data-i18n-html')); }
    nodes = root.querySelectorAll('[data-i18n-attr]');
    for (i = 0; i < nodes.length; i++) {
      el = nodes[i];
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var p = pair.split(':');
        if (p.length === 2) el.setAttribute(p[0].trim(), t(p[1].trim()));
      });
    }
  }

  window.I18N = {
    t: t,
    t2: t2,
    apply: apply,
    lang: function () { return lang; },
    locale: function () { return 'en-GB'; },
    onChange: function (fn) { listeners.push(fn); }
  };

  document.documentElement.lang = lang;
})();
