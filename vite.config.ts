import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
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
        manualChunks(id) {
          if (id.includes('@radix-ui')) {
            return 'radix-ui';
          }
          if (id.includes('framer-motion')) {
            return 'framer';
          }
          if (id.includes('recharts')) {
            return 'recharts';
          }
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom') || id.includes('date-fns')) {
            return 'vendor';
          }
        }
      }
    },
    minify: 'esbuild',
    target: 'esnext'
  }
}));
