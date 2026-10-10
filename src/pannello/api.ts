// Talks to the Pannello API (worker/pannello.js) and keeps the session.

const API: string =
  import.meta.env.PUBLIC_PANNELLO_API || (import.meta.env.DEV ? 'http://localhost:8787' : '');

const KEY = 'pannello.session';

export interface Session {
  email: string;
  session: string;
}

export function loadSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s?.session ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the session lasts until the tab closes */
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export const apiConfigured = () => Boolean(API);

export async function api<T>(path: string, opts: { method?: string; body?: unknown; session?: string } = {}): Promise<T> {
  if (!API) throw new ApiError('Il pannello non è ancora collegato al suo servizio.', 0);
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: opts.method || (opts.body ? 'POST' : 'GET'),
      headers: {
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.session ? { Authorization: `Bearer ${opts.session}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('Nessuna connessione. Controlla la rete e riprova.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Errore ${res.status}`, res.status);
  return data as T;
}
