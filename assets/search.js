/* =============================================================
   Daily Briefing — Search
   Loads search-index.json and performs client-side full-text search.
   ============================================================= */
(function () {
  'use strict';

  var input    = document.getElementById('search-input');
  var metaEl   = document.getElementById('search-meta');
  var listEl   = document.getElementById('search-results');
  var index    = null;
  var debounce = null;

  // Load index
  fetch('assets/search-index.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      index = data;
      metaEl.textContent = index.length + ' briefing' + (index.length === 1 ? '' : 's') + ' indexed';
      // If URL has ?q= param, search immediately
      var params = new URLSearchParams(window.location.search);
      var q = params.get('q');
      if (q) { input.value = q; search(q); }
    })
    .catch(function () {
      metaEl.textContent = 'Search index not yet built. Run publish.sh to generate it.';
    });

  input.addEventListener('input', function () {
    clearTimeout(debounce);
    debounce = setTimeout(function () { search(input.value); }, 200);
  });

  function search(query) {
    listEl.innerHTML = '';
    if (!index || !query || query.length < 2) {
      metaEl.textContent = index
        ? index.length + ' briefing' + (index.length === 1 ? '' : 's') + ' indexed'
        : '';
      return;
    }

    var q = query.toLowerCase();
    var results = [];

    index.forEach(function (entry) {
      var text = entry.text.toLowerCase();
      var pos = text.indexOf(q);
      if (pos === -1) return;

      // Count occurrences
      var count = 0;
      var p = 0;
      while ((p = text.indexOf(q, p)) !== -1) { count++; p += q.length; }

      // Build excerpt around first match
      var start = Math.max(0, pos - 80);
      var end = Math.min(entry.text.length, pos + query.length + 120);
      var excerpt = (start > 0 ? '...' : '') +
        entry.text.slice(start, end) +
        (end < entry.text.length ? '...' : '');

      results.push({ date: entry.date, excerpt: excerpt, count: count, pos: pos });
    });

    // Sort by date descending
    results.sort(function (a, b) { return b.date.localeCompare(a.date); });

    metaEl.textContent = results.length + ' result' + (results.length === 1 ? '' : 's') +
      ' for \u201c' + query + '\u201d';

    results.forEach(function (r) {
      var li = document.createElement('li');

      var dateDiv = document.createElement('div');
      dateDiv.className = 'search-result-date';
      var dateLink = document.createElement('a');
      dateLink.href = 'briefings/' + r.date + '.html';
      dateLink.textContent = r.date + ' (' + r.count + ' match' + (r.count === 1 ? '' : 'es') + ')';
      dateDiv.appendChild(dateLink);
      li.appendChild(dateDiv);

      var excDiv = document.createElement('div');
      excDiv.className = 'search-result-excerpt';
      excDiv.innerHTML = highlightExcerpt(r.excerpt, query);
      li.appendChild(excDiv);

      listEl.appendChild(li);
    });
  }

  function highlightExcerpt(text, query) {
    // Escape HTML then wrap matches in <mark>
    var escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var re = new RegExp('(' + escapeRegex(query).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + ')', 'gi');
    return escaped.replace(re, '<mark>$1</mark>');
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
})();
