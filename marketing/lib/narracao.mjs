// Regras do módulo de voz (conhecimento/11-voz-e-narracao.md) aplicadas ao plano.
// Ativam-se quando plano.audio.narracao.continua === true.

const PROIBIDO = [
  [/…|\.\.\./, "reticências"],
  [/\[\s*pausa/i, "marcação de pausa"],
  [/respir/i, "indicação de respirar"],
  [/aguard/i, "indicação de aguardar"],
];
const CAMPOS_DIRECAO = ["intencao", "energia", "ritmo", "velocidade", "enfase", "entonacao", "duracao_estimada_s", "edicao"];

export const contarPalavras = (t) => (String(t || "").match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
const norm = (t) => String(t || "").replace(/\s+/g, " ").trim();

/** Devolve { erros, avisos, estimativa } para a narração do plano. */
export function verificarNarracao(plano) {
  const n = plano?.audio?.narracao;
  const r = { erros: [], avisos: [], estimativa: null };
  if (!n || n.continua !== true) return r;
  const trechos = Array.isArray(n.trechos) ? n.trechos : [];
  if (!trechos.length) r.erros.push("audio.narracao.trechos: falta a direção vocal por trecho (11-voz §4)");
  const excecoes = new Set((n.pausa_excecao || []).filter((p) => p?.trecho && Number(p.duracao_s) > 0 && p.justificativa).map((p) => p.trecho));
  for (const t of trechos) {
    const id = t.id ?? "?";
    if (!norm(t.texto)) r.erros.push(`trecho ${id}: falta o texto exato`);
    for (const c of CAMPOS_DIRECAO) {
      const v = t[c];
      if (v == null || (Array.isArray(v) ? !v.length : !String(v).trim())) r.erros.push(`trecho ${id}: falta "${c}" na direção vocal`);
    }
    for (const [re, nome] of PROIBIDO) {
      if (re.test(t.texto || "") && !excecoes.has(id)) r.erros.push(`trecho ${id}: ${nome} no texto falado (narração contínua; use pausa_excecao com duração e justificativa se for mesmo precisa)`);
    }
    if (/[\[\]{}<>]/.test(t.texto || "")) r.erros.push(`trecho ${id}: o texto falado tem rótulos/comandos entre colchetes — direção fica fora do texto`);
  }
  for (const s of plano.cenas || []) {
    for (const [re, nome] of PROIBIDO) if (re.test(s.narracao || "")) r.erros.push(`${s.id}: ${nome} na narração da cena`);
  }
  // bloco único contínuo = soma exata dos trechos
  const junto = norm(trechos.map((t) => t.texto).join(" "));
  if (!norm(n.texto_completo)) r.erros.push("audio.narracao.texto_completo: falta o bloco contínuo pronto para copiar");
  else if (norm(n.texto_completo) !== junto) r.erros.push("audio.narracao.texto_completo não coincide com a soma dos trechos");
  // estimativa de duração
  const wps = Number(n.velocidade_alvo_wps);
  const palavras = contarPalavras(junto);
  const total = (plano.cenas || []).reduce((s, c) => s + Number(c.duracao_s || 0), 0);
  const disponivel = Number(n.tempo_disponivel_s ?? total);
  if (wps > 0 && palavras) {
    const est = Math.round((palavras / wps) * 10) / 10;
    r.estimativa = { palavras, wps, segundos: est, disponivel };
    if (est > disponivel) r.erros.push(`narração estimada em ${est} s para ${disponivel} s disponíveis: corte ou reformule o texto antes de acelerar (11-voz §3)`);
    else if (est > disponivel * 0.95) r.avisos.push(`narração estimada em ${est} s para ${disponivel} s: muito justa, valide ouvindo`);
    const somaTrechos = trechos.reduce((s, t) => s + Number(t.duracao_estimada_s || 0), 0);
    if (somaTrechos && Math.abs(somaTrechos - est) > Math.max(1.5, est * 0.15)) r.avisos.push(`soma das durações por trecho (${somaTrechos} s) difere da estimativa por palavras (${est} s)`);
  } else r.erros.push("audio.narracao.velocidade_alvo_wps: indique a velocidade de planeamento (perfil-vocal.md)");
  return r;
}
