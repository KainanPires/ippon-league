// app/admin/layout.tsx
//
// Ramo /admin — ferramentas internas. NÃO indexar nos motores de pesquisa.
// (A página em si é "use client" e não pode exportar metadata; por isso o
// noindex vive aqui, no layout do ramo, e cobre tudo o que estiver sob /admin.)
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
