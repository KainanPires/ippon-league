// lib/traduzirNoticia.ts
//
// TRADUÇÃO DE NOTÍCIAS por IA (Claude), do lado do SERVIDOR.
//
// As notícias do Blog do Dôdo — geradas pelo motor OU escritas por uma pessoa —
// nascem em português. Para chamarem a atenção de quem lê noutra língua, têm de
// aparecer JÁ traduzidas. Este ficheiro faz essa tradução e o resultado guarda-se
// em `hub_noticias.traducoes` (coluna JSON), para servir depois sem custo nem
// espera — traduz-se uma vez, ao publicar, e lê-se as vezes que forem precisas.
//
// SÓ CORRE NO SERVIDOR (usa a chave da API). NUNCA importar num componente do
// cliente: a ANTHROPIC_API_KEY ficaria exposta no browser.

export type CamposNoticia = { titulo: string; resumo: string; corpo: string };
export type LinguaAlvo = "en" | "es" | "fr" | "de";
export const LINGUAS_ALVO: LinguaAlvo[] = ["en", "es", "fr", "de"];
export type TraducoesNoticia = Partial<Record<LinguaAlvo, CamposNoticia>>;

const NOME_LINGUA: Record<LinguaAlvo, string> = {
  en: "English",
  es: "Spanish (Spain)",
  fr: "French (France)",
  de: "German (Germany)",
};

// Termos e nomes que NUNCA se traduzem — o glossário do judô e as marcas do
// produto. Vai no prompt para o modelo os deixar exatamente como estão. Nomes de
// pessoas, atletas, equipas, clubes e países também ficam intactos (regra geral
// no prompt), tal como números, resultados, categorias de peso e ligações.
const NAO_TRADUZIR = [
  // Judô
  "ippon", "waza-ari", "yuko", "shido", "hansoku-make", "judogi", "tatame", "dojo", "Pool",
  // Marcas / nomes próprios do produto
  "Ippon League", "Ippon Pro", "Pro Max", "Judocoins", "JC", "Copa do Dôdo",
  "Copa Ippon", "Dôdo", "Grand Slam", "Blog do Dôdo",
  "Instagram", "TikTok", "YouTube", "WhatsApp",
];

const SISTEMA = `You are a professional sports translator for a judo fantasy game.
Translate the given JSON news fields from Portuguese into the requested target languages.

Hard rules:
- Translate ONLY the human-readable text. Preserve meaning, tone and paragraph breaks (\\n) exactly.
- DO NOT translate or alter proper names: people, athletes, teams, clubs, countries and cities.
- DO NOT translate or alter these product and judo terms: ${NAO_TRADUZIR.join(", ")}.
- DO NOT change any numbers, scores, dates, weight categories (e.g. -73kg / +78kg), rankings, or URLs.
- Keep judo scoring terms (ippon, waza-ari, yuko, shido, hansoku-make) in their original form in every language.
- Return STRICT JSON ONLY. No prose, no explanations, no code fences.`;

// Constrói o pedido: UMA só chamada devolve TODAS as línguas de uma vez.
function construirPrompt(campos: CamposNoticia): string {
  const alvos = LINGUAS_ALVO.map((l) => `"${l}" (${NOME_LINGUA[l]})`).join(", ");
  return [
    `Source (Portuguese):`,
    JSON.stringify({ titulo: campos.titulo, resumo: campos.resumo, corpo: campos.corpo }),
    ``,
    `Translate into: ${alvos}.`,
    `Return a JSON object shaped EXACTLY like:`,
    `{"en":{"titulo":"...","resumo":"...","corpo":"..."},"es":{"titulo":"...","resumo":"...","corpo":"..."},"fr":{"titulo":"...","resumo":"...","corpo":"..."},"de":{"titulo":"...","resumo":"...","corpo":"..."}}`,
  ].join("\n");
}

// Tira cercas de código, caso o modelo as ponha apesar da instrução, e isola o
// objeto JSON entre a primeira { e a última }.
function extrairJson(texto: string): string {
  const limpo = texto.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const ini = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  return ini >= 0 && fim > ini ? limpo.slice(ini, fim + 1) : limpo;
}

/**
 * Traduz os campos de uma notícia para as 4 línguas. Devolve o objeto de
 * traduções, ou `null` se algo falhar (sem chave, erro da API, JSON inválido).
 * Nunca lança: quem chama deixa a notícia em português nesse caso e volta a
 * tentar mais tarde (a varredura do cron apanha-a na passagem seguinte).
 */
export async function traduzirNoticia(campos: CamposNoticia): Promise<TraducoesNoticia | null> {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) return null;
  // Modelo configurável: por omissão um rápido e barato, ideal para tradução.
  // Podes trocar por um mais forte em ANTHROPIC_MODEL sem mexer no código.
  const modelo = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": chave,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelo,
        max_tokens: 4000,
        temperature: 0,
        system: SISTEMA,
        messages: [{ role: "user", content: construirPrompt(campos) }],
      }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { content?: Array<{ type: string; text?: string }> };
    const texto = (data.content || []).filter((b) => b.type === "text").map((b) => b.text || "").join("");
    if (!texto) return null;
    const bruto = JSON.parse(extrairJson(texto)) as Record<string, Partial<CamposNoticia>>;
    const out: TraducoesNoticia = {};
    for (const l of LINGUAS_ALVO) {
      const v = bruto[l];
      if (v && typeof v.titulo === "string" && typeof v.corpo === "string") {
        out[l] = {
          titulo: v.titulo,
          resumo: typeof v.resumo === "string" ? v.resumo : "",
          corpo: v.corpo,
        };
      }
    }
    // Só vale se veio pelo menos uma língua completa.
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}
