import axios from "axios";

// By default requests go to the same origin ("/api/..."). In development Vite
// proxies them to the backend (vite.config.js); on Vercel, vercel.json does.
// Set VITE_API_URL only if the frontend should call the backend directly.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  withCredentials: true
});

// ---------------------------------------------------------------------------
// Cold-start detection. Render's free plan sleeps the backend after a while
// idle, and the first request can take ~50s. Until the server has answered
// once, a request still pending after SLOW_MS means it's waking up. After the
// first answer, slow requests are real work (e.g. AI generation), not a wake-up.

export const SLOW_MS = 4000;

let serverAwake = false;
let waking = false;
const listeners = new Set();

const setWaking = (value) => {
  if (waking === value) return;
  waking = value;
  listeners.forEach((listener) => listener(value));
};

/** Subscribe to "server is waking up" changes; returns an unsubscribe function. */
export function onServerWaking(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const isServerWaking = () => waking;

api.interceptors.request.use((config) => {
  if (!serverAwake) {
    config.wakeTimer = setTimeout(() => {
      if (!serverAwake) setWaking(true);
    }, SLOW_MS);
  }
  return config;
});

const markAwake = (config) => {
  clearTimeout(config?.wakeTimer);
  serverAwake = true;
  setWaking(false);
};

api.interceptors.response.use(
  (response) => {
    markAwake(response.config);
    return response;
  },
  (error) => {
    // Any HTTP answer (even 401/404) proves the server is up; a network
    // error doesn't, but the notice shouldn't stay up after a failure.
    if (error.response) {
      markAwake(error.config);
    } else {
      clearTimeout(error.config?.wakeTimer);
      setWaking(false);
    }
    return Promise.reject(error);
  }
);

export default api;
