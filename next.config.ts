import type { NextConfig } from "next";

// ===================================================================
// REPOSITÓRIO DO FANTASY (ippon-league) → next.config.ts, na raiz
//
// Isto é o que junta os dois produtos numa app só.
//
// A Academy continua a ser um site separado, com o seu próprio deploy —
// mas deixa de ter porta própria para quem usa. Tudo o que peça
// www.ipponleague.com/academy/... é ido buscar lá dentro e servido aqui,
// como se fosse desta casa.
//
// Porque é que isto resolve o login: o browser passa a ver UM endereço
// só. Uma app instalada, um cofre de dados, uma sessão. Deixa de haver
// dois sítios a tentar emprestar cookies um ao outro.
// ===================================================================

const ACADEMY = "https://academy.ipponleague.com";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/academy", destination: `${ACADEMY}/academy` },
      { source: "/academy/:caminho*", destination: `${ACADEMY}/academy/:caminho*` },
    ];
  },
};

export default nextConfig;
