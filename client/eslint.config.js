import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // The service worker is not a browser-script context: it uses `self`,
    // `clients` and `caches`, and references Workbox's injected
    // `self.__WB_MANIFEST`. None of those exist in `globals.browser`.
    files: ['src/sw.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.serviceworker },
    },
  },
  {
    // Build-time config, runs in Node.
    files: ['pwa-assets.config.js', 'vite.config.js'],
    languageOptions: { globals: globals.node },
  },
])
