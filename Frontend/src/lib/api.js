import axios from "axios";

// By default requests go to the same origin ("/api/..."). In development Vite
// proxies them to the backend (vite.config.js); on Vercel, vercel.json does.
// Set VITE_API_URL only if the frontend should call the backend directly.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  withCredentials: true
});

export default api;
