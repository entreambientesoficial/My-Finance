import axios from 'axios';

const baseURL = typeof window !== 'undefined'
  ? ''
  : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

// Module-level token cache populated by onAuthStateChange.
// onAuthStateChange fires with INITIAL_SESSION as soon as the Supabase client
// reads the cookies on page load, before useQuery hooks even run.
let _token: string | null = null;
let _ready = false;
const _waiters: Array<(t: string | null) => void> = [];

function _resolve(token: string | null) {
  _token = token;
  if (!_ready) {
    _ready = true;
    _waiters.splice(0).forEach(fn => fn(token));
  }
}

function _waitForToken(): Promise<string | null> {
  if (_ready) return Promise.resolve(_token);
  return new Promise<string | null>((resolve) => {
    _waiters.push(resolve);
    // Safety timeout: never block a request forever
    setTimeout(() => {
      const i = _waiters.indexOf(resolve);
      if (i > -1) { _waiters.splice(i, 1); resolve(null); }
    }, 3000);
  });
}

if (typeof window !== 'undefined') {
  import('@/lib/supabase/client')
    .then(({ createClient }) => {
      const supabase = createClient();
      // onAuthStateChange fires immediately with INITIAL_SESSION when
      // the client has read the session from cookies.
      supabase.auth.onAuthStateChange((_event, session) => {
        _resolve(session?.access_token ?? null);
      });
    })
    .catch(() => _resolve(null));
}

api.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    const token = await _waitForToken();
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Reset token cache and let the user re-authenticate
      _token = null;
      _ready = false;
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) window.location.href = '/login';
      } catch {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
