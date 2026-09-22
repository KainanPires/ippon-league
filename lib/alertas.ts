// lib/alertas.ts
//
// ALERTA AO FUNDADOR — email quando um cron acende 🔴.
//
// Reutiliza o MESMO caminho de envio da verificação de email (fetch direto ao
// Resend com RESEND_API_KEY + MAIL_FROM), para não haver duas formas de mandar
// email na app. O destino é ALERTA_EMAIL (uma variável de ambiente na Vercel).
//
// O corpo do email é o próprio "exame": cada sinal com observado / esperado /
// limite / estado — para o alerta se explicar sozinho, sem abrir a app.
//
// Variáveis de ambiente:
//   RESEND_API_KEY  — a mesma que já usas
//   MAIL_FROM       — o mesmo remetente (default "Ippon League <support@ipponleague.com>")
//   ALERTA_EMAIL    — para onde vai o alerta (ex.: pireskainan@gmail.com)

import { SINAL, ROTULO_ESTADO, type Leitura } from "@/lib/referencias";

const MAIL_FROM = process.env.MAIL_FROM || "Ippon League <support@ipponleague.com>";

export interface CtxAlerta {
  comp?: string | null;
  aoVivo?: boolean;
  erro?: string | null;
}

// Escapa texto para HTML. As entidades são montadas a partir dos códigos
// numéricos (mesmo motivo do email de verificação: sobreviver a conversões de
// texto por Word, que corrompem "&quot;" escrito à letra).
const E_AMP = String.fromCharCode(38) + "amp;";
const E_LT = String.fromCharCode(38) + "lt;";
const E_GT = String.fromCharCode(38) + "gt;";
const E_QUOT = String.fromCharCode(38) + "quot;";
function esc(v: unknown): string {
  return String(v ?? "")
    .split("&").join(E_AMP)
    .split("<").join(E_LT)
    .split(">").join(E_GT)
    .split(String.fromCharCode(34)).join(E_QUOT);
}

function corEstado(estado: Leitura["estado"]): string {
  if (estado === "alarme") return "#b4472f";
  if (estado === "aviso") return "#b8862b";
  return "#2f8f5b";
}

function linhaExame(l: Leitura): string {
  const cor = corEstado(l.estado);
  const un = l.unidade ? ` ${esc(l.unidade)}` : "";
  return `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eee">${esc(l.rotulo)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:700;color:${cor}">${esc(l.observado)}${un}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#666">${esc(l.esperado)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#666">${esc(l.limite)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;color:${cor};font-weight:600">${SINAL[l.estado]} ${ROTULO_ESTADO[l.estado]}</td>
    </tr>`;
}

/**
 * Manda o email de alerta. Devolve true se o Resend aceitou.
 * Nunca lança: um alerta que falha não pode partir o cron que o chamou.
 */
export async function alertarFundador(job: string, leituras: Leitura[], ctx: CtxAlerta = {}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const para = process.env.ALERTA_EMAIL;
  if (!apiKey || !para) return false;

  // As que não estão OK sobem para o topo; o resto vai como contexto.
  const foraDoNormal = leituras.filter((l) => l.estado !== "ok");
  const ordenadas = [...foraDoNormal, ...leituras.filter((l) => l.estado === "ok")];

  const quando = new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short", timeStyle: "short", timeZone: "Europe/Lisbon",
  }).format(new Date());

  const contexto = [
    ctx.aoVivo ? "durante competição AO VIVO" : null,
    ctx.comp ? `competição ${esc(ctx.comp)}` : null,
  ].filter(Boolean).join(" · ");

  const assunto = `🔴 Ippon League — ${job}: ${foraDoNormal.length} sinal(is) fora do normal`;

  const html = `
  <div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:640px">
    <p style="margin:0 0 6px;font-size:18px;font-weight:700">Um cron acendeu 🔴</p>
    <p style="margin:0 0 16px;color:#666">
      <strong>${esc(job)}</strong>${contexto ? " — " + contexto : ""} · ${esc(quando)} (Lisboa)
    </p>
    ${ctx.erro ? `<p style="margin:0 0 16px;padding:10px 12px;background:#fbeae6;border-radius:8px;color:#b4472f"><strong>Erro:</strong> ${esc(ctx.erro)}</p>` : ""}
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <thead>
        <tr style="text-align:left;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:.04em">
          <th style="padding:6px 10px">Sinal</th>
          <th style="padding:6px 10px">Observado</th>
          <th style="padding:6px 10px">Esperado</th>
          <th style="padding:6px 10px">Limite</th>
          <th style="padding:6px 10px">Estado</th>
        </tr>
      </thead>
      <tbody>
        ${ordenadas.map(linhaExame).join("")}
      </tbody>
    </table>
    <p style="margin:16px 0 0;color:#999;font-size:12px">
      Ippon League · observabilidade dos crons. Não respondas a este email.
    </p>
  </div>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM, to: [para], subject: assunto, html }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
