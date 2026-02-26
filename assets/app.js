/* =============================================================
   Morning Briefing — Interactive Features
   • Reading progress bar
   • Table of contents
   • Reading time estimate
   • Section wrapping (alternating bands)
   • Text highlighting with notes (Supabase-backed)
   • Highlight confirmation toast
   • Quick-share section links
   • Section bookmarking
   • Enhanced notes panel
   • Focus mode
   ============================================================= */
(function () {
  'use strict';

  // ── Utilities ────────────────────────────────────────────────

  function getBriefingDate() {
    var m = window.location.pathname.match(/(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    m = document.title.match(/(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    var el = document.querySelector('.masthead-date');
    if (el) return el.textContent.trim();
    return 'unknown';
  }

  function formatRelativeTime(ts) {
    var now = Date.now();
    var diff = now - ts;
    var d = new Date(ts);
    var today = new Date();
    var sameDay = d.toDateString() === today.toDateString();
    var hours = d.getHours();
    var mins = d.getMinutes();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    var timeStr = hours + ':' + (mins < 10 ? '0' : '') + mins + ' ' + ampm;

    if (sameDay) return 'Today at ' + timeStr;
    var yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday at ' + timeStr;

    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ' at ' + timeStr;
  }

  // ── 1. Reading Progress Bar ──────────────────────────────────

  function initProgress() {
    var bar = document.createElement('div');
    bar.className = 'reading-progress';
    document.body.appendChild(bar);

    function update() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // ── 1a. Scroll Position Memory ─────────────────────────────

  function initScrollMemory() {
    var date = getBriefingDate();
    if (date === 'unknown') return;
    var key = 'scroll-pos-' + date;

    // Restore saved position after a brief layout delay
    var saved = parseInt(localStorage.getItem(key), 10);
    if (saved > 0) {
      setTimeout(function () { window.scrollTo(0, saved); }, 150);
    }

    // Save position on scroll (debounced)
    var timer = null;
    window.addEventListener('scroll', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        localStorage.setItem(key, String(Math.round(window.scrollY)));
      }, 400);
    }, { passive: true });
  }

  // ── 2. Reading Time ──────────────────────────────────────────

  function initReadingTime() {
    var content = document.querySelector('.content');
    if (!content) return;
    var text = content.textContent || '';
    var words = text.trim().split(/\s+/).length;
    var minutes = Math.ceil(words / 230);

    var meta = document.createElement('div');
    meta.className = 'reading-meta';
    meta.textContent = '~' + minutes + ' min read';

    var masthead = document.querySelector('.masthead');
    if (masthead) {
      var ruleBottom = masthead.querySelector('.masthead-rule-bottom');
      if (ruleBottom) {
        masthead.insertBefore(meta, ruleBottom);
      } else {
        masthead.appendChild(meta);
      }
    }
  }

  // ── 3. Section Wrapping ──────────────────────────────────────

  var briefingSections = [];

  function wrapSections() {
    var content = document.querySelector('.content');
    if (!content) return;

    var hrs = content.querySelectorAll(':scope > hr');
    if (hrs.length === 0) return;

    // Collect nodes between each hr into sections
    var groups = [];
    var currentGroup = [];
    var children = Array.prototype.slice.call(content.childNodes);

    children.forEach(function (node) {
      if (node.nodeType === 1 && node.tagName === 'HR') {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [];
        // Keep hr in the DOM for visual divider — but place before next section
        groups.push([node]);
      } else {
        currentGroup.push(node);
      }
    });
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    // Rebuild: wrap non-hr groups into section elements
    var altIndex = 0;
    content.innerHTML = '';
    groups.forEach(function (group) {
      // If this group is just an HR, re-append it
      if (group.length === 1 && group[0].nodeType === 1 && group[0].tagName === 'HR') {
        content.appendChild(group[0]);
        return;
      }

      var section = document.createElement('div');
      section.className = 'briefing-section';
      if (altIndex % 2 === 1) section.classList.add('alt');
      altIndex++;

      group.forEach(function (node) {
        section.appendChild(node);
      });
      content.appendChild(section);
      briefingSections.push(section);
    });
  }

  // ── 4. Table of Contents ─────────────────────────────────────

  function initTOC() {
    var content = document.querySelector('.content');
    if (!content) return;

    var headings = content.querySelectorAll('h2[id], h3[id]');
    if (headings.length < 3) return;

    // Button
    var navLinks = document.querySelector('.nav-links');
    var btn = document.createElement('a');
    btn.href = '#';
    btn.className = 'toc-toggle';
    btn.textContent = 'Contents';
    navLinks.appendChild(btn);

    // Panel
    var panel = document.createElement('nav');
    panel.className = 'toc-panel';
    var ul = document.createElement('ul');

    headings.forEach(function (h) {
      var li = document.createElement('li');
      li.className = h.tagName === 'H2' ? 'toc-h2' : 'toc-h3';
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent.replace(/[\u2606\u2605]/g, '').trim();
      a.addEventListener('click', function () {
        panel.classList.remove('open');
      });
      li.appendChild(a);
      ul.appendChild(li);
    });
    panel.appendChild(ul);

    var topNav = document.querySelector('.top-nav');
    topNav.parentNode.insertBefore(panel, topNav.nextSibling);

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      panel.classList.toggle('open');
    });

    document.addEventListener('click', function (e) {
      if (!panel.contains(e.target) && e.target !== btn) {
        panel.classList.remove('open');
      }
    });

    // Active-section tracking
    var links = ul.querySelectorAll('a');
    function updateActive() {
      var current = '';
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top <= 100) current = headings[i].id;
      }
      links.forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('href') === '#' + current);
      });
    }
    window.addEventListener('scroll', updateActive, { passive: true });
    updateActive();
  }

  // ── 5. Section Bookmarking ───────────────────────────────────

  var bookmarks = {};
  var bookmarkDate = '';

  function initBookmarks() {
    var content = document.querySelector('.content');
    if (!content) return;

    bookmarkDate = getBriefingDate();
    var storageKey = 'bookmarks-' + bookmarkDate;
    try { bookmarks = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch (e) { bookmarks = {}; }

    var headings = content.querySelectorAll('h2[id], h3[id]');
    headings.forEach(function (h) {

      var star = document.createElement('span');
      star.className = 'bookmark-star';
      star.textContent = '\u2606'; // empty star
      if (bookmarks[h.id]) {
        star.classList.add('bookmarked');
        star.textContent = '\u2605'; // filled star
        h.classList.add('bookmarked-heading');
      }

      star.addEventListener('click', function (e) {
        e.stopPropagation();
        if (bookmarks[h.id]) {
          delete bookmarks[h.id];
          star.classList.remove('bookmarked');
          star.textContent = '\u2606';
          h.classList.remove('bookmarked-heading');
        } else {
          bookmarks[h.id] = h.textContent.replace(/[\u2606\u2605]/g, '').trim();
          star.classList.add('bookmarked');
          star.textContent = '\u2605';
          h.classList.add('bookmarked-heading');
        }
        localStorage.setItem(storageKey, JSON.stringify(bookmarks));
      });

      // Append star after heading text
      h.appendChild(star);
    });
  }

  // ── 7. Focus Mode ────────────────────────────────────────────

  var focusActive = false;

  function initFocusMode() {
    if (briefingSections.length < 2) return;

    var navLinks = document.querySelector('.nav-links');
    var btn = document.createElement('a');
    btn.href = '#';
    btn.className = 'focus-toggle';
    btn.textContent = 'Focus';
    navLinks.appendChild(btn);

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      toggleFocus();
    });

    function toggleFocus() {
      focusActive = !focusActive;
      document.body.classList.toggle('focus-mode', focusActive);
      btn.classList.toggle('active', focusActive);
      if (focusActive) updateFocusedSection();
    }

    function updateFocusedSection() {
      if (!focusActive) return;
      // Use a threshold line near the top of the viewport (100px down).
      // The focused section is the last section whose top is above this line.
      // This matches how the TOC "active heading" tracking works.
      var threshold = 150;
      var best = briefingSections[0];
      for (var i = 0; i < briefingSections.length; i++) {
        if (briefingSections[i].getBoundingClientRect().top <= threshold) {
          best = briefingSections[i];
        }
      }
      briefingSections.forEach(function (sec) {
        sec.classList.toggle('section-focused', sec === best);
      });
    }

    window.addEventListener('scroll', function () {
      if (focusActive) requestAnimationFrame(updateFocusedSection);
    }, { passive: true });

    // Keyboard shortcut: F key
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.key === 'f' || e.key === 'F') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          toggleFocus();
        }
      }
    });
  }

  // ── 9. Back to Top ──────────────────────────────────────────

  function initBackToTop() {
    var btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '&#8593;';
    document.body.appendChild(btn);

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    function update() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var pct = h > 0 ? window.scrollY / h : 0;
      btn.classList.toggle('visible', pct > 0.15);
    }
    window.addEventListener('scroll', update, { passive: true });
    update();

    // Keyboard shortcut: T key
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.key === 't' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // ── 10. Keyboard Shortcuts Help ────────────────────────────

  function initKeyboardHelp() {
    var overlay = null;
    var shortcuts = [
      { keys: '1 \u2013 5', desc: 'Highlight selected text (1=Critical, 2=Lead, 3=Question, 4=Discussion, 5=Strategic)' },
      { keys: 'N', desc: 'Add note to last highlight' },
      { keys: 'Shift + N', desc: 'Toggle meeting notes view' },
      { keys: 'F', desc: 'Toggle focus mode' },
      { keys: 'T', desc: 'Scroll to top' },
      { keys: '?', desc: 'Show this help' },
      { keys: 'Esc', desc: 'Close panels & overlays' }
    ];

    function show() {
      if (overlay) { hide(); return; }
      overlay = document.createElement('div');
      overlay.className = 'shortcuts-overlay';

      var card = document.createElement('div');
      card.className = 'shortcuts-card';

      var h = document.createElement('h3');
      h.textContent = 'Keyboard shortcuts';
      card.appendChild(h);

      var dl = document.createElement('dl');
      dl.className = 'shortcuts-list';
      shortcuts.forEach(function (s) {
        var dt = document.createElement('dt');
        var kbd = document.createElement('kbd');
        kbd.textContent = s.keys;
        dt.appendChild(kbd);
        dl.appendChild(dt);
        var dd = document.createElement('dd');
        dd.textContent = s.desc;
        dl.appendChild(dd);
      });
      card.appendChild(dl);

      var closeBtn = document.createElement('button');
      closeBtn.className = 'shortcuts-close';
      closeBtn.textContent = 'Done';
      closeBtn.addEventListener('click', hide);
      card.appendChild(closeBtn);

      overlay.appendChild(card);
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) hide();
      });
      document.body.appendChild(overlay);
    }

    function hide() {
      if (overlay) { overlay.remove(); overlay = null; }
    }

    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        show();
      }
      if (e.key === 'Escape') {
        if (overlay) { hide(); return; }
        var notesOv = document.querySelector('.notes-overlay');
        if (notesOv) { notesOv.remove(); return; }
        var toc = document.querySelector('.toc-panel.open');
        if (toc) toc.classList.remove('open');
      }
    });
  }

  // ── 11. Previous / Next Briefing Navigation ────────────────

  function initPrevNext() {
    var currentDate = getBriefingDate();
    if (currentDate === 'unknown') return;

    var inBriefingsDir = window.location.pathname.indexOf('/briefings/') !== -1;
    var rootPath = inBriefingsDir ? '../' : '';

    fetch(rootPath + 'assets/search-index.json')
      .then(function (r) { return r.json(); })
      .then(function (index) {
        var dates = index.map(function (e) { return e.date; }).sort();
        var idx = dates.indexOf(currentDate);
        if (idx === -1) return;

        var prev = idx > 0 ? dates[idx - 1] : null;
        var next = idx < dates.length - 1 ? dates[idx + 1] : null;
        if (!prev && !next) return;

        var nav = document.createElement('nav');
        nav.className = 'briefing-nav';

        if (prev) {
          var pa = document.createElement('a');
          pa.href = rootPath + 'briefings/' + prev + '.html';
          pa.className = 'briefing-nav-prev';
          pa.innerHTML = '&#8592; ' + fmtNavDate(prev);
          nav.appendChild(pa);
        } else {
          nav.appendChild(document.createElement('span'));
        }

        if (next) {
          var na = document.createElement('a');
          na.href = rootPath + 'briefings/' + next + '.html';
          na.className = 'briefing-nav-next';
          na.innerHTML = fmtNavDate(next) + ' &#8594;';
          nav.appendChild(na);
        }

        var footer = document.querySelector('.site-footer');
        if (footer) footer.parentNode.insertBefore(nav, footer);
      })
      .catch(function () { /* search index not available */ });
  }

  function fmtNavDate(d) {
    var p = d.split('-');
    var dt = new Date(+p[0], +p[1] - 1, +p[2]);
    var m = ['January','February','March','April','May','June',
             'July','August','September','October','November','December'];
    return m[dt.getMonth()] + ' ' + dt.getDate();
  }

  // ── 12. TOC Enhancements (read times, read tracking) ──────

  function initTOCEnhancements() {
    var panel = document.querySelector('.toc-panel');
    if (!panel) return;
    var content = document.querySelector('.content');
    if (!content) return;

    var tocLinks = panel.querySelectorAll('a');

    // --- Per-section reading time (h2 entries only) ---
    tocLinks.forEach(function (link) {
      var li = link.parentNode;
      if (!li.classList.contains('toc-h2')) return;

      var hId = link.getAttribute('href').replace('#', '');
      var heading = document.getElementById(hId);
      if (!heading) return;

      // Count words in the section that contains this heading
      var section = heading.closest('.briefing-section');
      if (!section) return;

      var words = (section.textContent || '').trim().split(/\s+/).length;
      if (words > 30) {
        var mins = Math.ceil(words / 230);
        var badge = document.createElement('span');
        badge.className = 'toc-time';
        badge.textContent = mins + 'm';
        link.appendChild(badge);
      }
    });

    // --- Section read-through tracking (cumulative — once read, stays read) ---
    function updateRead() {
      tocLinks.forEach(function (link) {
        if (link.classList.contains('toc-read')) return; // already marked
        var hId = link.getAttribute('href').replace('#', '');
        var heading = document.getElementById(hId);
        if (!heading) return;
        var rect = heading.getBoundingClientRect();
        if (rect.bottom < 0) link.classList.add('toc-read');
      });
    }
    window.addEventListener('scroll', updateRead, { passive: true });
    updateRead();
  }

  // ── 13. TOC Highlight Count Badges ─────────────────────────

  function updateTOCBadges() {
    var panel = document.querySelector('.toc-panel');
    if (!panel) return;

    panel.querySelectorAll('a').forEach(function (link) {
      var hId = link.getAttribute('href').replace('#', '');
      var heading = document.getElementById(hId);
      if (!heading) return;

      // Count highlights from this heading to the next heading of same or higher level
      var count = 0;
      var level = parseInt(heading.tagName.charAt(1), 10);
      var el = heading.nextElementSibling;
      while (el) {
        if (/^H[23]$/.test(el.tagName) && parseInt(el.tagName.charAt(1), 10) <= level) break;
        if (el.querySelectorAll) count += el.querySelectorAll('.user-highlight').length;
        el = el.nextElementSibling;
      }

      var badge = link.querySelector('.toc-hl-count');
      if (count > 0) {
        if (!badge) { badge = document.createElement('span'); badge.className = 'toc-hl-count'; link.appendChild(badge); }
        badge.textContent = count;
      } else if (badge) {
        badge.remove();
      }
    });
  }

  // ── 8. Highlighting + Notes ──────────────────────────────────

  // Color system constants
  var COLORS = {
    yellow: { label: 'Critical Point', key: '1', tip: 'Key facts & major developments' },
    green:  { label: 'Writing Lead',   key: '2', tip: 'Potential article topic' },
    blue:   { label: 'Question',       key: '3', tip: 'Needs investigation or follow-up' },
    red:    { label: 'Discussion',     key: '4', tip: 'Raise in editorial meeting' },
    purple: { label: 'Strategic',      key: '5', tip: 'Broader political significance' }
  };
  var COLOR_NAMES = ['yellow', 'green', 'blue', 'red', 'purple'];

  function initHighlighter() {
    var content = document.querySelector('.content');
    if (!content) return;

    var auth = window.briefingAuth || {};
    var sb = auth.supabase;
    var useSupabase = auth.authEnabled && sb && auth.user;
    var briefingDate = getBriefingDate();

    // In-memory cache of highlights for current page
    var highlightsCache = [];
    var storageKey = 'highlights-' + briefingDate;

    // --- Storage layer (Supabase or localStorage) ---

    function loadFromDB() {
      if (useSupabase) {
        return sb
          .from('highlights')
          .select('*')
          .eq('user_id', auth.user.id)
          .eq('briefing_date', briefingDate)
          .order('created_at', { ascending: true })
          .then(function (res) {
            highlightsCache = (res.data || []).map(function (row) {
              return {
                id: row.id,
                text: row.text,
                sectionId: row.section_id,
                sectionTitle: row.section_title,
                ts: new Date(row.created_at).getTime(),
                annotation: row.annotation || '',
                color: row.color || 'yellow'
              };
            });
            return highlightsCache;
          });
      }
      // localStorage fallback
      try {
        highlightsCache = JSON.parse(localStorage.getItem(storageKey)) || [];
      } catch (e) { highlightsCache = []; }
      return Promise.resolve(highlightsCache);
    }

    function saveToLocal() {
      localStorage.setItem(storageKey, JSON.stringify(highlightsCache));
    }

    function insertHL(hl) {
      if (useSupabase) {
        return sb.from('highlights').insert({
          user_id: auth.user.id,
          briefing_date: briefingDate,
          text: hl.text,
          section_id: hl.sectionId || null,
          section_title: hl.sectionTitle || null,
          color: hl.color || 'yellow'
        }).select().single().then(function (res) {
          if (res.data) {
            hl.id = res.data.id;
            hl.ts = new Date(res.data.created_at).getTime();
            highlightsCache.push(hl);
          }
          return hl;
        });
      }
      // localStorage fallback
      hl.id = hl.id || ('hl-' + Date.now());
      hl.ts = hl.ts || Date.now();
      highlightsCache.push(hl);
      saveToLocal();
      return Promise.resolve(hl);
    }

    function deleteHL(hlId) {
      highlightsCache = highlightsCache.filter(function (h) { return h.id !== hlId; });
      if (useSupabase) {
        return sb.from('highlights').delete().eq('id', hlId);
      }
      saveToLocal();
      return Promise.resolve();
    }

    function clearAllHL() {
      var ids = highlightsCache.map(function (h) { return h.id; });
      highlightsCache = [];
      if (useSupabase) {
        if (ids.length === 0) return Promise.resolve();
        return sb.from('highlights').delete().in('id', ids);
      }
      saveToLocal();
      return Promise.resolve();
    }

    function updateAnnotation(hlId, text) {
      var hl = highlightsCache.find(function (h) { return h.id === hlId; });
      if (hl) hl.annotation = text;
      if (useSupabase) {
        return sb.from('highlights').update({ annotation: text }).eq('id', hlId)
          .then(function () {})
          .catch(function () {});
      }
      saveToLocal();
      return Promise.resolve();
    }

    function updateColor(hlId, newColor) {
      var hl = highlightsCache.find(function (h) { return h.id === hlId; });
      if (hl) hl.color = newColor;
      // Update DOM marks
      content.querySelectorAll('mark[data-hl-id="' + hlId + '"]').forEach(function (m) {
        m.dataset.hlColor = newColor;
      });
      if (useSupabase) {
        return sb.from('highlights').update({ color: newColor }).eq('id', hlId)
          .then(function () {})
          .catch(function () {});
      }
      saveToLocal();
      return Promise.resolve();
    }

    // --- Badge ---
    var navLinks = document.querySelector('.nav-links');
    var notesBtn = document.createElement('a');
    notesBtn.href = '#';
    notesBtn.className = 'notes-toggle';
    navLinks.appendChild(notesBtn);

    function updateBadge() {
      var n = highlightsCache.length;
      notesBtn.textContent = n ? 'Notes (' + n + ')' : 'Notes';
      updateTOCBadges();
    }

    // --- Toast notification ---

    var currentToast = null;
    var toastTimer = null;

    function showToastNotification(hl) {
      // Remove existing toast
      if (currentToast) {
        currentToast.remove();
        clearTimeout(toastTimer);
      }

      var toast = document.createElement('div');
      toast.className = 'hl-toast';

      var msg = document.createElement('span');
      msg.className = 'hl-toast-msg';
      msg.textContent = (COLORS[hl.color] ? COLORS[hl.color].label : 'Highlight') + ' saved';
      toast.appendChild(msg);

      var actions = document.createElement('div');
      actions.className = 'hl-toast-actions';

      var viewBtn = document.createElement('button');
      viewBtn.textContent = 'Notes';
      viewBtn.addEventListener('click', function () {
        dismissToast(toast);
        toggleNotesPanel();
      });
      actions.appendChild(viewBtn);

      var undoBtn = document.createElement('button');
      undoBtn.textContent = 'Undo';
      undoBtn.addEventListener('click', function () {
        dismissToast(toast);
        unwrapHighlight(hl.id);
        deleteHL(hl.id).then(function () { updateBadge(); });
      });
      actions.appendChild(undoBtn);

      toast.appendChild(actions);
      document.body.appendChild(toast);
      currentToast = toast;

      toastTimer = setTimeout(function () {
        dismissToast(toast);
      }, 4000);
    }

    function dismissToast(toast) {
      if (!toast || !toast.parentNode) return;
      toast.classList.add('removing');
      setTimeout(function () {
        if (toast.parentNode) toast.remove();
      }, 150);
      if (toast === currentToast) currentToast = null;
      clearTimeout(toastTimer);
    }

    // --- Tooltip (color picker) ---
    var tooltip = document.createElement('div');
    tooltip.className = 'highlight-tooltip';
    var tooltipHTML = '<div class="hl-color-picker">';
    COLOR_NAMES.forEach(function (c) {
      tooltipHTML += '<button class="hl-color-dot" data-color="' + c + '" '
        + 'aria-label="' + COLORS[c].label + '" '
        + 'data-tooltip="' + COLORS[c].label + ' (' + COLORS[c].key + ') — ' + COLORS[c].tip + '">'
        + '</button>';
    });
    tooltipHTML += '</div>';
    tooltip.innerHTML = tooltipHTML;
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);

    // Track last highlight for N-key note shortcut
    var lastHighlightId = null;
    var lastHLTimer = null;

    document.addEventListener('mouseup', function () {
      setTimeout(showTooltip, 10);
    });
    document.addEventListener('mousedown', function (e) {
      if (!tooltip.contains(e.target)) tooltip.style.display = 'none';
    });

    // Mobile: detect text selection via selectionchange
    var touchSelTimer = null;
    document.addEventListener('selectionchange', function () {
      if (!('ontouchstart' in window)) return;
      clearTimeout(touchSelTimer);
      touchSelTimer = setTimeout(showTooltip, 300);
    });
    document.addEventListener('touchstart', function (e) {
      if (!tooltip.contains(e.target)) tooltip.style.display = 'none';
    });

    function showTooltip() {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        tooltip.style.display = 'none';
        return;
      }
      var range = sel.getRangeAt(0);
      var ancestor = range.commonAncestorContainer;
      if (!content.contains(ancestor)) { tooltip.style.display = 'none'; return; }

      var el = ancestor.nodeType === 3 ? ancestor.parentNode : ancestor;
      if (el.closest && el.closest('.user-highlight')) { tooltip.style.display = 'none'; return; }

      var rect = range.getBoundingClientRect();
      tooltip.style.display = 'block';
      var tooltipTop = rect.top + window.scrollY - tooltip.offsetHeight - 8;
      if (tooltipTop < window.scrollY) {
        tooltipTop = rect.bottom + window.scrollY + 8;
      }
      tooltip.style.top = tooltipTop + 'px';
      var tooltipLeft = rect.left + window.scrollX + rect.width / 2 - tooltip.offsetWidth / 2;
      var maxLeft = document.documentElement.clientWidth - tooltip.offsetWidth - 8;
      tooltipLeft = Math.max(8, Math.min(tooltipLeft, maxLeft));
      tooltip.style.left = tooltipLeft + 'px';
    }

    // Reusable highlight creation
    function performHighlight(color) {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;

      var range = sel.getRangeAt(0);
      var text = sel.toString().trim();
      if (!text) return;

      var section = findSection(range.startContainer);
      var tempId = 'hl-' + Date.now();

      applyHighlight(range, tempId, color);
      sel.removeAllRanges();
      tooltip.style.display = 'none';

      var hl = { id: tempId, text: text, sectionId: section.id, sectionTitle: section.title, ts: Date.now(), annotation: '', color: color };
      insertHL(hl).then(function (saved) {
        if (saved.id !== tempId) {
          content.querySelectorAll('mark[data-hl-id="' + tempId + '"]').forEach(function (m) {
            m.dataset.hlId = saved.id;
          });
        }
        updateBadge();
        showToastNotification(saved);
        // Track for N-key note shortcut
        lastHighlightId = saved.id;
        clearTimeout(lastHLTimer);
        lastHLTimer = setTimeout(function () { lastHighlightId = null; }, 10000);
        // Refresh notes overlay if open
        var openOverlay = document.querySelector('.notes-overlay');
        if (openOverlay) { openOverlay.remove(); toggleNotesPanel(); }
      });
    }

    tooltip.addEventListener('mousedown', function (e) { e.preventDefault(); });
    tooltip.addEventListener('touchstart', function (e) { e.preventDefault(); });
    tooltip.addEventListener('click', function (e) {
      var dot = e.target.closest('.hl-color-dot');
      if (!dot) return;
      e.preventDefault();
      e.stopPropagation();
      performHighlight(dot.dataset.color);
    });

    // --- Apply / remove highlight marks ---

    function applyHighlight(range, hlId, color) {
      var nodes = textNodesInRange(range);
      nodes.forEach(function (info) {
        var tn = info.node, s = info.start, en = info.end;
        if (en < tn.length) tn.splitText(en);
        var target = s > 0 ? tn.splitText(s) : tn;
        var mark = document.createElement('mark');
        mark.className = 'user-highlight';
        mark.dataset.hlId = hlId;
        mark.dataset.hlColor = color || 'yellow';
        target.parentNode.insertBefore(mark, target);
        mark.appendChild(target);
      });
    }

    function textNodesInRange(range) {
      var root = range.commonAncestorContainer;
      if (root.nodeType === 3) root = root.parentNode;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var list = [], started = false;
      while (walker.nextNode()) {
        var n = walker.currentNode;
        if (n === range.startContainer) started = true;
        if (!started) continue;
        var s = n === range.startContainer ? range.startOffset : 0;
        var e = n === range.endContainer ? range.endOffset : n.length;
        if (e > s) list.push({ node: n, start: s, end: e });
        if (n === range.endContainer) break;
      }
      return list;
    }

    function unwrapHighlight(hlId) {
      content.querySelectorAll('mark[data-hl-id="' + hlId + '"]').forEach(function (m) {
        var p = m.parentNode;
        while (m.firstChild) p.insertBefore(m.firstChild, m);
        p.removeChild(m);
        p.normalize();
      });
    }

    // --- Section detection ---

    function findSection(node) {
      var el = node.nodeType === 3 ? node.parentNode : node;
      while (el && el !== content) {
        var prev = el.previousElementSibling;
        while (prev) {
          if (/^H[23]$/.test(prev.tagName) && prev.id) {
            return { id: prev.id, title: prev.textContent.replace(/[\u2606\u2605]/g, '').trim() };
          }
          prev = prev.previousElementSibling;
        }
        el = el.parentNode;
      }
      return { id: '', title: 'General' };
    }

    // --- Restore on load (from Supabase) ---

    function restore() {
      loadFromDB().then(function (arr) {
        arr.forEach(function (hl) { findAndWrap(hl.text, hl.id, hl.color); });
        updateBadge();
      });
    }

    function findAndWrap(text, hlId, color) {
      var walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
      var nodes = [], pieces = [];
      while (walker.nextNode()) {
        nodes.push(walker.currentNode);
        pieces.push(walker.currentNode.textContent);
      }
      var full = pieces.join('');
      var idx = full.indexOf(text);
      if (idx === -1) return;

      var charCount = 0, startNode, startOff, endNode, endOff;
      for (var i = 0; i < nodes.length; i++) {
        var len = nodes[i].length;
        if (!startNode && charCount + len > idx) {
          startNode = nodes[i];
          startOff = idx - charCount;
        }
        if (!endNode && charCount + len >= idx + text.length) {
          endNode = nodes[i];
          endOff = idx + text.length - charCount;
          break;
        }
        charCount += len;
      }
      if (!startNode || !endNode) return;

      var range = document.createRange();
      range.setStart(startNode, startOff);
      range.setEnd(endNode, endOff);
      applyHighlight(range, hlId, color);
    }

    restore();

    // --- Notes overlay (full-page meeting notes view) ---

    notesBtn.addEventListener('click', function (e) {
      e.preventDefault();
      toggleNotesPanel();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

      // Shift+N: toggle notes overlay
      if (e.key === 'N' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleNotesPanel();
        return;
      }

      // N: add note to last highlight
      if (e.key === 'n' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && lastHighlightId) {
        e.preventDefault();
        openNotesAndFocus(lastHighlightId);
        lastHighlightId = null;
        return;
      }

      // 1-5: highlight selected text with color
      if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        var sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.toString().trim()) {
          var colorIdx = parseInt(e.key, 10) - 1;
          if (colorIdx >= 0 && colorIdx < COLOR_NAMES.length) {
            e.preventDefault();
            performHighlight(COLOR_NAMES[colorIdx]);
          }
        }
      }

      // Escape: close notes overlay
      if (e.key === 'Escape') {
        var overlay = document.querySelector('.notes-overlay');
        if (overlay) { overlay.remove(); e.preventDefault(); }
      }
    });

    function openNotesAndFocus(hlId) {
      var existing = document.querySelector('.notes-overlay');
      if (!existing) toggleNotesPanel();
      // Wait for DOM render then focus the annotation field
      setTimeout(function () {
        var card = document.querySelector('.notes-card[data-hl-id="' + hlId + '"]');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          var addBtn = card.querySelector('.notes-card-add-note');
          if (addBtn) addBtn.click();
          var noteEl = card.querySelector('.notes-card-note');
          if (noteEl) noteEl.click();
        }
      }, 100);
    }

    // --- Document position helper (for sequential ordering) ---
    function getDocPosition(hlId) {
      var mark = content.querySelector('mark[data-hl-id="' + hlId + '"]');
      if (!mark) return Infinity;
      var rect = mark.getBoundingClientRect();
      return rect.top + window.scrollY;
    }

    function sortByDocOrder(arr) {
      var positions = {};
      arr.forEach(function (hl) { positions[hl.id] = getDocPosition(hl.id); });
      return arr.slice().sort(function (a, b) { return positions[a.id] - positions[b.id]; });
    }

    // --- Group helpers ---
    function groupBySection(highlights) {
      var sections = {};
      var order = [];
      highlights.forEach(function (h) {
        var key = h.sectionTitle || 'General';
        if (!sections[key]) {
          sections[key] = { id: h.sectionId, items: [] };
          order.push(key);
        }
        sections[key].items.push(h);
      });
      return { sections: sections, order: order };
    }

    function groupByColor(highlights) {
      var groups = {};
      COLOR_NAMES.forEach(function (c) { groups[c] = []; });
      highlights.forEach(function (h) {
        var c = h.color || 'yellow';
        if (!groups[c]) groups[c] = [];
        groups[c].push(h);
      });
      return groups;
    }

    function countByColor(highlights) {
      var counts = {};
      COLOR_NAMES.forEach(function (c) { counts[c] = 0; });
      highlights.forEach(function (h) { counts[h.color || 'yellow']++; });
      return counts;
    }

    // --- Build a highlight card ---
    function buildCard(hl, overlay) {
      var card = document.createElement('div');
      card.className = 'notes-card';
      card.dataset.hlId = hl.id;

      var colorBar = document.createElement('div');
      colorBar.className = 'notes-card-color';
      colorBar.dataset.color = hl.color || 'yellow';
      card.appendChild(colorBar);

      var body = document.createElement('div');
      body.className = 'notes-card-body';

      // Highlighted text
      var textEl = document.createElement('p');
      textEl.className = 'notes-card-text';
      textEl.textContent = hl.text;
      body.appendChild(textEl);

      // Annotation (always visible if exists)
      var annoContainer = document.createElement('div');
      annoContainer.className = 'notes-card-annotation-editor';
      renderAnnotation(annoContainer, hl);
      body.appendChild(annoContainer);

      // Meta line
      var meta = document.createElement('div');
      meta.className = 'notes-card-meta';

      var catLabel = document.createElement('span');
      catLabel.className = 'notes-card-category';
      catLabel.textContent = COLORS[hl.color || 'yellow'].label;
      catLabel.style.color = 'var(--hl-' + (hl.color || 'yellow') + '-solid)';
      meta.appendChild(catLabel);

      if (hl.sectionTitle) {
        var secLabel = document.createElement('span');
        secLabel.className = 'notes-card-section';
        secLabel.textContent = hl.sectionTitle;
        meta.appendChild(secLabel);
      }

      if (hl.ts) {
        var tsLabel = document.createElement('span');
        tsLabel.textContent = formatRelativeTime(hl.ts);
        meta.appendChild(tsLabel);
      }

      var jumpBtn = document.createElement('button');
      jumpBtn.className = 'notes-card-jump';
      jumpBtn.textContent = 'Jump to \u2192';
      jumpBtn.addEventListener('click', function () {
        overlay.remove();
        var mark = content.querySelector('mark[data-hl-id="' + hl.id + '"]');
        if (mark) {
          mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
          mark.classList.add('user-highlight-flash');
          setTimeout(function () { mark.classList.remove('user-highlight-flash'); }, 1200);
        }
      });
      meta.appendChild(jumpBtn);

      // Action buttons
      var actions = document.createElement('span');
      actions.className = 'notes-card-actions';

      var copyBtn = document.createElement('button');
      copyBtn.className = 'notes-card-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', function () {
        var copyText = hl.text;
        if (hl.annotation) copyText += '\n\nNote: ' + hl.annotation;
        navigator.clipboard.writeText(copyText).then(function () {
          copyBtn.textContent = 'Copied!';
          setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1200);
        });
      });
      actions.appendChild(copyBtn);

      var rmBtn = document.createElement('button');
      rmBtn.className = 'notes-card-btn';
      rmBtn.textContent = 'Remove';
      rmBtn.addEventListener('click', function () {
        unwrapHighlight(hl.id);
        deleteHL(hl.id).then(function () {
          updateBadge();
          overlay.remove();
          toggleNotesPanel();
        });
      });
      actions.appendChild(rmBtn);
      meta.appendChild(actions);

      body.appendChild(meta);
      card.appendChild(body);
      return card;
    }

    function renderAnnotation(container, hl) {
      container.innerHTML = '';
      if (hl.annotation) {
        var noteText = document.createElement('div');
        noteText.className = 'notes-card-note';
        noteText.textContent = hl.annotation;
        noteText.title = 'Click to edit';
        noteText.addEventListener('click', function () {
          showCardEditor(container, hl);
        });
        container.appendChild(noteText);
      } else {
        var addBtn = document.createElement('button');
        addBtn.className = 'notes-card-add-note';
        addBtn.textContent = 'Add note...';
        addBtn.addEventListener('click', function () {
          showCardEditor(container, hl);
        });
        container.appendChild(addBtn);
      }
    }

    function showCardEditor(container, hl) {
      container.innerHTML = '';
      var textarea = document.createElement('textarea');
      textarea.value = hl.annotation || '';
      textarea.placeholder = 'Add a note about this highlight...';
      container.appendChild(textarea);
      textarea.focus();

      var saveTimer = null;
      textarea.addEventListener('input', function () {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
          hl.annotation = textarea.value;
          updateAnnotation(hl.id, textarea.value);
        }, 500);
      });

      textarea.addEventListener('blur', function () {
        hl.annotation = textarea.value;
        updateAnnotation(hl.id, textarea.value);
        renderAnnotation(container, hl);
      });

      textarea.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          e.stopPropagation();
          textarea.blur();
        }
      });
    }

    // --- Export formats ---
    function buildMeetingExport(format, highlights) {
      var byColor = groupByColor(highlights);
      var counts = countByColor(highlights);
      var out = '';

      if (format === 'markdown') {
        out = '# Meeting Notes \u2014 Morning Briefing ' + briefingDate + '\n\n';
        out += '## Summary\n';
        COLOR_NAMES.forEach(function (c) {
          if (counts[c] > 0) out += '- ' + COLORS[c].label + ': ' + counts[c] + '\n';
        });
        out += '\n---\n\n';
        COLOR_NAMES.forEach(function (c) {
          if (byColor[c].length === 0) return;
          out += '## ' + COLORS[c].label + '\n\n';
          byColor[c].forEach(function (hl) {
            out += '> ' + hl.text + '\n';
            if (hl.annotation) out += '\n*Note: ' + hl.annotation + '*\n';
            if (hl.sectionTitle) out += '\n_Section: ' + hl.sectionTitle + '_\n';
            out += '\n';
          });
        });
      } else if (format === 'plaintext') {
        out = 'MEETING NOTES \u2014 MORNING BRIEFING ' + briefingDate + '\n';
        out += '='.repeat(50) + '\n\n';
        out += 'SUMMARY\n';
        COLOR_NAMES.forEach(function (c) {
          if (counts[c] > 0) out += '  ' + COLORS[c].label + ': ' + counts[c] + '\n';
        });
        out += '\n' + '-'.repeat(50) + '\n\n';
        COLOR_NAMES.forEach(function (c) {
          if (byColor[c].length === 0) return;
          out += COLORS[c].label.toUpperCase() + '\n';
          out += '-'.repeat(COLORS[c].label.length) + '\n\n';
          byColor[c].forEach(function (hl) {
            out += '  \u201c' + hl.text + '\u201d\n';
            if (hl.annotation) out += '  Note: ' + hl.annotation + '\n';
            if (hl.sectionTitle) out += '  Section: ' + hl.sectionTitle + '\n';
            out += '\n';
          });
        });
      } else if (format === 'html') {
        out = '<h1>Meeting Notes \u2014 Morning Briefing ' + briefingDate + '</h1>\n';
        out += '<h2>Summary</h2>\n<ul>\n';
        COLOR_NAMES.forEach(function (c) {
          if (counts[c] > 0) out += '<li><strong>' + COLORS[c].label + ':</strong> ' + counts[c] + '</li>\n';
        });
        out += '</ul>\n<hr>\n';
        COLOR_NAMES.forEach(function (c) {
          if (byColor[c].length === 0) return;
          out += '<h2>' + COLORS[c].label + '</h2>\n';
          byColor[c].forEach(function (hl) {
            out += '<blockquote>' + hl.text + '</blockquote>\n';
            if (hl.annotation) out += '<p><em>Note: ' + hl.annotation + '</em></p>\n';
            if (hl.sectionTitle) out += '<p style="color:#888;font-size:0.85em">Section: ' + hl.sectionTitle + '</p>\n';
          });
        });
      }
      return out;
    }

    function buildSequentialExport(format, highlights) {
      var grouped = groupBySection(highlights);
      var out = '';
      if (format === 'markdown') {
        out = '# Notes \u2014 Morning Briefing ' + briefingDate + '\n\n';
        grouped.order.forEach(function (sec) {
          out += '## ' + sec + '\n\n';
          grouped.sections[sec].items.forEach(function (hl) {
            out += '> ' + hl.text + '\n';
            out += '> _[' + COLORS[hl.color || 'yellow'].label + ']_\n';
            if (hl.annotation) out += '\n*Note: ' + hl.annotation + '*\n';
            out += '\n';
          });
        });
      } else if (format === 'plaintext') {
        out = 'NOTES \u2014 MORNING BRIEFING ' + briefingDate + '\n\n';
        grouped.order.forEach(function (sec) {
          out += sec.toUpperCase() + '\n' + '-'.repeat(sec.length) + '\n\n';
          grouped.sections[sec].items.forEach(function (hl) {
            out += '  \u201c' + hl.text + '\u201d\n';
            out += '  [' + COLORS[hl.color || 'yellow'].label + ']\n';
            if (hl.annotation) out += '  Note: ' + hl.annotation + '\n';
            out += '\n';
          });
        });
      }
      return out;
    }

    // --- Main notes overlay toggle ---
    function toggleNotesPanel() {
      var existing = document.querySelector('.notes-overlay');
      if (existing) { existing.remove(); return; }

      var highlights = sortByDocOrder(highlightsCache.slice());
      var currentFilter = 'all';
      var currentView = 'sequential';

      var overlay = document.createElement('div');
      overlay.className = 'notes-overlay';

      // --- Header ---
      var header = document.createElement('div');
      header.className = 'notes-overlay-header';

      var titleGroup = document.createElement('div');
      titleGroup.className = 'notes-overlay-title-group';
      var title = document.createElement('h2');
      title.className = 'notes-overlay-title';
      title.textContent = 'Meeting Notes';
      titleGroup.appendChild(title);
      var subtitle = document.createElement('span');
      subtitle.className = 'notes-overlay-subtitle';
      subtitle.textContent = 'Morning Briefing \u2014 ' + briefingDate;
      titleGroup.appendChild(subtitle);
      header.appendChild(titleGroup);

      var headerRight = document.createElement('div');
      headerRight.className = 'notes-overlay-header-right';
      var searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'notes-overlay-search';
      searchInput.placeholder = 'Search highlights...';
      headerRight.appendChild(searchInput);
      var closeBtn = document.createElement('button');
      closeBtn.className = 'notes-close';
      closeBtn.textContent = '\u00d7';
      closeBtn.addEventListener('click', function () { overlay.remove(); });
      headerRight.appendChild(closeBtn);
      header.appendChild(headerRight);
      overlay.appendChild(header);

      // --- Stats bar ---
      var counts = countByColor(highlightsCache);
      var statsBar = document.createElement('div');
      statsBar.className = 'notes-stats';
      COLOR_NAMES.forEach(function (c) {
        if (counts[c] === 0) return;
        var stat = document.createElement('div');
        stat.className = 'notes-stat';
        stat.title = COLORS[c].label + ' — ' + COLORS[c].tip;
        stat.style.cursor = 'default';
        var dot = document.createElement('span');
        dot.className = 'notes-stat-dot';
        dot.style.background = 'var(--hl-' + c + '-solid)';
        stat.appendChild(dot);
        var countSpan = document.createElement('span');
        countSpan.className = 'notes-stat-count';
        countSpan.textContent = counts[c];
        stat.appendChild(countSpan);
        var label = document.createElement('span');
        label.textContent = COLORS[c].label;
        stat.appendChild(label);
        statsBar.appendChild(stat);
      });
      var totalStat = document.createElement('div');
      totalStat.className = 'notes-stat';
      totalStat.style.marginLeft = 'auto';
      totalStat.innerHTML = '<span class="notes-stat-count">' + highlightsCache.length + '</span> total';
      statsBar.appendChild(totalStat);
      overlay.appendChild(statsBar);

      // --- Controls bar (filters + view toggle) ---
      var controls = document.createElement('div');
      controls.className = 'notes-controls';

      var allBtn = document.createElement('button');
      allBtn.className = 'notes-filter-btn active';
      allBtn.dataset.color = 'all';
      allBtn.textContent = 'All';
      controls.appendChild(allBtn);

      COLOR_NAMES.forEach(function (c) {
        if (counts[c] === 0) return;
        var btn = document.createElement('button');
        btn.className = 'notes-filter-btn';
        btn.dataset.color = c;
        btn.textContent = COLORS[c].label + ' (' + counts[c] + ')';
        controls.appendChild(btn);
      });

      var spacer = document.createElement('div');
      spacer.className = 'notes-controls-spacer';
      controls.appendChild(spacer);

      var viewToggle = document.createElement('div');
      viewToggle.className = 'notes-view-toggle';
      var seqBtn = document.createElement('button');
      seqBtn.className = 'notes-view-btn active';
      seqBtn.textContent = 'Sequential';
      seqBtn.dataset.view = 'sequential';
      viewToggle.appendChild(seqBtn);
      var catBtn = document.createElement('button');
      catBtn.className = 'notes-view-btn';
      catBtn.textContent = 'By Category';
      catBtn.dataset.view = 'category';
      viewToggle.appendChild(catBtn);
      controls.appendChild(viewToggle);
      overlay.appendChild(controls);

      // --- Content area ---
      var contentArea = document.createElement('div');
      contentArea.className = 'notes-content';
      var contentInner = document.createElement('div');
      contentInner.className = 'notes-content-inner';
      contentArea.appendChild(contentInner);
      overlay.appendChild(contentArea);

      // --- Actions bar ---
      var actions = document.createElement('div');
      actions.className = 'notes-actions';

      // Export dropdown
      var exportWrap = document.createElement('div');
      exportWrap.className = 'notes-export-wrap';
      exportWrap.style.position = 'relative';
      var exportBtn = document.createElement('button');
      exportBtn.textContent = 'Export \u25B4';
      exportBtn.style.background = 'var(--text)';
      exportBtn.style.color = 'var(--bg)';
      exportBtn.style.borderColor = 'var(--text)';
      exportWrap.appendChild(exportBtn);

      var exportMenu = document.createElement('div');
      exportMenu.className = 'notes-export-menu';

      var exportOptions = [
        { label: 'Markdown', fn: function () {
          return currentView === 'category'
            ? buildMeetingExport('markdown', highlights)
            : buildSequentialExport('markdown', highlights);
        } },
        { label: 'Plain Text', fn: function () {
          return currentView === 'category'
            ? buildMeetingExport('plaintext', highlights)
            : buildSequentialExport('plaintext', highlights);
        } }
      ];

      exportOptions.forEach(function (opt) {
        var optBtn = document.createElement('button');
        optBtn.textContent = opt.label;
        optBtn.addEventListener('click', function () {
          var text = opt.fn();
          navigator.clipboard.writeText(text).then(function () {
            exportBtn.textContent = 'Copied!';
            exportMenu.classList.remove('open');
            setTimeout(function () { exportBtn.textContent = 'Export \u25B4'; }, 1500);
          });
        });
        exportMenu.appendChild(optBtn);
      });
      exportWrap.appendChild(exportMenu);
      exportBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        exportMenu.classList.toggle('open');
      });
      actions.appendChild(exportWrap);

      // Print button
      var printBtn = document.createElement('button');
      printBtn.textContent = 'Print';
      printBtn.addEventListener('click', function () {
        document.body.classList.add('notes-print-mode');
        window.print();
        document.body.classList.remove('notes-print-mode');
      });
      actions.appendChild(printBtn);

      var clearBtn = document.createElement('button');
      clearBtn.className = 'notes-clear';
      clearBtn.textContent = 'Clear All';
      clearBtn.addEventListener('click', function () {
        if (!confirm('Remove all highlights from this briefing?')) return;
        highlightsCache.slice().forEach(function (hl) { unwrapHighlight(hl.id); });
        clearAllHL().then(function () {
          updateBadge();
          overlay.remove();
        });
      });
      actions.appendChild(clearBtn);
      overlay.appendChild(actions);

      // Close export menu on outside click
      overlay.addEventListener('click', function (e) {
        if (!exportWrap.contains(e.target)) exportMenu.classList.remove('open');
      });

      // --- Render content ---
      function renderContent() {
        contentInner.innerHTML = '';
        var filtered = highlights;
        if (currentFilter !== 'all') {
          filtered = highlights.filter(function (h) { return (h.color || 'yellow') === currentFilter; });
        }
        // Apply search filter
        var q = searchInput.value.toLowerCase().trim();
        if (q) {
          filtered = filtered.filter(function (h) {
            return h.text.toLowerCase().indexOf(q) !== -1
              || (h.annotation && h.annotation.toLowerCase().indexOf(q) !== -1)
              || (h.sectionTitle && h.sectionTitle.toLowerCase().indexOf(q) !== -1);
          });
        }

        if (filtered.length === 0) {
          var empty = document.createElement('p');
          empty.className = 'notes-empty';
          empty.textContent = highlights.length === 0
            ? 'No highlights yet. Select text in the briefing and click a color to highlight.'
            : 'No highlights match the current filter.';
          contentInner.appendChild(empty);
          return;
        }

        if (currentView === 'sequential') {
          // Grouped by section, in document order
          var grouped = groupBySection(filtered);
          grouped.order.forEach(function (sec) {
            var group = document.createElement('div');
            group.className = 'notes-section-group';

            var headerDiv = document.createElement('div');
            headerDiv.className = 'notes-section-group-header';
            var h4 = document.createElement('h4');
            h4.textContent = sec;
            headerDiv.appendChild(h4);
            var cnt = document.createElement('span');
            cnt.className = 'notes-section-count';
            cnt.textContent = grouped.sections[sec].items.length;
            headerDiv.appendChild(cnt);
            headerDiv.addEventListener('click', function () {
              var targetId = grouped.sections[sec].id;
              if (targetId) {
                overlay.remove();
                var heading = document.getElementById(targetId);
                if (heading) heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            });
            group.appendChild(headerDiv);

            grouped.sections[sec].items.forEach(function (hl) {
              group.appendChild(buildCard(hl, overlay));
            });
            contentInner.appendChild(group);
          });
        } else {
          // Grouped by color category
          var byColor = groupByColor(filtered);
          COLOR_NAMES.forEach(function (c) {
            if (byColor[c].length === 0) return;
            var catHeader = document.createElement('div');
            catHeader.className = 'notes-category-header';
            var dot = document.createElement('span');
            dot.className = 'notes-category-dot';
            dot.style.background = 'var(--hl-' + c + '-solid)';
            catHeader.appendChild(dot);
            var h3 = document.createElement('h3');
            h3.textContent = COLORS[c].label;
            catHeader.appendChild(h3);
            var cnt = document.createElement('span');
            cnt.className = 'notes-category-count';
            cnt.textContent = byColor[c].length + ' highlight' + (byColor[c].length === 1 ? '' : 's');
            catHeader.appendChild(cnt);
            contentInner.appendChild(catHeader);

            byColor[c].forEach(function (hl) {
              contentInner.appendChild(buildCard(hl, overlay));
            });
          });
        }
      }

      renderContent();

      // --- Filter click handlers ---
      controls.addEventListener('click', function (e) {
        var btn = e.target.closest('.notes-filter-btn');
        if (btn) {
          controls.querySelectorAll('.notes-filter-btn').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          currentFilter = btn.dataset.color;
          renderContent();
        }
        var viewBtn = e.target.closest('.notes-view-btn');
        if (viewBtn) {
          viewToggle.querySelectorAll('.notes-view-btn').forEach(function (b) { b.classList.remove('active'); });
          viewBtn.classList.add('active');
          currentView = viewBtn.dataset.view;
          renderContent();
        }
      });

      // Search input
      var searchTimer = null;
      searchInput.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(renderContent, 200);
      });

      document.body.appendChild(overlay);
      searchInput.focus();
    }
  }

  // ── Init ─────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot() {
    // Only run on briefing pages (not archive, search)
    if (!document.querySelector('.content h2')) return;

    // Section wrapping (must run first — before TOC reads headings)
    wrapSections();

    // Progress bar and TOC work without auth
    initProgress();
    initReadingTime();
    initTOC();
    initBookmarks();
    initFocusMode();
    initScrollMemory();
    initBackToTop();
    initKeyboardHelp();
    initTOCEnhancements();
    initPrevNext();

    var auth = window.briefingAuth;

    // Auth disabled or not present → init highlighter immediately with localStorage
    if (!auth || !auth.authEnabled) {
      initHighlighter();
      return;
    }

    // Auth enabled → wait for Supabase session to resolve
    auth.onReady = function () {
      initHighlighter();
    };
    // If auth already resolved (fast session restore)
    if (auth.ready && auth.approved) {
      initHighlighter();
    }
  }
})();
