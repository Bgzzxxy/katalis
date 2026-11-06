import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The backend only CORS-enables /api/* and never /v1/*, and sessions are
// httpOnly cookies, so the app must talk to the API same-origin. Both the dev
// server and the production preview forward those prefixes to the Hono server.
const proxy = {
  "/api": { target: "http://127.0.0.1:3000", changeOrigin: true },
  "/v1": { target: "http://127.0.0.1:3000", changeOrigin: true },
} as const;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Bind all interfaces so the UI can be opened from another device on the LAN.
    host: true,
    proxy,
  },
  preview: {
    // `vite preview` does NOT inherit server.proxy, so serving the production
    // build without this leaves /api and /v1 as dead 404s.
    host: true,
    proxy,
  },
});
