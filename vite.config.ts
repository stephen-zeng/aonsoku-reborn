import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { createManualChunks } from "./src/manual-chunks";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const buildTimestamp = mode === "production" ? Date.now() : 0;
  return {
    plugins: [react()],
    define: {
      __BUILD_HASH__: JSON.stringify(
        buildTimestamp > 0 ? buildTimestamp.toString(36) : "dev",
      ),
      __BUILD_TIME__: buildTimestamp,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        cy: path.resolve(__dirname, "./cypress"),
      },
    },
    build: {
      minify: "terser",
      rollupOptions: {
        external: ["bufferutil", "utf-8-validate"],
        output: {
          manualChunks: createManualChunks,
        },
      },
    },
  };
});
