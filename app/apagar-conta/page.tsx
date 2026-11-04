"use client";

// app/apagar-conta/page.tsx — página PÚBLICA de eliminação de conta.
//
// A Google Play exige um URL web onde qualquer pessoa vê como pedir a eliminação
// da conta e dos dados, mesmo sem a app instalada. Também é para onde se vem
// depois de apagar (?feito=1).

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const GOLD = "#d9a441";

export default function ApagarContaPage() {
  const t = useT();
  const [feito, setFeito] = useState(false);
  useEffect(() => {
    try { setFeito(new URLSearchParams(window.location.search).get("feito") === "1"); } catch {}
  }, []);

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px 60px", color: "#f1ede2", lineHeight: 1.6 }}>
      <h1 style={{ fontFamily: FD, fontSize: 20, textTransform: "uppercase", margin: "0 0 18px" }}>{t("apagar.paginaTitulo")}</h1>

      {feito && (
        <div style={{ background: "#132019", border: "1px solid #2f5a42", borderRadius: 12, padding: 14, marginBottom: 20, color: "#a6e3bf" }}>
          {t("apagar.feito")}
        </div>
      )}

      <h2 style={{ fontSize: 15, margin: "18px 0 6px" }}>{t("apagar.comoTitulo")}</h2>
      <ol style={{ paddingLeft: 20, margin: 0, color: "#c7d0c9", fontSize: 14 }}>
        <li>{t("apagar.passo1")}</li>
        <li>{t("apagar.passo2")}</li>
        <li>{t("apagar.passo3")}</li>
      </ol>
      <p style={{ color: "#c7d0c9", fontSize: 14 }}>
        {t("apagar.semAcesso")}{" "}
        <a href="mailto:support@ipponleague.com?subject=Apagar%20conta" style={{ color: GOLD }}>support@ipponleague.com</a>
      </p>

      <h2 style={{ fontSize: 15, margin: "22px 0 6px" }}>{t("apagar.oQueTitulo")}</h2>
      <ul style={{ paddingLeft: 20, margin: 0, color: "#c7d0c9", fontSize: 14 }}>
        <li>{t("apagar.itemDados")}</li>
        <li>{t("apagar.itemPro")}</li>
        <li>{t("apagar.itemLigas")}</li>
        <li>{t("apagar.itemAcademy")}</li>
        <li>{t("apagar.itemHistorico")}</li>
        <li>{t("apagar.itemPagamentos")}</li>
      </ul>

      <p style={{ marginTop: 26 }}>
        <a href="/inicio" style={{ color: GOLD, fontWeight: 700, textDecoration: "none" }}>← Ippon League</a>
      </p>
    </main>
  );
}
