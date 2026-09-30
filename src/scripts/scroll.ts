/*
 * One shared requestAnimationFrame loop for everything that follows the
 * scroll position. Scroll events only wake the loop; the work happens once
 * per frame, and the loop goes back to sleep after half a second of stillness.
 */
type Listener = (y: number) => void;

const listeners = new Set<Listener>();
let running = false;
let lastY = -1;
let still = 0;

function frame() {
  const y = window.scrollY;
  if (y !== lastY) {
    lastY = y;
    still = 0;
    listeners.forEach((fn) => fn(y));
  } else if (++still > 30) {
    running = false;
    return;
  }
  requestAnimationFrame(frame);
}

export function wake() {
  if (running) return;
  running = true;
  still = 0;
  requestAnimationFrame(frame);
}

window.addEventListener('scroll', wake, { passive: true });

/** Calls `fn` with the scroll position once now and on every frame the page moves. */
export function onScroll(fn: Listener) {
  listeners.add(fn);
  fn(window.scrollY);
}

/** Run every listener again (after a layout change). */
export function refresh() {
  lastY = -1;
  wake();
}
