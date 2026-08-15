/**
 * Client bundle build (mirrors dsh-habits' preset): CJS wrapped in the
 * __ModuleLoader__.load({ id, factory }) handoff — the client-modules
 * contract. React and the shared UI primitives ride the platform module
 * table (external); everything else inlines.
 */
import { defineConfig } from 'tsdown'

const PLATFORM = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/dsh-client-ui-primitives',
]

export default defineConfig({
  name: 'dsh-archive-viewer/client',
  entry: { client: 'src/client/index.ts' },
  outDir: 'dist',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  clean: false,
  sourcemap: false,
  external: PLATFORM,
  noExternal: (id: string) => (PLATFORM.includes(id) ? undefined : true),
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: "dsh-archive-viewer", factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
