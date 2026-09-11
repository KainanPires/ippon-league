import type { NextConfig } from "next";

// ===================================================================
// REPOSITÓRIO DO FANTASY (ippon-league) → next.config.ts, na raiz
//
// (1) ACADEMY: junta os dois produtos numa app só (inalterado).
//     Tudo o que peça www.ipponleague.com/academy/... é servido a partir
//     do deploy separado da Academy.
//
// (2) POSTHOG (novo): reverse-proxy do analytics em /ingest, para os
//     eventos não serem bloqueados por ad-blockers. Aponta para a região
//     EU do PostHog. O cliente usa api_host = "/ingest" (ver lib/analytics.ts).
// ===================================================================

const ACADEMY = "https://academy.ipponleague.com";

const nextConfig: NextConfig = {
  // O PostHog serve alguns assets sem barra final; evita redirecionamentos que
  // partiriam o proxy.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      // --- Academy (inalterado) ---
      { source: "/academy", destination: `${ACADEMY}/academy` },
      { source: "/academy/:caminho*", destination: `${ACADEMY}/academy/:caminho*` },

      // --- PostHog EU (reverse proxy do analytics) ---
      { source: "/ingest/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://eu.i.posthog.com/:path*" },
    ];
  },
};

export default nextConfig;
