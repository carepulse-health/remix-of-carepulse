import type { CapacitorConfig } from "@capacitor/cli";

// Android wrapper for the CarePulse patient app. webDir is the static client
// build produced by `bun run build:android` (SPA mode); the web deployment build is unchanged.
const config: CapacitorConfig = {
  appId: "com.carepulse.patient",
  appName: "CarePulse",
  webDir: "dist/client",
  android: { allowMixedContent: false },
};

export default config;
