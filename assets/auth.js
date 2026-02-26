/* =============================================================
   Morning Briefing — Auth Gate
   Manages Supabase authentication, login/signup UI, and
   approval-gated access to briefing content.

   Controlled by AUTH_ENABLED in config.js.
   When AUTH_ENABLED = false, this script does nothing and the
   site works without any login requirement.
   ============================================================= */
(function () {
  'use strict';

  // ── Bail out if auth is disabled ────────────────────────────

  if (typeof AUTH_ENABLED !== 'undefined' && !AUTH_ENABLED) {
    // No auth — mark as ready so app.js can proceed with localStorage
    window.briefingAuth = {
      supabase: null,
      ready: true,
      user: null,
      approved: true,   // treat as "approved" so highlights work
      authEnabled: false,
      onReady: null
    };
    // Hide the overlay element if it exists
    var ov = document.getElementById('auth-overlay');
    if (ov) ov.style.display = 'none';
    return;
  }

  // ── Supabase client ──────────────────────────────────────────

  var configured = (typeof SUPABASE_URL === 'string' &&
                    SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
                    SUPABASE_URL.indexOf('supabase') !== -1);

  var sb = configured
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  // Expose for use by app.js
  window.briefingAuth = {
    supabase: sb,
    ready: false,
    user: null,
    approved: false,
    authEnabled: true,
    onReady: null  // callback set by app.js
  };

  // ── DOM references ───────────────────────────────────────────

  var overlay = document.getElementById('auth-overlay');
  var loginForm = document.getElementById('auth-login');
  var signupForm = document.getElementById('auth-signup');
  var pendingMsg = document.getElementById('auth-pending');
  var authError = document.getElementById('auth-error');
  var pageWrapper = document.querySelector('.page-wrapper');

  var showSignupLink = document.getElementById('show-signup');
  var showLoginLink = document.getElementById('show-login');
  var showLoginFromPending = document.getElementById('show-login-pending');

  // ── UI helpers ───────────────────────────────────────────────

  function showOverlay(panel) {
    overlay.style.display = 'flex';
    pageWrapper.classList.add('auth-hidden');
    loginForm.style.display = panel === 'login' ? 'block' : 'none';
    signupForm.style.display = panel === 'signup' ? 'block' : 'none';
    pendingMsg.style.display = panel === 'pending' ? 'block' : 'none';
    clearError();
  }

  function hideOverlay() {
    overlay.style.display = 'none';
    pageWrapper.classList.remove('auth-hidden');
  }

  function showError(msg) {
    authError.textContent = msg;
    authError.style.display = 'block';
  }

  function clearError() {
    authError.textContent = '';
    authError.style.display = 'none';
  }

  function setLoading(form, loading) {
    var btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = loading;
      btn.textContent = loading ? 'Please wait...' : btn.dataset.label;
    }
  }

  // ── Navigation between forms ─────────────────────────────────

  showSignupLink.addEventListener('click', function (e) {
    e.preventDefault();
    showOverlay('signup');
  });

  showLoginLink.addEventListener('click', function (e) {
    e.preventDefault();
    showOverlay('login');
  });

  showLoginFromPending.addEventListener('click', function (e) {
    e.preventDefault();
    showOverlay('login');
  });

  // ── Login ────────────────────────────────────────────────────

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();
    setLoading(loginForm, true);

    var email = loginForm.querySelector('[name="email"]').value.trim();
    var password = loginForm.querySelector('[name="password"]').value;

    sb.auth.signInWithPassword({ email: email, password: password })
      .then(function (res) {
        setLoading(loginForm, false);
        if (res.error) {
          showError(res.error.message);
        }
        // onAuthStateChange handles the rest
      });
  });

  // ── Signup ───────────────────────────────────────────────────

  signupForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();

    var email = signupForm.querySelector('[name="email"]').value.trim();
    var password = signupForm.querySelector('[name="password"]').value;
    var confirm = signupForm.querySelector('[name="confirm"]').value;

    if (password !== confirm) {
      showError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      showError('Password must be at least 6 characters.');
      return;
    }

    setLoading(signupForm, true);

    sb.auth.signUp({ email: email, password: password })
      .then(function (res) {
        setLoading(signupForm, false);
        if (res.error) {
          showError(res.error.message);
        } else {
          // Show pending approval message
          showOverlay('pending');
        }
      });
  });

  // ── Logout button ────────────────────────────────────────────

  function addLogoutButton() {
    var nav = document.querySelector('.top-nav');
    if (!nav || document.getElementById('logout-btn')) return;

    var btn = document.createElement('button');
    btn.id = 'logout-btn';
    btn.textContent = 'Logout';
    btn.addEventListener('click', function () {
      sb.auth.signOut().then(function () {
        window.location.reload();
      });
    });
    nav.appendChild(btn);
  }

  function removeLogoutButton() {
    var btn = document.getElementById('logout-btn');
    if (btn) btn.remove();
  }

  // ── Check approval status ────────────────────────────────────

  function checkApproval(userId) {
    return sb
      .from('profiles')
      .select('approved')
      .eq('id', userId)
      .single()
      .then(function (res) {
        if (res.error) return false;
        return res.data && res.data.approved === true;
      });
  }

  // ── localStorage migration ───────────────────────────────────

  function migrateLocalStorage(userId) {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.startsWith('highlights-')) keys.push(key);
    }
    if (keys.length === 0) return Promise.resolve();

    var rows = [];
    keys.forEach(function (key) {
      try {
        var date = key.replace('highlights-', '');
        var arr = JSON.parse(localStorage.getItem(key));
        if (!Array.isArray(arr)) return;
        arr.forEach(function (hl) {
          rows.push({
            user_id: userId,
            briefing_date: date,
            text: hl.text,
            section_id: hl.sectionId || null,
            section_title: hl.sectionTitle || null
          });
        });
      } catch (e) { /* skip malformed */ }
    });

    if (rows.length === 0) return Promise.resolve();

    return sb.from('highlights').insert(rows).then(function (res) {
      if (!res.error) {
        // Clear migrated localStorage entries
        keys.forEach(function (key) { localStorage.removeItem(key); });
        console.log('Migrated ' + rows.length + ' highlights to Supabase');
      }
    });
  }

  // ── Auth state handler ───────────────────────────────────────

  var authVersion = 0;  // guards against stale async callbacks

  function handleAuth(session) {
    var myVersion = ++authVersion;

    if (!session || !session.user) {
      // Not logged in
      window.briefingAuth.ready = true;
      window.briefingAuth.user = null;
      window.briefingAuth.approved = false;
      removeLogoutButton();
      showOverlay('login');
      return;
    }

    var user = session.user;
    window.briefingAuth.user = user;

    checkApproval(user.id).then(function (approved) {
      // If a newer handleAuth call happened while we were waiting, bail out
      if (myVersion !== authVersion) return;

      window.briefingAuth.approved = approved;
      window.briefingAuth.ready = true;

      if (!approved) {
        removeLogoutButton();
        showOverlay('pending');
        return;
      }

      // Approved — show content
      hideOverlay();
      addLogoutButton();

      // Migrate any localStorage highlights
      migrateLocalStorage(user.id).then(function () {
        // Notify app.js that auth is ready
        if (typeof window.briefingAuth.onReady === 'function') {
          window.briefingAuth.onReady();
        }
      });
    });
  }

  // ── Initialize ───────────────────────────────────────────────

  if (!configured || !sb) {
    // Supabase not configured — show overlay with login form (non-functional)
    showOverlay('login');
    return;
  }

  // Listen for auth changes — this is the primary auth handler.
  // In Supabase v2, onAuthStateChange fires INITIAL_SESSION on
  // subscribe, so we don't need a separate getSession() call.
  sb.auth.onAuthStateChange(function (event, session) {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      handleAuth(session);
    } else if (event === 'SIGNED_OUT') {
      handleAuth(null);
    }
  });

})();
