import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: "localhost", proxy: { "/api": "http://localhost:3001" } },
});
