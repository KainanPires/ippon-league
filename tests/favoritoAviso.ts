// tests/favoritoAviso.ts — npx tsx tests/favoritoAviso.ts
// Garante que o push do favorito diz "venceu"/"perdeu" pelo PLACAR e não pela
// ordem da lista de lutas (bug: perdeu a última luta e o push dizia "venceu").
import assert from "node:assert/strict";
import { decidirAviso, codificarEstado, lerEstado } from "../lib/favoritoAviso";

const W = { venceu: true }, L = { venceu: false };

// codificação ida e volta
assert.deepEqual(lerEstado(codificarEstado(3, 2)), { vitorias: 3, derrotas: 2 });
assert.equal(lerEstado(4), null); // formato antigo (nº de lutas)

// 1ª vez: semeia, sem push
assert.deepEqual(decidirAviso(undefined, { vitorias: 2, derrotas: 0 }), { novoEstado: codificarEstado(2, 0), aviso: null });

// O CASO DO BUG: estava 3-1, perdeu a repescagem -> 3-2. A lista termina numa
// VITÓRIA (ordem não cronológica / luta manual no fim) e mesmo assim é "perdeu".
assert.equal(decidirAviso(codificarEstado(3, 1), { vitorias: 3, derrotas: 2, lutas: [L, L, W, W, W] }).aviso, "perdeu");

// Vitória nova com a lista a terminar numa derrota -> "venceu"
assert.equal(decidirAviso(codificarEstado(2, 1), { vitorias: 3, derrotas: 1, lutas: [W, W, W, L] }).aviso, "venceu");

// Primeira luta
assert.equal(decidirAviso(codificarEstado(0, 0), { vitorias: 1, derrotas: 0 }).aviso, "venceu");
assert.equal(decidirAviso(codificarEstado(0, 0), { vitorias: 0, derrotas: 1 }).aviso, "perdeu");

// Sem mudança: nada a gravar, nada a enviar
assert.deepEqual(decidirAviso(codificarEstado(3, 2), { vitorias: 3, derrotas: 2 }), { novoEstado: null, aviso: null });

// Estado antigo (só nº de lutas): converte em silêncio
assert.deepEqual(decidirAviso(4, { vitorias: 3, derrotas: 2 }), { novoEstado: codificarEstado(3, 2), aviso: null });

// Correção do JudoBase (total igual): acerta o estado, sem push
assert.deepEqual(decidirAviso(codificarEstado(3, 1), { vitorias: 2, derrotas: 2 }), { novoEstado: codificarEstado(2, 2), aviso: null });

// Duas lutas na mesma volta (V e D novas): desempata pela lista
assert.equal(decidirAviso(codificarEstado(1, 0), { vitorias: 2, derrotas: 1, lutas: [W, W, L] }).aviso, "perdeu");
assert.equal(decidirAviso(codificarEstado(1, 0), { vitorias: 2, derrotas: 1, lutas: [W, L, W] }).aviso, "venceu");

console.log("favoritoAviso: OK");
