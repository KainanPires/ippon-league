# Proposta · "De onde vêm os pontos?" — educativo de pontuação

Campanha `educativo-pontuacao` · versão 1 · 30/09/2026
**Estado: PROPOSTA para avaliação. Nada foi enviado ao Higgsfield. Nada foi gerado nem gasto.**

---

## 1. Objetivo e entendimento da dúvida

**A dor.** O fã de judô sabe ler o placar de uma luta: quem fez ippon ou waza-ari ganha. Quando entra na Ippon League vê números que não batem com esse placar — um atleta que perdeu soma pontos, um que ganhou pode descontar — e não percebe para que servem esses pontos.

**O que o vídeo tem de deixar claro (3 ideias, nesta ordem):**
1. **Placar da luta ≠ pontos fantasy.** O placar decide quem vence. Os pontos fantasy contam cada ação do atleta: o que aplica soma, o que sofre desconta — mesmo quando perde.
2. **De onde vem cada ponto.** Tabela de ações e shidos crescentes, com um exemplo calculado.
3. **Para que servem.** Atleta → competição → capitão ×2 → soma dos 8 → ranking da liga → faixa do mês.

**Objetivo de negócio.** Aumentar a compreensão (e com ela a ativação: montar time e escolher capitão). Métricas: conclusão do vídeo, saves e partilhas do carrossel, cliques para `/como-jogar`.

**Proposta de melhoria à ideia (e porquê):**
- **Abrir com um paradoxo, não com uma tabela.** "Ele venceu a luta… e fez −2 pontos." Uma tabela no início explica antes de a pessoa querer saber; o paradoxo cria a pergunta que o vídeo responde. É também um caso real do motor (calculado abaixo).
- **Um só atleta, duas lutas.** Em vez de vários exemplos soltos, seguimos o mesmo atleta: ganha uma luta (+12) e perde outra (+3), e o vencedor dessa segunda luta fica com −2 — fecha o gancho.
- **Valorização fica para o episódio 2.** Pontos → preço → património é a segunda grande dúvida, mas juntá-la aqui sobrecarrega. O episódio 2 usa o mesmo atleta: custava 11 JC, fez 15 pontos → passa a 13 JC e o dono ganha +1 JC de património (calculado com o motor).
- **Duração: ~1:21**, não 30 s. Com menos, teria de cortar ou a tabela, ou o exemplo, ou a ligação ao objetivo — e são as três partes da dor. O carrossel funciona como "cola" para guardar e o vídeo pode ser **fixado no perfil**.
- **CTA para a página que já existe:** `ipponleague.com/como-jogar` tem a tabela publicada (confirmado a 30/09).

**Não repete o lançamento:** sem "não é bet", sem arco de lançamento, sem pedido de feedback; a narrativa é um mistério com resposta.

### Regras usadas (verificadas no código `main@e816cac`)
| Regra | Fonte | Estado |
|---|---|---|
| Ippon +10 / −5 · Waza-ari +4 / −2 · Yuko +2 / −1 | `lib/engine.ts` (POINTS) | implementado · verificado · publicado |
| Shido provocado +1, +2, +3 · sofrido −2, −3, −4 | `lib/engine.ts`, `lib/ijf.ts` | implementado · publicado |
| Pontos do atleta na competição = soma de todas as lutas | `lib/congelar.ts` | implementado |
| Capitão ×2; pontos do time = soma dos 8 | `lib/congelar.ts` | implementado |
| Faixa pelo desempenho do mês face aos outros jogadores | `lib/engine.ts`, `lib/faixas.ts` | implementado · verificado |

### O exemplo (calculado com o motor real, `scoreContestSide`)
Atleta fictício de judogi **azul** (sem nome, de costas):
- **Luta 1 (venceu):** waza-ari +4, ippon +10, 1 shido sofrido −2 → **+12**
- **Luta 2 (perdeu):** yuko +2, waza-ari sofrido −2, 2 shidos provocados +1 +2 → **+3**
  - O adversário que **venceu** a luta 2: waza-ari +4, yuko sofrido −1, 2 shidos sofridos −2 −3 → **−2**
- **Competição:** 12 + 3 = **15** · **como capitão: 30**

⚠️ Deixei **de fora** o "hansoku-make direto −10": está na tabela publicada, mas o motor que lê as lutas do JudoBase não o aplica (só existe na tabela). Ver pendências.

---

## 2. Conceito e descrição corrida

