# Módulo de voz · entrega 1 (01/10/2026)

> Nada pago foi gerado nesta tarefa. Tudo o que está marcado 🧪 é hipótese a validar.

**O que mudou na Máquina:** módulo permanente `conhecimento/11-voz-e-narracao.md`; pasta `voz/` (perfil vocal, avaliações, textos, plano de clone); agentes de roteiro, direção e revisão atualizados; o `validar` agora **bloqueia** narração com reticências, "[pausa]" ou "respirar", falta de direção vocal, bloco contínuo diferente dos trechos e texto que não cabe no tempo.

---

# 1. Perfil vocal inicial (Kainan e Dôdo)


Legenda: ✅ confirmado · 🧪 hipótese a validar no teste · ❓ falta informação

## 1. Voz da marca — Kainan (fundador)
| Item | Valor | Estado |
|---|---|---|
| Papel | narrador principal da Ippon League; fala com o fã de judô de igual para igual | ✅ (pedido do Kainan) |
| Idioma nativo | português do Brasil | 🧪 (escrita das mensagens; confirmar sotaque/região a manter) |
| Personalidade na voz | confiante, próximo, desafiador amigável, didático quando explica, entusiasmo verdadeiro no judô | 🧪 |
| Registo | conversa direta para a câmara ("você"), nunca locutor de rádio, nunca gritado | 🧪 |
| Velocidade alvo em vídeos curtos (PT) | 2,6–2,9 palavras/s, sem silêncios | 🧪 medir no teste |
| Velocidade de referência medida | Archie (ElevenLabs) EN e PT: ~2,1 palavras/s **com** pausas | ✅ medido 30/09 |
| Faixa de energia | baixa (segredo/alerta) · média (explicação) · alta (gancho, revelação, CTA) | 🧪 |
| Voz sintética aprovada | nenhuma ainda | ✅ |
| Ferramenta de clone | candidatas: Higgsfield `create_voice`, ElevenLabs, Fish Audio | 🧪 piloto |

## 2. Voz do Dôdo (personagem)
| Item | Valor | Estado |
|---|---|---|
| Papel | sensei do jogador: caloroso, brincalhão, confiante | ✅ (04-dodo.md) |
| Base | **mesma identidade vocal do Kainan** com direção de personagem: mais leve, sorriso na voz, frases curtas, mais reação ("Olha isso!", "Opa!") | 🧪 decidir no piloto |
| Alternativa | voz própria distinta do Kainan (para não confundir fundador e mascote) | ❓ decisão do Kainan |
| Até haver decisão | EN: Archie (aprovado nas peças de 30/09) | ✅ |

## 3. Pronúncia (todas as línguas)
| Termo | Como soa | Nota |
|---|---|---|
| ippon | "ip-pon", p dobrado | nunca "eye-pon" |
| waza-ari | "wa-za a-ri", 4 sílabas | nunca "waza-airy" |
| yuko | "yu-ko" | |
| shido | "shi-do" | nunca "shy-doh" |
| hansoku-make | "han-so-ku ma-ke" | "make" não é o inglês |
| judô / judoka | PT "ju-DÔ"; EN "JOO-doh" | |
| Judocoins | "judô-coins" (produto) | 🧪 confirmar com o Kainan |
| Ippon League | "Ip-pon Lig" (inglês em "League") | 🧪 confirmar |

## 4. Velocidades por idioma (para planear; recalibrar com áudio real)
| Idioma | palavras/s alvo (dinâmico, sem pausas) | Expansão típica vs PT | Estado |
|---|---|---|---|
| PT-BR | 2,6–2,9 | — | 🧪 |
| EN | 2,6–3,0 | ~10–15 % menos palavras | 🧪 |
| ES | 2,8–3,2 | parecido ao PT | 🧪 |
| FR | 2,7–3,0 | +10–15 % | 🧪 |
| DE | 2,2–2,5 | palavras longas: reescrever mais curto | 🧪 |

## 5. Configurações testadas
| Data | Ferramenta | Voz | Parâmetros | Resultado |
|---|---|---|---|---|
| 30/09 | Higgsfield → ElevenLabs | Archie | texto com reticências e maiúsculas | entoação boa; pausas longas demais |
| 30/09 | Higgsfield → Seed Audio | Archie | speech_rate 0 | lenta (1,7 palavras/s) |

