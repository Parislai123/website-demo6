/* =========================
  Compact Menu toggle → Hero
========================= */
// 只在 hero page 生效
if (document.documentElement.classList.contains('is-hero')) {
  
  // Intent:
  // Only add a subtle header state cue on hero pages
  // Threshold is tuned to avoid flicker on small scroll / trackpad jitter
  // Keep this class-based so CSS remains the single source of visual truth
  const trigger = 40;
  const onScroll = () => {
    document.documentElement.classList.toggle(
      'hero-scrolled',
      window.scrollY > trigger
    );
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}


/**=========================
 * 雖然 CSS 已經處理了大部分邏輯，但如果你需要在運行時
 * 根據特定行為（例如：切換深色模式、或是特定頁面隱藏）
 * 可以透過以下 JS 進行控制。
 =========================*/

  // Optional hook:
    // Watermark is a global decorative layer.
    // This hook exists for page-specific tuning (e.g. modals / special sections)
    // Safe to ignore if you don't need runtime control
 const watermark = document.getElementById('global-watermark');

// 檢測螢幕旋轉時執行某些邏輯（如果需要比 CSS 更精確的控制）
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    // check status
    // console.log("當前寬度:", width);
});

// 提供一個方法讓特定頁面可以動態修改透明度
function setWatermarkOpacity(value) {
    if(watermark) {
        watermark.style.opacity = value;
    }
}


// ================================
// checkbox（#openmenu）去 toggle class
// ================================
// IMPORTANT (bfcache / back-forward restore):
  // Some browsers restore checkbox state on back/forward
  // We force-reset to prevent "menu-open" ghost state after navigation
document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.getElementById('openmenu');
  if (!menuToggle) return;

  // ----------------------------
  // 1) Hard reset (避免 bfcache / restore 狀態)
  // ----------------------------
  document.documentElement.classList.remove('menu-open');
  document.body.classList.remove('menu-open');
  document.body.style.top = '';
  menuToggle.checked = false;

  // ----------------------------
  // 2) Scroll lock (iOS-safe)
  // ----------------------------
  let scrollY = 0;

  // iOS-safe scroll lock:
    // Use body top offset + scroll restore to prevent background scroll jump
    // Do NOT replace with only overflow:hidden (iOS may still scroll / jump)
  function syncMenuState(isOpen) {
    if (isOpen) {
      scrollY = window.scrollY || 0;
      document.body.style.top = `-${scrollY}px`;
    } else {
      document.body.style.top = '';
      window.scrollTo(0, scrollY);
    }

    document.documentElement.classList.toggle('menu-open', isOpen);
    document.body.classList.toggle('menu-open', isOpen);
  }

  // 3) Bind change handler
  menuToggle.addEventListener('change', (e) => {
    syncMenuState(e.target.checked);
  });

  // 4) Final sync (保險：確保 state 一致)
  syncMenuState(menuToggle.checked);
});


// ================================
// Global UI Visibility Controller (For header / menu visibility)
// ================================
// include‑partials.js: menu 行為、focus、ARIA
// widget_msgbox_scrolltop.js: widget 顯示/隱藏
// UIVisibility: header / menu visibility
// CSS: 視覺狀態  

// 在頁面內使用:
    //UIVisibility.hideAll();
    //UIVisibility.show();
    //Mobile Menu用UIVisibility.hideForMenu();

