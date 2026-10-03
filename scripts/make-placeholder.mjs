// Generates the single neutral placeholder used until real photos arrive.
// Colours are the theme tokens (settings/theme.yaml); rerun after changing them:
//   node scripts/make-placeholder.mjs
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';

const theme = readFileSync(new URL('../src/content/settings/theme.yaml', import.meta.url), 'utf8');
const token = (name) => theme.match(new RegExp(`^\\s*${name}:\\s*"([^"]+)"`, 'm'))?.[1];

const bg = token('color-surface');
const bg2 = token('color-surface-strong');
const ridge = [token('color-ridge-1'), token('color-ridge-2'), token('color-ridge-3')];
const ink = token('color-text-muted');

const W = 2400;
const H = 1600;

// Three soft mountain profiles, like the header ridges of the current site.
function profile(base, amp, off) {
  let d = '';
  for (let x = 0; x <= W; x += 12) {
    const t = (x / W) * Math.PI * 2;
    const y = H * base - amp[0] * Math.sin(t + off) - amp[1] * Math.sin(t * 3 + off * 1.4) - amp[2] * Math.sin(t * 5 + off * 2.1);
    d += `${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)} `;
  }
  return `${d}L${W} ${H} L0 ${H} Z`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <path d="${profile(0.7, [70, 30, 14], 0)}" fill="${ridge[0]}"/>
  <path d="${profile(0.8, [90, 36, 16], 1.7)}" fill="${ridge[1]}"/>
  <path d="${profile(0.9, [110, 40, 18], 3.4)}" fill="${ridge[2]}"/>
  <text x="${W / 2}" y="${H * 0.4}" text-anchor="middle" font-family="Consolas, Menlo, monospace" font-size="64" letter-spacing="12" fill="${ink}">SEGNAPOSTO</text>
  <text x="${W / 2}" y="${H * 0.4 + 90}" text-anchor="middle" font-family="Consolas, Menlo, monospace" font-size="40" letter-spacing="6" fill="${ink}">foto in arrivo</text>
</svg>`;

const out = new URL('../src/assets/foto/', import.meta.url);
mkdirSync(out, { recursive: true });
await sharp(Buffer.from(svg)).jpeg({ quality: 82, mozjpeg: true }).toFile(new URL('segnaposto.jpg', out).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
console.log('src/assets/foto/segnaposto.jpg written');