**Conceito: "O placar mente (para o fantasy)".**

Abre num placar de luta: o judoca de branco vence por waza-ari. Por baixo, o contador de pontos fantasy dele cai para **−2**, a vermelho. "Ele venceu a luta… e fez menos dois pontos."
O Dôdo 3D, o sensei, entra no tatame, inclina a cabeça para o −2 e levanta a mão: "Calma." O ecrã divide-se: à esquerda o placar da luta, que decide quem vence; à direita os pontos fantasy, onde tudo o que o atleta aplica soma e tudo o que sofre desconta — mesmo quando perde.
Surge a tabela, uma linha de cada vez, com o Dôdo 2D a apontar: ippon, waza-ari, yuko. Depois duas escadas mostram que o shido pesa cada vez mais.
Agora o exemplo: vista de cima de um tatame, o nosso atleta de azul (número 8, BRA). Na primeira luta os cartões saltam — +4, +10, −2 — e o contador fecha em **12**. Na segunda luta ele perde, mas soma +2, −2, +1, +2: **3**. A música corta meio segundo: "E quem venceu?" O contador do branco volta a aparecer: **−2**. O mistério do início está resolvido.
Os dois números juntam-se: **15** na competição. A moldura dourada de capitão encaixa e o número dobra: **30**. A carta entra numa grelha de 8 atletas, que somam os pontos do time na rodada; o time sobe no ranking da liga e, em baixo, a faixa do mês acende.
Fecha com o Dôdo 3D a comemorar e a frase: "Escolha quem faz mais do que ganhar." Botão: Monte seu time.

---

## 3. Roteiro cena por cena (≈ 81 s · 9:16 · 1080×1920 · 30 fps)

Paleta e fontes da marca: fundo `#0c0e0d` com textura diagonal e partículas douradas; Oswald (títulos), Manrope (texto); creme `#f1ede2`, dourado `#d9a441`, verde `#7fd1a3`, vermelho `#e2655a`. Atletas sempre fictícios, de costas, sem rosto nem nome.

### C01 · 00:00–00:05 (5 s) · Gancho
- **Dôdo:** não aparece.
- **Cenário e composição:** placar estilizado ao centro (sem logos de federações): AZUL 1 yuko · BRANCO 1 waza-ari + 2 shidos → "BRANCO VENCE". Por baixo, contador dourado "PONTOS FANTASY · BRANCO".
- **Câmara:** plano geral do placar; zoom digital rápido (0,4 s) para o contador aos 2 s.
- **Textos:** "ELE VENCEU A LUTA…" (Oswald creme, letra a letra, topo) → "…E FEZ −2 PONTOS." (Oswald dourado; "−2" vermelho, centro).
- **Narração:** «Ele venceu a luta… [0,4 s] e fez menos dois pontos.» — intenção: intriga, tom baixo.
- **Música:** só batida grave, intensidade baixa.
- **SFX / VFX:** bip de placar; whoosh descendente quando o contador cai; tremor leve no −2.
- **Transição:** corte seco no fim de "pontos".
- **Produção:** motion no CapCut. Ficheiros: fundo com textura (PNG), placar (PNG/camadas), fontes Oswald/Manrope.

### C02 · 00:05–00:11 (6 s) · O sensei entra — **Higgsfield G1**
- **Dôdo:** 3D (vinil), judogi branco, faixa preta; plano médio centrado; inclina a cabeça para o −2, levanta a mão direita num gesto calmo de "espera, eu explico", olha para a câmara. Expressão: tranquila, de sensei.
- **Cenário:** estúdio escuro, chão de tatame verde-escuro, luz de recorte dourada, partículas lentas.
- **Câmara:** push-in muito lento.
- **Textos:** "CALMA." (Oswald creme, topo).
- **Narração:** «Calma. [0,3 s] Placar da luta e pontos do seu time são coisas diferentes.» — intenção: acolher, mudar de tom.
- **Música:** entra o tema (pad + batida), média-baixa.
- **SFX:** "plim" suave no gesto.
- **Transição:** congela o último quadro 1 s (o clipe tem 5 s) e desliza para a esquerda.
- **Produção:** geração image-to-video a partir de `assets/dodo/3d/dodo3d_0.5.jpg` (Dôdo 3D de corpo inteiro, sem texto). Prompt no `plano.json`.

