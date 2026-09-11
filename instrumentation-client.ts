// instrumentation-client.ts  (raiz do projeto, ao lado do next.config.ts)
//
// Ponto de arranque do lado do cliente no Next.js App Router. Corre uma vez,
// no início. Só inicializa o PostHog — que arranca OPTED-OUT (sem consentimento
// nada é enviado). A lógica toda vive em lib/analytics.ts.

import { initAnalytics } from "@/lib/analytics";

initAnalytics();
