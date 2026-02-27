/* =============================================================
   Morning Briefing — Language Selector
   Supports: English (en), Deutsch (de)
   ============================================================= */
(function () {
  'use strict';

  var LANGUAGES = {
    en: { label: 'EN', name: 'English' },
    de: { label: 'DE', name: 'Deutsch' }
  };

  // German UI translations
  var DE = {
    'Latest': 'Aktuell',
    'Archive': 'Archiv',
    'Search': 'Suche',
    'Contents': 'Inhalt',
    'Focus': 'Fokus',
    'Logout': 'Abmelden',
    '\u25D0 Dark': '\u25D0 Dunkel',
    '\u25D1 Light': '\u25D1 Hell',
    'Morning Briefing': 'Morgen-Briefing',
    'Search across all briefings...': 'Alle Briefings durchsuchen\u2026',
    'Sign in to continue': 'Zum Fortfahren anmelden',
    'Email': 'E-Mail',
    'Password': 'Passwort',
    'Sign In': 'Anmelden',
    'Request access': 'Zugang anfragen',
    'Confirm Password': 'Passwort best\u00e4tigen',
    'Request Access': 'Zugang anfragen',
    'Back to sign in': 'Zur\u00fcck zur Anmeldung',
    'Account pending approval.': 'Konto wartet auf Genehmigung.',
    '\u2190 All Briefings': '\u2190 Alle Briefings',
    '\u2190 Latest': '\u2190 Aktuell',
    'min read': 'Min. Lesezeit',
    'Notes': 'Notizen',
    'Focus On': 'Fokus An',
    'Focus Off': 'Fokus Aus',
    'January': 'Januar', 'February': 'Februar', 'March': 'M\u00e4rz',
    'April': 'April', 'May': 'Mai', 'June': 'Juni',
    'July': 'Juli', 'August': 'August', 'September': 'September',
    'October': 'Oktober', 'November': 'November', 'December': 'Dezember',
    'Monday': 'Montag', 'Tuesday': 'Dienstag', 'Wednesday': 'Mittwoch',
    'Thursday': 'Donnerstag', 'Friday': 'Freitag',
    'Saturday': 'Samstag', 'Sunday': 'Sonntag',
    'World Events': 'Weltgeschehen',
    'Class Struggle': 'Klassenkampf',
    'Strategic Insights': 'Strategische Einblicke',
    'Daily': 'T\u00e4glich'
  };

  var TRANSLATIONS = { de: DE };

  // ── Core helpers ───────────────────────────────────────────────

  function getLang() {
    return localStorage.getItem('briefing-lang') || 'en';
  }

  function setLang(code) {
    localStorage.setItem('briefing-lang', code);
  }

  function t(key) {
    var lang = getLang();
    if (lang === 'en') return key;
    var dict = TRANSLATIONS[lang];
    return (dict && dict[key]) || key;
  }

  // ── Detect current briefing date ──────────────────────────────

  function getCurrentDate() {
    var m = window.location.pathname.match(/(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    m = document.title.match(/(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    return null;
  }

  // ── Redirect logic ────────────────────────────────────────────

  function redirectForLanguage(lang) {
    var path = window.location.pathname;
    var date = getCurrentDate();

    if (lang === 'de') {
      // English briefing page → German version
      if (date && path.match(/\/briefings\/\d{4}/) && !path.includes('/de/')) {
        var dePath = path.replace('/briefings/', '/briefings/de/');
        navigateIfExists(dePath);
        return;
      }
      // Index page → German index
      if (path.endsWith('/index.html') || path.match(/\/$/)) {
        if (date) {
          var deLatest = path.replace(/index\.html$/, '').replace(/\/$/, '') + '/briefings/de/' + date + '.html';
          // Try relative path too
          if (deLatest.startsWith('/')) deLatest = deLatest;
          navigateIfExists(deLatest);
          return;
        }
      }
    }

    if (lang === 'en' && path.includes('/de/')) {
      // German page → English version
      var enPath = path.replace('/briefings/de/', '/briefings/');
      window.location.href = enPath;
      return;
    }

    // Fallback: just reload to apply UI translations
    window.location.reload();
  }

  function navigateIfExists(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('HEAD', url, true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        window.location.href = url;
      } else {
        // German version doesn't exist — just reload with translated UI
        window.location.reload();
      }
    };
    xhr.onerror = function () {
      window.location.reload();
    };
    xhr.send();
  }

  // ── Translate static UI elements ──────────────────────────────

  function translateUI() {
    var lang = getLang();
    if (lang === 'en') return;

    document.documentElement.setAttribute('lang', lang);

    // Nav links
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      var text = a.textContent.trim();
      var translated = t(text);
      if (translated !== text) a.textContent = translated;
    });

    // Theme toggle
    document.querySelectorAll('#theme-toggle span').forEach(function (span) {
      span.textContent = t(span.textContent.trim());
    });

    // Reading tools panel tooltips
    document.querySelectorAll('#reading-tools .rt-btn[data-label]').forEach(function (btn) {
      var label = btn.getAttribute('data-label');
      var translated = t(label);
      if (translated !== label) {
        btn.setAttribute('data-label', translated);
        btn.setAttribute('aria-label', translated);
      }
    });

    // Masthead title
    var mTitle = document.querySelector('.masthead-title');
    if (mTitle && mTitle.textContent.trim() === 'Morning Briefing') {
      mTitle.textContent = t('Morning Briefing');
    }

    // Masthead date sub-label
    var mDate = document.querySelector('.masthead-date');
    if (mDate) {
      var dt = mDate.textContent.trim();
      if (dt === 'Archive') mDate.textContent = t('Archive');
      if (dt === 'Search') mDate.textContent = t('Search');
    }

    // Masthead tagline
    var tagline = document.querySelector('.masthead-tagline');
    if (tagline) {
      tagline.innerHTML = t('World Events') + ' &middot; ' + t('Class Struggle') + ' &middot; ' + t('Strategic Insights') + ' &middot; ' + t('Daily');
    }

    // Auth card
    var authH2 = document.querySelector('.auth-card h2');
    if (authH2) authH2.textContent = t('Morning Briefing');
    var authSub = document.querySelector('.auth-subtitle');
    if (authSub) authSub.textContent = t('Sign in to continue');

    // Footer links
    document.querySelectorAll('.site-footer a').forEach(function (a) {
      a.textContent = t(a.textContent.trim());
    });

    // Search placeholder
    var si = document.getElementById('search-input');
    if (si) si.placeholder = t('Search across all briefings...');

    // Archive month names and weekdays
    document.querySelectorAll('.archive-month-title').forEach(function (el) {
      el.textContent = t(el.textContent.trim());
    });
    document.querySelectorAll('.entry-weekday').forEach(function (el) {
      el.textContent = t(el.textContent.trim());
    });

    // Archive: rewrite briefing links to German versions
    document.querySelectorAll('.archive-list a').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href && href.includes('briefings/') && !href.includes('/de/')) {
        a.setAttribute('href', href.replace('briefings/', 'briefings/de/'));
      }
    });
  }

  // ── Build language selector ───────────────────────────────────

  function initLanguageSelector() {
    var nav = document.querySelector('.top-nav');
    if (!nav) return;

    var currentLang = getLang();
    var wrapper = document.createElement('div');
    wrapper.className = 'lang-selector';

    var select = document.createElement('select');
    select.id = 'lang-select';
    select.setAttribute('aria-label', 'Language');

    Object.keys(LANGUAGES).forEach(function (code) {
      var opt = document.createElement('option');
      opt.value = code;
      opt.textContent = LANGUAGES[code].label;
      if (code === currentLang) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', function () {
      var newLang = this.value;
      setLang(newLang);
      redirectForLanguage(newLang);
    });

    wrapper.appendChild(select);

    // Insert before theme toggle button
    var themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      nav.insertBefore(wrapper, themeToggle);
    } else {
      nav.appendChild(wrapper);
    }
  }

  // ── Boot ──────────────────────────────────────────────────────

  function init() {
    initLanguageSelector();
    translateUI();
  }

  // Expose for other modules
  window.briefingLang = { t: t, getLang: getLang, setLang: setLang };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
