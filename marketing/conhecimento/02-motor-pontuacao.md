# 02 · Motor de pontuação e valorização (como funciona de verdade)

Fontes: `lib/engine.ts`, `lib/ijf.ts` (scoreContestSide), `lib/congelar.ts`, `lib/team.ts`. Consultado a 30/09/2026 (`main@e816cac`). Os números estão em `factos.json` (VERIFICADO).
Os testes de caracterização do motor vivem em `testes  /engine.caracterizacao.ts` (a pasta tem espaços no nome; o script `npm test` aponta para `tests/…` e por isso não a encontra — problema existente, não alterado).

## 1. Pontos por luta, para cada lado

1. **Ações de valor fixo** (tabela `POINTS`), aplicadas e sofridas, somam-se todas:

| Ação | Aplica | Sofre |
|---|---|---|
| Ippon | +10 | −5 |
| Waza-ari | +4 | −2 |
| Yuko | +2 | −1 |
| Hansoku-make direto | — | −10 |

2. **Shidos** — não usam valor fixo, são **crescentes**:
   - sofrer: 1.º −2, 2.º −3, 3.º −4 (3 shidos = −9)
   - provocar (shido no adversário): 1.º +1, 2.º +2, 3.º +3 (3 shidos = +6)
3. **Hansoku-make por 3 shidos**: o ippon que o JudoBase regista é "fantasma" e é **ignorado dos dois lados**. Contam só os shidos.

Exemplos validados no código:
- vitória por hansoku (3 shidos provocados): vencedor **+6**, perdedor **−9**;
- ippon com 2 shidos provocados: vencedor **+13** (10+1+2), perdedor **−10** (−5 −2 −3);
- ippon limpo: vencedor **+10**, perdedor **−5**.

## 2. Pontos da equipa na rodada
- Soma dos pontos dos 8 atletas; **capitão ×2**.
- Equipa acima do orçamento: **inativa** na rodada (0 pontos, património parado).

## 3. Preço dos atletas (modelo v2)
- **Preço de estreia**: expectativa **70% média 12 meses + 30% últimas 3 competições**, escala **2–20 JC**.
- **Durante a época**: `D = pontos da competição − preço atual`; **novo preço = preço + 50% × D**.
- **Piso 2 JC**. Pode passar dos 20 JC. Existe um **teto de segurança de 50 JC** contra dados corrompidos (não é regra de jogo, mas existe — não dizer "sem limite").
- Exemplos do código: preço 15, fez 35 → 25 JC; preço 25, fez 45 → 35 JC; preço 35, fez 5 → 20 JC.

## 4. Património do jogador (assimétrico)
Por atleta escalado, a cada competição (`lib/congelar.ts`):
- atleta **valorizou** v JC → o jogador **ganha v/2**;
- atleta **desvalorizou** v JC → o jogador **perde v inteiro**.
("Ganhas metade do que o atleta sobe, perdes tudo o que ele desce.")

## 5. Época
Ano civil. Reset a 30/12: re-preço 70/30 na escala 2–20, orçamento volta a 100 JC, JC comprados expiram.

## 6. Faixas (percentil mensal entre jogadores ativos)
preta ≤ 5% · marrom ≤ 15% · roxa ≤ 30% · verde ≤ 50% · amarela ≤ 70% · azul ≤ 90% · branca o resto.

## Como explicar em conteúdo (validado com o código)
- "Ippon vale +10. Do capitão vale +20." ✅
- "Cada shido que o teu atleta provoca vale mais que o anterior: +1, +2, +3." ✅
- "O atleta valoriza quando faz mais pontos do que custa." ✅
- Evitar: "sem limite de preço" ❌ · "ganhas o mesmo que o atleta valoriza" ❌
