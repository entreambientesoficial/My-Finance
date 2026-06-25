import axios from 'axios';

const baseURL = typeof window !== 'undefined'
  ? ''
  : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

// Attach access token as Bearer so API routes don't need to read cookies
api.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      let accessToken: string | undefined;

      // Primary: read from local cache/storage (no network call)
      const { data: { session } } = await supabase.auth.getSession();
      accessToken = session?.access_token;

      // Fallback: force a server-side validation which also triggers token
      // refresh and repopulates the in-memory session cache.
      if (!accessToken) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: { session: fresh } } = await supabase.auth.getSession();
          accessToken = fresh?.access_token;
        }
      }

      if (accessToken) {
        config.headers = config.headers ?? {};
        (config.headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
      }
    } catch {
      // proceed without token — server will check cookies
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) window.location.href = '/login';
        }
      } catch {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