const UIVisibility = (() => {

  let menuOpen = false;

  function setMenuOpen(v) {
    menuOpen = v;
  }
  function isMenuOpen() {
    return menuOpen;
  }

  const selectors = {
    mobileMenu: '#site-menu', //'.mobile-toggle-wrapper' 只針對 hamburger
    desktopMenu: '#hero-header',
    widget: 'widget-msgbox-scrolltop'  //自訂元素（custom element tag）, 不需要加 # 或 .
  };

  const cache = {};

  // Reversible hiding:
    // We store inline display values to restore exact previous state
    // This supports nested UI hides (e.g. modal -> lightbox) without drift
  const displayBackup = new Map();

  function get(name) {
    if (!cache[name]) {
      const el = document.querySelector(selectors[name]);
      if (el) cache[name] = el;
    }
    return cache[name] || null;
  }

  function hideForMenu() {
    // menu 打開時：只隱藏 desktop header（或你想隱藏的項）
    ['desktopMenu'].forEach(key => {
      const el = get(key);
      if (!el) return;

      if (!displayBackup.has(el)) displayBackup.set(el, el.style.display);
      el.style.display = 'none';
    });
  }


  function hideAll() {
    // widget modal / full modal 用
    // State signal:
      // ui-hide-global is a semantic flag for CSS (e.g. prevent layout shifts / blur effects)
    document.body.classList.add('ui-hide-global');   
    ['mobileMenu', 'desktopMenu', 'widget'].forEach(key => {
      const el = get(key);
      if (!el) return;
      if (!displayBackup.has(el)) displayBackup.set(el, el.style.display);
      el.style.display = 'none';
    });
  }

  function show() {
    document.body.classList.remove('ui-hide-global'); // 新增
    displayBackup.forEach((display, el) => {
      el.style.display = display ?? '';
    });
    displayBackup.clear();
  }


  return {
    hideAll,
    hideForMenu,
    show,
    setMenuOpen,
    isMenuOpen
  };

})();

  //偵測 High zoom（以 Desktop AND viewport 變窄作 proxy）
    // Desktop 100%: 所有 floating UI 正常
    // Desktop 150%: 正常
    // Desktop ≥200%: msgbox + scrollTop + hamburger 全部隱藏高 
    // zoom + menu 已開: hamburger 保留（
    // Mobile: 原本 mobile 行為
  function applyReadingMode(host){
    
    // Reading mode heuristic:
      // On desktop, high zoom effectively reduces visualViewport width
      // We treat (pointer:fine + vw <= threshold) as "reading mode"
      // to hide floating UI and reduce distraction
    const HIDE_THRESHOLD = 900;

    const update = () => {
      const vw = window.visualViewport
        ? window.visualViewport.width
        : window.innerWidth;

      const isDesktop = window.matchMedia('(pointer: fine)').matches;
      const enabled = isDesktop && vw <= HIDE_THRESHOLD;

      host.classList.toggle('ui-reading-mode', enabled);
      document.documentElement.classList.toggle('ui-reading-mode', enabled);
    };

    // 初始執行
    update();

    // 1. 一般 resize
    window.addEventListener('resize', update, { passive: true });

    // 2. visualViewport resize（iOS / Chrome）
    if (window.visualViewport){
      window.visualViewport.addEventListener('resize', update);
    }

    // 3. DevTools 切換 device mode 時會觸發
    window.addEventListener('orientationchange', update);

    // 4. Tab / viewport 恢復可見（DevTools 常用）
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) update();
    });
  }

  // 掛到全域
  window.applyReadingMode = applyReadingMode;


/* =========================
   Scroll Active Underlines (Final Optimized)
   - Barba safe: can re-init after container swap
   - Performance: only toggles the delta (no full sweep remove each time)
   - Stability: picks the most visible section by intersectionRatio
   // Mobile: 不用 rootMargin
   // Desktop: 小幅 rootMargin（≤ 10%）
   // 排序: intersectionRatio
========================= */

(() => {
  let __io = null;
  let __lastActive = null;

  // Stability note:
    // Mobile uses 0px rootMargin to avoid mis-detection caused by dynamic viewport
    // and fixed overlays (address bar / safe-area / toolbars)
    // Do NOT unify margins across breakpoints without testing
  function initScrollUnderlines(){
    // ---- cleanup old observer ----
    if(__io){
      try{ __io.disconnect(); }catch(e){}
      __io = null;
    }
    __lastActive = null;

    const sections = Array.from(document.querySelectorAll('.section'));
    if(sections.length === 0) return;

    const targets = sections.filter(sec => sec.querySelector('.title-underline'));
    if(targets.length === 0) return;

    // ---- breakpoint ----
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    // ---- IntersectionObserver ----
    __io = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if(!visible) return;

      const next = visible.target;
      if(__lastActive === next) return;

      if(__lastActive) __lastActive.classList.remove('is-active');
      next.classList.add('is-active');
      __lastActive = next;
    }, {
      threshold: [0.25, 0.4, 0.55, 0.7],

      // Mobile：0px（避免 dynamic viewport + fixed overlay 問題）
      // Desktop：小幅收窄，集中在視窗中段
      rootMargin: isMobile
        ? "0px"
        : "-10% 0px -10% 0px"
    });

    targets.forEach(sec => __io.observe(sec));
  }

  // ---- expose for Barba / other scripts ----
  window.initScrollUnderlines = initScrollUnderlines;

  // ---- initial boot ----
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initScrollUnderlines);
  }else{
    initScrollUnderlines();
  }

  // ---- re-init on viewport change ----
  window.addEventListener("resize", initScrollUnderlines, { passive:true });
})();

