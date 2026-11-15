import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

// Content-Security-Policy for production builds: if an XSS bug ever slipped in, injected
// scripts couldn't run or send the in-memory access token anywhere but our own API.
// Only added to `vite build` output: the dev server relies on inline scripts for hot reload.
// Every outside host the site loads from must be listed here, or it will be blocked.
function contentSecurityPolicy(apiUrl) {
  const apiOrigin = new URL(apiUrl).origin
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Property photos and videos are served from the Cloudflare R2 public domain; any https: image /
    // video is allowed until that domain is fixed (PRODUCTION_CHECKLIST.md: narrow it). The map's
    // pins are data: images.
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "frame-src https://www.youtube-nocookie.com",
    // MapLibre GL (components/ui/maplibre-maps.tsx) draws in a web worker it starts from a blob: URL.
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    // The admin's uploads go straight to Cloudflare R2 (src/api/uploads.ts). Maps: OpenFreeMap's
    // style, tiles and fonts; OpenStreetMap's tiles only if OpenFreeMap is down (the map's fallback).
    `connect-src 'self' ${apiOrigin} https://*.r2.cloudflarestorage.com https://tiles.openfreemap.org https://tile.openstreetmap.org`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }]
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [
      figmaAssetResolver(),
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),
      contentSecurityPolicy(env.VITE_API_URL || 'http://localhost:3000'),
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})
