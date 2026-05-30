/* ==========================================================================
   Earthling Aid Tech — site.js
   Vanilla JS, no dependencies. Defer-loaded.
   Responsibilities:
     1. Reduced-motion detection
     2. Mobile nav drawer (open/close, focus trap, ESC, scroll-lock)
     3. Sticky-header shadow on scroll
     4. IntersectionObserver scroll-reveal (no-op under reduced motion)
     5. Inject current year into footer
     6. Active-nav-link highlighting by pathname
     7. Optional lightweight canvas "node field" hero background
   All features fail gracefully if their target elements are absent.
   ========================================================================== */
(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  /* ----------------------------------------------------------------------
     0. No-JS fallback flip: if JS runs, remove .no-reveal so reveals arm.
     (Set <html class="no-reveal"> in markup so content shows without JS.)
     ---------------------------------------------------------------------- */
  function armReveals() {
    if (prefersReducedMotion) return; // keep content visible, skip animation
    document.documentElement.classList.remove("no-reveal");
  }

  /* ----------------------------------------------------------------------
     1. CURRENT YEAR
     Any element with [data-year] gets the current year injected.
     ---------------------------------------------------------------------- */
  function injectYear() {
    var year = String(new Date().getFullYear());
    var nodes = document.querySelectorAll("[data-year]");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = year;
  }

  /* ----------------------------------------------------------------------
     2. ACTIVE NAV LINK by pathname
     Marks links whose href matches the current file as .is-active.
     Treats "/" and "/index.html" as equivalent.
     ---------------------------------------------------------------------- */
  function normalizePath(path) {
    try {
      var p = path.split("?")[0].split("#")[0];
      // last path segment
      var seg = p.replace(/\/+$/, "").split("/").pop();
      if (!seg || seg === "") seg = "index.html";
      return seg.toLowerCase();
    } catch (e) {
      return "index.html";
    }
  }

  function highlightActiveNav() {
    var current = normalizePath(window.location.pathname);
    var links = document.querySelectorAll(
      ".site-nav__link, .nav-drawer__link"
    );
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var href = link.getAttribute("href");
      if (!href) continue;
      // ignore external / mailto / pure-anchor links
      if (/^(https?:|mailto:|tel:|#)/i.test(href)) continue;
      if (normalizePath(href) === current) {
        link.classList.add("is-active");
        link.setAttribute("aria-current", "page");
      } else {
        link.classList.remove("is-active");
        link.removeAttribute("aria-current");
      }
    }
  }

  /* ----------------------------------------------------------------------
     3. STICKY HEADER SHADOW
     ---------------------------------------------------------------------- */
  function initStickyHeader() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    var ticking = false;
    function update() {
      if (window.scrollY > 8) header.classList.add("is-scrolled");
      else header.classList.remove("is-scrolled");
      ticking = false;
    }
    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ----------------------------------------------------------------------
     4. MOBILE NAV DRAWER
     Expects:
       <button class="nav-toggle" aria-controls="nav-drawer" aria-expanded="false">
       <div class="nav-drawer" id="nav-drawer"> … .nav-drawer__overlay … .nav-drawer__close …
     ---------------------------------------------------------------------- */
  function initNavDrawer() {
    var toggle = document.querySelector(".nav-toggle");
    var drawer = document.getElementById("nav-drawer");
    if (!toggle || !drawer) return;

    var overlay = drawer.querySelector(".nav-drawer__overlay");
    var closeBtn = drawer.querySelector(".nav-drawer__close");
    var panel = drawer.querySelector(".nav-drawer__panel");
    var lastFocused = null;

    function focusables() {
      return drawer.querySelectorAll(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
      );
    }

    function open() {
      lastFocused = document.activeElement;
      drawer.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");
      toggle.setAttribute("aria-expanded", "true");
      document.body.classList.add("no-scroll");
      // focus first actionable element in the panel
      var f = focusables();
      if (f.length) {
        window.setTimeout(function () {
          (closeBtn || f[0]).focus();
        }, 60);
      }
      document.addEventListener("keydown", onKeydown);
    }

    function close() {
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("no-scroll");
      document.removeEventListener("keydown", onKeydown);
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus();
      }
    }

    function isOpen() {
      return drawer.classList.contains("is-open");
    }

    function onKeydown(e) {
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "Tab") {
        var f = focusables();
        if (!f.length) return;
        var first = f[0];
        var last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    toggle.addEventListener("click", function () {
      isOpen() ? close() : open();
    });
    if (overlay) overlay.addEventListener("click", close);
    if (closeBtn) closeBtn.addEventListener("click", close);

    // Close after following an in-page nav link
    var links = drawer.querySelectorAll(".nav-drawer__link");
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener("click", function () {
        // allow navigation; close drawer state
        close();
      });
    }

    // Close drawer if viewport grows to desktop
    var mq = window.matchMedia("(min-width: 1024px)");
    var mqHandler = function (ev) {
      if (ev.matches && isOpen()) close();
    };
    if (mq.addEventListener) mq.addEventListener("change", mqHandler);
    else if (mq.addListener) mq.addListener(mqHandler);

    // Prevent panel clicks from bubbling to overlay
    if (panel) {
      panel.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }
  }

  /* ----------------------------------------------------------------------
     5. SCROLL REVEAL (IntersectionObserver)
     Targets [data-reveal] and [data-reveal-stagger]. No-op + immediate show
     under reduced motion or when IO is unsupported.
     ---------------------------------------------------------------------- */
  function initScrollReveal() {
    var targets = document.querySelectorAll(
      "[data-reveal], [data-reveal-stagger]"
    );
    if (!targets.length) return;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      for (var i = 0; i < targets.length; i++) {
        targets[i].classList.add("is-revealed");
      }
      return;
    }

    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            obs.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
    );

    for (var j = 0; j < targets.length; j++) observer.observe(targets[j]);
  }

  /* ----------------------------------------------------------------------
     6. OPTIONAL NODE-FIELD HERO CANVAS
     Activates only for a container marked [data-node-field].
     Creates <canvas class="hero__canvas"> inside it. Lightweight: capped
     node count, capped DPR, connects nearby nodes with faint lines, a soft
     parallax toward the pointer. Pauses when offscreen / tab hidden.
     Degrades gracefully: skipped entirely under reduced motion.
     ---------------------------------------------------------------------- */
  function initNodeField() {
    var host = document.querySelector("[data-node-field]");
    if (!host) return;
    if (prefersReducedMotion) return; // honor reduced motion: no canvas anim

    var canvas = document.createElement("canvas");
    canvas.className = "hero__canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.insertBefore(canvas, host.firstChild);
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    var width = 0;
    var height = 0;
    var nodes = [];
    var pointer = { x: 0.5, y: 0.4, active: false };
    var rafId = null;
    var running = false;

    var ACCENT = "74, 158, 255"; // matches --accent

    function nodeCount() {
      // density scaled to area, capped for performance
      var area = width * height;
      var n = Math.round(area / 26000);
      return Math.max(18, Math.min(n, 64));
    }

    function seedNodes() {
      nodes = [];
      var count = nodeCount();
      for (var i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.18,
          r: Math.random() * 1.4 + 0.6
        });
      }
    }

    function resize() {
      var rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * DPR);
      canvas.height = Math.floor(height * DPR);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      seedNodes();
    }

    var connectDist = 130;

    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);

      var px = pointer.x * width;
      var py = pointer.y * height;

      // update + draw nodes
      for (var i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        a.x += a.vx;
        a.y += a.vy;

        // gentle wrap
        if (a.x < -20) a.x = width + 20;
        else if (a.x > width + 20) a.x = -20;
        if (a.y < -20) a.y = height + 20;
        else if (a.y > height + 20) a.y = -20;

        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + ACCENT + ", 0.55)";
        ctx.fill();
      }

      // connections
      for (var m = 0; m < nodes.length; m++) {
        var n1 = nodes[m];
        for (var k = m + 1; k < nodes.length; k++) {
          var n2 = nodes[k];
          var dx = n1.x - n2.x;
          var dy = n1.y - n2.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectDist) {
            var alpha = (1 - dist / connectDist) * 0.22;
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.strokeStyle = "rgba(" + ACCENT + ", " + alpha.toFixed(3) + ")";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        // link to pointer for subtle interactivity
        if (pointer.active) {
          var pdx = n1.x - px;
          var pdy = n1.y - py;
          var pdist = Math.sqrt(pdx * pdx + pdy * pdy);
          if (pdist < connectDist * 1.4) {
            var pAlpha = (1 - pdist / (connectDist * 1.4)) * 0.3;
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(px, py);
            ctx.strokeStyle = "rgba(" + ACCENT + ", " + pAlpha.toFixed(3) + ")";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      rafId = window.requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      rafId = window.requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = null;
    }

    // pointer parallax (host-relative)
    host.addEventListener(
      "pointermove",
      function (e) {
        var rect = host.getBoundingClientRect();
        pointer.x = (e.clientX - rect.left) / rect.width;
        pointer.y = (e.clientY - rect.top) / rect.height;
        pointer.active = true;
      },
      { passive: true }
    );
    host.addEventListener("pointerleave", function () {
      pointer.active = false;
    });

    // pause when offscreen
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) start();
            else stop();
          });
        },
        { threshold: 0.01 }
      );
      io.observe(host);
    } else {
      start();
    }

    // pause when tab hidden
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else start();
    });

    // debounced resize
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 180);
    });

    resize();
    start();
  }

  /* ----------------------------------------------------------------------
     INIT
     ---------------------------------------------------------------------- */
  function init() {
    armReveals();
    injectYear();
    highlightActiveNav();
    initStickyHeader();
    initNavDrawer();
    initScrollReveal();
    initNodeField();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
