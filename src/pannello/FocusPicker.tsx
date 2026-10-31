// Choosing the point of a photo to keep in view. Tap or drag on the photo (or
// use the arrow keys); the small frames show how the site crops it on a phone,
// in a square thumbnail and on a computer.
import { useEffect, useRef, useState } from 'preact/hooks';
import { photoUrl } from './content';
import { clampPoint, formatFocus, parseFocus, type Point } from './focus';

const CROPS: [label: string, ratio: string][] = [
  ['Telefono', '3 / 4'],
  ['Quadrata', '1 / 1'],
  ['Computer', '16 / 9'],
];

export function FocusPicker({ src, value, onChange }: { src: unknown; value: unknown; onChange: (v: string | undefined) => void }) {
  const url = photoUrl(src);
  const [point, setPoint] = useState<Point>(() => parseFocus(value));
  const dragging = useRef(false);
  const area = useRef<HTMLDivElement>(null);

  // follow the saved value (another photo, "Annulla le modifiche"), except mid-drag
  useEffect(() => {
    if (!dragging.current) setPoint(parseFocus(value));
  }, [value]);

  if (!url) return null;

  const at = (e: PointerEvent): Point => {
    const r = area.current!.getBoundingClientRect();
    return clampPoint([((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100]);
  };
  const save = (p: Point) => {
    const next = formatFocus(p);
    if (next !== (typeof value === 'string' ? value : undefined)) onChange(next);
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setPoint(at(e));
    e.preventDefault();
  };
  const move = (e: PointerEvent) => dragging.current && setPoint(at(e));
  const up = (e: PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const p = at(e);
    setPoint(p);
    save(p); // one change per gesture, not one per pixel
  };
  const key = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    const d: Record<string, Point> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!d[e.key]) return;
    e.preventDefault();
    const p = clampPoint([point[0] + d[e.key][0], point[1] + d[e.key][1]]);
    setPoint(p);
    save(p);
  };

  const [x, y] = point;
  const centred = x === 50 && y === 50;
  const position = `${x}% ${y}%`;

  return (
    <div class="p-focus">
      <div class="p-focus__head">
        <span class="p-input__label">Punto da tenere in vista</span>
        {!centred && (
          <button
            type="button"
            class="p-btn p-btn--small p-btn--quiet"
            onClick={() => {
              setPoint([50, 50]);
              save([50, 50]);
            }}
          >
            Torna al centro
          </button>
        )}
      </div>
      <div class="p-focus__body">
        <div
          ref={area}
          class="p-focus__pick"
          role="slider"
          tabIndex={0}
          aria-label="Punto da tenere in vista: usa le frecce per spostarlo"
          aria-valuetext={`${x}% da sinistra, ${y}% dall'alto`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={key}
        >
          <img src={url} alt="" draggable={false} />
          <span class="p-focus__dot" style={{ left: `${x}%`, top: `${y}%` }} aria-hidden="true" />
        </div>
        <div class="p-focus__crops" aria-label="Come appare la foto tagliata">
          {CROPS.map(([label, ratio]) => (
            <figure key={label}>
              <div class="p-focus__crop" style={{ aspectRatio: ratio }}>
                <img src={url} alt="" style={{ objectPosition: position }} />
              </div>
              <figcaption>{label}</figcaption>
            </figure>
          ))}
        </div>
      </div>
      <p class="p-quiet">
        Tocca la foto sul punto più importante (il muso del cavallo, un volto): quando il sito la taglia, sul telefono o nelle
        anteprime, quel punto resta sempre visibile.
      </p>
    </div>
  );
}