### C03 · 00:11–00:21 (10 s) · A diferença essencial
- **Dôdo:** 2D **sábio** (óculos), canto inferior direito, virado para a coluna da direita.
- **Composição:** ecrã dividido — esquerda "PLACAR DA LUTA" (cinza `#93a39a`, ícone de troféu, "decide quem vence"); direita "PONTOS FANTASY" (dourado) com linhas que entram: "aplicou → SOMA" (verde), "sofreu → DESCONTA" (vermelho), "mesmo perdendo".
- **Câmara:** fixa; cada linha entra com escala 95→100 %.
- **Narração:** «O placar do judô decide quem vence. [0,3 s] Os pontos fantasy contam o que o seu atleta fez: aplicou, soma. Sofreu, desconta. [0,2 s] Mesmo quando ele perde.» — intenção: clareza, ritmo firme.
- **Música:** tema estável, média.
- **VFX:** divisória dourada desenha-se de cima para baixo.
- **Transição:** a metade esquerda sai; a direita expande (wipe).
- **Produção:** motion no CapCut + `assets/dodo/2d/png/dodo_sabio_faixa-preta_judogi-branco.png`.

### C04 · 00:21–00:30 (9 s) · Tabela de ações
- **Dôdo:** 2D **indicando**, à esquerda da tabela, braço a apontar para a linha ativa.
- **Composição:** tabela em cartões da app (fundo `#141a17`, borda `#243029`): cabeçalho AÇÃO · APLICA · SOFRE; linhas IPPON +10 −5 · WAZA-ARI +4 −2 · YUKO +2 −1. Cada linha acende quando é dita.
- **Câmara:** fixa.
- **Narração:** «Ippon aplicado vale dez. Sofrido, menos cinco. [0,2 s] Waza-ari: mais quatro ou menos dois. [0,2 s] Yuko: mais dois ou menos um.» — intenção: didática, sem pressa.
- **Música:** tema, média. **SFX:** "tic" por linha. **VFX:** brilho dourado na linha ativa.
- **Transição:** a tabela desliza para cima.
- **Produção:** motion no CapCut (opcional: 2 s de gravação de ecrã da tabela em `/como-jogar`). `dodo_indicando_faixa-preta_judogi-branco.png`.

### C05 · 00:30–00:37 (7 s) · Shidos crescentes
- **Dôdo:** 2D **sábio**, entre as escadas.
- **Composição:** duas escadas de 3 degraus — verde a subir (PROVOCOU: +1 +2 +3) e vermelha a descer (LEVOU: −2 −3 −4). Título "SHIDO PESA CADA VEZ MAIS" (creme + "CADA VEZ MAIS" dourado).
- **Câmara:** leve subida vertical a acompanhar a escada verde.
- **Narração:** «E o shido pesa cada vez mais. [0,2 s] Provocar dá um, dois, três. Levar tira dois, três, quatro.»
- **Música:** tema, média. **SFX:** 3 degraus ascendentes; 3 degraus graves descendentes.
- **Transição:** corte para o tatame.
- **Produção:** motion no CapCut.

### C06 · 00:37–00:46 (9 s) · Exemplo, luta 1
- **Dôdo:** não aparece (o atleta é o protagonista).
- **Cenário:** vista de cima de um tatame estilizado; avatar AZUL de costas com back number 8 e sigla BRA; adversário BRANCO. Selo pequeno "VENCEU".
- **Ação:** cartões saltam do AZUL: WAZA-ARI +4 → IPPON +10 → SHIDO SOFRIDO −2; contador rola até **+12**.
- **Câmara:** plano geral; push-in lento para o contador no fim.
- **Textos:** "LUTA 1" · "+4 · +10 · −2" · "= +12" (dourado grande).
- **Narração:** «Veja o seu atleta. [0,3 s] Primeira luta: waza-ari, mais quatro. Ippon, mais dez. Levou um shido, menos dois. [0,2 s] Doze pontos.»
- **Música:** o tema sobe um nível. **SFX:** "pop" por cartão; registo suave no total.
- **Transição:** o "12" encolhe para o canto superior esquerdo e fica.
- **Produção:** motion no CapCut; avatares de kimono (❓ ficheiro vetorial dos avatares da app — ver pendências).

