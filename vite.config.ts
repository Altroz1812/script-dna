import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.lovable.dev https://*.livekit.cloud wss://*.livekit.cloud https://*.loca.lt wss://*.loca.lt https://*.ngrok-free.dev wss://*.ngrok-free.dev https://*.ngrok.io wss://*.ngrok.io https://*.trycloudflare.com wss://*.trycloudflare.com",
  "media-src 'self' blob:",
  "frame-ancestors 'none'",
].join("; ");

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    headers: {
      "Content-Security-Policy": contentSecurityPolicy,
    },
    hmr: {
      overlay: false,
    },
  },
  preview: {
    headers: {
      "Content-Security-Policy": contentSecurityPolicy,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-livekit": ["livekit-client", "@livekit/components-react"],
          "vendor-recharts": ["recharts"],
          "vendor-motion": ["framer-motion"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-query": ["@tanstack/react-query"],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));
