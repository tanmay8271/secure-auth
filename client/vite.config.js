import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // In development, calls to /api go to the Express server.
  server: { proxy: { "/api": "http://localhost:5000" } },
});
