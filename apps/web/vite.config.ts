import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The backend only CORS-enables /api/* and never /v1/*, and sessions are
// httpOnly cookies, so the app must talk to the API same-origin. The dev proxy
// forwards both prefixes to the Hono server on :3000.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/v1": { target: "http://127.0.0.1:3000", changeOrigin: true },
    },
  },
});