### C07 · 00:46–00:59 (13 s) · Exemplo, luta 2 — fecha o gancho
- **Cenário:** o mesmo tatame; selo "PERDEU" no AZUL.
- **Ação:** YUKO +2 → WAZA-ARI SOFRIDO −2 → 2 SHIDOS PROVOCADOS +1 +2 → **+3**. Silêncio de 0,5 s. Aparece o contador do BRANCO: **−2** (o mesmo flash vermelho da C01).
- **Câmara:** fixa; zoom no −2 no fim.
- **Textos:** "LUTA 2 · PERDEU" · "+2 · −2 · +1 · +2" · "= +3" · "QUEM VENCEU: −2".
- **Narração:** «Segunda luta: ele perdeu. [0,3 s] Mas fez um yuko: mais dois. Sofreu um waza-ari: menos dois. Provocou dois shidos: mais um, mais dois. [0,2 s] Três pontos. [0,5 s] E quem venceu? Menos dois.» — intenção: revelação, sorriso na voz no final.
- **Música:** corte de 0,5 s antes de "E quem venceu?" e volta. **SFX:** "pop" por cartão; "ding" irónico no −2. **VFX:** flash vermelho igual à C01.
- **Transição:** os contadores 12 e 3 voam para o centro.
- **Produção:** motion no CapCut.

### C08 · 00:59–01:05 (6 s) · Competição e capitão
- **Composição:** 12 + 3 → **15**; a carta do atleta recebe a **moldura dourada de capitão** (como no Meu Time) e o número duplica → **30**.
- **Câmara:** close na carta; punch-in no ×2.
- **Textos:** "COMPETIÇÃO: 15" · "CAPITÃO ×2 = 30".
- **Narração:** «Na competição, ele soma quinze. [0,2 s] Se for o seu capitão, conta em dobro: trinta.»
- **Música:** alta. **SFX:** "clack" da moldura; subida rápida no ×2. **VFX:** brilho na moldura.
- **Transição:** a carta encolhe e entra numa grelha de 8.
- **Produção:** motion no CapCut + gravação de ecrã do Meu Time com **conta de teste** (só a moldura de capitão).

### C09 · 01:05–01:15 (10 s) · Ligação ao objetivo
- **Dôdo:** 2D **comemorando**, canto inferior; a faixa dele passa de branca para azul quando a faixa acende.
- **Composição:** grelha de 8 cartas (4 M + 4 F) soma "PONTOS DO SEU TIME"; seta para um ranking de liga em que o time sobe uma posição; em baixo, barra das 7 faixas (branca → preta) com a próxima a acender.
- **Câmara:** panorâmica vertical lenta da grelha para as faixas.
- **Textos:** "8 ATLETAS = PONTOS DO SEU TIME" · "SOBE NO RANKING" · "MÊS A MÊS, SOBE DE FAIXA".
- **Narração:** «Os oito atletas somam os pontos do seu time na rodada. [0,2 s] É isso que faz você subir no ranking da sua liga. E, mês a mês, de faixa.»
- **Música:** pico. **SFX:** whoosh ascendente no ranking; acorde na faixa. **VFX:** partículas douradas.
- **Transição:** fundido para o final.
- **Produção:** motion no CapCut + gravação de ecrã de um ranking de liga **de teste** (sem nomes reais) + `dodo_comemorando_*.png` (faixa branca e azul — a azul renderiza-se do SVG, custo zero).

### C10 · 01:15–01:21 (6 s) · CTA — **Higgsfield G2 (opcional)**
- **Dôdo:** 3D, plano americano, levanta os dois braços a comemorar e acena para a câmara. Expressão: alegre.
- **Cenário:** estúdio escuro, raios de luz dourados, partículas.
- **Câmara:** fixa com leve subida.
- **Textos:** "ESCOLHA QUEM FAZ MAIS DO QUE GANHAR." (creme + "MAIS DO QUE GANHAR" dourado) · botão dourado "MONTE SEU TIME · LINK NA BIO"; último 1 s: logótipo.
- **Narração:** «Escolha quem faz mais do que ganhar. [0,2 s] Monte seu time na Ippon League.»
- **Música:** resolve no último acorde. **SFX:** "ding" no botão.
- **Transição:** fim.
- **Produção:** geração image-to-video de `dodo3d_0.5.jpg`. **Plano B de custo zero:** Dôdo 2D comemorando animado no CapCut + `assets/marca/logo-vertical-com-dodo_*`.

---

## 4. Texto corrido para narrar no CapCut

