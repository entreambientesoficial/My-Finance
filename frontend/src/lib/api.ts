import axios from 'axios';

const baseURL = typeof window !== 'undefined'
  ? ''
  : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

// Prevents multiple simultaneous refresh calls when many requests get 401 at once.
// The first 401 performs the actual refresh; all others wait in a queue and retry
// only after the refresh resolves — avoiding the race condition that rotates the
// refresh token multiple times and causes unexpected logouts.
let isRefreshing = false;
let refreshQueue: Array<(success: boolean) => void> = [];

function drainQueue(success: boolean) {
  refreshQueue.forEach((cb) => cb(success));
  refreshQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // A refresh is already in progress — queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((success: boolean) => {
          if (success) resolve(api(original));
          else reject(error);
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      await axios.post('/api/auth/refresh', {}, { withCredentials: true });
      isRefreshing = false;
      drainQueue(true);
      return api(original);
    } catch {
      isRefreshing = false;
      drainQueue(false);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  },
);