/* =========================================================
   Default: Journey Lite (is-journey)
   + Perceptible cue: 48ms pause after leave
   + Auto fallback to Fade (bl-fallback-fade) when:
     - prefers-reduced-motion
     - save-data / slow network
     - low device spec
     - low FPS heuristic
========================================================= */
// EARLY: if URL has hash, disable smooth before browser applies anchor scroll
if (location.hash) {
  document.documentElement.classList.add('hash-jump');
}

const DEV_FORCE_MOTION =
  location.hostname === 'localhost' ||
  new URLSearchParams(location.search).get('forceMotion') === '1';

function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

/* ---------- Hooks you already rely on ---------- */
function reloadPartials(){
  if(typeof window.loadPartials === 'function') window.loadPartials();
}

function initAOS(){
  if(window.AOS && typeof window.AOS.init === 'function'){
    window.AOS.init({ duration: 1000, easing: 'ease', once: true });
  }
}

function resetScrollTop(){
  // 如果係跨頁 hash（about.html#milestone），唔好強制回頂
  if (location.hash) return;

  try{
    if(window.scroller){
      if(typeof window.scroller.setPosition === 'function'){
        window.scroller.setPosition(0);
        return;
      }
      if(typeof window.scroller.setPostion === 'function'){ // legacy typo guard
        window.scroller.setPostion(0);
        return;
      }
    }
  }catch(e){}
  window.scrollTo(0, 0);
}

function jumpToHashInstant(){
  const hash = location.hash;
  if (!hash) return;

  const target = document.querySelector(hash);
  if (!target) return;

  // force instant (auto) scroll
  target.scrollIntoView({ block: 'start', behavior: 'auto' });

  // restore global smooth for future in-page scroll
  document.documentElement.classList.remove('hash-jump');
}