> Ele venceu a luta… e fez menos dois pontos.
> Calma. Placar da luta e pontos do seu time são coisas diferentes.
> O placar do judô decide quem vence. Os pontos fantasy contam o que o seu atleta fez: aplicou, soma. Sofreu, desconta. Mesmo quando ele perde.
> Ippon aplicado vale dez. Sofrido, menos cinco. Waza-ari: mais quatro ou menos dois. Yuko: mais dois ou menos um.
> E o shido pesa cada vez mais. Provocar dá um, dois, três. Levar tira dois, três, quatro.
> Veja o seu atleta. Primeira luta: waza-ari, mais quatro. Ippon, mais dez. Levou um shido, menos dois. Doze pontos.
> Segunda luta: ele perdeu. Mas fez um yuko: mais dois. Sofreu um waza-ari: menos dois. Provocou dois shidos: mais um, mais dois. Três pontos.
> E quem venceu? Menos dois.
> Na competição, ele soma quinze. Se for o seu capitão, conta em dobro: trinta.
> Os oito atletas somam os pontos do seu time na rodada. É isso que faz você subir no ranking da sua liga. E, mês a mês, de faixa.
> Escolha quem faz mais do que ganhar. Monte seu time na Ippon League.

(Versão com pausas e por cena: `entrega-capcut/v1/narracao/`. Idioma em PT-BR — ver pendências.)

---

## 5. Carrossel correspondente (Instagram, 8 páginas, 1080×1350)

Desenho dos posts de referência: logótipo pequeno no topo esquerdo, título enorme Oswald (creme + palavra dourada), texto Manrope ≤ 3 linhas, cartões com borda, botão dourado. Guardável como "cola".

| Pág. | Função | Título | Texto / visual |
|---|---|---|---|
| 1 | Gancho | ELE VENCEU. **E FEZ −2.** | Placar: BRANCO vence · contador fantasy −2 a vermelho. Dôdo 2D sábio a coçar a cabeça. "Desliza →" |
| 2 | Diferença | PLACAR ≠ **PONTOS** | Duas colunas: "Placar: decide quem vence." / "Fantasy: aplicou soma, sofreu desconta — mesmo perdendo." |
| 3 | Tabela | DE ONDE VÊM **OS PONTOS** | Cartão: Ippon +10/−5 · Waza-ari +4/−2 · Yuko +2/−1. Dôdo indicando. |
| 4 | Shidos | O SHIDO **PESA MAIS** | Escadas: provocou +1 +2 +3 · levou −2 −3 −4. |
| 5 | Luta 1 | LUTA 1: **+12** | Atleta azul (fictício): waza-ari +4, ippon +10, shido −2. Selo "VENCEU". |
| 6 | Luta 2 | PERDEU. **+3.** | Yuko +2, waza-ari sofrido −2, 2 shidos provocados +1 +2. Rodapé: "Quem venceu fez −2." |
| 7 | Objetivo | 15 → **30** | Competição 15 · capitão ×2 = 30 · "8 atletas = pontos do seu time → ranking da liga → faixa do mês". |
| 8 | CTA | ESCOLHA QUEM FAZ **MAIS DO QUE GANHAR** | Dôdo comemorando + botão "MONTE SEU TIME · LINK NA BIO". "Guarde este post." |

**Legenda sugerida:** "Na luta, o placar decide quem vence. No fantasy, conta tudo o que o seu atleta faz — até quando perde. Guarde a cola 👇 e veja a tabela completa em ipponleague.com/como-jogar. #judo #judô #fantasy #ipponleague" (hashtags a validar).
**Produção:** montagem estática (CapCut/Canva ou gerada por mim em HTML → PNG, custo zero). Sem Higgsfield.

---

## 6. Higgsfield vs. componentes reutilizados

| Cena | Origem | Custo |
|---|---|---|
| C02 Dôdo 3D "calma" | **Higgsfield G1** (image-to-video, 5 s) | pago |
| C10 Dôdo 3D a comemorar | **Higgsfield G2** (opcional; plano B 2D) | pago / zero |
| C01, C03–C09 | motion no CapCut | zero |
| Dôdo 2D (sábio, indicando, comemorando; faixas branca/azul/preta) | `assets/dodo/2d/` — renderizado do código | zero |
| Logótipo | `assets/marca/` | zero |
| Tabela, moldura de capitão, ranking | gravações de ecrã da app (conta de teste) | zero |
| Fundo com textura e partículas | a criar uma vez e reutilizar em todas as peças | zero |
| Carrossel | montagem estática | zero |

