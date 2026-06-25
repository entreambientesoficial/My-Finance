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
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers = config.headers ?? {};
        (config.headers as Record<string, string>)['Authorization'] = `Bearer ${session.access_token}`;
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
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
