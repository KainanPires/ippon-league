# Economia Ippon League — Modelo v2 (spec para aprovação)

> **Estado: spec para aprovar. Nenhum código escrito.**
> Isto trava, por escrito, o modelo que decidimos hoje. Mexe no motor de preço
> e no património — a parte mais sensível do jogo — por isso quero o teu "sim"
> a esta folha antes de editar `lib/engine.ts` / `lib/congelar.ts`.

---

## Vocabulário

- **Época / temporada** = ano civil. Fecha a **30 de dezembro**; a seguir "zera".
- **D (diferença de referência)** = `pontos do atleta na competição − preço atual do atleta (JC)`.
- **JC** = Judocoins. 1 JC = 1 €.

---

## 1. Preço inicial de um atleta (primeira vez que aparece)

Continua como hoje: pela **expectativa 70/30** (70% média 12 meses + 30% últimas
3 competições), convertida na escala **2–20 JC**. Inalterado.
*(É o `calcularForma` / Modelo A atual.)*

## 2. Movimento de preço DURANTE a época (a cada competição)

Muda para o teu modelo:

- `D = pontos − preço`
- **Novo preço = preço + 50% × D**
- **Sem teto superior** durante a época (um atleta pode passar de 20 JC — ex.: 20 → 32).
- **Piso** mantém-se: nunca abaixo de **2 JC**.
- Durante a época **já não se usa** a expectativa 70/30 — só na primeira aparição (ponto 1) e no reset de ano (ponto 4).

## 3. Património de quem escalou (por atleta, por competição)

Assimétrico, para criar a pressão de comprar JC:

- Se o atleta **valoriza** (D > 0): **ganhas 25% de D**.
- Se o atleta **desvaloriza** (D < 0): **perdes 50% de |D|**.

Traduzindo: **ganhas metade do que o atleta sobe, mas perdes o total do que ele
desce.** (O atleta move-se 50% de D; tu ficas com metade disso na subida e com o
valor inteiro na descida.)

## 4. Reset de início de ano (a seguir a 30 dez)

- Todos os atletas são **re-precificados pela 70/30 na escala 2–20 JC** — é aqui que o **teto de 20 JC** volta a existir (re-ancoragem anual).
- Todos os utilizadores voltam a **100 JC** de orçamento/património.
- **Os JC comprados expiram** (ver ponto 5 e o alerta legal).

## 5. Compra de JC (dinheiro real)

- 1 JC = 1 €. Compra **orçamento extra**, válido em **todas as ligas** (a tua decisão).
- Publicidade no mercado, sobretudo quando falta saldo para um atleta.
- **Os JC comprados valem só até 30 de dezembro do ano da compra; depois zeram.** Tem de ser **informado claramente no checkout** (e ver o alerta legal em baixo).

---

## Exemplo de uma época inteira (1 atleta, 1 jogador)

| Momento | Pontos | D | Preço do atleta | O teu património |
|---|---|---|---|---|
| Início de ano (70/30) | — | — | **15 JC** | **100 JC** |
| Competição 1 | 35 | 35−15 = **20** | 15 + 10 = **25 JC** | +25%×20 = **105** |
| Competição 2 | 45 | 45−25 = **20** | 25 + 10 = **35 JC** *(passou dos 20)* | +5 = **110** |
| Competição 3 | 5 | 5−35 = **−30** | 35 − 15 = **20 JC** | −50%×30 = **95** |
| 30 dez → reset | — | — | re-preço 70/30 (≤20 JC) | volta a **100** |

Repara: na subida ganhas metade (competições 1 e 2), na descida levas o valor
inteiro (competição 3 dói mesmo). Sem teto, a estrela sobe livre durante o ano;
no reset, tudo volta ao padrão e os JC comprados zeram.

---

## Alertas honestos (para decidires de olhos abertos)

1. **JC comprados que expiram a 30 dez — o ponto mais sensível.** Vender valor
   digital pago que depois desaparece é delicado na lei do consumidor da UE, e
   ainda mais com prémios por perto. O mais defensável é **não expirar os JC
   comprados** (expirar só o orçamento ganho no jogo). Se mantiveres a expiração,
   precisa de aviso muito claro no checkout **e** de validação com advogado antes
   de vender. (Não sou advogado — isto é um sinal, não um veredito.)

2. **Vantagem paga + prémio.** Comprar orçamento em todas as ligas, agora sem
   teto de preço, reforça o ângulo "vantagem paga". A mitigação continua a ser o
   mérito do teu jogo (pontua-se por ações, não por medalhas), mas o
   enquadramento com prémios merece revisão jurídica.

3. **Entrar a meio da época.** Sem teto, um novato que chega em outubro encontra
   estrelas a 35+ JC com apenas 100 JC, enquanto os veteranos têm património
   inflado. O reset anual corrige, mas dentro do ano a distância cresce. Decide:
   aceitar assim (mais simples) ou dar ao novato um orçamento à escala do mercado.

---

## O que muda no código (quando aprovares — ainda não)

- `lib/engine.ts` — `computeNewPrice`: passa a `preço + 50%×(pontos−preço)`, remove o teto **durante a época** (mantém piso 2 JC).
- `lib/congelar.ts` — património: soma **25% de D** nas subidas e **50% de |D|** nas descidas (em vez do delta inteiro).
- **Reset de ano** — re-preço 70/30 na escala 2–20, património a 100, expiração de JC comprados (conforme decisão do alerta 1).
- **Compra de JC** — fluxo de checkout + publicidade no mercado + registo do que expira e quando.
- **Extra pedido:** no "Meu Time", mostrar quem **valorizou/desvalorizou mais** no conjunto dos 8.

---

*Fim da spec. Confirma (ou ajusta) e eu passo ao plano de implementação.*