Referência para G1 e G2: `assets/dodo/3d/dodo3d_0.5.jpg` (quadro do vídeo de lançamento, Dôdo de corpo inteiro, sem texto).

---

## 7. Orçamento — **PENDENTE**

| Op. | O quê | Qtd | Créditos/unid. | Estado do preço |
|---|---|---|---|---|
| 1 | Alojar a referência num URL público (a API pede `image_url`) | 1 | 0 (fora do Higgsfield) | ❓ onde alojar |
| 2 | Estimativa oficial (`/estimate`) de G1 e G2 — não gera | 2 | 0 | precisa de credenciais da API |
| 3 | **G1** · C02 · `kling-video/v3.0-turbo/image-to-video` · 5 s · 1080p · 9:16 | 1 | **❓ não confirmado** | pendente |
| 4 | **G2** · C10 · mesmo endpoint e parâmetros (opcional) | 1 | **❓ não confirmado** | pendente |
| 5 | Acompanhar e descarregar | — | 0 | — |
| — | Regerações automáticas | 0 | — | não previstas: cena rejeitada precisa de nova autorização |

**Referência (não serve para autorizar):** a 30/09, pelo conector no Cowork, `get_cost` deu **10 créditos** para `kling3_0`, 5 s, 9:16, parâmetros padrão, sem imagem. Não é o mesmo produto/parâmetros da API.
**Teto solicitado:** **pendente** — será 1 × preço confirmado de G1 (+ 1 × G2 se aprovares G2). Na referência acima, seria **10** (só G1) ou **20** (G1 + G2), sem margem para retakes.
Saldo da conta Plus a 30/09: 740 créditos (❓ se a API usa o mesmo saldo).

**Gerações pedidas:** 1 obrigatória (G1) + 1 opcional (G2) = no máximo 2.

---

## 8. Pendências e critérios de revisão

### Pendências (decisões tuas)
1. **Idioma:** narração e textos em PT-BR (como escreveste) ou PT-PT (como a app)? A proposta está em PT-BR.
2. **Voz:** narras tu, como narrador, ou dás voz ao Dôdo?
3. **Música:** faixa e licença (fonte com uso comercial confirmado).
4. **Caminho de geração:** API com o executor (precisa de credenciais + URL pública da referência) ou conector do Cowork (confirmação por chamada, fora da trava assinada)?
5. **Preços:** confirmar G1/G2 no caminho escolhido → fecho o orçamento e o teto.
6. **G2:** gerar ou usar o plano B 2D (custo zero)?
7. **Gravações de ecrã:** conta de teste com dados fictícios (Meu Time com capitão, ranking de liga) — quem grava?
8. **Avatares de kimono:** ficheiro vetorial dos avatares da app (costas, back number) para as cenas 6–7.
9. **`utm_medium`** (C12) para o link.
10. **Produto (para o projeto de código):** "hansoku-make direto −10" aparece no guia publicado, mas o motor que lê o JudoBase não o aplica. Corrigir o guia ou o motor.

### Critérios de revisão (antes de P2 e de P4)
- **Factos:** todos os números batem com o motor (exemplo recalculado com `scoreContestSide`); nada de hansoku direto; nenhuma funcionalidade planeada.
- **Compreensão:** alguém que nunca jogou responde, depois de ver: "porque é que quem perdeu somou pontos?" e "para que servem os pontos?".
- **Gancho:** o −2 aparece antes dos 3 s e é resolvido na C07.
- **Ritmo:** narração cabe nos tempos (≈ 2,5 palavras/s); nenhuma cena com mais de uma ideia nova.
- **Marca:** cores e fontes oficiais; logótipo aprovado; fundo com textura.
- **Dôdo:** ornitorrinco fiel ao mestre (bico largo laranja, cabeça verde-azulada, judogi branco, faixa preta no 3D); 3D só em C02/C10; rejeitar gerações com anatomia ou cores diferentes.
- **Direitos:** atletas fictícios, de costas, sem nome; nenhuma imagem de transmissão; nenhum logo IJF/federação; música licenciada; ecrãs gravados sem dados de jogadores reais.
- **Diferente do lançamento:** sem "não é bet", sem arco de lançamento.
- **Gasto:** no máximo 2 gerações, sem regeração automática.

---

**Próximo passo:** respondes às pendências 1–6. Depois confirmo os preços sem gerar nada, fecho o orçamento, e só envio ao Higgsfield com a tua autorização explícita.