## 6. Exemplos aprovados
Nenhum com a voz do Kainan ainda.

## Histórico
- v0.1 · 01/10/2026 · criado a partir das peças de 30/09 e do módulo 11.

---

# 2. Teste curto de gravação


Objetivo: medir a qualidade da captação e alimentar um **piloto** de clonagem. Ainda não é a sessão longa.

## Antes de gravar
- **Lugar:** quarto pequeno com coisas macias (cama, cortinas, roupas). Evite cozinha, banheiro e sala vazia, que fazem eco.
- **Silêncio:** janelas fechadas, ventilador/ar desligados, celular em modo avião.
- **Aparelho:** o celular serve.
  - iPhone: app *Gravador*, com "Qualidade do áudio: Sem perdas".
  - Android: gravador de voz na qualidade mais alta.
  - Microfone USB/lapela: melhor ainda.
- **Distância:** dois punhos (≈ 15–20 cm) da boca, um pouco de lado para o "p" e o "b" não estourarem. Mantenha **sempre a mesma distância**.
- **Sem efeitos:** nada de redução de ruído, música ou filtros.
- **Respiração:** respire à vontade. Nesta gravação **pode respirar normalmente**; quem tira os respiros é a edição, depois.
- **Errou?** Repita a frase inteira e siga. Eu corto depois.
- **Nomes dos arquivos:**
  - `voz_0_sala`
  - `voz_A_base`
  - `voz_A_espontaneo`
  - `voz_B_interpretacao`
  - `voz_C_avaliacao`
  - `voz_EN_opcional`
