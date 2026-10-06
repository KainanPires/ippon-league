# Proposta · "Montei o time. E agora?" — pontos, preço e Judocoins

Campanha `montei-e-agora` · versão 1 · 30/09/2026 · PT-BR
**Estado: PROPOSTA para avaliação. Nada foi gerado. Só fiz consultas gratuitas ao Higgsfield (vozes, modelos e preços). Saldo: 740 créditos.**

Decisões tuas já aplicadas: português do Brasil (entendi "Brasil" — confirma) · voz do Dôdo jovem, feminina mas não adulta · geração pelo Cowork · Dôdo 3D pago · cenas da app feitas por mim, sem precisar de gravações tuas.

---

## 1. Objetivo e entendimento da dúvida

**A dor.** Quem acabou de montar o time pergunta "e agora?". A maioria escolheu os favoritos de cada categoria achando que isso garante pontos. Não sabe que:
1. o que conta são as **ações nas lutas**, não o favoritismo;
2. o **preço do atleta é uma meta de pontos**: se ele fizer menos pontos do que custa, **desvaloriza**;
3. quando desvaloriza, **o dono perde Judocoins** — e é com esse património que monta o time da **próxima rodada**.

**A ideia central do vídeo: "você joga dois placares".** Pontos → ranking. Judocoins → o time que você consegue montar a seguir. O favorito pode ajudar no primeiro e prejudicar no segundo.

**Objetivo de negócio:** menos frustração depois da primeira rodada, mais retenção (quem entende o património volta para reescalar). Métricas: conclusão, partilhas, comentários com dúvidas.

**Melhorias que proponho:**
- **Não demonizar o favorito.** Mostro também um favorito que valoriza (18 → 21). A lição não é "evite favoritos", é "pergunte quem faz mais pontos do que custa" — mais correto e mais útil.
- **Mostrar a assimetria** (ganha metade, perde a queda inteira). É a regra que mais surpreende e a que mais explica a perda de Judocoins.
- **O capitão dobra os pontos, não os Judocoins.** Uma confusão provável que cabe numa frase.
- **Este vídeo sai antes do educativo de pontuação.** Responde à dúvida de agora; o de pontuação vira o "episódio 1" para quem quiser o detalhe das ações.
- **Duração ~80 s.** Com menos, cai a assimetria ou o exemplo do favorito que valoriza — e são essas as partes que evitam o erro.

### Regras usadas (verificadas no código)
| Regra | Fonte | Estado |
|---|---|---|
| D = pontos − preço; novo preço = preço + 50% de D; piso 2 JC | `lib/engine.ts` | implementado · verificado |
| Dono ganha metade da valorização e perde a desvalorização inteira | `lib/congelar.ts` | implementado |
| Orçamento para montar = património atual (+ JC comprados) | `app/api/orcamento` | implementado |
| Capitão ×2 nos pontos; a variação de património não dobra | `lib/congelar.ts` | implementado |
| Pontos no início acompanham-se ao vivo; na rodada seguinte reescala-se | guia da app | implementado |

### Exemplos (calculados com o motor real)
| Atleta (fictício) | Preço | Pontos | Novo preço | Dono |
|---|---|---|---|---|
| Favorito (ippon +10, depois perdeu por waza-ari −2) | 18 | 8 | **13** ▼ | **−5 JC** |
| Aposta | 6 | 16 | **11** ▲ | **+2,5 JC** |
| Favorito que cumpre | 18 | 24 | **21** ▲ | **+1,5 JC** |

---

## 2. Conceito e descrição corrida

**Conceito: "Dois placares".**

