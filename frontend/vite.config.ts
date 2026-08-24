import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the site from https://<user>.github.io/<repo>/
// so every asset URL needs that "/<repo>/" prefix in production.
// Set VITE_BASE_PATH as a build-time env var in your GitHub Actions
// workflow (see .github/workflows/deploy-frontend.yml) to "/<repo>/".
// Locally (npm run dev) it defaults to "/" so nothing breaks.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "production" ? process.env.VITE_BASE_PATH || "/" : "/",
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
}));
