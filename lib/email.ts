// lib/email.ts
//
// ENVIO DE EMAILS via Resend + MOLDE VISUAL PARTILHADO — SÓ NO SERVIDOR.
//
// `emailHtmlBase` é o molde ÚNICO de todos os emails do produto (verificação/
// boas-vindas, reengajamento, etc.), para todos ficarem com a mesma cara: topo
// preto com o Dodo (ícone da app) + "IPPON LEAGUE", corpo branco, botão dourado
// CENTRADO, notas em cinzento e a barra "Ippon League 🥋". Layout em TABELAS com
// estilos inline — é o que os clientes de email (sobretudo o Outlook) renderizam
// de forma fiável.
//
// `enviarEmailResend` envia e devolve o id da mensagem do Resend (para cruzar
// depois com os webhooks de entrega/abertura). Falha em silêncio.

const MAIL_FROM = process.env.MAIL_FROM || "Ippon League <support@ipponleague.com>";

// O Dodo (identidade visual). É o ícone público da app; um pouco maior (72px)
// do que a versão antiga, como o Kainan pediu.
const LOGO_URL = "https://www.ipponleague.com/icon-192.png";

// Escapa texto para HTML. As entidades são montadas a partir dos códigos
// numéricos (não literais) para o ficheiro sobreviver a conversões de texto
// (um "&quot;" à letra já se corrompeu uma vez ao passar por um Word).
const E_AMP = String.fromCharCode(38) + "amp;";
const E_LT = String.fromCharCode(38) + "lt;";
const E_GT = String.fromCharCode(38) + "gt;";
const E_QUOT = String.fromCharCode(38) + "quot;";
export function escHtml(v: string): string {
  return String(v)
    .split("&").join(E_AMP)
    .split("<").join(E_LT)
    .split(">").join(E_GT)
    .split(String.fromCharCode(34)).join(E_QUOT);
}

/**
 * Molde visual partilhado. `saudacao` e `corpo` podem trazer HTML de confiança
 * (ex.: <strong>); o NOME do utilizador deve vir já escapado por quem chama.
 * `notas` = linhas cinzentas por baixo do botão (ex.: validade, "ignora se…").
 * `naoResponder` = a linha final, mais clara ("email automático…").
 */
export function emailHtmlBase(args: {
  saudacao: string;
  corpo: string;
  botaoTexto: string;
  botaoLink: string;
  notas?: string[];
  naoResponder?: string;
}): string {
  const notasHtml = (args.notas || [])
    .filter(Boolean)
    .map((n) => `<p style="margin:0 0 12px;color:#6c766d;font-size:13px">${n}</p>`)
    .join("");
  const naoResp = args.naoResponder
    ? `<p style="margin:0;color:#9aa39a;font-size:12px">${args.naoResponder}</p>`
    : "";
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f1ea;margin:0;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e1d5">
        <tr><td align="center" style="background:#0c0e0d;padding:26px 24px">
          <img src="${LOGO_URL}" width="72" height="72" alt="Ippon League" style="display:block;border-radius:16px;margin:0 auto 12px">
          <div style="font-family:'IBM Plex Mono',Menlo,Consolas,monospace;font-size:17px;font-weight:700;letter-spacing:3px;color:#d9a441">IPPON LEAGUE</div>
        </td></tr>
        <tr><td style="padding:28px 28px 8px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1b211e">
          <p style="margin:0 0 14px">${args.saudacao}</p>
          <p style="margin:0 0 24px">${args.corpo}</p>
          <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 24px">
            <tr><td align="center" bgcolor="#d9a441" style="border-radius:10px">
              <a href="${args.botaoLink}" style="display:inline-block;padding:14px 34px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;font-weight:700;color:#1b211e;text-decoration:none;border-radius:10px">${args.botaoTexto}</a>
            </td></tr>
          </table>
          ${notasHtml}
          ${naoResp}
        </td></tr>
        <tr><td style="padding:18px 28px 24px;border-top:1px solid #eee;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:11px;line-height:1.5;color:#9aa39a">
          Ippon League 🥋
        </td></tr>
      </table>
    </td></tr>
  </table>`;
}

/**
 * Envia UM email via Resend. Devolve { ok, id } — o id é o da mensagem no
 * Resend (para cruzar com os webhooks). Nunca lança.
 */
export async function enviarEmailResend(args: {
  to: string;
  subject: string;
  html: string;
  // Etiquetas que voltam nos webhooks do Resend (ex.: { tipo, user_id }).
  tags?: Record<string, string>;
}): Promise<{ ok: boolean; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !args.to) return { ok: false };
  const corpo: Record<string, unknown> = {
    from: MAIL_FROM,
    to: [args.to],
    subject: args.subject,
    html: args.html,
  };
  if (args.tags) {
    corpo.tags = Object.entries(args.tags).map(([name, value]) => ({ name, value }));
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const j = (await r.json().catch(() => null)) as { id?: string } | null;
    return { ok: r.ok, id: j?.id };
  } catch {
    return { ok: false };
  }
}
