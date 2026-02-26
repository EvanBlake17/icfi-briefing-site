/* =============================================================
   Daily Briefing — Interactive Features
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

      var section = document.createElement('section');
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
      { keys: 'F', desc: 'Toggle focus mode' },
      { keys: 'Shift + N', desc: 'Toggle notes panel' },
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
        var notes = document.querySelector('.notes-panel');
        if (notes) notes.remove();
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
                annotation: row.annotation || ''
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
          section_title: hl.sectionTitle || null
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
          .catch(function () {
            // annotation column might not exist yet — silently ignore
          });
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
      msg.textContent = 'Highlight saved';
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

    // --- Tooltip ---
    var tooltip = document.createElement('div');
    tooltip.className = 'highlight-tooltip';
    tooltip.innerHTML = '<button class="hl-btn" aria-label="Highlight selection">Highlight</button>';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);

    var hlBtn = tooltip.querySelector('.hl-btn');

    document.addEventListener('mouseup', function () {
      setTimeout(showTooltip, 10);
    });
    document.addEventListener('mousedown', function (e) {
      if (!tooltip.contains(e.target)) tooltip.style.display = 'none';
    });

    // Mobile: detect text selection via selectionchange
    var touchSelTimer = null;
    document.addEventListener('selectionchange', function () {
      if (!('ontouchstart' in window)) return; // only on touch devices
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

      // Don't show on existing highlights
      var el = ancestor.nodeType === 3 ? ancestor.parentNode : ancestor;
      if (el.closest && el.closest('.user-highlight')) { tooltip.style.display = 'none'; return; }

      var rect = range.getBoundingClientRect();
      tooltip.style.display = 'block';
      var tooltipTop = rect.top + window.scrollY - tooltip.offsetHeight - 8;
      // If tooltip would go above viewport, place it below the selection instead
      if (tooltipTop < window.scrollY) {
        tooltipTop = rect.bottom + window.scrollY + 8;
      }
      tooltip.style.top = tooltipTop + 'px';
      // Clamp left position so tooltip stays within viewport
      var tooltipLeft = rect.left + window.scrollX + rect.width / 2 - tooltip.offsetWidth / 2;
      var maxLeft = document.documentElement.clientWidth - tooltip.offsetWidth - 8;
      tooltipLeft = Math.max(8, Math.min(tooltipLeft, maxLeft));
      tooltip.style.left = tooltipLeft + 'px';
    }

    hlBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
    hlBtn.addEventListener('touchstart', function (e) { e.preventDefault(); });
    hlBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;

      var range = sel.getRangeAt(0);
      var text = sel.toString().trim();
      if (!text) return;

      var section = findSection(range.startContainer);
      var tempId = 'hl-' + Date.now();

      applyHighlight(range, tempId);
      sel.removeAllRanges();
      tooltip.style.display = 'none';

      // Save
      var hl = { id: tempId, text: text, sectionId: section.id, sectionTitle: section.title, ts: Date.now(), annotation: '' };
      insertHL(hl).then(function (saved) {
        // Update the DOM mark elements with the real server ID
        if (saved.id !== tempId) {
          content.querySelectorAll('mark[data-hl-id="' + tempId + '"]').forEach(function (m) {
            m.dataset.hlId = saved.id;
          });
        }
        updateBadge();
        showToastNotification(saved);
        // Refresh notes panel if open
        var openPanel = document.querySelector('.notes-panel');
        if (openPanel) { openPanel.remove(); toggleNotesPanel(); }
      });
    });

    // Clicking a highlight no longer removes it — use the Notes panel instead.

    // --- Apply / remove highlight marks ---

    function applyHighlight(range, hlId) {
      var nodes = textNodesInRange(range);
      nodes.forEach(function (info) {
        var tn = info.node, s = info.start, en = info.end;
        if (en < tn.length) tn.splitText(en);
        var target = s > 0 ? tn.splitText(s) : tn;
        var mark = document.createElement('mark');
        mark.className = 'user-highlight';
        mark.dataset.hlId = hlId;
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
        arr.forEach(function (hl) { findAndWrap(hl.text, hl.id); });
        updateBadge();
      });
    }

    function findAndWrap(text, hlId) {
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
      applyHighlight(range, hlId);
    }

    restore();

    // --- Notes panel (enhanced) ---

    notesBtn.addEventListener('click', function (e) {
      e.preventDefault();
      toggleNotesPanel();
    });

    // Keyboard shortcut: Shift+N
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.key === 'N' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleNotesPanel();
      }
    });

    function toggleNotesPanel() {
      var existing = document.querySelector('.notes-panel');
      if (existing) { existing.remove(); return; }

      var highlights = highlightsCache.slice();
      var panel = document.createElement('div');
      panel.className = 'notes-panel';

      // Header
      var header = document.createElement('div');
      header.className = 'notes-header';
      var title = document.createElement('h3');
      title.textContent = 'Notes \u2014 ' + briefingDate;
      header.appendChild(title);
      var closeBtn = document.createElement('button');
      closeBtn.className = 'notes-close';
      closeBtn.textContent = '\u00d7';
      closeBtn.addEventListener('click', function () { panel.remove(); });
      header.appendChild(closeBtn);
      panel.appendChild(header);

      // Search/filter bar
      var searchWrap = document.createElement('div');
      searchWrap.className = 'notes-search';
      var searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = 'Filter highlights...';
      searchWrap.appendChild(searchInput);
      panel.appendChild(searchWrap);

      var body = document.createElement('div');
      body.className = 'notes-body';

      // Build bookmarks section at top (if any bookmarks exist)
      var bmKeys = Object.keys(bookmarks);
      if (bmKeys.length > 0) {
        var bmSection = document.createElement('div');
        bmSection.className = 'notes-bookmarks';
        var bmH4 = document.createElement('h4');
        bmH4.textContent = '\u2605 Bookmarks';
        bmSection.appendChild(bmH4);
        bmKeys.forEach(function (id) {
          var item = document.createElement('div');
          item.className = 'notes-bookmark-item';
          var a = document.createElement('a');
          a.textContent = bookmarks[id];
          a.addEventListener('click', function () {
            var heading = document.getElementById(id);
            if (heading) heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
          item.appendChild(a);
          bmSection.appendChild(item);
        });
        body.appendChild(bmSection);
      }

      if (!highlights.length) {
        var empty = document.createElement('p');
        empty.className = 'notes-empty';
        empty.textContent = 'No highlights yet. Select text in the briefing and click "Highlight."';
        body.appendChild(empty);
      } else {
        // Group by section
        var sections = {};
        var sectionOrder = [];
        highlights.forEach(function (h) {
          var key = h.sectionTitle || 'General';
          if (!sections[key]) {
            sections[key] = { id: h.sectionId, items: [] };
            sectionOrder.push(key);
          }
          sections[key].items.push(h);
        });

        sectionOrder.forEach(function (sec) {
          var div = document.createElement('div');
          div.className = 'notes-section';
          div.dataset.section = sec;

          // Section header with count and click-to-scroll
          var headerDiv = document.createElement('div');
          headerDiv.className = 'notes-section-header';
          var h4 = document.createElement('h4');
          h4.textContent = sec;
          headerDiv.appendChild(h4);
          var count = document.createElement('span');
          count.className = 'notes-count';
          count.textContent = sections[sec].items.length;
          headerDiv.appendChild(count);

          headerDiv.addEventListener('click', function () {
            var targetId = sections[sec].id;
            if (targetId) {
              var heading = document.getElementById(targetId);
              if (heading) heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
          div.appendChild(headerDiv);

          sections[sec].items.forEach(function (hl) {
            var item = document.createElement('div');
            item.className = 'notes-item';
            item.dataset.hlId = hl.id;

            // Timestamp
            if (hl.ts) {
              var tsDiv = document.createElement('div');
              tsDiv.className = 'notes-timestamp';
              tsDiv.textContent = formatRelativeTime(hl.ts);
              item.appendChild(tsDiv);
            }

            var p = document.createElement('p');
            p.textContent = hl.text;
            item.appendChild(p);

            // Annotation
            var annoDiv = document.createElement('div');
            annoDiv.className = 'notes-annotation';
            if (hl.annotation) {
              var annoText = document.createElement('div');
              annoText.className = 'notes-annotation-text';
              annoText.textContent = hl.annotation;
              annoText.title = 'Click to edit';
              annoText.addEventListener('click', function () {
                annoDiv.innerHTML = '';
                showAnnotationEditor(annoDiv, hl);
              });
              annoDiv.appendChild(annoText);
            } else {
              var addNote = document.createElement('button');
              addNote.className = 'notes-add-note';
              addNote.textContent = 'Add note...';
              addNote.addEventListener('click', function () {
                annoDiv.innerHTML = '';
                showAnnotationEditor(annoDiv, hl);
              });
              annoDiv.appendChild(addNote);
            }
            item.appendChild(annoDiv);

            // Copy button
            var copyBtn = document.createElement('button');
            copyBtn.className = 'notes-copy-hl';
            copyBtn.textContent = 'Copy';
            copyBtn.addEventListener('click', function () {
              var copyText = hl.text;
              if (hl.annotation) copyText += '\n\nNote: ' + hl.annotation;
              navigator.clipboard.writeText(copyText).then(function () {
                copyBtn.textContent = 'Copied!';
                setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1200);
              });
            });
            item.appendChild(copyBtn);

            var rm = document.createElement('button');
            rm.className = 'notes-remove';
            rm.textContent = 'Remove';
            rm.addEventListener('click', function () {
              unwrapHighlight(hl.id);
              deleteHL(hl.id).then(function () {
                item.remove();
                updateBadge();
                // Update count
                var remaining = div.querySelectorAll('.notes-item');
                if (remaining.length === 0) {
                  div.remove();
                } else {
                  count.textContent = remaining.length;
                }
                if (!body.querySelector('.notes-item')) {
                  body.innerHTML = '<p class="notes-empty">All highlights cleared.</p>';
                }
              });
            });
            item.appendChild(rm);
            div.appendChild(item);
          });
          body.appendChild(div);
        });
      }
      panel.appendChild(body);

      // Filter logic
      searchInput.addEventListener('input', function () {
        var q = searchInput.value.toLowerCase();
        var items = body.querySelectorAll('.notes-item');
        var secs = body.querySelectorAll('.notes-section');

        items.forEach(function (item) {
          var text = item.textContent.toLowerCase();
          item.style.display = (!q || text.indexOf(q) !== -1) ? '' : 'none';
        });

        // Show/hide section headers based on visible items
        secs.forEach(function (sec) {
          var visible = sec.querySelectorAll('.notes-item:not([style*="display: none"])');
          sec.style.display = visible.length > 0 ? '' : 'none';
        });

        // Bookmarks section
        var bmSec = body.querySelector('.notes-bookmarks');
        if (bmSec) {
          if (!q) { bmSec.style.display = ''; return; }
          var bmItems = bmSec.querySelectorAll('.notes-bookmark-item');
          var bmVisible = false;
          bmItems.forEach(function (item) {
            var match = item.textContent.toLowerCase().indexOf(q) !== -1;
            item.style.display = match ? '' : 'none';
            if (match) bmVisible = true;
          });
          bmSec.style.display = bmVisible ? '' : 'none';
        }
      });

      // Actions
      var actions = document.createElement('div');
      actions.className = 'notes-actions';

      // Export dropdown
      var exportWrap = document.createElement('div');
      exportWrap.className = 'notes-export-wrap';
      var exportBtn = document.createElement('button');
      exportBtn.className = 'notes-export-btn';
      exportBtn.textContent = 'Export \u25B4';
      exportWrap.appendChild(exportBtn);

      var exportMenu = document.createElement('div');
      exportMenu.className = 'notes-export-menu';

      function buildExport(format) {
        var out = '';
        if (format === 'markdown') {
          out = '# Notes \u2014 Daily Briefing ' + briefingDate + '\n\n';
          sectionOrder.forEach(function (sec) {
            out += '## ' + sec + '\n\n';
            sections[sec].items.forEach(function (hl) {
              out += '> ' + hl.text + '\n';
              if (hl.annotation) out += '\n*' + hl.annotation + '*\n';
              out += '\n';
            });
          });
        } else if (format === 'plaintext') {
          out = 'Notes \u2014 Daily Briefing ' + briefingDate + '\n\n';
          sectionOrder.forEach(function (sec) {
            out += sec.toUpperCase() + '\n' + '-'.repeat(sec.length) + '\n\n';
            sections[sec].items.forEach(function (hl) {
              out += '\u201c' + hl.text + '\u201d\n';
              if (hl.annotation) out += '  Note: ' + hl.annotation + '\n';
              out += '\n';
            });
          });
        } else if (format === 'html') {
          out = '<h1>Notes \u2014 Daily Briefing ' + briefingDate + '</h1>\n';
          sectionOrder.forEach(function (sec) {
            out += '<h2>' + sec + '</h2>\n';
            sections[sec].items.forEach(function (hl) {
              out += '<blockquote>' + hl.text + '</blockquote>\n';
              if (hl.annotation) out += '<p><em>' + hl.annotation + '</em></p>\n';
            });
          });
        }
        return out;
      }

      ['Markdown', 'Plain Text', 'HTML'].forEach(function (label) {
        var optBtn = document.createElement('button');
        optBtn.textContent = label;
        optBtn.addEventListener('click', function () {
          var format = label.toLowerCase().replace(' ', '');
          if (format === 'plaintext') format = 'plaintext';
          var text = buildExport(format);
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

      // Close menu on outside click
      document.addEventListener('click', function () {
        exportMenu.classList.remove('open');
      });

      actions.appendChild(exportWrap);

      var clearBtn = document.createElement('button');
      clearBtn.className = 'notes-clear';
      clearBtn.textContent = 'Clear All';
      clearBtn.addEventListener('click', function () {
        if (!confirm('Remove all highlights from this briefing?')) return;
        highlights.forEach(function (hl) { unwrapHighlight(hl.id); });
        clearAllHL().then(function () {
          updateBadge();
          panel.remove();
        });
      });
      actions.appendChild(clearBtn);
      panel.appendChild(actions);

      document.body.appendChild(panel);

      // Local references for export - need sections/sectionOrder in scope
      var sectionOrder = [];
      var sections = {};
      highlights.forEach(function (h) {
        var key = h.sectionTitle || 'General';
        if (!sections[key]) {
          sections[key] = { id: h.sectionId, items: [] };
          sectionOrder.push(key);
        }
        sections[key].items.push(h);
      });
    }

    function showAnnotationEditor(container, hl) {
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
        container.innerHTML = '';
        if (hl.annotation) {
          var annoText = document.createElement('div');
          annoText.className = 'notes-annotation-text';
          annoText.textContent = hl.annotation;
          annoText.title = 'Click to edit';
          annoText.addEventListener('click', function () {
            container.innerHTML = '';
            showAnnotationEditor(container, hl);
          });
          container.appendChild(annoText);
        } else {
          var addNote = document.createElement('button');
          addNote.className = 'notes-add-note';
          addNote.textContent = 'Add note...';
          addNote.addEventListener('click', function () {
            container.innerHTML = '';
            showAnnotationEditor(container, hl);
          });
          container.appendChild(addNote);
        }
      });
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
