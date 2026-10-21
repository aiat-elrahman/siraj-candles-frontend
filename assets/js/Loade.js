/* Siraj Candles — page-load counter.
   Include as the FIRST script in <head> (no defer/async):
       <script src="assets/js/loader.js"></script>
   It paints a branded screen with a counting percentage at once, then removes it when the
   page's data (every /api/ request) has really finished loading, so visitors never stare at
   an empty page while the server wakes up. Self-contained: no other file is needed, and the
   site works exactly as before if this file is missing. */
(function () {
    'use strict';
    if (window.SirajLoader) return;

    // ---- the only wording in this file; change here if you ever want different text ----
    var SLOW_AFTER_MS = 5000;
    var SLOW_TEXT = 'Warming things up… almost there';
    var GIVE_UP_MS = 60000;      // never block the page longer than this
    var SETTLE_MS = 250;         // quiet time with no API requests before we call it "loaded"

    var root = document.documentElement;
    var started = Date.now();
    var shownOnce = false;
    try { shownOnce = sessionStorage.getItem('sirajLoaderSeen') === '1'; } catch (e) {}

    var overlay, numEl, barEl, msgEl, shown = false, finished = false;
    var pending = 0, settleTimer = null, domReady = false, displayed = 0, raf = null;

    // ---- styles + markup (brand tokens) ----
    function build() {
        var css = document.createElement('style');
        css.textContent =
            '#siraj-loader{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
            'background:#1E1023;color:#FCE7F3;transition:opacity .45s ease,visibility .45s ease;opacity:1}' +
            '#siraj-loader.sl-hide{opacity:0;visibility:hidden;pointer-events:none}' +
            '#siraj-loader .sl-logo{font-family:"Cormorant Garamond",Georgia,serif;letter-spacing:.32em;font-size:1.05rem;font-weight:600;margin-bottom:26px;color:#F472B6}' +
            '#siraj-loader .sl-logo span{color:#FCE7F3;font-weight:400;margin-left:.5em}' +
            '#siraj-loader .sl-num{font-family:"Cormorant Garamond",Georgia,serif;font-size:clamp(4rem,16vw,7rem);line-height:1;font-weight:700;color:#fff;font-variant-numeric:tabular-nums}' +
            '#siraj-loader .sl-num small{font-size:.35em;color:#F472B6;margin-left:.1em}' +
            '#siraj-loader .sl-bar{width:min(260px,60vw);height:2px;background:rgba(216,180,216,.25);margin-top:22px;border-radius:2px;overflow:hidden}' +
            '#siraj-loader .sl-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#BE185D,#F472B6)}' +
            '#siraj-loader .sl-msg{font-family:Montserrat,Arial,sans-serif;font-size:.78rem;letter-spacing:.08em;color:#D8B4D8;margin-top:18px;min-height:1.2em;opacity:0;transition:opacity .4s}' +
            '#siraj-loader .sl-msg.on{opacity:1}' +
            'html.sl-lock{overflow:hidden!important}';
        overlay = document.createElement('div');
        overlay.id = 'siraj-loader';
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-label', 'Loading');
        overlay.innerHTML =
            '<div class="sl-logo">SIRAJ<span>CANDLES</span></div>' +
            '<div class="sl-num"><b id="sl-n">0</b><small>%</small></div>' +
            '<div class="sl-bar"><i id="sl-b"></i></div>' +
            '<div class="sl-msg" id="sl-m"></div>';
        root.appendChild(css);
        root.appendChild(overlay);
        root.classList.add('sl-lock');
        numEl = overlay.querySelector('#sl-n');
        barEl = overlay.querySelector('#sl-b');
        msgEl = overlay.querySelector('#sl-m');
        shown = true;
        tick();
    }

    // ---- counting: eases toward ~92% while waiting, snaps to 100 when really done ----
    function target() {
        if (finished) return 100;
        var t = Date.now() - started;
        // fast start, then slows and never reaches 100 by itself
        return Math.min(92, 92 * (1 - Math.exp(-t / 2600)));
    }
    function paint() {
        var n = Math.round(displayed);
        numEl.textContent = n;
        barEl.style.width = displayed + '%';
        if (!finished && Date.now() - started > SLOW_AFTER_MS) {
            msgEl.textContent = SLOW_TEXT; msgEl.className = 'sl-msg on';
        }
    }
    function tick() {
        if (!shown) return;
        var goal = target();
        var step = finished ? Math.max(2, (100 - displayed) * 0.25) : 0.6;
        if (displayed < goal) displayed = Math.min(goal, displayed + step);
        paint();
        if (finished && displayed >= 100) { return hide(); }
        raf = requestAnimationFrame(tick);
    }
    function hide() {
        if (!shown) return;
        shown = false;
        overlay.classList.add('sl-hide');
        root.classList.remove('sl-lock');
        try { sessionStorage.setItem('sirajLoaderSeen', '1'); } catch (e) {}
        setTimeout(function () { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 600);
    }

    // ---- know when the page's data has really arrived ----
    function isApi(url) {
        url = String(url || '');
        return url.indexOf('/api/') > -1 && url.indexOf('/api/tracking') === -1 && url.indexOf('/api/push') === -1;
    }
    function maybeFinish() {
        clearTimeout(settleTimer);
        if (finished || !domReady || pending > 0) return;
        settleTimer = setTimeout(function () {
            if (pending === 0) finish();
        }, SETTLE_MS);
    }
    function finish() {
        if (finished) return;
        finished = true;
        if (!shown) return;           // never became visible (very fast page): nothing to animate
        if (!raf) tick();
    }

    var nativeFetch = window.fetch;
    if (typeof nativeFetch === 'function') {
        window.fetch = function (input) {
            var url = typeof input === 'string' ? input : (input && input.url);
            if (!isApi(url) || finished) return nativeFetch.apply(this, arguments);
            pending++;
            var done = function () { pending = Math.max(0, pending - 1); maybeFinish(); };
            var p = nativeFetch.apply(this, arguments);
            p.then(done, done);
            return p;
        };
    }

    document.addEventListener('DOMContentLoaded', function () { domReady = true; maybeFinish(); });
    // Back/forward cache restores a finished page: make sure no stale overlay is shown.
    window.addEventListener('pageshow', function (e) { if (e.persisted) { finished = true; hide(); } });
    setTimeout(function () { finished = true; if (shown) { displayed = Math.max(displayed, 99); tick(); } }, GIVE_UP_MS);

    window.SirajLoader = { done: function () { pending = 0; domReady = true; finish(); } };

    // First visit this session: show immediately. Later page views: only if it is slow (>350ms),
    // so quick navigations don't flash a screen.
    if (!shownOnce) build();
    else setTimeout(function () { if (!finished && !shown) build(); }, 350);
})();