/* ---------- Fallback decision ---------- */
function prefersReducedMotion(){
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function saveDataOrSlowNetwork(){
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if(!c) return false;
  if(c.saveData) return true;
  const t = String(c.effectiveType || '').toLowerCase();
  return (t.includes('2g') || t.includes('slow-2g'));
}

function lowDeviceSpec(){
  const mem = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency;
  if(typeof mem === 'number' && mem <= 4) return true;
  if(typeof cores === 'number' && cores <= 4) return true;
  return false;
}

async function lowFPS(){
  try{
    let frames = 0;
    const start = performance.now();
    await new Promise(resolve => {
      function tick(){
        frames++;
        if(frames >= 18) return resolve();
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
    const dur = performance.now() - start;
    const fps = (frames / dur) * 1000;

    // UX threshold:
    // Below ~45fps, motion feels "laggy" and harms perceived quality
    // We prefer fading fallback over stutter
    return fps < 45;
  }catch(e){
    return false;
  }
}

async function shouldFallbackToFade(){
  // DEV 模式：忽略 prefers-reduced-motion，方便測 Journey
  // Dev override:
  // forceMotion=1 allows testing Journey even when device would normally fallback
  if(!DEV_FORCE_MOTION && prefersReducedMotion()) return true;

  if(saveDataOrSlowNetwork()) return true;
  if(lowDeviceSpec()) return true;
  return await lowFPS();
}


/* ---------- Apply state classes ---------- */
function applyMode(useFade){
  const html = document.documentElement;
  if(useFade){
    html.classList.add('bl-fallback-fade');
    html.classList.remove('is-journey');
  }else{
    html.classList.remove('bl-fallback-fade');
    html.classList.add('is-journey');
  }
}

/* ---------- Barba: drive CSS classes ---------- */
function setupBarba(){
  if(!window.barba || typeof window.barba.init !== 'function'){
    reloadPartials();
    initAOS();
    return;
  }

  const html = document.documentElement;

  // align with shared.css variables (kept fixed for predictability)
  const JOURNEY_DUR = 320; 
  const FADE_DUR   = 240; 
  const dur = () => html.classList.contains('bl-fallback-fade') ? FADE_DUR : JOURNEY_DUR;

  window.barba.init({
    sync: true,
    transitions: [{
      async leave(){
        html.classList.add('is-leaving');
        await wait(dur());

        // micro pause so users can perceive a state change
        await wait(48);

        html.classList.remove('is-leaving');
      },

      async enter(){
        html.classList.add('is-entering');

        // tiny pause helps the brain register the swap
        await wait(32);

        requestAnimationFrame(() => html.classList.add('is-entering-play'));
        await wait(dur() + 60);
        html.classList.remove('is-entering', 'is-entering-play');
      },

      async once(){
        html.classList.add('is-entering');
        requestAnimationFrame(() => html.classList.add('is-entering-play'));
        await wait(dur());
        html.classList.remove('is-entering', 'is-entering-play');
      }
    }]
  });

  window.barba.hooks.afterOnce(() => {
    reloadPartials();
    initAOS();
    resetScrollTop();
    if(typeof window.initScrollUnderlines === 'function') window.initScrollUnderlines();

    // 放最後：確保其他 init 完咗先做 hash jump
    jumpToHashInstant();
  });

  window.barba.hooks.after(() => {
    reloadPartials();
    initAOS();
    resetScrollTop();
    if(typeof window.initScrollUnderlines === 'function') window.initScrollUnderlines();

    jumpToHashInstant();
  });

  // 更準時機（避免 hash 行為在 after 才發生）
  window.barba.hooks.afterEnter(() => {
    jumpToHashInstant();
  });
}

/* ---------- Boot ---------- */
(async function boot(){
  const useFade = await shouldFallbackToFade();
  applyMode(useFade);

  if(window.matchMedia){
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener?.('change', (e) => applyMode(e.matches ? true : useFade));
  }

const start = () => {
  setupBarba();
  if (!window.barba) {
    reloadPartials();
    initAOS();
  }
};


  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start);
  }else{
    start();
  }
})();

/* =========================
   DEBUG: Verify Barba transition is running
   Usage:
   - Open DevTools Console
   - Click menu links to navigate
========================= */
(function(){
  function stamp(){
    const html = document.documentElement;
    const mode = html.classList.contains('bl-fallback-fade') ? 'FADE(fallback)' :
                 html.classList.contains('is-journey') ? 'JOURNEY' : 'UNKNOWN';
    const state = [
      html.classList.contains('is-leaving') ? 'leaving' : '',
      html.classList.contains('is-entering') ? 'entering' : '',
      html.classList.contains('is-entering-play') ? 'play' : ''
    ].filter(Boolean).join('|') || 'idle';
    const ns = document.querySelector('[data-barba="container"]')?.getAttribute('data-barba-namespace') || '(no namespace)';
    // check status
    //console.log(`[BL Transition] mode=${mode} state=${state} namespace=${ns}`);
  }

  // 每次 class 改變就打印（觀察 state 變化）
  const obs = new MutationObserver(stamp);
  obs.observe(document.documentElement, { attributes:true, attributeFilter:['class'] });

  // Barba hooks（如果 Barba 存在）
  if(window.barba){
    try{
      barba.hooks.before(() => console.log('[BL Transition] barba.before'));
      barba.hooks.beforeLeave(() => console.log('[BL Transition] barba.beforeLeave'));
      barba.hooks.afterLeave(() => console.log('[BL Transition] barba.afterLeave'));
      barba.hooks.beforeEnter(() => console.log('[BL Transition] barba.beforeEnter'));
      barba.hooks.afterEnter(() => console.log('[BL Transition] barba.afterEnter'));
      barba.hooks.after(() => console.log('[BL Transition] barba.after'));
    }catch(e){}
  }

  // 首次輸出一次
  stamp();
})();

/* =========================
   DEBUG Motion (visual + console)
   Show only on:
   - localhost OR
   - URL contains ?debugMotion=1
========================= */
(() => {
  const isDebug =
    location.hostname === 'localhost' ||
    new URLSearchParams(location.search).get('debugMotion') === '1';

  if (!isDebug) return;

  // ---- badge style (inline, no CSS file needed)
  const style = document.createElement('style');
  style.textContent = `
    .bl-debug-badge{
      position:fixed; top:10px; right:10px; z-index:999999;
      font-family: inherit;
      font-size: 12px;
      line-height: 1.4;
      font-weight:800; letter-spacing:.2px;
      color:#111; background:rgba(255,255,255,.88);
      border:1px solid rgba(0,0,0,.14);
      border-radius:999px; padding:8px 10px;
      box-shadow:0 10px 22px rgba(0,0,0,.12);
      backdrop-filter:blur(8px);
      display:flex; align-items:center; gap:8px;
    }
    .bl-debug-dot{ width:8px; height:8px; border-radius:50%; background:#22c55e; }
    .bl-debug-dot.leaving{ background:#f97316; }
    .bl-debug-dot.entering{ background:#3b82f6; }
    .bl-debug-dot.fallback{ background:#ef4444; }
    .bl-debug-mini{ font-weight:800; opacity:.65; margin-left:6px; }
  `;
  document.head.appendChild(style);

  // ---- badge element
  const badge = document.createElement('div');
  badge.className = 'bl-debug-badge';
  badge.innerHTML = `<span class="bl-debug-dot"></span><span class="bl-debug-text">BL Motion</span>`;
  document.body.appendChild(badge);

  const dot = badge.querySelector('.bl-debug-dot');
  const txt = badge.querySelector('.bl-debug-text');

  function snapshot(){
    const html = document.documentElement;

    const mode = html.classList.contains('bl-fallback-fade')
      ? 'FADE(fallback)'
      : (html.classList.contains('is-journey') ? 'JOURNEY' : 'UNKNOWN');

    const state = html.classList.contains('is-leaving')
      ? 'leaving'
      : (html.classList.contains('is-entering') ? 'entering' : 'idle');

    const ns = document.querySelector('[data-barba="container"]')
      ?.getAttribute('data-barba-namespace') || '(no namespace)';

    return { mode, state, ns };
  }

  function render(){
    const { mode, state, ns } = snapshot();
    dot.classList.remove('leaving','entering','fallback');

    if (mode.startsWith('FADE')) dot.classList.add('fallback');
    if (state === 'leaving') dot.classList.add('leaving');
    if (state === 'entering') dot.classList.add('entering');

    txt.innerHTML = `${mode} • ${state} <span class="bl-debug-mini">${ns}</span>`;
  }

  // ---- watch html class changes (this is what your transition uses)
  const mo = new MutationObserver(render);
  mo.observe(document.documentElement, { attributes:true, attributeFilter:['class'] });
  render();

  // ---- console hooks (Barba lifecycle)
  if (window.barba && window.barba.hooks){
    try{
      barba.hooks.beforeLeave(() => console.log('[BL Motion] beforeLeave', snapshot()));
      barba.hooks.afterLeave(() => console.log('[BL Motion] afterLeave', snapshot()));
      barba.hooks.beforeEnter(() => console.log('[BL Motion] beforeEnter', snapshot()));
      barba.hooks.afterEnter(() => console.log('[BL Motion] afterEnter', snapshot()));
      barba.hooks.after(() => console.log('[BL Motion] after', snapshot()));
    }catch(e){}
  }
})();


// =========================
// Scroll Reveal (Barba-safe)
// =========================
(() => {
  let __revealIO = null;

  function initReveal(){
    // 清理舊 observer（Barba 換頁避免重覆 observe）
    if(__revealIO){
      try{ __revealIO.disconnect(); }catch(e){}
      __revealIO = null;
    }

    const els = Array.from(document.querySelectorAll('.reveal'));
    if(els.length === 0) return;

    // 如果使用者偏好減少動畫：直接全部顯示
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      els.forEach(el => el.classList.add('in'));
      return;
    }

    __revealIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add('in');
          __revealIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });

    els.forEach(el => {
      // 已經 reveal 過就唔再 observe
      if(el.classList.contains('in')) return;
      __revealIO.observe(el);
    });
  }

  // 暴露給頁面內 script / Barba hooks 用
  window.initReveal = initReveal;

  // 初次載入
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initReveal);
  } else {
    initReveal();
  }

  // 如果你有 Barba：換頁後要再做一次
  try{
    if(window.barba && window.barba.hooks){
      window.barba.hooks.after(initReveal);
      window.barba.hooks.afterOnce(initReveal);
    }
  }catch(e){}
})();



   /* ============================
       Focus trap（新增）：Tab 只會喺 modal 內循環
       - 支援 Activity modal + Lightbox 疊加
    ============================ */
    //在頁面內使用:
    //ModalFocus.activateFocusTrap();
    //ModalFocus.deactivateFocusTrap();
    //ModalFocus.restoreFocus();

    (function () {
    let __focusTrap = { active:false, container:null, handler:null };

    function getFocusable(container){
      if(!container) return [];
      const sel = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
      ].join(',');
      return Array.from(container.querySelectorAll(sel)).filter(el=>{
        if(el.getAttribute('aria-hidden') === 'true') return false;
        // hidden elements
        const style = window.getComputedStyle(el);
        if(style.display === 'none' || style.visibility === 'hidden') return false;
        return true;
      });
    }

    function deactivateFocusTrap(){
      if(__focusTrap.handler){
        document.removeEventListener('keydown', __focusTrap.handler, true);
      }
      __focusTrap = { active:false, container:null, handler:null };
    }

    function activateFocusTrap(container, preferredFocusEl=null){
      // 先清除上一個 trap
      deactivateFocusTrap();

      __focusTrap.active = true;
      __focusTrap.container = container;

      const handler = (e) => {
        if(!__focusTrap.active) return;
        if(e.key !== 'Tab') return;

        const box = __focusTrap.container;
        if(!box) return;

        const focusables = getFocusable(box);
        if(focusables.length === 0){
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last  = focusables[focusables.length - 1];

        // 若焦點唔喺 modal 入面，拉返入嚟
        if(!box.contains(document.activeElement)){
          e.preventDefault();
          (preferredFocusEl || first).focus({preventScroll:true});
          return;
        }

        if(e.shiftKey){
          if(document.activeElement === first){
            e.preventDefault();
            last.focus({preventScroll:true});
          }
        }else{
          if(document.activeElement === last){
            e.preventDefault();
            first.focus({preventScroll:true});
          }
        }
      };

      document.addEventListener('keydown', handler, true);
      __focusTrap.handler = handler;

      // 如果目前焦點已經喺 container 入面，就唔強行改
      const shouldMove = !(container && container.contains(document.activeElement));
      if(shouldMove){
        requestAnimationFrame(()=>{
          const focusables = getFocusable(container);
          const target = preferredFocusEl || focusables[0];
          target?.focus({preventScroll:true});
        });
      }
    }

    function restoreFocus(el){
      try{
        if(el && document.contains(el)) el.focus({preventScroll:true});
      }catch(e){}
    }

    
  // 掛到 window 方便其他頁面用 / inline onclick 用
  window.ModalFocus = {
    activateFocusTrap,
    deactivateFocusTrap,
    restoreFocus
  };
})();


