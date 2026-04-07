// Role note:
  // This script injects shared partials (menu/footer) and owns global nav UX:
  // path normalization, active link state, home intro policy, and mobile drawer accessibility
  // Changes here affect every page

// Behavior:
  // Home refresh ALWAYS plays intro
  // Logo -> Home ALWAYS plays intro
  // Menu-item -> Home does NOT play intro


(function () {
  // ---------- constants ----------
  // Intent:
    // Use sessionStorage so the policy survives navigation within the same tab,
    // but resets naturally when the session ends. SKIP_HOME_INTRO is "skip once" by design
  const NAV_SOURCE_KEY = 'nav_source';          // 'logo' | 'menu'
  const SKIP_HOME_INTRO_KEY = 'skip_home_intro';// '1' means: next time landing home, skip once

  // ---------- single-flight guard (prevents double inject from Barba hooks) ----------
  let __loading = null;
  let __lastStamp = 0;

  async function inject(id, url) {
    const el = document.getElementById(id);
    if (!el) return;
    const res = await fetch(url, { cache: 'no-cache' });
    el.innerHTML = await res.text();
  }

  // ---------- helpers ----------
  function $(sel, root = document) { return root.querySelector(sel); }
  function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
  function getCheckbox() { return document.getElementById('openmenu'); }
  function getHamburgerLabel() {
    const scope = document.getElementById('site-menu');
    return scope ? scope.querySelector('.hamburger-icon') : document.querySelector('.hamburger-icon');
  }
  function setBodyMenuOpen(isOpen) { document.body.classList.toggle('menu-open', !!isOpen); }

  // Path strategy:
    // Base prefix is derived from runtime pathname to support pages in different folders
    // Do NOT hardcode '../' unless all pages share the same directory depth
  function getBase() {
    return location.pathname.includes('/components/') ? '../' : '';
  }

  function isHomePage() {
    // Prefer Barba namespace if present; fallback to pathname
    // Prefer Barba namespace to avoid false negatives when using client-side routing/swaps
    const ns = document
      .querySelector('main[data-barba="container"]')
      ?.getAttribute('data-barba-namespace');
    if (ns === 'home') return true;

    const p = location.pathname.replace(/\/$/, '');
    return p === '' || p === '/' || p.endsWith('/index.html');
  }

  // -------------------------------------------------
  // Normalize injected menu paths
  // BOTH <a href> and <img src> under #site-menu
  // menu.html uses relative href="index.html" and src="assets/img/logo.svg"
  // -------------------------------------------------
  // Safety rules:
    // Only rewrite relative internal paths. Never touch absolute URLs or special schemes
    // This prevents breaking external links and avoids double-prefixing
  function normalizeMenuPaths(base) {
    const scope = document.getElementById('site-menu');
    if (!scope) return;

    // Fix internal links
    scope.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;

      if (
        href.startsWith('http') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) return;

      if (href.startsWith('/')) return;

      if (base && !href.startsWith(base)) {
        const clean = href.replace(/^\.?\//, '');
        a.setAttribute('href', base + clean);
      }
    });

    // Fix images (logo, etc.)
    scope.querySelectorAll('img[src]').forEach(img => {
      const src = img.getAttribute('src');
      if (!src) return;

      if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('/')) return;

      if (base && !src.startsWith(base)) {
        const clean = src.replace(/^\.?\//, '');
        img.setAttribute('src', base + clean);
      }
    });

    // Mobile drawer logo is <img class="drawer-logo"> (no href) in menu.html. 
    const drawerLogo = scope.querySelector('.drawer-logo');
    if (drawerLogo && drawerLogo.dataset.boundHome !== '1') {
      drawerLogo.addEventListener('click', () => {
        sessionStorage.setItem(NAV_SOURCE_KEY, 'logo');
        sessionStorage.removeItem(SKIP_HOME_INTRO_KEY); // logo always plays
        window.location.href = base + 'index.html';
      });
      drawerLogo.dataset.boundHome = '1';
    }
  }

  // -------------------------------------------------
  // Active menu item (aria-current="page")
  // -------------------------------------------------
  // Accessibility:
    // Use aria-current="page" to indicate the current location for assistive tech
    // Visual styling can still be done via CSS [aria-current="page"] selectors
  function setActiveMenuLinks() {
    const container = document.getElementById('site-menu');
    if (!container) return;

    const links = container.querySelectorAll('a[href]');
    if (!links.length) return;

    const currentPath = location.pathname.replace(/\/$/, '');

    links.forEach(a => {
      a.removeAttribute('aria-current');

      const href = a.getAttribute('href');
      if (!href || href.startsWith('http')) return;

      const url = new URL(href, location.href);
      const linkPath = url.pathname.replace(/\/$/, '');

      if (linkPath === currentPath) {
        a.setAttribute('aria-current', 'page');
      }
    });
  }

  function updateFooterYear() {
    const el = document.getElementById('footerYear');
    if (el) el.textContent = new Date().getFullYear();
  }

  // -------------------------------------------------
  // Navigation source tracking:
  // - Click logo => NAV_SOURCE='logo'
  // - Click menu item => NAV_SOURCE='menu'
  // - If menu item goes to home => set SKIP_HOME_INTRO_KEY='1' (skip once)
  //
  // Desktop structure: logo is inside #hero-header .logo-container; menu items are inside .menu-items .menu-item a. 
  // -------------------------------------------------
  document.addEventListener('click', (e) => {
    const a = e.target.closest('#site-menu a[href]');
    if (!a) return;

    const inDesktopLogo = !!a.closest('#hero-header .logo-container');
    const inDesktopMenu = !!a.closest('#hero-header .menu-items');
    const inMobileMenu  = !!a.closest('.menu-links'); // drawer links list

    const href = a.getAttribute('href') || '';
    const url = new URL(href, location.href);
    const path = url.pathname.replace(/\/$/, '');
    const isHomeHref = path === '' || path === '/' || path.endsWith('/index.html');

    // Logo click
    if (inDesktopLogo) {
      sessionStorage.setItem(NAV_SOURCE_KEY, 'logo');
      sessionStorage.removeItem(SKIP_HOME_INTRO_KEY); // logo always plays
      return;
    }

    // Menu-item click (desktop or mobile links)
    if (inDesktopMenu || inMobileMenu) {
      sessionStorage.setItem(NAV_SOURCE_KEY, 'menu');
      if (isHomeHref) {
        // User clicked "Home" via menu item => do NOT play intro on the next home landing
        sessionStorage.setItem(SKIP_HOME_INTRO_KEY, '1');
      }
    }
  }, true);

  // -------------------------------------------------
  // Wait intro end by listening ONLY the last .menu-item (stagger-safe)
  // -------------------------------------------------
  function waitIntroEndOnLastItem(siteMenu) {
    const prefersReduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduce) return Promise.resolve();

    const items = siteMenu.querySelectorAll('#hero-header .menu-item');
    if (!items.length) return Promise.resolve();

    const lastItem = items[items.length - 1];

    return new Promise(resolve => {
      let done = false;

      const finish = () => {
        if (done) return;
        done = true;
        lastItem.removeEventListener('animationend', onEnd);
        lastItem.removeEventListener('animationcancel', onEnd);
        resolve();
      };

      const onEnd = (e) => {
        if (e.target !== lastItem) return;
        finish();
      };

      lastItem.addEventListener('animationend', onEnd);
      lastItem.addEventListener('animationcancel', onEnd);

      requestAnimationFrame(() => {
        const animName = getComputedStyle(lastItem).animationName;
        if (!animName || animName === 'none') finish();
      });
    });
  }

  // -------------------------------------------------
  // Intro play policy (your requirement):
  // - On HOME refresh => always play
  // - On logo -> home => always play
  // - On menu-item -> home => skip (once)
  // -------------------------------------------------
  async function maybePlayHomeIntro() {
    const siteMenu = document.getElementById('site-menu');
    if (!siteMenu) return;

    if (!isHomePage()) {
      siteMenu.classList.remove('menu-animate');
      return;
    }

    // Skip exactly once if coming via menu-item to home
    const skip = sessionStorage.getItem(SKIP_HOME_INTRO_KEY) === '1';
    const navSource = sessionStorage.getItem(NAV_SOURCE_KEY); // 'logo' | 'menu' | null

    if (skip && navSource === 'menu') {
      sessionStorage.removeItem(SKIP_HOME_INTRO_KEY);
      siteMenu.classList.remove('menu-animate');
      return;
    }

    // If page loads already in compact state, do NOT replay menu intro animation
    // (e.g. user refreshed while scrolled down)
    
    // UX guard:
      // If user refreshed while already scrolled (compact header state),
      // do NOT replay the intro animation (prevents distraction / visual jump)
    const trigger = 40;
    const html = document.documentElement;
    const alreadyCompact = html.classList.contains('hero-scrolled') || window.scrollY > trigger;
    if (alreadyCompact) {
      siteMenu.classList.remove('menu-animate');
      return;
    }

    // Otherwise play on home (refresh / direct / logo) when in HERO initial state
    const wait = waitIntroEndOnLastItem(siteMenu);
    siteMenu.classList.add('menu-animate');
    await wait;
    siteMenu.classList.remove('menu-animate');
  }

  // ---------- mobile overlay & focus management ----------
  let lastFocusedEl = null;

  // Structure normalization:
    // Ensure a stable drawer container for padding/scroll and focus trapping
    // We wrap existing pane children to avoid requiring strict markup in menu.html
  function ensureDrawerStructure() {
    const pane = $('.menu-pane');
    if (!pane) return null;

    let drawer = $('.menu-drawer', pane);
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.className = 'menu-drawer';
      while (pane.firstChild) drawer.appendChild(pane.firstChild);
      pane.appendChild(drawer);
    }

    pane.setAttribute('role', 'dialog');
    pane.setAttribute('aria-modal', 'true');
    drawer.setAttribute('role', 'document');
    drawer.setAttribute('aria-label', 'Main menu');

    return { pane, drawer };
  }

  function getTabbables(container) {
    return $$(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      container
    ).filter(el =>
      !el.hasAttribute('disabled') &&
      el.tabIndex !== -1 &&
      el.offsetParent !== null
    );
  }

  // Re-entrancy guard:
  // When toggling checkbox programmatically, suppress the change handler once
  // to avoid open/close loops and duplicate state transitions
  function openMenu(pane, drawer) {
    const cb = getCheckbox();
    if (cb && !cb.checked) {
      cb.dataset.suppressChange = '1';
      cb.checked = true;
    }

    pane.classList.add('is-open');
    drawer.classList.add('is-open');
    setBodyMenuOpen(true);

    // 只 toggle 一次
    document.documentElement.classList.add('menu-open');

    const label = getHamburgerLabel();
    label?.setAttribute('aria-expanded', 'true');

    lastFocusedEl = document.activeElement;
    const firstLink = $('.menu-links a', drawer);
    if (firstLink) firstLink.focus();
    else {
      drawer.setAttribute('tabindex', '-1');
      drawer.focus();
    }

    // menu open 時，只 hide header（widget 由 widget 自己處理）
    window.UIVisibility?.hideForMenu?.();
  }

  function closeMenu(pane, drawer) {
    const cb = getCheckbox();
    if (cb && cb.checked) {
      cb.dataset.suppressChange = '1';
      cb.checked = false;
    }

    pane.classList.remove('is-open');
    drawer.classList.remove('is-open');
    setBodyMenuOpen(false);

    // 只 toggle 一次
    document.documentElement.classList.remove('menu-open');

    const label = getHamburgerLabel();
    label?.setAttribute('aria-expanded', 'false');
    if (label && typeof label.focus === 'function') label.focus();
    else if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') lastFocusedEl.focus();

    // restore header（widget 會因為 menu-open 移除而自動回來）
    window.UIVisibility?.show?.();
  }

  function bindFocusTrap(pane, drawer) {
    // Single-bind rule:
      // This handler must be registered only once per page lifetime
      // Barba/partial reload may call bind multiple times
    if (window.__MENU_ESC_BOUND__) return;

    document.addEventListener('keydown', (e) => {
      const cb = getCheckbox();
      if (e.key === 'Escape' && cb?.checked) {
        closeMenu($('.menu-pane'), $('.menu-drawer'));
      }
      if (e.key === 'Tab' && cb?.checked) {
        const tabbables = getTabbables(drawer);
        if (!tabbables.length) return;

        const first = tabbables[0];
        const last  = tabbables[tabbables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          last.focus(); e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus(); e.preventDefault();
        }
      }
    });

    window.__MENU_ESC_BOUND__ = true;
  }

  function bindMobileMenuUX() {
    const structure = ensureDrawerStructure();
    if (!structure) return;
    const { pane, drawer } = structure;

    const cb = getCheckbox();

    if (cb && cb.dataset.boundChange !== '1') {
      cb.addEventListener('change', () => {
        if (cb.dataset.suppressChange === '1') {
          delete cb.dataset.suppressChange;
          return;
        }
        if (cb.checked) openMenu(pane, drawer);
        else closeMenu(pane, drawer);
      });
      cb.dataset.boundChange = '1';
    }


    $$('.menu-links a', drawer).forEach(a => {
      if (a.dataset.bound !== '1') {
        a.addEventListener('click', () => closeMenu(pane, drawer));
        a.dataset.bound = '1';
      }
    });

    if (pane && pane.dataset.boundClick !== '1') {
      pane.addEventListener('click', (e) => {
        const cb2 = getCheckbox();
        if (!cb2?.checked) return;
        if (drawer.contains(e.target)) return;
        closeMenu(pane, drawer);
      });
      pane.dataset.boundClick = '1';
    }

    bindFocusTrap(pane, drawer);
  }

  // -------------------------------------------------
  // loadPartials (guarded)
  // main.js may call window.loadPartials from Barba hooks after/afterOnce 
  // This guard prevents double inject that could interrupt the intro animation.
  // -------------------------------------------------
  async function loadPartials() {
    const now = Date.now();
    if (__loading) return __loading;
    if (now - __lastStamp < 200) return; // tiny throttle
    __lastStamp = now;

    __loading = (async () => {
      const base = getBase();

      await inject('site-menu', base + 'partials/menu.html');
      await inject('site-footer', base + 'partials/footer.html');

      normalizeMenuPaths(base);
      setActiveMenuLinks();
      updateFooterYear();
      bindMobileMenuUX();
      await maybePlayHomeIntro();
    })();

    try {
      return await __loading;
    } finally {
      __loading = null;
    }
  }

  // expose for Barba hooks
  window.loadPartials = loadPartials;

  // initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPartials);
  } else {
    loadPartials();
  }
})();