Abre com um time inteiro de favoritos, cartas douradas a brilhar — e por baixo o contador de Judocoins a descer. "Montou o time só com favoritos? Cuidado."
O Dôdo 3D cruza os braços, pensa e aponta para a câmara: "E agora? Aqui você joga dois placares." O ecrã divide-se: pontos levam ao ranking; Judocoins decidem o próximo time.
Uma carta de atleta mostra a regra: o preço é uma linha-meta; a barra de pontos passa a linha (valoriza) ou fica abaixo (desvaloriza).
Primeiro exemplo: um favorito de 18 JC faz um ippon e perde a luta seguinte — 8 pontos, longe da meta. O preço cai para 13 e o património do dono marca −5. Segundo: uma aposta de 6 faz 16 — sobe para 11, dono +2,5.
Uma balança pende para o lado vermelho: "Quando sobe, você fica com metade. Quando cai, perde a queda inteira."
Para ser justo: o favorito que faz 24 sobe para 21. E o capitão? Dobra os pontos — não os Judocoins.
Fecha com o Dôdo 3D a tocar na têmpora e a fazer positivo: "Não pergunte só quem vai ganhar. Pergunte quem vai fazer mais pontos do que custa."

---

## 3. Roteiro cena por cena (80 s · 9:16 · 1080×1920 · 30 fps)

Estilo em todas as cenas: fundo `#0c0e0d` com textura diagonal, brilho verde no topo e partículas douradas; Oswald (títulos) + Manrope (texto); creme `#f1ede2`, dourado `#d9a441`, verde `#7fd1a3`, vermelho `#e2655a`; cartas no estilo da app (`#141a17`, borda `#243029`); atletas fictícios, de costas, sem nome nem rosto.
**Voz:** toda a narração é do Dôdo (voz gerada). **Música:** trilha instrumental (ver secção 3.1).

