import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "github.realtvop.aonsoku",
  appName: "Aonsoku",
  webDir: "dist",
  plugins: {
    Keyboard: {
      resize: "none",
    },
  },
};

export default config;
