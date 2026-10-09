/**
 * motion — the site's scroll choreography (GSAP + ScrollTrigger + SplitText, Lenis on desktop).
 *
 * Base.astro imports this lazily and only when the visitor has not asked for reduced motion, so
 * none of it is on the critical path. Every effect is opt-in by attribute, and every element it
 * touches is fully readable before it runs — the module only ever animates *from* a hidden
 * state it set itself, so a failed import leaves a normal, static page.
 *
 *   [data-split]          heading revealed word by word ("hero" = per-character 3D rise)
 *   [data-count]          number counts up when it scrolls in
 *   [data-tilt]           card tilts toward the pointer with a moving glare (fine pointers)
 *   [data-magnetic]       button leans toward the pointer (fine pointers)
 *   [data-kinetic]        giant text row that drifts, and speeds up / skews with scroll velocity
 *   [data-stack]          sticky product cards that recede as the next one slides over
 *   [data-steps]          process steps whose rules fill in sequence as you scroll
 *   [data-parallax]       image that drifts inside its frame
 *   [data-hero]           hero copy lifts away / brand mark leans as you scroll and point
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export function initMotion() {
  smoothScroll();
  splitHeadings();
  counters();
  hero();
  kinetic();
  stack();
  steps();
  parallax();
  if (finePointer) {
    tilt();
    magnetic();
  }
  // Fonts and lazy images change layout after first measure.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

/* ---- Lenis: inertial scrolling on desktop only. Touch keeps native scrolling, which is both
   what phone users expect and far cheaper. ---- */
function smoothScroll() {
  if (!finePointer) return;
  const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.95 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ---- Headings: words rise out of a line mask. The hero gets a per-character 3D flip. ---- */
function splitHeadings() {
  document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
    // The safety timeout in Base.astro may already have revealed it on a slow connection;
    // animating it now would make visible text vanish and replay.
    if (el.hasAttribute('data-split-ready')) return;
    const isHero = el.dataset.split === 'hero';

    SplitText.create(el, {
      type: isHero ? 'lines,words,chars' : 'lines,words',
      mask: 'lines',
      linesClass: 'split-line',
      wordsClass: 'split-word',
      charsClass: 'split-char',
      autoSplit: true,
      onSplit(self) {
        // A gradient word is painted with background-clip:text on its wrapper, which stops
        // painting once its letters move onto their own transformed layers. Give every piece
        // the gradient, sized and offset to the wrapper, so it still reads as one sweep.
        el.querySelectorAll<HTMLElement>('.text-gradient').forEach((g) => {
          const box = g.getBoundingClientRect();
          g.querySelectorAll<HTMLElement>(isHero ? '.split-char' : '.split-word').forEach((p) => {
            const r = p.getBoundingClientRect();
            p.classList.add('text-gradient');
            p.style.backgroundSize = `${box.width}px ${box.height}px`;
            p.style.backgroundPosition = `${box.left - r.left}px ${box.top - r.top}px`;
          });
        });
        el.setAttribute('data-split-ready', '');

        if (isHero) {
          return gsap.from(self.chars, {
            yPercent: 115,
            rotateX: -85,
            transformPerspective: 600,
            opacity: 0,
            transformOrigin: '50% 100%',
            duration: 1.15,
            ease: 'expo.out',
            stagger: 0.02,
            delay: 0.1,
          });
        }
        return gsap.from(self.words, {
          yPercent: 110,
          opacity: 0,
          duration: 0.95,
          ease: 'expo.out',
          stagger: 0.045,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      },
    });
  });
}

/* ---- Counters: "1.7k+" counts 0 → 1.7 and keeps its suffix; "100%" counts to 100. ---- */
function counters() {
  document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
    const raw = (el.textContent ?? '').trim();
    const m = raw.match(/^([^\d]*)([\d,]*\.?\d+)(.*)$/);
    if (!m) return;
    const [, prefix, num, suffix] = m;
    const target = parseFloat(num.replace(/,/g, ''));
    if (!Number.isFinite(target)) return;
    const decimals = (num.split('.')[1] ?? '').length;
    const grouped = num.includes(',');
    const fmt = (v: number) => {
      const s = decimals ? v.toFixed(decimals) : Math.round(v).toString();
      return grouped ? Number(s).toLocaleString('en-IN') : s;
    };
    const state = { v: 0 };
    gsap.to(state, {
      v: target,
      duration: 1.6,
      ease: 'power3.out',
      immediateRender: false,
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      onStart: () => { el.textContent = prefix + fmt(0) + suffix; },
      onUpdate: () => { el.textContent = prefix + fmt(state.v) + suffix; },
      onComplete: () => { el.textContent = raw; },
    });
  });
}

/* ---- Hero: copy drifts up and fades as it scrolls away; the brand mark leans after the
   pointer and grows slightly on the way out. ---- */
function hero() {
  const root = document.querySelector<HTMLElement>('[data-hero]');
  if (!root) return;
  const copy = root.querySelector<HTMLElement>('[data-hero-copy]');
  const mark = root.querySelector<HTMLElement>('[data-hero-mark]');
  const wave = root.querySelector<HTMLElement>('[data-wave]');

  const scrub = { trigger: root, start: 'top top', end: 'bottom top', scrub: true };
  if (copy) gsap.to(copy, { yPercent: -18, opacity: 0.15, ease: 'none', scrollTrigger: scrub });
  if (mark) gsap.to(mark, { y: 80, scale: 1.12, ease: 'none', scrollTrigger: { ...scrub } });
  // fromTo, not to: the canvas starts at opacity 0 (it fades in once WebGL draws), and a `to`
  // would record that 0 as its start value and pin the wave invisible at the top of the page.
  if (wave) gsap.fromTo(wave, { yPercent: 0, opacity: 1 }, { yPercent: 12, opacity: 0.35, ease: 'none', scrollTrigger: { ...scrub } });

  if (mark && finePointer) {
    gsap.set(mark, { transformPerspective: 900 });
    const rx = gsap.quickTo(mark, 'rotationX', { duration: 0.9, ease: 'power3.out' });
    const ry = gsap.quickTo(mark, 'rotationY', { duration: 0.9, ease: 'power3.out' });
    root.addEventListener('pointermove', (e) => {
      const r = root.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      ry(nx * 16);
      rx(-ny * 12);
    });
    root.addEventListener('pointerleave', () => { rx(0); ry(0); });
  }
}

