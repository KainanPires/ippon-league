import type { MetadataRoute } from "next";

// Manifesto PWA da Ippon League. Permite "instalar" a app no telemóvel,
// com ícone do Dodô no ecrã inicial e abertura em ecrã inteiro.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ippon League",
    short_name: "Ippon League",
    description: "O jogo oficial dos fãs de judô.",
    start_url: "/inicio",
    display: "standalone",
    background_color: "#0c0e0d",
    theme_color: "#0c0e0d",
    lang: "pt",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
