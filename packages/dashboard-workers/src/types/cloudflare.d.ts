// Cloudflare environment type definitions for OpenNext

import type { D1Database } from '../lib/db/client';

declare module '@opennextjs/cloudflare' {
  interface CloudflareEnv {
    DB: D1Database;
    ASSETS: any;
    NEXTJS_ENV: string;
    JWT_SECRET?: string;
  }
}
