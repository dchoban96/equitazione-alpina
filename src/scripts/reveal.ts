/* Scroll reveal: each block fades and rises into place the first time it
   enters the viewport, and never again. */
(window as unknown as { __eaReveal: boolean }).__eaReveal = true;

const blocks = document.querySelectorAll<HTMLElement>('.reveal');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (reduced || !('IntersectionObserver' in window)) {
  blocks.forEach((b) => b.classList.add('is-in'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    },
    { threshold: 0, rootMargin: '0px 0px -60px 0px' },
  );
  blocks.forEach((b) => io.observe(b));
}
