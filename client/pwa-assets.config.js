// Icon generation for the PWA. Run: npx pwa-assets-generator
//
// Reuses the same 1024x1024 source the Android launcher icons come from, so the
// home-screen icon matches the native app. Output lands in public/ (and is
// therefore precached by the plugin's png glob) and never touches the
// hand-written favicon.svg.
import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

export default defineConfig({
  preset: minimal2023Preset,
  images: ["assets/icon.png"],
});
