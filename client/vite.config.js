import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite only loads VITE_-prefixed vars into import.meta.env. Passing '' as the
  // third arg loads EVERY key instead, so vite.config.js can read the Sentry
  // token. These deliberately have no VITE_ prefix — a prefixed auth token
  // would be inlined into the browser bundle and handed to every visitor.
  const env = loadEnv(mode, process.cwd(), '')

  const sentryUploadEnabled = Boolean(env.SENTRY_AUTH_TOKEN)

  return {
    plugins: [
      react(),

      // injectManifest, not generateSW: a hand-written service worker already
      // exists with push handlers, and generateSW would replace it wholesale.
      // In this mode src/sw.js is a normal source file — the push listeners and
      // the Workbox precaching simply coexist in it — and `self.__WB_MANIFEST`
      // is text-substituted with the real precache list at build time.
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        registerType: 'prompt',
        // Registration is ours, in src/lib/pwa.js + ServiceWorkerManager.jsx.
        // Left at the 'auto' default the plugin would also inject its own
        // registerSW script tag, which is the fragile heuristic we're avoiding.
        injectRegister: null,
        includeAssets: ['favicon.svg', 'icons.svg'],

        manifest: {
          id: '/',
          name: 'ChowZilla',
          short_name: 'ChowZilla',
          description: 'Order from campus restaurants and track your delivery live.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#f59e0b', // amber-500 — the brand accent used across the UI
          background_color: '#ffffff',
          categories: ['food', 'shopping'],
          icons: [
            { src: '/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            // Kept as a SEPARATE entry from `any` on purpose. `any maskable` in
            // one entry is what makes Android letterbox the icon.
            { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },

        injectManifest: {
          // jpg is included so the login hero (auth-bg.jpg, ~436 KB) renders
          // offline — it's the first thing a logged-out user sees.
          globPatterns: ['**/*.{js,css,html,svg,png,jpg,ico,webmanifest}'],
          globIgnores: ['**/*.map'],
          // Workbox THROWS (it does not warn) when a file exceeds this, failing
          // the build. The main chunk is ~930 KB and the login hero ~436 KB, so
          // the 2 MiB default has little headroom left.
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          minify: true,
          // Off explicitly: the parent build sets `build.sourcemap: 'hidden'`
          // when a Sentry token is present, and the nested SW build inherits it
          // — which would emit dist/sw.js.map and race Sentry's
          // filesToDeleteAfterUpload, potentially leaving a .map served publicly.
          sourcemap: false,
        },

        // Never in dev: HMR plus a Workbox worker on one origin is a stale-cache
        // trap. src/lib/pwa.js also refuses to register outside production.
        devOptions: { enabled: false },
      }),

      // Wrapped in a guard so `npm run build` still works locally for someone
      // who has no Sentry credentials.
      ...(sentryUploadEnabled
        ? sentryVitePlugin({
            org: env.SENTRY_ORG,
            project: env.SENTRY_PROJECT,
            authToken: env.SENTRY_AUTH_TOKEN,
            telemetry: false,
            // Fail loudly. Left at its default, a rejected upload only logs,
            // then STILL deletes the maps from dist/ and exits 0 — leaving the
            // bundle pointing at a .map file that no longer exists and Sentry
            // with nothing at all. A silent half-state like that is worse than
            // a failed build, so a bad token must stop the build.
            errorHandler(error) {
              throw error
            },
            sourcemaps: {
              // Upload the maps to Sentry, then strip them from dist/.
              // Without this the deployed site would serve your original,
              // unminified source code to anyone who opens devtools.
              filesToDeleteAfterUpload: ['./dist/**/*.map'],
            },
          })
        : []),
    ],

    build: {
      // Tied to the token on purpose: maps only exist when something will
      // upload them. A build with no token therefore emits none, so a
      // misconfigured deploy can't leak source instead of just losing maps.
      //
      // 'hidden' (not `true`) emits the maps WITHOUT a trailing
      // `//# sourceMappingURL=` comment. Since filesToDeleteAfterUpload strips
      // the maps from dist/ anyway, a comment pointing at them would just 404
      // in devtools. Sentry matches stack traces by the injected debug IDs, so
      // it doesn't need that comment.
      sourcemap: sentryUploadEnabled ? 'hidden' : false,
    },
  }
})
