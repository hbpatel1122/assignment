import axios, { AxiosError } from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      // Use replace so the auth page doesn't get a broken back-stack entry
      window.location.replace('/auth');
      // Return a never-resolving promise so no downstream code runs after redirect
      return new Promise(() => {});
    }
    return Promise.reject(err);
  }
);

export default api;

/**
 * Resolve a media URL that may be stored as a relative path (e.g. /uploads/posts/file.jpg).
 * Prepends the backend origin so the browser fetches from the correct server.
 */
const BACKEND_ORIGIN =
  (process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000').replace(/\/$/, '');

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  // Already absolute
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Relative path — prepend backend origin
  return `${BACKEND_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}
