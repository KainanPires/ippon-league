import type { Metadata, Viewport } from "next";
import { Oswald, Manrope } from "next/font/google";
import "./globals.css";
import { RegistarServiceWorker } from "@/components/RegistarServiceWorker";
import { CarregarHorarios } from "@/components/CarregarHorarios";
import { JudoguiProvider } from "@/components/JudoguiProvider";
import { TatameProvider } from "@/components/TatameProvider";
import { BarraTopo } from "@/components/BarraTopo";
import { LinguaProvider } from "@/lib/i18n";

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
    //
    // Trocar isto para a língua do utilizador obrigaria a decidi-la no servidor
    // — e o servidor não conhece a preferência guardada na conta.
    <html
      lang="pt"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <RegistarServiceWorker />
        <CarregarHorarios />
        {/* A barra de troca entre os dois produtos. Fica por fora dos
            providers de propósito: não precisa de nenhum deles e assim é a
            primeira coisa que o browser desenha, sem esperar por nada. */}
        <BarraTopo />
        {/* O LinguaProvider envolve TUDO: qualquer ecrã pode chamar useT() sem
            se preocupar em ser embrulhado. Fica por fora dos outros providers
            porque não depende de nenhum deles — e porque, se um dia o judogui
            ou o tatame precisarem de texto traduzido, já o têm disponível. */}
        <LinguaProvider>
          <JudoguiProvider>
            <TatameProvider>
              {children}
            </TatameProvider>
          </JudoguiProvider>
        </LinguaProvider>
      </body>
    </html>
  );
}