| # | Tempo | Dôdo (posição · expressão · ação) | Cenário e composição | Enquadramento · câmara | Textos visíveis | Narração exata (pausas · intenção) | Música | SFX · VFX | Transição | Produção e ficheiros |
|---|---|---|---|---|---|---|---|---|---|---|
| **01** | 0:00–0:06 | não aparece | grelha de 8 cartas de atletas com selo dourado FAVORITO; contador "SEUS JUDOCOINS" 100 → 91 a vermelho | plano geral · fixa, micro-zoom no contador aos 4 s | MONTOU SÓ COM FAVORITOS? / PODE **CUSTAR** JUDOCOINS. | «Montou o time só com favoritos? [0,3 s] Cuidado: isso pode te custar Judocoins.» — alerta amigável | entra: pulso grave + pluck tenso, baixa | whoosh de cartas; tick descendente · tremor no contador | corte seco | estúdio de cenas (eu) |
| **02** | 0:06–0:12 | **3D**, plano médio centrado · pensativo → confiante · cruza os braços, pensa, aponta para a câmara | estúdio escuro, tatame verde-escuro, luz de recorte dourada | plano médio · push-in lento | E AGORA? | «Montou… e agora? [0,3 s] Aqui você joga dois placares.» — curiosidade | tema entra (~95 BPM), média-baixa | "plim" no gesto · partículas | congela 1 s, ecrã divide-se | **Higgsfield G1** (5 s) a partir de `dodo3d_0.5.jpg` |
| **03** | 0:12–0:20 | **2D sábio** ao centro, em baixo | ecrã dividido: PONTOS (pódio → RANKING) · JUDOCOINS (moeda → PRÓXIMO TIME) | plano fixo | PONTOS → RANKING · JUDOCOINS → PRÓXIMO TIME | «Os pontos te fazem subir no ranking. [0,2 s] Os Judocoins decidem o time que você consegue montar na próxima rodada.» — clareza | tema, média | tic por coluna · divisória dourada | coluna JUDOCOINS expande | estúdio + `dodo_sabio_faixa-preta` |
| **04** | 0:20–0:29 | **2D indicando**, à esquerda da carta | carta "PREÇO 18 JC" com linha-meta dourada; barra de pontos passa a linha (verde ▲) e depois fica abaixo (vermelho ▼) | close na carta · fixa | O PREÇO É A META · PONTOS > PREÇO = ▲ VALORIZA · PONTOS < PREÇO = ▼ DESVALORIZA | «E o preço de cada atleta é uma meta de pontos. [0,2 s] Fez mais pontos do que custa? Valoriza. Fez menos? Desvaloriza.» — didática | tema, média | enchimento ascendente; buzz curto · brilho na meta | a carta vira | estúdio + `dodo_indicando_faixa-preta` |
| **05** | 0:29–0:40 | não aparece | carta FAVORITO · 18 JC; Luta 1 ippon +10 · Luta 2 sofreu waza-ari −2 → 8 PONTOS; preço 18 → 13 ▼; "SEU PATRIMÔNIO −5 JC" (ver quadro de exemplo) | close → plano do contador · push-in no −5 | O FAVORITO CAIU / E VOCÊ PAGOU · 18 → 13 JC · −5 JC | «Olha este favorito: custava dezoito. [0,2 s] Venceu por ippon e perdeu a seguinte por waza-ari: oito pontos. [0,3 s] Caiu para treze… e você perdeu cinco Judocoins.» — tensão | tema desce (tensão) | pop por ação; queda grave · flash vermelho | deslize lateral | estúdio (`estudio/c05_quadro-final.png` é o quadro final) |
| **06** | 0:40–0:48 | não aparece | carta APOSTA · 6 JC; 16 PONTOS acima da meta; 6 → 11 ▲; "SEU PATRIMÔNIO +2,5 JC" | close · fixa | APOSTA · 6 JC · FEZ 16 PONTOS · 6 → 11 JC · +2,5 JC | «Agora uma aposta de seis que fez dezesseis pontos. [0,2 s] Subiu para onze, e você ganhou dois e meio.» — alívio | tema sobe, média-alta | registo suave · partículas verdes | cartas lado a lado | estúdio |
| **07** | 0:48–0:56 | **2D sábio**, ao lado da balança | balança: prato verde "SUBIU +5 → VOCÊ +2,5" leve; prato vermelho "CAIU −5 → VOCÊ −5" pesado | plano fixo | SUBIU? VOCÊ FICA COM METADE. · CAIU? VOCÊ PERDE A QUEDA INTEIRA. | «Percebeu? [0,3 s] Quando o atleta sobe, você fica com metade. Quando ele cai, você perde a queda inteira.» — revelação | corte de 0,3 s em "Percebeu?" | clonk da balança | corte | estúdio + `dodo_sabio` |
| **08** | 0:56–1:05 | não aparece | carta FAVORITO · 18 JC com 24 PONTOS acima da meta; 18 → 21 ▲; +1,5 JC | close · fixa | FAVORITO TAMBÉM VALORIZA · SE FIZER MAIS DO QUE CUSTA · 18 → 21 JC | «O favorito também valoriza, se fizer mais do que custa: [0,2 s] dezoito que faz vinte e quatro vai para vinte e um.» — equilíbrio | tema, média-alta | enchimento ascendente | carta ganha moldura de capitão | estúdio |
| **09** | 1:05–1:10 | não aparece | moldura dourada de capitão: PONTOS ×2 (brilha) · JUDOCOINS ×2 riscado | close · punch-in | CAPITÃO: PONTOS ×2 · JUDOCOINS ×1 | «E o capitão dobra os pontos… [0,3 s] não os Judocoins.» — piscadela | tema, alta | clack da moldura · risco vermelho | fundido | estúdio |
| **10** | 1:10–1:20 | **3D**, plano médio · esperto e confiante · toca na têmpora e faz positivo; últimos 5 s: ecrã final | estúdio escuro, raios dourados → ecrã final com logótipo e botão | plano médio → ecrã final · fixa, leve subida | NÃO PERGUNTE SÓ QUEM VAI GANHAR. / PERGUNTE QUEM FAZ **MAIS DO QUE CUSTA**. / MONTE SEU TIME · LINK NA BIO | «Então não pergunte só quem vai ganhar. [0,2 s] Pergunte quem vai fazer mais pontos do que custa. Monte seu time na Ippon League.» — conselho de sensei | resolve no acorde final | ding no botão · raios de luz | fim | **Higgsfield G2** (5 s) + ecrã final (estúdio + `assets/marca/`) |

