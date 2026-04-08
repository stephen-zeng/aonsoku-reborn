import react from "@vitejs/plugin-react";
import crypto from "crypto";
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
        // Exclusion-based approach so new files are automatically
        // included in future builds.
        const EXCLUDE_DIRS = new Set(["screenshots"]);
        const EXCLUDE_FILES = new Set(["sw.js", "env-config.js"]);
        const EXCLUDE_EXTS = new Set([".map"]);

        function collectFiles(dir: string, base = ""): string[] {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          const result: string[] = [];
          for (const entry of entries) {
            if (entry.isDirectory()) {
              if (EXCLUDE_DIRS.has(entry.name)) continue;
              result.push(
                ...collectFiles(
                  path.join(dir, entry.name),
                  `${base}${entry.name}/`,
                ),
              );
            } else if (entry.isFile()) {
              if (EXCLUDE_FILES.has(entry.name)) continue;
              if (EXCLUDE_EXTS.has(path.extname(entry.name))) continue;
              result.push(`/${base}${entry.name}`);
            }
          }
          return result;
        }

        const precacheUrls = collectFiles(outDir);

        // Content-based hash: identical builds produce the same cache
        // key, so returning users skip re-downloading unchanged assets.
        const hash = crypto
          .createHash("md5")
          .update(JSON.stringify(precacheUrls.sort()))
          .digest("hex")
          .slice(0, 10);

        content = content.replace(/__SW_CACHE_HASH__/g, hash);
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
export default defineConfig(({ mode }) => {
  const buildTimestamp = mode === "production" ? Date.now() : 0;
  return {
    plugins: [react(), swVersionPlugin()],
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
