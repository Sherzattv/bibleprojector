/// <reference types="svelte" />
/// <reference types="vite/client" />

// Подставляются на сборке (define в vite.config.ts / vitest.config.ts)
declare const __APP_VERSION__: string
declare const __BUILD_COMMIT__: string

declare module '*.json' {
  const value: unknown
  export default value
}