// ==============================
// Sticky + Push Cover Reveal (FINAL)
// - JS-only (no CSS file changes)
// - cover = bottom-up clip (hide bottom first)
// - uncover = top-down clip (show top first)
// - never set opacity to 0 (use 0.01 to avoid Safari flicker)
// - rAF throttled
// ==============================
function getVH() {
  return (window.visualViewport && window.visualViewport.height) || window.innerHeight;
}

function getMenuH() {
  const rootStyle = getComputedStyle(document.documentElement);
  const isMobile = window.matchMedia('(max-width: 1023px)').matches;
  const key = isMobile ? '--menu-h-mobile' : '--menu-h';
  const v = parseFloat(rootStyle.getPropertyValue(key));
  return Number.isFinite(v) ? v : 70;
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function findNextPush(scope) {
  let el = scope.nextElementSibling;
  while (el) {
    if (el.classList && el.classList.contains('section-push')) return el;
    el = el.nextElementSibling;
  }
  return null;
}

// ---------- Style Helpers ----------
function setStyleOnce(el, prop, value) {
  const k = `__st_${prop}`;
  if (el[k] === value) return;
  el.style[prop] = value;
  el[k] = value;
}

function isMobile() {
  return window.matchMedia('(max-width: 767px)').matches;
}

// ---------- 核心修正：佈局計算 ----------
function initStickyLayout() {
  const vh = getVH();
  const menuH = getMenuH();
  const stickyVisuals = document.querySelectorAll('.section-visual.sticky');

  stickyVisuals.forEach((visual) => {
    const visualHeight = visual.offsetHeight;

    // Mobile 長內容：直接禁用 sticky（避免 iOS 視覺鎖住）
    if (isMobile() && visualHeight > vh * 4.2) {
      setStyleOnce(visual, 'position', 'relative');
      setStyleOnce(visual, 'top', 'auto');
      // 還原顯示
      setStyleOnce(visual, 'clipPath', 'inset(0px 0px 0px 0px)');
      setStyleOnce(visual, 'webkitClipPath', 'inset(0px 0px 0px 0px)');
      setStyleOnce(visual, 'opacity', '1');
      return;
    }

    // GPU 加速優化
    if (!visual.__gpuPromoted) {
      setStyleOnce(visual, 'transform', 'translateZ(0)');
      setStyleOnce(visual, 'backfaceVisibility', 'hidden');
      // JS style property 要用 camelCase
      setStyleOnce(visual, 'willChange', 'clip-path, top');
      visual.__gpuPromoted = true;
    }

    const availableHeight = vh - menuH;

    // 緩存判斷，避免重複計算
    const prev = visual.__stickyCache || {};
    if (prev.vh === vh && prev.h === visualHeight && prev.menuH === menuH) return;

    let topPx;
    if (visualHeight > availableHeight) {
      topPx = vh - visualHeight;
    } else {
      topPx = menuH;
    }

    setStyleOnce(visual, 'position', 'sticky');
    setStyleOnce(visual, 'top', `${topPx}px`);

    visual.__stickyCache = { vh, h: visualHeight, menuH };
  });
}

// ---------- 捲動遮罩效果 ----------
function handleScrollEffects() {
  const stickyVisuals = document.querySelectorAll('.section-visual.sticky');
  const EPS = 0.01;

  stickyVisuals.forEach((visual) => {
    const vh = getVH();

    // 如果 init 已把它變成 relative（mobile 長內容），就唔做遮罩效果
    if (visual.style.position === 'relative') return;

    const scope = visual.closest('section') || visual.parentElement;
    if (!scope) return;

    const nextPush = findNextPush(scope);
    if (!nextPush) {
      setStyleOnce(visual, 'clipPath', 'inset(0px 0px 0px 0px)');
      setStyleOnce(visual, 'webkitClipPath', 'inset(0px 0px 0px 0px)');
      setStyleOnce(visual, 'opacity', '1');
      return;
    }

    const vRect = visual.getBoundingClientRect();
    const nRect = nextPush.getBoundingClientRect();

    const covered = vRect.bottom - nRect.top;

    if (covered <= 0) {
      setStyleOnce(visual, 'clipPath', 'inset(0px 0px 0px 0px)');
      setStyleOnce(visual, 'webkitClipPath', 'inset(0px 0px 0px 0px)');
      setStyleOnce(visual, 'opacity', '1');
      return;
    }

    const hideBottomPx = clamp(covered, 0, vRect.height);
    const clipValue = `inset(0px 0px ${hideBottomPx.toFixed(2)}px 0px)`;

    setStyleOnce(visual, 'clipPath', clipValue);
    setStyleOnce(visual, 'webkitClipPath', clipValue);

    const progress = clamp(hideBottomPx / Math.max(1, vRect.height), 0, 1);
    const opacity = clamp(1 - (progress * progress), EPS, 1);
    setStyleOnce(visual, 'opacity', opacity.toFixed(4));
  });
}

// ---------- Event Listeners ----------
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    // scroll 時只做遮罩；top 計算交給 resize/viewport resize/首次
    handleScrollEffects();
    ticking = false;
  });
}

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => { initStickyLayout(); handleScrollEffects(); });
window.visualViewport?.addEventListener('resize', () => { initStickyLayout(); handleScrollEffects(); });
window.addEventListener('load', () => { initStickyLayout(); handleScrollEffects(); });

initStickyLayout();
handleScrollEffects();

