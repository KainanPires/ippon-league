// lib/favoritoAviso.ts
//
// Decide o push do ATLETA FAVORITO: "venceu" ou "perdeu" a última luta.
//
// PORQUÊ ESTE FICHEIRO EXISTE (bug corrigido):
//   Antes, a rota olhava para o ÚLTIMO elemento de `resultados_atletas.lutas` e
//   assumia que era a luta mais recente. Não é garantido:
//     • a ordem vem do JudoBase tal como ele a devolve (não é cronológica por contrato);
//     • as lutas MANUAIS (lib/lutasManuais) são sempre acrescentadas ao FIM, mesmo
//       que tenham acontecido antes das lutas que o JudoBase leu depois.
//   Resultado: um atleta que perdia recebia "venceu!" (a "última" da lista era uma
//   vitória antiga).
//
// COMO DECIDIMOS AGORA (sem depender de ordem nenhuma):
//   Guardamos, por (user, atleta, competição), o placar que já tínhamos visto
//   (vitórias e derrotas). Na volta seguinte comparamos:
//     • as DERROTAS subiram  -> perdeu
//     • as VITÓRIAS subiram  -> venceu
//   Só contam lutas DECIDIDAS (vitórias + derrotas). Uma luta apenas agendada/em
//   curso já não dispara aviso.
//
// ESTADO: cabe na coluna inteira que já existia (`favoritos_notif_estado.ultimas_lutas`),
// para não exigir alteração à base de dados:
//     valor = 10000 + vitórias*100 + derrotas        (ex.: 3-2 -> 10302)
//   Valores < 10000 são do formato ANTIGO (só o nº de lutas). Esses são convertidos
//   em silêncio na primeira passagem (sem push), porque não sabemos o placar anterior.

export type TipoAviso = "venceu" | "perdeu";

export interface PlacarAtual {
  vitorias: number;
  derrotas: number;
  /** Lista de lutas (só usada como desempate quando houve vitória E derrota novas na mesma volta). */
  lutas?: Array<{ venceu?: boolean }>;
}

export interface DecisaoAviso {
  /** Novo valor a gravar em `ultimas_lutas`, ou null se não há nada a gravar. */
  novoEstado: number | null;
  /** Push a enviar, ou null se não há aviso. */
  aviso: TipoAviso | null;
}

const BASE = 10000;
const limitar = (x: number): number => Math.max(0, Math.min(99, Math.floor(Number(x) || 0)));

/** Placar -> inteiro guardado na base. */
export function codificarEstado(vitorias: number, derrotas: number): number {
  return BASE + limitar(vitorias) * 100 + limitar(derrotas);
}

/** Inteiro guardado -> placar. Devolve null se for do formato antigo (só nº de lutas). */
export function lerEstado(valor: number): { vitorias: number; derrotas: number } | null {
  if (!Number.isFinite(valor) || valor < BASE) return null;
  const resto = Math.floor(valor) - BASE;
  return { vitorias: Math.floor(resto / 100), derrotas: resto % 100 };
}

/**
 * Compara o estado anterior com o placar atual e diz o que fazer.
 * @param prev valor guardado em `ultimas_lutas` (undefined = nunca vimos este par).
 */
export function decidirAviso(prev: number | undefined, atual: PlacarAtual): DecisaoAviso {
  const v = limitar(atual.vitorias);
  const d = limitar(atual.derrotas);
  const estadoAtual = codificarEstado(v, d);

  // Primeira vez que vemos este par: SEED, sem notificar.
  if (prev === undefined) return { novoEstado: estadoAtual, aviso: null };

  // Formato antigo: converte em silêncio (não sabemos se o que mudou foi V ou D).
  const antes = lerEstado(prev);
  if (!antes) return { novoEstado: estadoAtual, aviso: null };

  const dv = v - antes.vitorias;
  const dd = d - antes.derrotas;

  // Nada de novo.
  if (dv === 0 && dd === 0) return { novoEstado: null, aviso: null };

  // O total de lutas decididas não subiu (ex.: o JudoBase corrigiu um resultado):
  // acerta o estado, sem push.
  if (v + d <= antes.vitorias + antes.derrotas) return { novoEstado: estadoAtual, aviso: null };

  if (dd > 0 && dv <= 0) return { novoEstado: estadoAtual, aviso: "perdeu" };
  if (dv > 0 && dd <= 0) return { novoEstado: estadoAtual, aviso: "venceu" };

  // Raro: uma vitória E uma derrota novas na mesma volta (duas lutas entre duas
  // passagens do cron). Só aqui recorremos à ordem da lista, como melhor palpite.
  const lutas = atual.lutas || [];
  const ultima = lutas.length > 0 ? lutas[lutas.length - 1] : null;
  return { novoEstado: estadoAtual, aviso: ultima?.venceu === true ? "venceu" : "perdeu" };
}
