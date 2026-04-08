import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { type PluginOption, defineConfig } from "vite";
import { createManualChunks } from "./src/manual-chunks";

function swVersionPlugin(): PluginOption {
  let outDir = "dist";
  return {
    name: "sw-version-inject",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const swPath = path.resolve(outDir, "sw.js");
      try {
        let content = fs.readFileSync(swPath, "utf-8");
        const hash = Date.now().toString(36);

        // Collect precache manifest from build output
        const precacheUrls: string[] = ["/index.html"];
        const assetsDir = path.resolve(outDir, "assets");
        try {
          const assets = fs
            .readdirSync(assetsDir)
            .filter((f) => /\.(js|css)$/.test(f))
            .map((f) => `/assets/${f}`);
          precacheUrls.push(...assets);
        } catch {
          // assets dir missing (unexpected) — precache app shell only
        }

        content = content.replace(/__BUILD_HASH__/g, hash);
        content = content.replace(
          '"__PRECACHE_MANIFEST__"',
          JSON.stringify(precacheUrls),
        );
        fs.writeFileSync(swPath, content);
        console.log(
          `[sw-version] hash=${hash}, precache=${precacheUrls.length} files`,
        );
      } catch {
        // sw.js not present in output (e.g. electron build) — skip
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), swVersionPlugin()],
  define: {
    __BUILD_HASH__: JSON.stringify(
      mode === "production" ? Date.now().toString(36) : "dev",
    ),
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
}));
