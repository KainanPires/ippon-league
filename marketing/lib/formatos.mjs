// Formatos de produção (conhecimento/12-formatos-kainan-apresenta.md).
export const FORMATOS = ["ludico-narrado", "kainan-apresenta", "luta-real"];
export const VISUAIS = ["kainan-real", "kainan-avatar", "tela-app", "site-publico", "dodo", "cena-estudio", "grafico", "foto-permitida", "clip-3d"];
const ehKainan = (t) => t === "kainan-real" || t === "kainan-avatar";

/** Devolve { erros, avatar_s, kainan_s, referencias_s, materiais_em_falta } */
export function verificarFormato(plano) {
  const r = { erros: [], avatar_s: 0, kainan_s: 0, referencias_s: 0, materiais_em_falta: [] };
  const c = plano?.campanha || {};
  const f = c.formato_producao;
  if (!f) return r; // planos antigos
  if (!FORMATOS.includes(f)) { r.erros.push(`campanha.formato_producao inválido: "${f}" (usar ${FORMATOS.join(", ")})`); return r; }
  if (!String(c.formato_motivo || "").trim()) r.erros.push("campanha.formato_motivo: explique em 1–2 frases porque este formato");
  if (f !== "kainan-apresenta") return r;
  const trechos = new Set((plano.audio?.narracao?.trechos || []).map((t) => t.id));
  let algumKainan = false;
  for (const s of plano.cenas || []) {
    const v = s.visual || {};
    if (!VISUAIS.includes(v.tipo)) { r.erros.push(`${s.id}: visual.tipo obrigatório (${VISUAIS.join(", ")})`); continue; }
    const dur = Number(s.duracao_s || 0);
    if (ehKainan(v.tipo)) {
      algumKainan = true; r.kainan_s += dur; if (v.tipo === "kainan-avatar") r.avatar_s += dur;
      for (const k of ["enquadramento", "expressao", "gesto"]) if (!String(s.kainan?.[k] || "").trim()) r.erros.push(`${s.id}: kainan.${k} obrigatório quando o Kainan está em tela`);
    } else {
      r.referencias_s += dur;
      if (!String(v.demonstra || "").trim()) r.erros.push(`${s.id}: visual.demonstra — que mensagem esta referência explica? (sem imagens decorativas)`);
    }
    if (!String(v.origem || "").trim()) r.erros.push(`${s.id}: visual.origem obrigatória (de onde vem o material)`);
    if (v.existe === false) r.materiais_em_falta.push(`${s.id}: ${v.captura_necessaria || v.origem}`);
    if (v.existe === false && !String(v.captura_necessaria || "").trim()) r.erros.push(`${s.id}: material em falta sem indicação do que capturar`);
    if (!String(s.fala_continua || "").trim()) r.erros.push(`${s.id}: fala_continua — diga como a fala atravessa esta troca de imagem`);
    for (const t of s.audio_trechos || []) if (!trechos.has(t)) r.erros.push(`${s.id}: audio_trechos refere "${t}", que não existe em audio.narracao.trechos`);
  }
  if (!algumKainan) r.erros.push("kainan-apresenta sem nenhuma cena com o Kainan em tela");
  if (plano.audio?.narracao?.continua !== true) r.erros.push("kainan-apresenta exige audio.narracao.continua = true (11-voz)");
  r.avatar_s = Math.round(r.avatar_s * 10) / 10; r.kainan_s = Math.round(r.kainan_s * 10) / 10; r.referencias_s = Math.round(r.referencias_s * 10) / 10;
  return r;
}