### 3.1 Música (escolha minha)
O Higgsfield não gera música. Proposta: **só trilha instrumental** (sem canção), da biblioteca do CapCut com uso comercial permitido — procurar por *"sport hip hop"* ou *"trap beat light"*, **90–100 BPM**, com um "drop" claro. Estrutura: tensão baixa no gancho (0–6 s) → tema médio na explicação → **desce** na perda do favorito (c05) → sobe com a aposta (c06) → **silêncio de 0,3 s** em "Percebeu?" → pico no capitão → acorde final no botão. A voz fica sempre por cima (música a −18 dB sob a narração). Os SFX (tic, pop, whoosh, ding) vêm da biblioteca de efeitos do CapCut.

---

## 4. Texto corrido (voz do Dôdo)

> Montou o time só com favoritos? Cuidado: isso pode te custar Judocoins.
> Montou… e agora? Aqui você joga dois placares.
> Os pontos te fazem subir no ranking. Os Judocoins decidem o time que você consegue montar na próxima rodada.
> E o preço de cada atleta é uma meta de pontos. Fez mais pontos do que custa? Valoriza. Fez menos? Desvaloriza.
> Olha este favorito: custava dezoito. Venceu por ippon e perdeu a seguinte por waza-ari: oito pontos. Caiu para treze… e você perdeu cinco Judocoins.
> Agora uma aposta de seis que fez dezesseis pontos. Subiu para onze, e você ganhou dois e meio.
> Percebeu? Quando o atleta sobe, você fica com metade. Quando ele cai, você perde a queda inteira.
> O favorito também valoriza, se fizer mais do que custa: dezoito que faz vinte e quatro vai para vinte e um.
> E o capitão dobra os pontos… não os Judocoins.
> Então não pergunte só quem vai ganhar. Pergunte quem vai fazer mais pontos do que custa. Monte seu time na Ippon League.

(171 palavras · ~70 s de fala + pausas. Versão por cena: `entrega-capcut/v1/narracao/`.)

---

## 5. Carrossel (Instagram, 7 páginas, 1080×1350)

| Pág. | Título | Conteúdo |
|---|---|---|
| 1 | MONTOU SÓ COM **FAVORITOS?** | Grelha de cartas douradas; "Isso pode te custar Judocoins →" |
| 2 | VOCÊ JOGA **DOIS PLACARES** | Pontos → ranking · Judocoins → próximo time. Dôdo sábio. |
| 3 | O PREÇO É **A META** | Barra com linha-meta: acima ▲ valoriza · abaixo ▼ desvaloriza. |
| 4 | O FAVORITO CAIU. **VOCÊ PAGOU.** | Quadro do exemplo: 18 JC → 8 pontos → 13 JC · −5 JC. |
| 5 | SOBE METADE. **CAI INTEIRO.** | Aposta 6 → 11 (+2,5) vs favorito 18 → 13 (−5). |
| 6 | CAPITÃO: **PONTOS ×2** | "Os Judocoins não dobram." + favorito que cumpre 18 → 21. |
| 7 | QUEM FAZ **MAIS DO QUE CUSTA?** | Dôdo 3D (quadro da G2) + botão "MONTE SEU TIME · LINK NA BIO" · "Guarde este post". |

Produção: eu gero as 7 páginas no estúdio de cenas (custo zero); a página 7 usa um quadro do clipe G2.

---

## 6. O que é Higgsfield e o que é reutilizado

| Componente | Origem | Custo |
|---|---|---|
| C02 Dôdo 3D "e agora?" | **Higgsfield G1** — `kling3_0`, 5 s, 9:16, modo pro, sem som, imagem inicial `dodo3d_0.5.jpg` | pago |
| C10 Dôdo 3D positivo | **Higgsfield G2** — idem | pago |
| Voz do Dôdo | **Higgsfield** `seed_audio` — teste + narração final | pago |
| C01, C03–C09, ecrã final, carrossel | **estúdio de cenas** (eu renderizo em HTML → vídeo/PNG no estilo da app, dados fictícios) | zero |
| Dôdo 2D (sábio, indicando) | `assets/dodo/2d/` | zero |
| Logótipo | `assets/marca/` | zero |
| Música e SFX | biblioteca do CapCut (uso comercial) | zero (confirmar licença) |

