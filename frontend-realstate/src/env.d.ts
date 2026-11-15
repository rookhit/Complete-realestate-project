/// <reference types="vite/client" />

/** Build-time settings (Vercel → Environment Variables, or a local `.env.local`). All are public. */
interface ImportMetaEnv {
  /** The API's origin; on Vercel the site's own address (vercel.json forwards /api). */
  readonly VITE_API_URL?: string;
  /** The site's public address, for canonical links and the sitemap. */
  readonly VITE_SITE_URL?: string;
}
