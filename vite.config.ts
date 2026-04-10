import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { defineConfig, type Plugin } from "vite";
import { createManualChunks } from "./src/manual-chunks";

function swCacheVersionPlugin(buildHash: string): Plugin {
  return {
    name: "sw-cache-version",
    closeBundle() {
      const swPath = path.resolve(__dirname, "dist/sw.js");
      try {
        const content = fs.readFileSync(swPath, "utf-8");
        fs.writeFileSync(
          swPath,
          content.replace(/__SW_CACHE_VERSION__/g, buildHash),
        );
      } catch {
        // sw.js not in build output — nothing to patch
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const buildTimestamp = mode === "production" ? Date.now() : 0;
  const buildHash =
    buildTimestamp > 0 ? buildTimestamp.toString(36) : "dev";
  return {
    plugins: [
      react(),
      ...(mode === "production" ? [swCacheVersionPlugin(buildHash)] : []),
    ],
    define: {
      __BUILD_HASH__: JSON.stringify(buildHash),
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
