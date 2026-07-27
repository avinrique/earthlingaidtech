/**
 * Drive a requestAnimationFrame loop only while its element is on screen.
 *
 * rAF already stops for a backgrounded *tab*, but not for a canvas the user
 * has simply scrolled past — the Curio page runs four physics simulations, and
 * without this they all keep integrating and repainting forever, which on a
 * phone reads as heat and a flat battery.
 */
export function loopWhileVisible(el: Element, step: (now: number) => void) {
  let raf = 0;
  let running = false;

  const frame = (now: number) => {
    step(now);
    raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  let onScreen = true;
  if ('IntersectionObserver' in window) {
    onScreen = false;
    new IntersectionObserver(
      (entries) => {
        onScreen = entries[0].isIntersecting;
        if (onScreen && !document.hidden) start();
        else stop();
      },
      { threshold: 0 },
    ).observe(el);
  } else {
    start();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (onScreen) start();
  });
  window.addEventListener('pagehide', stop);

  return { start, stop };
}
