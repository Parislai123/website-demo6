/**
 * widget_msgbox_scrolltop.js (FINAL - visualViewport anchored, old-behavior scrollTop)
 * -----------------------------------------------------------------------------
 * What you asked for (like your earlier version):
 *  - ScrollTop at top: NOT visible and NOT reserving space (no slot)
 *  - When scrolled: ScrollTop appears, and message shifts slightly LEFT (layout expands to left)
 *  - No vertical "jump" at footer / address-bar hide/show (use visualViewport anchoring)
 *
 * NEW (your latest request):
 *  - In mobile landscape, when msgbox is OPEN:
 *      1) Hide msgbox button + scrolltop button (hide .fab-wrap)
 *      2) Move msgbox (contact-modal) DOWN closer to bottom
 *  - Shrink SVG inside scrolltop button (arrow icon)
 */

(() => {
  // Single-init guard:
  // This widget can be loaded multiple times (Barba swaps / partial reload / devtools)
  // Guard prevents duplicate hosts, event listeners, and visualViewport handlers
  if (window.__WIDGET_MSGBOX_SCROLLTOP_VV_OLD__) return;
  window.__WIDGET_MSGBOX_SCROLLTOP_VV_OLD__ = true;

  const PULSE_SESSION_KEY = "msgbox_widget_opened_once";
  // UX thresholds:
  // Different thresholds prevent premature ScrollTop on small screens
  // Portrait shows earlier; desktop waits longer to reduce UI noise
  const THRESHOLD_DESKTOP = 200;
  const THRESHOLD_PORTRAIT = 140;

  // ---- tune: spacing (not too close to border) ----
  const MARGIN_DESKTOP = 26;
  const MARGIN_MOBILE  = 22;

  // ---- tune: “main content safe area” bottom offsets by breakpoint (fixed; not footer calc) ----
  // Stability decision:
  // Bottom offsets are fixed (not footer/scroll based) to avoid vertical jump
  // from address-bar show/hide and layout reflow near the page end
  const OFFSET_DESKTOP = 1;
  const OFFSET_TABLET  = 1;
  const OFFSET_MOBILE  = 1;

  // NEW: always compute mobile state dynamically (DevTools / rotate safe)
  const isMobileNow = () => window.matchMedia("(max-width: 768px)").matches;

  // ---- inline UI ----
  const FRAGMENT = `
<style>
:host{
  /* keep your existing palette sync from JS; these are fallbacks */
  --msgboxButton-color:#D6B36A;
  --msgboxButton-color-hover:#C5A45F;
  --scrollButton-color:#BE9A43;
  --scrollButton-color-hover:#BE9A43;


  --ui-gray:#6B6B6B;            /* NEW: neutral icon gray */
  --ui-gray-soft:#5A5A5A;

  --shadow:0 8px 20px rgba(0,0,0,.15);
  --shadow-strong:0 12px 30px rgba(0,0,0,.22);
  --radius:16px;

  --ui-margin:${MARGIN_DESKTOP}px;
  --ui-bottom-offset:${OFFSET_DESKTOP}px;
  --fab-stack-height: 20px; /* desktop 預設 */
  font-family: "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif;
}

/* Widget – High Zoom / Reading Mode */
:host(.ui-reading-mode) .fab-wrap{
  opacity: 0;
  pointer-events: none;
}

*,*::before,*::after{ box-sizing:border-box; }

@media (prefers-reduced-motion: reduce){
  *{ animation:none !important; transition:none !important; scroll-behavior:auto !important; }
}

/* Root is inside host */
#widget-root{ position:absolute; inset:0; pointer-events:none; }

@media (max-width:768px){
  :host{
    --fab-stack-height: 20px; /* 視乎你實際 FAB 高度 */
  }
}

/* =========================
   FAB wrap
========================= */
.fab-wrap{
  position:absolute;
  right:calc(var(--ui-margin) + env(safe-area-inset-right,0px));
  bottom:calc(var(--ui-margin) + env(safe-area-inset-bottom,0px) + var(--ui-bottom-offset));
  z-index:2147483647;

  display:flex;
  flex-direction:row;
  gap:12px;
  align-items:flex-end;

  pointer-events:auto;
}

@media (max-width:768px){
  :host{ --ui-margin:${MARGIN_MOBILE}px; }

  .fab-wrap{ 
   position: fixed !important;
   right: calc(16px + env(safe-area-inset-right, 0px));
   bottom: calc(16px + env(safe-area-inset-bottom, 0px));  
   flex-direction: column-reverse;
   align-items:flex-end;
   gap:10px;
 }
}

/* Modal open = hide msgbox + scrollTop */
:host([data-open="1"]) .fab-wrap{
  opacity: 0;
  pointer-events: none;
}
/* mobile landscape open => hide FABs */
@media (max-width:767px) and (orientation:landscape){
  :host([data-open="1"]) .fab-wrap{ 
  display:none !important; 
  }
}

/* =========================
   Base FAB
========================= */
.fab{
  border:none;
  cursor:pointer;
  border-radius:50%;
  display:flex;
  align-items:center;
  justify-content:center;
  box-shadow:var(--shadow);
  transition:transform .2s ease, box-shadow .2s ease, background .2s ease, border .2s ease;
  -webkit-tap-highlight-color:transparent;
}
.fab svg{ pointer-events:none; }
.fab:focus-visible{
  outline:3px solid rgba(255,107,74,.35);
  outline-offset:3px;
  border-radius:12px;
}

/* =========================
   Msgbox (PRIMARY) – white + red border
========================= */
#openContactBtn{
  width:52px;
  height:52px;
  min-width:48px;
  min-height:48px;
  max-width:52px;   /* 防止 zoom 無限放大 */
  max-height:52px;

  background: rgba(255,255,255,.85);
  border: none;                  
  box-shadow:
    0 8px 24px rgba(0,0,0,.12),
    0 0 0 2px rgba(218, 204, 173, 0.18);  /* 外圍金色 halo暈圈 */

}
#openContactBtn svg{
  width:20px;
  height:20px;
  color:var(--ui-gray);
}

#openContactBtn:hover{
  background:var(--white-100);
  transform:translateY(-3px) scale(1.05);
  box-shadow:
    0 10px 28px rgba(0,0,0,.14),
}

/* subtle pulse still allowed */
@keyframes ctaPulse{
  0%{ transform:translateY(0) scale(1); }
  70%{ transform:translateY(-1px) scale(1.015); }
  100%{ transform:translateY(0) scale(1); }
}
.cta-pulse{ animation:ctaPulse 6.5s ease-in-out infinite; }

/* =========================
   ScrollTop (SECONDARY) – semi-transparent + gray icon
========================= */
#scrollGroup{ display:none; }
#scrollGroup.is-visible{ display:flex; }

#scrollTopBtn{
  width:40px;
  height:40px;
  min-width:36px;
  min-height:36px;
  max-width:40px;
  max-height:40px;

  background: rgba(255,255,255,.55);
  box-shadow:
    0 6px 20px rgba(0,0,0,.10),
    0 0 0 1px rgba(0,0,0,.06);   /* 很淡的外圍 */

  backdrop-filter:blur(10px);
  -webkit-backdrop-filter:blur(10px);

  color:var(--ui-gray);
}

#scrollTopBtn svg{
  width:16px;
  height:16px;
  color:var(--ui-gray);
  opacity:1;
}

#scrollTopBtn:hover{
  background:rgba(255,255,255,.85);
  transform:translateY(-2px) scale(1.02);
  box-shadow:var(--shadow-strong);
}

/* bounce only scrollTop */
#scrollGroup.is-visible #scrollTopBtn{
  animation:scrollBounce .6s cubic-bezier(.2,.9,.2,1);
}
@keyframes scrollBounce{
  0%{ transform:translateY(12px) scale(.95); }
  55%{ transform:translateY(-6px) scale(1.03); }
  100%{ transform:translateY(0) scale(1); }
}

/* =========================
   Overlay + Modal
========================= */
/* 1. 確保遮罩層覆蓋全螢幕並置中內容 */
.overlay {
  position: fixed; /* 改為 fixed 確保不隨頁面滾動位移 */
  inset: 0;
  z-index: 2147483646;
  display: none; 
  align-items: center;     /* 垂直置中 */
  justify-content: center;   /* 水平置中 */
  padding: 20px;           /* 手機版邊距 */
  pointer-events: auto;
}

/* 當 data-open="1" 時顯示 */
:host([data-open="1"]) .overlay { 
  display: flex !important; 
}

.overlay-bg {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4); /* 稍微加深背景色 */
  backdrop-filter: blur(5px);    /* 增加毛玻璃質感 */
  -webkit-backdrop-filter: blur(5px);
}

/* 2. Modal 主體比例優化 */
.contact-modal {
  position: relative;
  z-index: 1;
  background: var(--white-100);
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  
  /* 核心比例邏輯：
     - 手機版：寬度約 92%
     - 平板版 (iPad)：寬度會自動擴展到 480px - 520px 左右，看起來更穩重
     - 電腦版：最大寬度限制在 560px
  */
  width: clamp(320px, 85vw, 560px); 
  
  /* 高度邏輯：確保在矮螢幕上也能捲動 */
  max-height: 90vh; 
  
  animation: modalScaleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modalScaleIn {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* 3. 內容細節優化 */
.contact-modal__header {
  padding: 20px 24px;
  background: #fff7ed;
  border-bottom: 1px solid #f4d6a6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.contact-modal__header strong {
  font-size: 1.2rem;
  color: #333;
}

.contact-modal__body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px; /* 增加輸入框間距，更好點擊 */
}

/* 輸入框樣式優化 */
.contact-input,
.contact-textarea {
  width: 100%;
  padding: 14px 16px;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  font-size: 16px; /* 16px 可防止 iOS 自動縮放頁面 */
  font-family: inherit;
  transition: all 0.2s ease;
  background: #fafafa;
}

.contact-input:focus,
.contact-textarea:focus {
  outline: none;
  border-color: var(--scrollButton-color);
  background: #fff;
  box-shadow: 0 0 0 4px rgba(190, 154, 67, 0.15);
}

.contact-textarea {
  min-height: 140px; /* 平板/電腦版增加留言框高度 */
  resize: none;
}

.contact-modal__footer {
  padding: 16px 24px 24px;
  display: flex;
  justify-content: flex-end;
}

.contact-submit {
  min-width: 120px;
  height: 48px;
  border-radius: 12px;
  background: var(--scrollButton-color);
  color: #fff;
  font-weight: 700;
  font-size: 1rem;
  border: none;
  cursor: pointer;
  transition: transform 0.2s, filter 0.2s;
}

.contact-submit:hover {
  filter: brightness(1.05);
  transform: translateY(-1px);
}

/* 4. 針對不同裝置的微調 (Media Queries) */

/* 平板與電腦版 (螢幕寬度 > 768px) */
@media (min-width: 769px) {
  .contact-modal__body {
    padding: 32px; /* 大螢幕給予更多留白，增加高級感 */
    gap: 20px;
  }
}

/* 手機橫屏處理 (Landscape) */
@media (max-height: 500px) {
  .contact-modal {
    max-height: 95vh;
  }
  .contact-modal__body {
    padding: 12px 24px;
    gap: 10px;
  }
  .contact-textarea {
    min-height: 80px;
  }
}

/* =========================
   Close button (unchanged)
========================= */
#closeContactBtn{
  width:36px;
  height:36px;
  border-radius:50%;
  border:0;
  background:rgba(0,0,0,.06);
  backdrop-filter:blur(10px);
  -webkit-backdrop-filter:blur(10px);
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  transition:background .25s ease, box-shadow .25s ease, transform .25s ease;
}
#closeContactBtn svg{
  width:16px;
  height:16px;
  color:rgba(0,0,0,.75);
}
#closeContactBtn:hover {
  background: rgba(0,0,0,0.1);
}
  
</style>

<div id="widget-root">
  <div class="fab-wrap" role="group" aria-label="快速操作">
    <button class="fab cta-pulse" id="openContactBtn" aria-label="開啟留言表單">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 3v-13a1.5 1.5 0 0 1 1.5-1.5Z"
              stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="9" cy="11" r="1.5" fill="currentColor"/>
        <circle cx="13" cy="11" r="1.5" fill="currentColor"/>
        <circle cx="17" cy="11" r="1.5" fill="currentColor"/>
      </svg>
    </button>

    <div id="scrollGroup">
      <button class="fab" id="scrollTopBtn" aria-label="回到頂端">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5 L12 19" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>
          <path d="M6 11 L12 5 L18 11" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </div>

  <div class="overlay" id="overlay">
    <div class="overlay-bg" id="overlayBg"></div>

    <div class="contact-modal" id="contactModal">
      <div class="contact-modal__header">
        <strong>如需代禱或查詢，歡迎留言給我們。</strong>
        <button id="closeContactBtn" class="contact-modal__close">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="2"/>
            <line x1="14" y1="2" x2="2" y2="14" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </div>

      <div class="contact-modal__body">
        <input id="name" placeholder="聯絡名稱" class="contact-input">
        <input id="email" placeholder="電郵地址" class="contact-input">
        <textarea id="message" placeholder="留言給我們…" class="contact-textarea"></textarea>
      </div>

      <div class="contact-modal__footer">
        <button id="btnSend" class="contact-submit">送出</button>
      </div>
    </div>
  </div>
</div>
`;

  function shouldPulse() {
    try { return sessionStorage.getItem(PULSE_SESSION_KEY) !== "1"; } catch { return true; }
  }
  function markPulseDone() {
    try { sessionStorage.setItem(PULSE_SESSION_KEY, "1"); } catch {}
  }

  function bestBottomOffsetPx() {
    const w = window.innerWidth || document.documentElement.clientWidth;
    if (w <= 480) return OFFSET_MOBILE;
    if (w <= 1024) return OFFSET_TABLET;
    return OFFSET_DESKTOP;
  }

  function bestThreshold() {
    return window.matchMedia("(max-width: 768px) and (orientation: portrait)").matches
      ? THRESHOLD_PORTRAIT : THRESHOLD_DESKTOP;
  }

  function applyVisualViewport(host){
    const vv = window.visualViewport;
    if (!vv) return;
    host.style.left = vv.offsetLeft + "px";
    host.style.top = vv.offsetTop + "px";
    host.style.width = vv.width + "px";
    host.style.height = vv.height + "px";
  }

  function init() {
    if (document.querySelector("widget-msgbox-scrolltop")) return;

    const host = document.createElement("widget-msgbox-scrolltop");
    document.documentElement.appendChild(host);

    host.style.position = "fixed";
    host.style.left = "0";
    host.style.top = "0";
    host.style.width = "100%";

    // no TDZ, compute mobile dynamically
    // Mobile idle optimization:
    // Use height:0 (not display:none) so the custom element stays mounted, but doesn't reserve space or intercept touches
    host.style.height = isMobileNow() ? "0" : "100%";
    host.style.zIndex = "2147483647";
    host.style.pointerEvents = "none";
    host.style.display = "block";

    // Sync theme tokens from document :root into widget host
    // Why:
      // Shadow DOM styles may not inherit all global CSS variables as expected
      // We mirror key tokens onto the host to keep widget theme consistent site-wide
    try {
      const root = getComputedStyle(document.documentElement);
      const map = {
        '--msgboxButton-color': root.getPropertyValue('--msgboxButton-color').trim() || '#f0efef',
        '--msgboxButton-color-hover': root.getPropertyValue('--msgboxButton-color-hover').trim() || '#f0efef',
        '--action-primary': root.getPropertyValue('--action-primary').trim() || '#f0efef',
        '--action-primary-hover': root.getPropertyValue('--action-primary-hover').trim() || '#f0efef'
      };
      Object.entries(map).forEach(([k,v]) => host.style.setProperty(k, v));
    } catch(e) {
      console.warn('[widget] token sync failed', e);
    }

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = FRAGMENT;

    // 偵測 High zoom（以 Desktop AND viewport 變窄作 proxy）
    // (applyReadingMode 在 main.js 內已掛到 window)
    if (typeof window.applyReadingMode === "function") {
      window.applyReadingMode(host);
    }

    // set safe-area offset by breakpoint (fixed; not scroll-based)
    const applyOffset = () => host.style.setProperty("--ui-bottom-offset", bestBottomOffsetPx() + "px");
    applyOffset();
    window.addEventListener("orientationchange", applyOffset, { passive:true });

    // -------------------------
    // Desktop-only visualViewport anchoring + auto switch
    // -------------------------
    let vvUpdate = null;
    const attachVV = () => {
      if (!window.visualViewport) return;
      if (vvUpdate) return;
      vvUpdate = () => applyVisualViewport(host);
      window.visualViewport.addEventListener("resize", vvUpdate);
      window.visualViewport.addEventListener("scroll", vvUpdate);
      vvUpdate();
    };
    const detachVV = () => {
      if (!window.visualViewport) return;
      if (!vvUpdate) return;
      window.visualViewport.removeEventListener("resize", vvUpdate);
      window.visualViewport.removeEventListener("scroll", vvUpdate);
      vvUpdate = null;
      // reset to normal fixed box when leaving vv mode
      host.style.left = "0";
      host.style.top = "0";
      host.style.width = "100%";
    };

    // -------------------------
    // Host box (height) + PE sync
    // -------------------------
    // Why desktop-only VV:
      // On mobile, the host is collapsed (height:0) when idle,
      // and VV anchoring can introduce jitter during address-bar changes
      // Desktop uses VV anchoring to prevent footer/viewport jump
    const syncHostBox = () => {
      if (document.documentElement.classList.contains('menu-open')) return;

      const open = host.getAttribute("data-open") === "1";
      host.style.height = open ? "100%" : (isMobileNow() ? "0" : "100%");

      if (!isMobileNow()) attachVV();
      else detachVV();
    };

    // 2) pointer-events：只在 modal open 時才接管
    // Interaction safety:
      // Widget host must never block page interaction when closed
      // Only enable pointer-events when the modal is open
    const syncHostPE = () => {
      if (document.documentElement.classList.contains('menu-open')) return;
      const open = host.getAttribute("data-open") === "1";
      host.style.pointerEvents = open ? "auto" : "none";
    };

    // initial sync
    syncHostBox();
    syncHostPE();

    // menu-open 時隱藏整個 widget；menu close 自動恢復
    const applyMenuState = () => {
      const menuOpen = document.documentElement.classList.contains('menu-open');

      if (menuOpen) {
        if (!host.dataset.prevDisplay) host.dataset.prevDisplay = host.style.display ?? '';
        host.style.display = 'none';
      } else {
        host.style.display = host.dataset.prevDisplay ?? '';
        delete host.dataset.prevDisplay;

        // 關 menu 後立即同步一次
        syncHostBox();
        syncHostPE();
      }
    };

    applyMenuState();

    const mo = new MutationObserver(applyMenuState);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });


    // keep stable on devtools toggle / rotate / tab back
    window.addEventListener("resize", () => { syncHostBox(); }, { passive:true });
    window.addEventListener("orientationchange", () => { syncHostBox(); }, { passive:true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) syncHostBox();
    });

    const openBtn = shadow.getElementById("openContactBtn");
    const scrollGroup = shadow.getElementById("scrollGroup");
    const scrollTopBtn = shadow.getElementById("scrollTopBtn");
    const overlayBg = shadow.getElementById("overlayBg");
    const closeBtn = shadow.getElementById("closeContactBtn");
    const sendBtn = shadow.getElementById("btnSend");
    const nameInput = shadow.getElementById("name");
    const msgInput = shadow.getElementById("message");

    // pulse until first open
    if (!shouldPulse()) openBtn.classList.remove("cta-pulse");

    const setOpen = (open) => {
      host.setAttribute("data-open", open ? "1" : "0");

      // 每次開/關都同步 host height（mobile idle=0）
      syncHostBox();

      // 同步全站狀態，俾 mobile-menu.css / 其他全域 CSS 用
      // Cross-system signal:
        // `html.modal-open` is the global state flag used by CSS to adjust
        // FAB visibility and modal placement (especially mobile landscape)
      document.documentElement.classList.toggle('modal-open', open);

      // 每次開/關都要同步 pointer-events
      syncHostPE();

      if (open) {
        openBtn.classList.remove("cta-pulse");
        markPulseDone();
        setTimeout(() => nameInput && nameInput.focus(), 50);
      }
      // FAB hide/show + modal bottom shift are handled by CSS under mobile landscape
    };

    openBtn.addEventListener("click", () => setOpen(true));
    overlayBg && overlayBg.addEventListener("click", () => setOpen(false));
    closeBtn && closeBtn.addEventListener("click", () => setOpen(false));

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && host.getAttribute("data-open") === "1") setOpen(false);
    });

    sendBtn && sendBtn.addEventListener("click", () => {
      const msg = (msgInput?.value || "").trim();
      if (!msg) { alert("請輸入留言內容"); return; }
      setOpen(false);
    });

    // =========================
    // ScrollTop behavior (keep your working approach + fallback)
    // =========================
    let threshold = bestThreshold();

    const getY = () =>
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;

    const toggle = () => {
      // menu 開緊：強制隱藏 scrollTop（防止 scroll/resize 又彈出）
      if (document.documentElement.classList.contains('menu-open')) {
        scrollGroup.classList.remove("is-visible");
        scrollGroup.style.display = "none";
        return;
      }

      const show = getY() > threshold;

      // Old-behavior requirement:
        // Use display:none (not only opacity) so ScrollTop has zero footprint when hidden
        // and doesn't reserve layout space or intercept taps
      scrollGroup.classList.toggle("is-visible", show);
      scrollGroup.style.display = show ? "flex" : "none";
    };

    window.addEventListener("scroll", toggle, { passive: true });
    window.addEventListener("resize", () => { threshold = bestThreshold(); toggle(); }, { passive: true });
    toggle();

    scrollTopBtn.addEventListener("click", () => {
      const se = document.scrollingElement || document.documentElement;
      se.scrollTo({ top: 0, behavior: "smooth" });
      document.body.scrollTo({ top: 0, behavior: "smooth" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    console.log("[widget] ready (visualViewport + old scrollTop layout)");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();