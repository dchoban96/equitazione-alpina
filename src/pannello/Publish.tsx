// Pubblica: re-reads the site, checks every edited page, then sends all the
// edits in one commit. The site rebuilds and is live in a few minutes.
import { useEffect, useState } from 'preact/hooks';
import { api, ApiError, type Session } from './api';
import { buildModel, type Model, type RawFile } from './content';
import { discard, rebase, useDrafts } from './drafts';
import { blobBody, dropPending, getPending, pendingNames, photoRefs } from './photos';
import { fileText } from './save';
import { problems } from './validate';

type Phase = 'checking' | 'ready' | 'sending' | 'done' | 'error';

const fetchModel = (session: Session) =>
  api<{ head: string; files: RawFile[]; photos: string[] }>('/content', { session: session.session }).then((r) =>
    buildModel(r.head, r.files, r.photos),
  );

export function PublishDialog({ session, onClose, onPublished }: { session: Session; onClose: () => void; onPublished: (m: Model) => void }) {
  const drafts = useDrafts();
  const [phase, setPhase] = useState<Phase>('checking');
  const [fresh, setFresh] = useState<Model | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [uploaded] = useState(() => new Map<string, string>()); // photo name -> blob sha, kept across a retry

  const check = async () => {
    setPhase('checking');
    try {
      const m = await fetchModel(session);
      setFresh(m);
      setPhase('ready');
      return m;
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
      return null;
    }
  };
  useEffect(() => void check(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && phase !== 'sending' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [phase]);

  const entries = Object.entries(drafts).map(([id, d]) => {
    const item = fresh?.byId.get(id);
    return {
      id,
      draft: d,
      item,
      title: d.data.title || item?.title || id,
      stale: Boolean(item && item.file.sha !== d.sha),
      issues: item ? problems(item, d.data, d.body) : ['Questa pagina non esiste più sul sito.'],
    };
  });
  const blocked = entries.some((e) => e.stale || e.issues.length);

  const send = async (m: Model, retried = false): Promise<void> => {
    setPhase('sending');
    const files = entries.map((e) => ({
      path: e.id,
      text: fileText(e.item!.file, e.draft.data, e.item!.kind === 'article' ? e.draft.body : undefined),
    }));
    const titles = entries.map((e) => e.title);
    const summary = titles.length > 3 ? `${titles.slice(0, 3).join(', ')} e altre ${titles.length - 3}` : titles.join(', ');

    // new photos the edits use, uploaded one by one before the commit
    const pending = new Set(pendingNames());
    const used = new Set(entries.flatMap((e) => [...photoRefs(e.draft.data)]));
    const newPhotos = [...used].filter((n) => pending.has(n));

    // photos the edited pages used before and that no page uses any more are removed from the site
    const before = new Set(entries.flatMap((e) => [...photoRefs(e.item!.data)]));
    const after = new Set<string>();
    for (const [id, it] of m.byId) photoRefs(drafts[id]?.data ?? it.data, after);
    const existing = new Set(m.photos);
    const removed = [...before].filter((n) => !after.has(n) && existing.has(n));

    try {
      for (const [i, name] of newPhotos.entries()) {
        if (uploaded.has(name)) continue;
        setProgress(`Carico le foto… ${i + 1} di ${newPhotos.length}`);
        const blob = await getPending(name);
        if (!blob) throw new Error('Una foto nuova non è più in questo browser: aggiungila di nuovo.');
        const { sha } = await api<{ sha: string }>('/blob', { session: session.session, raw: await blobBody(blob) });
        uploaded.set(name, sha);
      }
      setProgress('Pubblico…');
      await api('/publish', {
        session: session.session,
        body: {
          base: m.head,
          files,
          blobs: newPhotos.map((n) => ({ path: `src/assets/foto/${n}`, sha: uploaded.get(n) })),
          deletions: removed.map((n) => `src/assets/foto/${n}`),
          summary,
        },
      });
      discard(entries.map((e) => e.id));
      await dropPending(newPhotos);
      onPublished(await fetchModel(session).catch(() => m));
      setPhase('done');
    } catch (e) {
      // someone published in between: read again, and go on if none of these pages changed
      if (e instanceof ApiError && e.status === 409 && !retried) {
        const again = await check();
        if (again && !entries.some((x) => again.byId.get(x.id)?.file.sha !== x.draft.sha)) return send(again, true);
        return;
      }
      setError((e as Error).message);
      setPhase('error');
    } finally {
      setProgress('');
    }
  };

  return (
    <div class="p-dialog" role="dialog" aria-modal="true" aria-labelledby="p-publish-title">
      <div class="p-dialog__box">
        <h2 id="p-publish-title">Pubblica sul sito</h2>
        {phase === 'checking' && <p class="p-quiet">Controllo le modifiche…</p>}
        {phase === 'error' && (
          <>
            <p class="p-error">{error}</p>
            <p class="p-quiet">Le modifiche restano salvate in questo browser: puoi riprovare.</p>
          </>
        )}
        {phase === 'done' && (
          <p>
            Fatto. Il sito si aggiorna entro qualche minuto: in basso a sinistra vedi quando la pubblicazione è terminata.
          </p>
        )}
        {(phase === 'ready' || phase === 'sending') && (
          <>
            <p>
              {entries.length === 1 ? 'Questa pagina andrà online' : `Queste ${entries.length} pagine andranno online`} così come le
              vedi nel pannello.
            </p>
            <ul class="p-publist">
              {entries.map((e) => (
                <li key={e.id}>
                  <strong>{e.title}</strong>
                  {e.stale && (
                    <div class="p-issues">
                      Qualcuno l'ha pubblicata dopo che hai iniziato a modificarla. «Unisci» porta le tue modifiche sulla versione nuova: dove avete cambiato lo stesso testo resta il tuo.
                      <div class="p-draftbar__actions">
                        <button type="button" class="p-btn p-btn--small" onClick={() => rebase(e.item!)}>Unisci le modifiche</button>
                        <button type="button" class="p-btn p-btn--small" onClick={() => discard([e.id])}>Scarta le mie</button>
                      </div>
                    </div>
                  )}
                  {e.issues.length > 0 && (
                    <ul class="p-issues">
                      {e.issues.map((t) => <li key={t}>{t}</li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        <div class="p-dialog__actions">
          {phase === 'done' || !entries.length ? (
            <button type="button" class="p-btn p-btn--primary" onClick={onClose}>Chiudi</button>
          ) : (
            <>
              <button type="button" class="p-btn p-btn--quiet" onClick={onClose} disabled={phase === 'sending'}>Annulla</button>
              {phase === 'error' ? (
                <button type="button" class="p-btn" onClick={check}>Riprova</button>
              ) : (
                <button type="button" class="p-btn p-btn--primary" disabled={phase !== 'ready' || blocked} onClick={() => send(fresh!)}>
                  {phase === 'sending' ? progress || 'Pubblico…' : 'Pubblica ora'}
                </button>
              )}
            </>
          )}
        </div>
        {phase === 'ready' && blocked && <p class="p-quiet">Sistema i punti indicati e torna qui.</p>}
      </div>
    </div>
  );
}
