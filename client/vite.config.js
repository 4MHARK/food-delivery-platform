import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

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
              throw error;
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