**Sobre o teu ponto 6:** criei o primeiro quadro no **estúdio de cenas** (anexo `estudio/c05_quadro-final.png`). A partir de agora eu produzo as cenas "de app" com dados fictícios, sem precisares de gravar. São recriações fiéis ao visual da app, não gravações da app real.

---

## 7. Orçamento (preços confirmados no Higgsfield via Cowork, `get_cost`, 30/09/2026)

| Etapa | Operação | Qtd | Créditos/unid. | Subtotal |
|---|---|---|---|---|
| **A · teste de voz** | 1 frase curta em PT-BR com 3 vozes candidatas (`seed_audio`) | 3 | 0,8 | **2,4** |
| **B · produção** | Narração completa (1 take, ~171 palavras) na voz escolhida | 1 | ~5,5 (estimado: 140 palavras = 4,5) | **≤ 6** |
| B | **G1** C02 · `kling3_0` pro, 5 s, 9:16, sem som | 1 | 8,75 | **8,75** |
| B | **G2** C10 · idem | 1 | 8,75 | **8,75** |
| — | Carregar a imagem de referência no Higgsfield | 1 | 0 (upload) | 0 |
| — | Regerações automáticas | 0 | — | nenhuma |
| | | | **Total máximo** | **25,9** |

- O preço dos clipes foi consultado **sem** a imagem inicial; antes de gerar volto a consultar com a imagem. Se subir, paro e peço-te de novo.
- A narração será reconsultada com o texto final antes de gerar.

**Teto solicitado: 26 créditos**, em duas autorizações:
- **Etapa A:** até **2,4 créditos** (3 amostras de voz). Tu ouves e escolhes.
- **Etapa B:** até **23,5 créditos** (narração + G1 + G2), só depois de escolheres a voz.

Saldo depois do máximo: ~714 de 740.

---

## 8. Pendências e critérios de revisão

### Pendências
1. **Idioma:** respondeste "Brasil de Portugal" — assumi **português do Brasil**. Confirma.
2. **Voz — ouve antes (grátis):** candidatas que parecem jovens nas amostras do Higgsfield (em inglês): *Pixie*, *Skye*, *Juno*, *Quinn*, *Kaia*. Diz-me 3 para o teste pago em PT-BR, ou deixa que eu escolha.
3. **Música:** escolhes a faixa na biblioteca do CapCut com o filtro de uso comercial, seguindo 3.1.
4. **Autorização:** Etapa A (2,4 cr) e depois Etapa B (23,5 cr).
5. **`utm_medium`** do link (C12).

### Critérios de revisão
- **Factos:** números batem com o motor (recalculados); nenhuma promessa de ganhos; o favorito não é apresentado como "mau".
- **Compreensão:** quem vê responde "porque perdi Judocoins?" e "o que é a meta de um atleta?".
- **Dôdo 3D:** ornitorrinco fiel (bico largo laranja, cabeça verde-azulada, judogi branco, faixa preta); rejeitar deformações — sem nova tentativa automática.
- **Voz:** jovem, clara em PT-BR, sem sotaque estrangeiro forte; se nenhuma das 3 servir, paramos e propomos outra via (ex.: gravares tu e usar mudança de voz).
- **Marca e direitos:** cores e fontes oficiais; atletas fictícios; música com licença; sem dados de jogadores reais.
- **Gasto:** no máximo 5 gerações (3 amostras + narração + 2 clipes), dentro do teto autorizado.

**Próximo passo:** confirma o idioma, diz-me as vozes (ou "escolhe tu") e, se concordares, escreve: *"Autorizo a Etapa A, até 2,4 créditos."*
