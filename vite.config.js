import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**", "**/Ornek_Veriler/**", "**/CSV_Sablonlari/**"]
    }
  },
  build: {
    // Web assets and portable release binaries share dist without deleting each other.
    outDir: "dist/web",
    target: "es2022",
    sourcemap: true,
    // PDF/DOCX generators are lazy chunks and intentionally include offline fonts.
    chunkSizeWarningLimit: 1_400
  }
});
