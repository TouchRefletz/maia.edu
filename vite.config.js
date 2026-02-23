import react from "@vitejs/plugin-react"; // <--- Nova importação
import { defineConfig } from "vite";

export default defineConfig({
  plugins: process.env.VITEPRESS ? [] : [react()], // <--- Ativa o React apenas fora do VitePress

  // Configuração básica existente
  build: {
    target: "esnext",
  },
  envPrefix: ["VITE_", "FIREBASE_", "IMGBB_", "GOOGLE_", "PINECONE_"],
  server: {
    watch: {
      ignored: ["**/docs/**"],
    },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
    proxy: {
      "/docs": {
        target: "http://localhost:5174", // Porta padrão do VitePress
        changeOrigin: true,
      },
    },
  },
});
