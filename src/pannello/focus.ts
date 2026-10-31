// The point of a photo that stays in view when the site crops it: "x% y%" from
// the top-left corner, saved next to the photo (`focus`, `coverFocus` for an
// article cover) and used by the site as CSS object-position. No value means
// the centre.

export type Point = [x: number, y: number];

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

export function parseFocus(v: unknown): Point {
  const m = typeof v === 'string' ? v.match(/^(\d{1,3})% (\d{1,3})%$/) : null;
  return m ? [clamp(Number(m[1])), clamp(Number(m[2]))] : [50, 50];
}

/** The value to save: undefined for the centre, so files stay as they were. */
export const formatFocus = ([x, y]: Point): string | undefined =>
  clamp(x) === 50 && clamp(y) === 50 ? undefined : `${clamp(x)}% ${clamp(y)}%`;

export const clampPoint = ([x, y]: Point): Point => [clamp(x), clamp(y)];

/** "Al centro", "In alto a sinistra"… for a read-only view. */
export function focusLabel(v: unknown): string {
  const [x, y] = parseFocus(v);
  const h = x < 34 ? 'a sinistra' : x > 66 ? 'a destra' : '';
  const vert = y < 34 ? 'in alto' : y > 66 ? 'in basso' : '';
  if (!h && !vert) return 'Al centro';
  return [vert, h].filter(Boolean).join(' ').replace(/^./, (c) => c.toUpperCase());
}
