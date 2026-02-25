/* =============================================================
   Daily Briefing — Interactive Features
   • Reading progress bar
   • Table of contents
   • Text highlighting with notes (Supabase-backed)
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

  // ── 2. Table of Contents ─────────────────────────────────────

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
      a.textContent = h.textContent;
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

  // ── 3. Highlighting + Notes ──────────────────────────────────

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
                ts: new Date(row.created_at).getTime()
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
            highlightsCache.push(hl);
          }
          return hl;
        });
      }
      // localStorage fallback
      hl.id = hl.id || ('hl-' + Date.now());
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

    // --- Badge ---
    var navLinks = document.querySelector('.nav-links');
    var notesBtn = document.createElement('a');
    notesBtn.href = '#';
    notesBtn.className = 'notes-toggle';
    navLinks.appendChild(notesBtn);

    function updateBadge() {
      var n = highlightsCache.length;
      notesBtn.textContent = n ? 'Notes (' + n + ')' : 'Notes';
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
      tooltip.style.top = (rect.top + window.scrollY - tooltip.offsetHeight - 8) + 'px';
      tooltip.style.left = (rect.left + window.scrollX + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
    }

    hlBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
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

      // Save to Supabase
      var hl = { id: tempId, text: text, sectionId: section.id, sectionTitle: section.title, ts: Date.now() };
      insertHL(hl).then(function (saved) {
        // Update the DOM mark elements with the real server ID
        if (saved.id !== tempId) {
          content.querySelectorAll('mark[data-hl-id="' + tempId + '"]').forEach(function (m) {
            m.dataset.hlId = saved.id;
          });
        }
        updateBadge();
      });
    });

    // Click existing highlight → remove
    content.addEventListener('click', function (e) {
      var mark = e.target.closest('.user-highlight');
      if (!mark || !mark.dataset.hlId) return;
      var hlId = mark.dataset.hlId;
      unwrapHighlight(hlId);
      deleteHL(hlId).then(function () { updateBadge(); });
    });

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
            return { id: prev.id, title: prev.textContent };
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

    // --- Notes panel ---

    notesBtn.addEventListener('click', function (e) {
      e.preventDefault();
      toggleNotesPanel();
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

      if (!highlights.length) {
        var empty = document.createElement('p');
        empty.className = 'notes-empty';
        empty.textContent = 'No highlights yet. Select text in the briefing and click "Highlight."';
        panel.appendChild(empty);
      } else {
        // Group by section
        var sections = {};
        highlights.forEach(function (h) {
          var key = h.sectionTitle || 'General';
          if (!sections[key]) sections[key] = [];
          sections[key].push(h);
        });

        var body = document.createElement('div');
        body.className = 'notes-body';

        Object.keys(sections).forEach(function (sec) {
          var div = document.createElement('div');
          div.className = 'notes-section';
          var h4 = document.createElement('h4');
          h4.textContent = sec;
          div.appendChild(h4);

          sections[sec].forEach(function (hl) {
            var item = document.createElement('div');
            item.className = 'notes-item';
            var p = document.createElement('p');
            p.textContent = hl.text;
            item.appendChild(p);
            var rm = document.createElement('button');
            rm.className = 'notes-remove';
            rm.textContent = 'Remove';
            rm.addEventListener('click', function () {
              unwrapHighlight(hl.id);
              deleteHL(hl.id).then(function () {
                item.remove();
                updateBadge();
                if (!div.querySelector('.notes-item')) div.remove();
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
        panel.appendChild(body);

        // Actions
        var actions = document.createElement('div');
        actions.className = 'notes-actions';

        var copyBtn = document.createElement('button');
        copyBtn.className = 'notes-copy';
        copyBtn.textContent = 'Copy All';
        copyBtn.addEventListener('click', function () {
          var out = 'Notes \u2014 Daily Briefing ' + briefingDate + '\n\n';
          Object.keys(sections).forEach(function (sec) {
            out += '## ' + sec + '\n\n';
            sections[sec].forEach(function (hl) {
              out += '> ' + hl.text + '\n\n';
            });
          });
          navigator.clipboard.writeText(out).then(function () {
            copyBtn.textContent = 'Copied!';
            setTimeout(function () { copyBtn.textContent = 'Copy All'; }, 1500);
          });
        });
        actions.appendChild(copyBtn);

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
      }

      document.body.appendChild(panel);
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

    // Progress bar and TOC work without auth
    initProgress();
    initTOC();

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
