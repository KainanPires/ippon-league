// ===================================================================
// REPOSITÓRIO DO FANTASY (ippon-league) → app/layout.tsx
// SUBSTITUI o ficheiro que lá está.
//
// O QUE MUDA nesta versão: entra o PostHogProvider (analytics + banner de
// consentimento + pageviews), colocado DENTRO do LinguaProvider para o banner
// seguir o idioma. Nada mais mudou — a Academy continua sem porta aqui dentro.
//
// PARA A TRAZER DE VOLTA, um dia: repõe as duas linhas marcadas com
// <<< VOLTAR >>> aqui em baixo e volta a criar o components/BarraTopo.tsx.
// ===================================================================

import type { Metadata, Viewport } from "next";
import { Oswald, Manrope } from "next/font/google";
import "./globals.css";
import { RegistarServiceWorker } from "@/components/RegistarServiceWorker";
import { CarregarHorarios } from "@/components/CarregarHorarios";
import { JudoguiProvider } from "@/components/JudoguiProvider";
import { TatameProvider } from "@/components/TatameProvider";
// <<< VOLTAR >>> import { BarraTopo } from "@/components/BarraTopo";
import { LinguaProvider } from "@/lib/i18n";
import { PostHogProvider } from "@/components/PostHogProvider";

const geistSans = Manrope({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Oswald({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ippon League",
  description: "O jogo oficial dos fãs de judô.",
  applicationName: "Ippon League",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Ippon League",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0e0d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // lang="pt" fica: é a língua do HTML servido pelo servidor, e é em português
    // que o conteúdo é escrito primeiro. A tradução acontece no cliente, depois
    // de o LinguaProvider saber que língua a pessoa quer.
    <html
      lang="pt"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <RegistarServiceWorker />
        <CarregarHorarios />
        {/* <<< VOLTAR >>> <BarraTopo /> */}
        {/* O LinguaProvider envolve TUDO. O PostHogProvider fica DENTRO dele
            porque o banner de consentimento usa useLingua() para sair no idioma
            da pessoa. */}
        <LinguaProvider>
          <PostHogProvider>
            <JudoguiProvider>
              <TatameProvider>
                {children}
              </TatameProvider>
            </JudoguiProvider>
          </PostHogProvider>
        </LinguaProvider>
      </body>
    </html>
  );
}