/* ---- Kinetic type: rows drift continuously; scrolling pushes them faster and skews them,
   then they settle back. Each row holds its content twice, so wrapping at -50% is seamless. ---- */
function kinetic() {
  const rows = gsap.utils.toArray<HTMLElement>('[data-kinetic]');
  if (!rows.length) return;
  let velocity = 0;
  ScrollTrigger.create({
    trigger: rows[0].parentElement!,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => { velocity = self.getVelocity(); },
  });

  rows.forEach((row) => {
    const dir = Number(row.dataset.kinetic) || 1;
    const wrap = gsap.utils.wrap(-50, 0);
    let x = dir > 0 ? -25 : -10;
    let skew = 0;
    const setX = gsap.quickSetter(row, 'xPercent');
    const setSkew = gsap.quickSetter(row, 'skewX', 'deg');
    let visible = false;
    ScrollTrigger.create({ trigger: row, start: 'top bottom', end: 'bottom top', onToggle: (s) => { visible = s.isActive; } });

    gsap.ticker.add((_, delta) => {
      if (!visible) return;
      const boost = Math.min(Math.abs(velocity) / 300, 14);
      x = wrap(x - dir * (0.012 + boost * 0.01) * delta * 0.06);
      setX(x);
      const targetSkew = gsap.utils.clamp(-12, 12, (velocity / -220) * dir);
      skew += (targetSkew - skew) * 0.1;
      setSkew(skew);
    });
  });
  // let the boost decay when scrolling stops
  gsap.ticker.add(() => { velocity *= 0.92; });
}

/* ---- Product stack: each card pins under the header; as the next card slides over it, the
   one beneath recedes and dims. Only where the layout is actually sticky (see `stack:` in
   global.css) — on phones the cards stay in normal flow. ---- */
function stack() {
  const mm = gsap.matchMedia();
  mm.add('(min-width: 64rem) and (min-height: 45rem)', () => {
    const items = gsap.utils.toArray<HTMLElement>('[data-stack-item]');
    items.forEach((item, i) => {
      const next = items[i + 1];
      if (!next) return;
      const card = item.querySelector<HTMLElement>('[data-stack-card]');
      const shade = item.querySelector<HTMLElement>('[data-stack-shade]');
      if (!card) return;
      const tl = gsap.timeline({
        scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 30%', scrub: true },
      });
      // Shrink from the top edge so the receding card's rim stays visible above the next one —
      // that peeking edge is what makes it read as a deck rather than a slideshow.
      gsap.set(card, { transformOrigin: '50% 0%' });
      tl.to(card, { scale: 0.92 + i * 0.02, ease: 'none' }, 0);
      if (shade) tl.to(shade, { opacity: 0.55, ease: 'none' }, 0);
    });
  });
}

/* ---- Process steps: the rule under each number fills in turn as the section scrolls. ---- */
function steps() {
  document.querySelectorAll<HTMLElement>('[data-steps]').forEach((list) => {
    const fills = list.querySelectorAll<HTMLElement>('[data-step-fill]');
    const nums = list.querySelectorAll<HTMLElement>('[data-step-num]');
    if (!fills.length) return;
    gsap.set(fills, { scaleX: 0 });
    const tl = gsap.timeline({
      scrollTrigger: { trigger: list, start: 'top 75%', end: 'bottom 55%', scrub: 0.6 },
    });
    fills.forEach((f, i) => {
      tl.to(f, { scaleX: 1, ease: 'none', duration: 1 });
      if (nums[i]) tl.fromTo(nums[i], { opacity: 0.35 }, { opacity: 1, duration: 0.3 }, '<');
    });
  });
}

/* ---- Parallax: an image drifts a little against its frame. ---- */
function parallax() {
  document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((img) => {
    const frame = img.closest<HTMLElement>('[data-parallax-frame]') ?? img.parentElement!;
    gsap.fromTo(
      img,
      { yPercent: -7, scale: 1.16 },
      { yPercent: 7, scale: 1.16, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true } },
    );
  });
}

/* ---- Tilt: cards lean toward the pointer; CSS paints a glare and a lit border from
   --mx / --my (global.css). ---- */
function tilt() {
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((card) => {
    const max = Number(card.dataset.tilt) || 7;
    let armed = false;
    const rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' });

    card.addEventListener('pointerenter', () => {
      if (armed) return;
      armed = true;
      // The card's own CSS transition includes `transform` (for the scroll reveal). Left in
      // place it would smear every frame of the tilt; drop it now that the reveal is done.
      card.style.transitionProperty = 'opacity, translate, border-color, background-color, box-shadow';
      gsap.set(card, { transformPerspective: 1000 });
    });
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
      card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
      ry((px - 0.5) * max * 2);
      rx(-(py - 0.5) * max * 2);
    });
    card.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });
}

/* ---- Magnetic buttons ---- */
function magnetic() {
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    el.style.transitionProperty = 'color, background-color, border-color, box-shadow, translate, opacity';
    const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * 0.28);
      y((e.clientY - (r.top + r.height / 2)) * 0.38);
    });
    el.addEventListener('pointerleave', () => { x(0); y(0); });
  });
}