- **Onde salvar:** `Maquina de Conteudo\voz\teste-v1\`

---

## Parte 0 · Sala (15 s) → `voz_0_sala`
Fique **10 segundos em silêncio** com o gravador ligado, depois diga, no seu tom normal:
"Teste de som da Ippon League, um, dois, três."
*(Serve para eu medir o ruído do ambiente.)*

## Parte A · Base de clonagem (≈ 90 s) → `voz_A_base`
**Como ler:** energia **média**, o seu jeito natural de explicar algo a um amigo, olhando para a câmera. Ritmo confortável, **igual do começo ao fim**. Não interprete, não grite, não sussurre. Constância é o que importa aqui.

> O judô é um esporte de respeito, mas também é um esporte de decisão. Em poucos segundos, um atleta pode mudar uma luta inteira com um ippon. Foi pensando nisso que eu criei a Ippon League, um jogo para quem acompanha as competições e quer viver cada luta de um jeito diferente.
>
> Funciona assim: você escolhe oito atletas, quatro homens e quatro mulheres, e tem cem Judocoins para montar o seu time. Cada ação na luta vale pontos. Quem ataca, pontua. Quem leva shido, perde. E o seu capitão pontua em dobro.
>
> Cada competição do calendário vira uma rodada. Grand Slam, Mundial, Continental. Você monta o time antes de o mercado fechar e acompanha os pontos entrando ao vivo. Dá para disputar com amigos, com fãs do seu país e com o mundo inteiro.
>
> No fim, o que vale é conhecer o judô de verdade. Saber quem está em boa fase, quem luta limpo e quem costuma ir longe na chave. É isso que faz a diferença na hora de escolher.

## Parte A2 · Fala espontânea (≈ 45 s) → `voz_A_espontaneo`
**Sem texto.** Responda como se estivesse conversando, sem pressa:
"Como você conheceu o judô e por que decidiu criar a Ippon League?"
*(Mostra o seu ritmo real e o seu sotaque, que um texto lido esconde.)*

## Parte B · Biblioteca de interpretação (6 frases) → `voz_B_interpretacao`
Diga o número antes de cada frase ("um", "dois"…). Siga a direção; o texto é o que está entre aspas.

| # | Intenção | Como fazer | Texto |
|---|---|---|---|
| 1 | **Desafio amigável** | Energia alta, sorriso na voz, sem gritar. Sobe a entonação em "quem" e termina em desafio. Emende as duas frases. | "Você tem cem Judocoins. Quem entra no seu time?" |
| 2 | **Explicação didática** | Energia média, ritmo constante. Destaque "dez" e "cinco" e desça a voz em "menos cinco". | "Ippon vale mais dez. Se o seu atleta sofre, são menos cinco." |
| 3 | **Surpresa** | Começa médio e cresce até "quarenta e oito", com espanto real. | "O mesmo atleta fez cinco pontos no ouro e quarenta e oito no bronze." |
| 4 | **Entusiasmo** | Energia alta e rápida, como gol na final; a última palavra explode. | "Waza-ari, yuko e ippon na mesma luta: dezesseis pontos!" |
| 5 | **Reflexão / alerta** | Energia baixa, voz mais grave e próxima, quase um conselho em segredo. Destaque "cada um". | "Cuidado com os shidos. Cada um custa mais que o anterior." |
| 6 | **Convite** | Energia média para alta, calorosa, termina para cima. | "Ainda não montou seu time? O link está na bio." |

## Parte C · Avaliação (3 frases, NÃO entram no treino) → `voz_C_avaliacao`
Leia com o seu jeito natural, energia média. Depois eu gero **as mesmas frases** com o clone e comparamos.
1. "Na repescagem ainda dá para somar muitos pontos, e isso muda o seu ranking."
2. "Escolher bem o capitão pode valer mais do que trocar o time inteiro."
3. "Hansoku-make acontece no terceiro shido, e aí a luta acaba na hora."

## Parte EN · opcional (≈ 30 s) → `voz_EN_opcional`
Se se sentir à vontade, leia em inglês, no seu ritmo, sem tentar mudar o sotaque:
> "Ippon League is the fantasy game for judo fans. Pick eight athletes, choose your captain and score points with every ippon, waza-ari and yuko. Build your team now, the link is in the bio."

---
**Depois de gravar:** me avise. Eu meço volume, ruído, eco e velocidade (sem custo) e devolvo um relatório antes de qualquer clonagem paga.

---

# 3. Plano de construção e avaliação do clone


Nada nesta lista gera custo sem autorização explícita do Kainan, etapa por etapa.

## Etapa 0 · Teste de captação (custo zero)
1. O Kainan grava `textos/teste-captacao-v1.md` (≈ 4 min de áudio).
2. A Máquina analisa e entrega um relatório:
   - **volume:** alvo −23 a −18 dB RMS, pico verdadeiro ≤ −3 dB;
   - **ruído de fundo:** alvo abaixo de −60 dB;
   - **eco, cortes e estouros;**
   - **velocidade real** (palavras/s) em cada intenção, que atualiza o `perfil-vocal.md`.
3. Se a qualidade não chegar ao mínimo, ajustar o lugar ou o microfone e repetir. Ainda sem custo.

## Etapa 1 · Piloto de clonagem (pago, pequeno — pedir autorização com valores do dia)
**Material de treino:** só o conjunto **A** (`voz_A_base` + `voz_A_espontaneo`, ≈ 2 min).
- É a faixa recomendada pela ElevenLabs para clone instantâneo: 1–2 min, máximo de ~3 min.
- A Fish Audio pede no mínimo 10 s por trecho e recomenda 1–2 min.

| Candidata | Como entra | Custo a confirmar no dia |
|---|---|---|
| **Higgsfield `create_voice`** (já integrado) | clone a partir do áudio dentro do Higgsfield; testar com o motor ElevenLabs (`voice_type: element`) | créditos Higgsfield |
| **ElevenLabs** (Instant Voice Cloning) | conta própria; plano Starter ou superior | assinatura mensal |
| **Fish Audio** | conta própria; o plano grátis não permite uso comercial | assinatura se aprovado |

**Gerações do piloto, iguais em cada ferramenta:**
- as 3 frases do conjunto **C**;
- 2 frases do conjunto **B** (desafio e alerta);
- o roteiro de 15 s em PT;
- 1 frase em cada idioma: EN, ES, FR, DE.

## Etapa 2 · Avaliação às cegas
- O Kainan ouve os pares sem saber qual ferramenta gerou cada um (A/B/C) e compara com a gravação real do conjunto **C**.
- **Nota de 1 a 5 por critério:**

| Critério | Peso |
|---|---|
| Semelhança com a voz real | 30 % |
| Naturalidade (soa humano, sem robô) | 20 % |
| Controle de interpretação (responde à direção escrita) | 15 % |
| Pronúncia: termos de judô e cada idioma | 15 % |
| Custo por conteúdo aprovado (incluindo novas tentativas) | 10 % |
| Integração com o fluxo (geração, download, montagem automática) | 10 % |

- **Aprovação:** média ≥ 4 e semelhança ≥ 4. Os resultados ficam em `avaliacoes.csv`, e o vencedor vira a **voz v1** no `perfil-vocal.md`.

## Etapa 3 · Sessão longa (só se o piloto pedir)
- **Quando:** a semelhança ficou abaixo de 4 e a ferramenta vencedora oferece clone profissional.
- **ElevenLabs Professional Voice Cloning:** mínimo de 30 min de áudio, ideal 2–3 h, e verificação de que a voz é do próprio dono; disponível do plano Creator para cima.
- A Máquina escreve os textos originais da sessão, divididos em blocos de 10 min com o **mesmo estilo** do conjunto A.

## Etapa 4 · Idiomas
- Para cada idioma, gerar o roteiro de 15 s e medir a duração real contra a estimativa.
- Avaliar pronúncia e identidade e registrar em `avaliacoes.csv`.
- Idioma reprovado: usar o caminho 2 (gravação do Kainan em PT + dublagem) ou reescrever o texto mais curto.

## Etapa 5 · Produção e lapidação
- Toda peça registra voz, versão do perfil e parâmetros.
- Cada correção do Kainan entra em `avaliacoes.csv`. Quando se repete, vira regra no perfil (nova versão).
- Se a voz piorar num tipo de fala, rever o conjunto A ou fazer a sessão longa, com autorização.

## Riscos e cuidados
- Clonar **só a voz do Kainan**, com o consentimento dele. As ferramentas exigem verificação.
- Áudios da voz fora do repositório público.
- Os preços e planos mudam: confirmar na data de contratação.

---

# 4. Modelo de roteiro atualizado

O modelo `templates/plano.modelo.json` ganhou:
- `campanha.dor`, `ideia_central`, `acao_esperada`, `montagem`;
- `audio.narracao`: `continua`, `voz`, `idioma`, `caminho` (gravação / clone / dublagem), `velocidade_alvo_wps`, `tempo_disponivel_s`, `trechos[]` com **texto · intenção · energia · ritmo · velocidade · ênfase · entonação · duração · edição**, `texto_completo` (bloco único para copiar) e `pausa_excecao` (só com duração e justificativa);
- `orcamento_ferramentas` (créditos estimados + reserva de tentativas + fonte do preço) e `pontos_aprovacao`.

O roteiro gerado traz as 9 partes da entrega: objetivo/público/dor/ideia, cenas, direção vocal por trecho, bloco contínuo, durações, música e efeitos, montagem, consumo e pontos de aprovação. Os dois exemplos abaixo foram gerados com este modelo.

---

# 5A. Exemplo de 15 segundos

> Documento de planeamento. **Não autoriza nenhum gasto.**

| Campo | Valor |
|---|---|
| Objetivo | Fazer quem não joga entender em 15 s como se monta o time e clicar no link |
| Público | fãs de judô que ainda não jogam |
| Dor / dúvida | "Como funciona? Parece complicado." |
| Ideia central | Montar o time é simples: 100 JC, 4 + 4 atletas e um capitão que vale o dobro |
| Ação esperada | clicar no link da bio e montar o time |
| Promessa | — |
| Hipótese | — |
| Formato / redes | Reels, TikTok, Shorts |
| Duração total | 15 s |
| Idioma | PT-BR |
| CTA | Monte seu time — link na bio |
| Link UTM | — |

## Cenas

### c01 · 00:0000–00:0004 (4 s) · GANCHO
- **Origem:** motion (estúdio animado, custo zero)
- **Cenário:** moeda JC gira e mostra '100 JC'; 8 vagas vazias em grelha 4×2; Dôdo 2D a apontar
- **Personagens:** Dôdo 2D: 'Quem entra' → indicando, desafio
- **Ação:** contador 0→100 JC; as 8 vagas piscam
- **Enquadramento:** fixo 9:16
- **Câmara:** zoom lento contínuo
- **Texto em ecrã:** "100 JUDOCOINS" (Oswald dourado gigante) · "8 VAGAS. QUEM ENTRA?" (Oswald creme)
- **Narração:** Você tem cem Judocoins e oito vagas. Quem entra no seu time?
- **Música:** entra com impacto no quadro 0
- **Efeitos sonoros:** moeda 'ka-ching' em 100, tic nas vagas
- **Transição de saída:** corte seco

### c02 · 00:0004–00:0007 (3 s) · 4 + 4
- **Origem:** motion (estúdio animado, custo zero)
- **Cenário:** vagas preenchem-se: 4 silhuetas azuis (M) e 4 rosa-dourado (F)
- **Personagens:** —
- **Ação:** silhuetas entram uma a uma no ritmo da fala
- **Enquadramento:** fixo 9:16
- **Câmara:** zoom lento contínuo
- **Texto em ecrã:** "4 HOMENS + 4 MULHERES" (Oswald creme)
- **Narração:** Quatro homens, quatro mulheres
- **Música:** batida constante
- **Efeitos sonoros:** pop por silhueta
- **Transição de saída:** corte seco

### c03 · 00:0007–00:0010 (3 s) · capitão
- **Origem:** motion (estúdio animado, custo zero)
- **Cenário:** braçadeira C dourada pousa numa vaga; '×2' bate
- **Personagens:** Dôdo 2D comemorando em 'dobro'
- **Ação:** C pousa; ×2 com impacto
- **Enquadramento:** fixo 9:16
- **Câmara:** zoom lento contínuo
- **Texto em ecrã:** "CAPITÃO = PONTOS ×2" (Oswald dourado)
- **Narração:** e um capitão que pontua em dobro.
- **Música:** mini drop em 'dobro'
- **Efeitos sonoros:** whoosh, impacto em ×2
- **Transição de saída:** corte seco

### c04 · 00:0010–00:0015 (5 s) · CTA
- **Origem:** motion (estúdio animado, custo zero)
- **Cenário:** ecrã final: logótipo + botão dourado 'MONTE SEU TIME → LINK NA BIO'
- **Personagens:** Dôdo 2D: 'agora' → aponta para a câmara; 'bio' → polegar
- **Ação:** botão pulsa
- **Enquadramento:** fixo 9:16
- **Câmara:** zoom lento contínuo
- **Texto em ecrã:** "MONTE SEU TIME" (botão dourado) · "LINK NA BIO" (Oswald)
- **Narração:** Escolhe bem e monta o seu agora: o link tá na bio!
- **Música:** sobe e fecha com impacto
- **Efeitos sonoros:** botão pop, impacto final
- **Transição de saída:** corte seco

## Mapa musical

| De | Até | Faixa | Fonte / licença | Intensidade | Nota |
|---|---|---|---|---|---|
| 00:0000 | 00:0015 | Trap japonês / taiko hip hop, 95–105 BPM, instrumental | escolha do Kainan ou provisória da Máquina / uso comercial | média → alta no CTA | função: energia e convite; baixa sob a voz, sobe no final |

## Montagem

- Montagem pela Máquina (estúdio animado + voz + efeitos + música provisória); entrega em faixas separadas e MP4 final
- Voz: silêncios internos ≤120 ms; música −20 dB debaixo da voz, sobe 0,3 s no fim
- Se for o Kainan a gravar: um take por trecho, sem cortes dentro do trecho

## Consumo estimado das ferramentas pagas

| Ferramenta | O quê | Qtd. | Créditos estimados | Reserva de tentativas | Fonte do preço |
|---|---|---|---|---|---|
| Gravação do Kainan | narração PT | 1 | 0 | 0 | — |
| Higgsfield → ElevenLabs (clone, quando aprovado) | narração PT (35 palavras) | 1 | ≈0,7 (estimado por palavra; confirmar com get_cost) | 1 | médias medidas a 30/09 (~0,02 cr/palavra) |
| Estúdio animado + efeitos + mistura | cenas e som | 4 | 0 | 0 | custo zero |

## Depende da aprovação do Kainan

- texto e direção vocal dos 3 trechos
- voz: gravação do Kainan ou clone
- gasto (se clone): 1 geração + 1 tentativa de reserva

## Narração e direção vocal

- **Voz:** Kainan (gravação) ou clone aprovado · **Idioma:** PT-BR · **Velocidade de planeamento:** 2.7 palavras/s
- **Estimativa:** 35 palavras ≈ 13 s para 14.5 s disponíveis (estimativa — validar ouvindo)
- **Regra:** narração contínua, sem silêncios de respiro; a fala atravessa os cortes de cena.

| Trecho | Cenas | Texto exato | Intenção | Energia | Ritmo | Velocidade | Ênfase | Entonação | Duração | Edição |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | c01 | "Você tem cem Judocoins e oito vagas. Quem entra no seu time?" | desafiar | alta: voz projetada e sorriso na voz, sem gritar | ágil e contínuo: emenda a pergunta sem parar | rápida (~2,8 palavras/s) | cem Judocoins, quem | firme em 'cem Judocoins'; sobe em 'Quem' e fecha 'time' em desafio amigável | ~4.3 s | começar no quadro 0, sem respiração antes; cortar a respiração entre 'vagas' e 'Quem' |
| T2 | c02, c03 | "Quatro homens, quatro mulheres e um capitão que pontua em dobro." | explicar | média-alta: clara, ritmo de lista | contínuo, acelera de leve na lista e trava em 'dobro' | rápida (~2,7 palavras/s) | Quatro homens, quatro mulheres, dobro | lista no mesmo nível; 'em dobro' sobe e bate como novidade | ~4.1 s | a fala atravessa o corte c02→c03 sem parar; 'dobro' em cima do ×2 na tela |
| T3 | c04 | "Escolhe bem e monta o seu agora: o link tá na bio!" | convidar | alta e calorosa: energia de final, sorriso aberto | crescente | confortável (~2,6 palavras/s) | agora, link | desce um pouco em 'Escolhe bem' (conselho) e sobe até 'bio' (convite) | ~4.2 s | emendar logo depois de 'dobro'; deixar 0,3 s de música no fim, depois da última palavra |

### Texto completo (copiar e colar — só a fala)

```
Você tem cem Judocoins e oito vagas. Quem entra no seu time? Quatro homens, quatro mulheres e um capitão que pontua em dobro. Escolhe bem e monta o seu agora: o link tá na bio!
```

## Factos usados (verificar com ippon-produto)

- Equipa de 8 atletas: 4 homens + 4 mulheres; 100 JC; capitão ×2 — fonte: 01-produto.md / lib/congelar.ts (IMPLEMENTADO · VERIFICADO)

---

# 5B. Exemplo de 30 segundos

> Documento de planeamento. **Não autoriza nenhum gasto.**

| Campo | Valor |
|---|---|
| Objetivo | Explicar que os shidos acumulam e custam cada vez mais, e levar a montar o time |
| Público | jogadores e fãs que escolhem atletas só por vencer |
| Dor / dúvida | "O meu atleta ganhou, porque é que pontuou mal?" |
| Ideia central | Shido acumula: −2, −3, −4 (−9 no hansoku-make); os do adversário dão +1, +2, +3 |
| Ação esperada | montar o time a pensar em quem luta limpo |
| Promessa | — |
| Hipótese | — |
| Formato / redes | Reels, TikTok, Shorts |
| Duração total | 30 s |
| Idioma | PT-BR |
| CTA | Monte seu time — link na bio |
| Link UTM | — |

## Cenas

### c01 · 00:0000–00:0004 (4 s) · GANCHO
- **Origem:** motion (estúdio animado, custo zero)
- **Cenário:** placar de luta: 'VENCEU ✓' a verde e, por baixo, '−1 PT' a vermelho com tremor (EXEMPLO)
- **Personagens:** Dôdo 2D: 'tirou pontos?' → careta/surpresa
- **Ação:** o −1 bate no ecrã
- **Enquadramento:** fixo 9:16
- **Câmara:** zoom lento contínuo
- **Texto em ecrã:** "VENCEU…" (Oswald verde) · "E PERDEU PONTOS?" (Oswald vermelho)
- **Narração:** O seu atleta venceu a luta e mesmo assim te tirou pontos?
- **Música:** entra com impacto
- **Efeitos sonoros:** apito de fim de luta, glitch no −1
- **Transição de saída:** corte seco

### c02 · 00:0004–00:0009 (5 s) · o motivo
- **Origem:** motion (estúdio animado, custo zero)
- **Cenário:** cartão amarelo SHIDO gigante; legenda 'CADA UM CUSTA MAIS'
- **Personagens:** Dôdo 2D sábio, dedo levantado
- **Ação:** cartão cai e assenta
- **Enquadramento:** fixo 9:16
- **Câmara:** zoom lento contínuo
- **Texto em ecrã:** "CULPA DOS SHIDOS" (Oswald amarelo) · "CADA UM CUSTA MAIS" (Oswald creme)
- **Narração:** Culpa dos shidos: na Ippon League, cada um custa mais que o anterior.
- **Música:** baixa e grave
- **Efeitos sonoros:** apito de árbitro, cartão a cair
- **Transição de saída:** corte seco

### c03 · 00:0009–00:0016 (7 s) · a escada de shidos
- **Origem:** motion (estúdio animado, custo zero)
- **Cenário:** 3 cartões amarelos −2, −3, −4 + cartão vermelho TOTAL −9
- **Personagens:** Dôdo 2D: 'menos nove' → triste, mãos na cabeça
- **Ação:** cada cartão cai mais pesado; tela treme no −9
- **Enquadramento:** fixo 9:16
- **Câmara:** zoom lento contínuo
- **Texto em ecrã:** "−2 · −3 · −4" (Oswald vermelho) · "HANSOKU-MAKE = −9" (cartão vermelho)
- **Narração:** O primeiro tira dois, o segundo tira três, o terceiro tira quatro, e aí é hansoku-make: menos nove.
- **Música:** tensão crescente; quase para no −9
- **Efeitos sonoros:** impacto crescente por cartão, grave forte no −9
- **Transição de saída:** corte seco

### c04 · 00:0016–00:0021 (5 s) · virada
- **Origem:** motion (estúdio animado, custo zero)
- **Cenário:** espelho a verde: +1, +2, +3 = +6
- **Personagens:** Dôdo 2D comemorando
- **Ação:** cartões verdes sobem
- **Enquadramento:** fixo 9:16
- **Câmara:** zoom lento contínuo
- **Texto em ecrã:** "SHIDOS DO ADVERSÁRIO: +1 · +2 · +3" (Oswald verde)
- **Narração:** Mas quando é o adversário que leva, você ganha um, dois e três.
- **Música:** abre e sobe
- **Efeitos sonoros:** chime ascendente ×3
- **Transição de saída:** corte seco

### c05 · 00:0021–00:0025 (4 s) · conselho
- **Origem:** motion (estúdio animado, custo zero)
- **Cenário:** checklist: ATACA ✓ · LUTA LIMPO ✓
- **Personagens:** Dôdo 2D sábio
- **Ação:** ✓ entram com a fala
- **Enquadramento:** fixo 9:16
- **Câmara:** zoom lento contínuo
- **Texto em ecrã:** "ESCOLHA QUEM ATACA E LUTA LIMPO" (Oswald dourado)
- **Narração:** Então escolhe atleta que ataca e luta limpo.
- **Música:** firme, média
- **Efeitos sonoros:** check ×2
- **Transição de saída:** corte seco

### c06 · 00:0025–00:0030 (5 s) · CTA
- **Origem:** motion (estúdio animado, custo zero)
- **Cenário:** ecrã final com botão
- **Personagens:** Dôdo 2D: aponta → polegar
- **Ação:** botão pulsa
- **Enquadramento:** fixo 9:16
- **Câmara:** zoom lento contínuo
- **Texto em ecrã:** "MONTE SEU TIME" (botão dourado) · "LINK NA BIO" (Oswald)
- **Narração:** Monta o seu time agora, o link tá na bio!
- **Música:** sobe e fecha com impacto
- **Efeitos sonoros:** botão pop, impacto final
- **Transição de saída:** corte seco

## Mapa musical

| De | Até | Faixa | Fonte / licença | Intensidade | Nota |
|---|---|---|---|---|---|
| 00:0000 | 00:0030 | Trap japonês / taiko hip hop, 95–105 BPM, instrumental | escolha do Kainan ou provisória da Máquina / uso comercial | tensa → aberta → alta | função: tensão (c02–c03), virada (c04), energia no CTA |

## Montagem

- Montagem pela Máquina; entrega em faixas separadas (voz, música, efeitos) e MP4 final
- A fala atravessa os cortes c03→c04 e c05→c06
- Música: baixa e grave em c02–c03, abre em c04 (virada), sobe no CTA

## Consumo estimado das ferramentas pagas

| Ferramenta | O quê | Qtd. | Créditos estimados | Reserva de tentativas | Fonte do preço |
|---|---|---|---|---|---|
| Gravação do Kainan | narração PT | 1 | 0 | 0 | — |
| Higgsfield → ElevenLabs (clone, quando aprovado) | narração PT (74 palavras) | 1 | ≈1,5 (estimado; confirmar com get_cost) | 1 | médias medidas a 30/09 (~0,02 cr/palavra) |
| Estúdio animado + efeitos + mistura | cenas e som | 6 | 0 | 0 | custo zero |

## Depende da aprovação do Kainan

- texto e direção vocal dos 6 trechos
- voz: gravação do Kainan ou clone
- gasto (se clone): 1 geração + 1 tentativa de reserva

## Narração e direção vocal

- **Voz:** Kainan (gravação) ou clone aprovado · **Idioma:** PT-BR · **Velocidade de planeamento:** 2.7 palavras/s
- **Estimativa:** 74 palavras ≈ 27.4 s para 29.5 s disponíveis (estimativa — validar ouvindo)
- **Regra:** narração contínua, sem silêncios de respiro; a fala atravessa os cortes de cena.

| Trecho | Cenas | Texto exato | Intenção | Energia | Ritmo | Velocidade | Ênfase | Entonação | Duração | Edição |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | c01 | "O seu atleta venceu a luta e mesmo assim te tirou pontos?" | surpreender | alta: espanto real, voz projetada | ágil | rápida (~2,8 palavras/s) | venceu, tirou pontos | sobe em 'venceu', cai incrédula em 'tirou pontos?' | ~4.3 s | começa no quadro 0; nada de respiração antes |
| T2 | c02 | "Culpa dos shidos: na Ippon League, cada um custa mais que o anterior." | explicar | média: tom de quem revela o motivo | contínuo | confortável (~2,6 palavras/s) | shidos, cada um, mais | 'Culpa dos shidos' em tom de revelação; 'cada um custa mais' devagar e firme | ~5 s | emendar direto na resposta, sem silêncio depois da pergunta |
| T3 | c03 | "O primeiro tira dois, o segundo tira três, o terceiro tira quatro, e aí é hansoku-make: menos nove." | alertar | média → alta: cada número mais pesado | crescente | rápida (~2,8 palavras/s) | dois, três, quatro, menos nove | cada número um degrau mais grave; 'menos nove' é o ponto mais pesado do vídeo | ~6.8 s | números colados aos cartões de shido; sem silêncio entre os números |
| T4 | c04 | "Mas quando é o adversário que leva, você ganha um, dois e três." | virada/alívio | média → alta: a voz volta a sorrir | crescente | rápida (~2,8 palavras/s) | adversário, ganha | 'Mas' muda o clima; 'um, dois e três' a subir | ~4.6 s | emendar logo a seguir a 'menos nove' (a música faz a virada) |
| T5 | c05 | "Então escolhe atleta que ataca e luta limpo." | aconselhar | média: sensei calmo e firme | contínuo | confortável (~2,5 palavras/s) | ataca, limpo | descendente e segura, como conselho | ~3.2 s | sem respiração antes de 'Então' |
| T6 | c06 | "Monta o seu time agora, o link tá na bio!" | convidar | alta e calorosa | crescente | confortável (~2,6 palavras/s) | agora, bio | sobe até 'bio' e termina para cima | ~3.4 s | deixar 0,4 s de música depois da última palavra |

### Texto completo (copiar e colar — só a fala)

```
O seu atleta venceu a luta e mesmo assim te tirou pontos? Culpa dos shidos: na Ippon League, cada um custa mais que o anterior. O primeiro tira dois, o segundo tira três, o terceiro tira quatro, e aí é hansoku-make: menos nove. Mas quando é o adversário que leva, você ganha um, dois e três. Então escolhe atleta que ataca e luta limpo. Monta o seu time agora, o link tá na bio!
```

## Factos usados (verificar com ippon-produto)

- Shido sofrido −2/−3/−4 (3 = −9, hansoku-make); provocado +1/+2/+3 — fonte: lib/ijf.ts scoreContestSide; lib/engine.ts (IMPLEMENTADO · VERIFICADO)
- Vencer por waza-ari com 2 shidos sofridos dá −1 — fonte: exemplos (validar) (VERIFICADO)

---

## Fontes consultadas (01/10/2026)
- [ElevenLabs — Professional Voice Cloning](https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/professional-voice-cloning)
- [ElevenLabs — Instant Voice Cloning](https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning)
- [ElevenLabs — Preços](https://elevenlabs.io/pricing)
- [Fish Audio — Planos](https://fish.audio/plan)
- [Fish Audio — Criar modelos de voz](https://docs.fish.audio/developer-guide/core-features/creating-models)
