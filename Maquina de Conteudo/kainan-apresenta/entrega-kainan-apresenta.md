# Kainan apresenta · entrega 1 (01/10/2026)

> Nada foi contratado nem gerado. Preços de ferramentas de terceiros: **verificar na data** antes de qualquer autorização.

**O que mudou na Máquina:**
- Novo módulo `conhecimento/12-formatos-kainan-apresenta.md` com os formatos A (lúdico narrado) e B (Kainan apresenta).
- O `validar` agora exige: formato e motivo; em cada cena, o que aparece (Kainan real/avatar ou referência), a função da referência, a origem do material, o que falta capturar e como a fala atravessa a troca. Também calcula **quantos segundos de avatar** precisam ser gerados.
- Agentes de estratégia, direção e revisão atualizados. Pasta `kainan-apresenta/` com perfil, plano do avatar, teste de voz e lista de materiais.

---

# 1. Fluxo de produção

## 1. Formatos prioritários
| Código | Formato | Quando recomendar |
|---|---|---|
| `ludico-narrado` | **A · Lúdico narrado.** A voz conduz; aparecem o Dôdo, cenas criativas, demonstrações do app, desenhos e efeitos. | explicar regras, números, mecânicas; conteúdo divertido, viral, sem rosto; multi-idioma rápido |
| `kainan-apresenta` | **B · Kainan apresenta.** O Kainan fala com o público; a imagem alterna entre ele e referências (telas reais do app, fotos permitidas, gráficos, Dôdo, cenas). | confiança, opinião, novidades e lançamentos, bastidores, convites, respostas a dúvidas da comunidade, anúncios |

- **Frente futura (não bloqueia A nem B):** "Luta real e impacto no app" (`luta-real`), provavelmente com editor humano.
- **Em cada pedido**, a Máquina recomenda o formato e explica a escolha em uma ou duas frases (campo `campanha.formato_producao` + `campanha.formato_motivo`).

## 2. Regras de "Kainan apresenta"
1. **A origem da imagem do Kainan é sempre declarada:** `kainan-real` (gravação verdadeira) ou `kainan-avatar` (gerado). Nunca se mistura sem dizer.
2. **A voz não para nas trocas de imagem.** A narração é um áudio contínuo; o Kainan pode sair da tela enquanto a fala segue sobre a referência.
3. **Para cada cena, o roteiro indica:**
   - quem aparece (Kainan ou referência) e o que a referência demonstra;
   - como a fala continua na troca de imagem;
   - quando o Kainan volta;
   - enquadramento, expressão e gesto pretendidos.
4. **As referências precisam ter função.** Priorizar **telas reais** do app e informações verificadas. Se o material não existe, listar o que capturar. **Nunca inventar telas, dados ou funcionalidades.**
5. **Fotos e vídeos de atletas reais continuam proibidos** (direito de imagem; 03-identidade).
6. **Gestos e expressões são intenções de direção.** Não prometer controle exato quando a ferramenta não o oferece.
7. **Áudio primeiro:** quando a voz é externa, o áudio é finalizado e aprovado **antes** de gerar o avatar, para a boca acompanhar o ritmo aprovado.
   - Se mudar o áudio depois, gerar de novo só o trecho de avatar afetado (com autorização) ou ajustar sem quebrar a sincronia.
8. **Gerar só os trechos de avatar que entram na montagem** (`audio_trecho` + `duracao_s` de cada cena `kainan-avatar`). Nunca gerar o Kainan falando o vídeo inteiro se parte dele fica coberta por referências.
   - Tecnicamente: gerar o avatar por trecho de áudio, ou um único take curto que cubra só esses trechos. Escolher o mais barato que mantenha a continuidade.
9. **Consistência de voz entre formatos:** a voz do Kainan no formato A e no formato B é a mesma voz aprovada (`voz/perfil-vocal.md`). Não alternar vozes perceptivelmente diferentes sem aprovação.
10. **Idiomas:** validar primeiro em PT-BR; só depois multiplicar (EN, ES, FR, DE), adaptando texto e tempo em cada idioma.

## 3. Fluxo de produção (formato B)
1. **Pedido** → formato recomendado + motivo.
2. **Roteiro completo** (12 itens, secção 4) → aprovação P1/P2 do roteiro e do gasto.
3. **Áudio:**
   - gravação real do Kainan, **ou** voz clonada aprovada;
   - edição sem respiros;
   - aprovação do áudio.
4. **Imagem do Kainan:**
   - `kainan-real`: o Kainan grava as falas das cenas em que aparece (podem ser cortes curtos);
   - `kainan-avatar`: gera-se o avatar **só para os trechos aprovados**, com o áudio aprovado.
5. **Referências:** captura de telas reais, cenas do estúdio animado (custo zero), Dôdo.
6. **Montagem pela Máquina:**
   - voz contínua;
   - cortes entre o Kainan e as referências;
   - legendas, efeitos e música;
   - entrega organizada por cena, com faixas separadas e o MP4 final.
7. **Revisão do Kainan (P3/P4)** → avaliações registradas no perfil (secção 6).

## 4. Entrega do roteiro (12 itens)
1. Objetivo, público, mensagem principal, ação esperada.
2. Formato recomendado e motivo.
3. Roteiro por cena com duração estimada.
4. Texto da fala e direção vocal por trecho (11-voz §4).
5. Em cada cena: Kainan em tela (real ou avatar) ou referência visual.
6. Expressão, gesto, enquadramento e transição.
7. Materiais necessários, origem de cada um e se já existem.
8. Narração completa num bloco limpo.
9. Música, legendas e efeitos.
10. Montagem (CapCut ou Máquina).
11. Consumo estimado por ferramenta, incluindo **segundos de avatar**.
12. Pontos que precisam de aprovação.

A duração é estimativa até validar o áudio. O `validar` confere os campos obrigatórios do formato B.


---

# 2. Plano mínimo do avatar


Nada é contratado nem gerado sem autorização. Os requisitos abaixo são os da **HeyGen** (help center, consultado em 01/10/2026). Confirmar de novo no dia da gravação.

## 1. Gravação de treino do avatar (Digital Twin)
| Item | Requisito HeyGen | Como fazemos |
|---|---|---|
| Duração | mínimo 2 min, ideal 5 min | **3 min** no piloto; 5 min se o piloto pedir |
| Continuidade | **um take só, sem cortes nem emendas** | errou? continua a falar naturalmente, sem cortar |
| Câmera | mín. 1080p 30 fps; ideal 4K 60 fps; aceita celular | celular na **vertical 9:16** (o nosso formato), câmera traseira, 4K se possível, tripé na altura dos olhos |
| Enquadramento | gestos dentro do quadro | **plano médio:** topo da cabeça a ~10 % da borda de cima, cintura no fundo; mãos visíveis quando gesticula |
| Iluminação | clara e uniforme, sem sombras duras | de frente para uma janela (luz do dia) ou ring light atrás do celular; nada de luz forte atrás de você |
| Fundo | simples e estático | parede lisa ou tecido escuro liso; sem pessoas nem TV ligada |
| Roupa | evitar logótipos grandes e texto | camiseta lisa escura (look 1). Judogi branco só como 2.º look, depois do piloto |
| Som | silêncio, a sua voz audível (a boca aprende com ela) | microfone de lapela se tiver; senão, quarto silencioso |
| Olhar | direto na lente | colar um adesivo ao lado da lente como lembrete |
| Comportamento | natural; expressões visíveis nas pausas; mãos sem cobrir o rosto | falar como num vídeo seu: explicar, sorrir, fazer pausas naturais **de boca fechada** e com expressão |
| Pausas | necessárias na gravação de referência | **aqui pode respirar e pausar**; a regra "sem respiros" vale só para o vídeo final |

**Roteiro da gravação de treino (3 min):**
1. Ler a Parte A do `voz/textos/teste-captacao-v1.md` (≈ 90 s).
2. Falar livremente sobre "como conheci o judô" (≈ 60 s).
3. Repetir as 6 frases da Parte B com os gestos da tabela do perfil (≈ 30 s).

O mesmo áudio serve para o teste de voz (conjunto A).

## 2. Vídeo de consentimento (obrigatório na HeyGen)
- **Mesma pessoa e mesmas condições** da gravação de treino.
- **Menos de 30 s**, lendo **exatamente** o texto que a HeyGen mostrar, incluindo o código.
- MP4, MOV ou WebM, entre 480p e 4K. Pode ser gravado pela webcam, pelo celular (QR code) ou enviado como arquivo.
- **Não** pode ser gravação de ecrã. Fale o código com clareza.

## 3. Piloto curto
1. Criar o Digital Twin.
   - O plano grátis da HeyGen dá 1 avatar, 3 vídeos/mês com máx. 1 min (marca d'água e uso comercial **a confirmar**).
   - Se o grátis não servir para avaliar, pedir autorização para **1 mês do Creator** (US$ 29, 600 créditos).
2. Gerar **só** o roteiro de 15 s em 3 versões (ver `teste-comparativo-voz.md`).
3. Avaliar com nota de 1 a 5:

| Critério | O que olhar | Mínimo |
|---|---|---|
| Rosto / identidade | parece o Kainan, sem "cara de cera" | 4 |
| Boca / sincronia | sílabas batendo, sem atraso | 4 |
| Olhar | natural, sem fixo robótico | 3 |
| Mãos / gestos | sem mãos deformadas | 3 |
| Voz | semelhança, naturalidade e pronúncia | 4 |
| Interpretação | energia e ênfase do roteiro | 3 |

4. Aprovado → **avatar v1** no `perfil.md`. Reprovado → nova gravação de treino (5 min, ajustes de luz/enquadramento) antes de gastar mais.

## 4. Depois do piloto
- Testar o 2.º look (judogi) e o plano próximo.
- Validar o formato em PT antes dos outros idiomas.

---

# 3. Teste comparativo de voz


**Texto (igual para todas as versões):**
- o roteiro de 15 s (`templates/exemplos/demo-ka-15s.plano.json`), com 35 palavras e ≈ 13 s;
- as 3 frases de avaliação do conjunto C (`voz/textos/teste-captacao-v1.md`), ≈ 15 s.

**Ordem obrigatória:** primeiro o áudio de cada versão é **aprovado**, depois gera-se o avatar com ele. Em V1 a HeyGen gera voz e boca juntas.

| Versão | Voz | Como entra no avatar | Para que serve |
|---|---|---|---|
| **V0 · referência** | gravação real do Kainan, editada sem respiros | carregar o áudio no avatar (upload de áudio **a confirmar** no plano) | padrão-ouro de sincronia e identidade; testa também o caminho "Kainan grava, avatar aparece" |
| **V1** | clone de voz **da HeyGen** (feito com o áudio da gravação de treino) | nativo | uma só ferramenta |
| **V2** | clone **ElevenLabs** (clone instantâneo com o conjunto A) | voz importada na HeyGen por chave de API da ElevenLabs (integração documentada) **ou** áudio exportado e carregado | qualidade de voz ElevenLabs + avatar HeyGen |

**Avaliação às cegas** (o Kainan não sabe qual é qual):
- semelhança com a voz real;
- naturalidade;
- interpretação (segue a direção?);
- pronúncia (ippon, waza-ari, shido, Judocoins);
- **sincronia da boca**;
- **custo por vídeo aprovado**, incluindo novas tentativas.

Registrar tudo em `voz/avaliacoes.csv`.

## Consumo estimado (verificar no dia — preços mudam)
| Ferramenta | O que | Estimativa | Fonte |
|---|---|---|---|
| HeyGen | 3 versões × ≈ 28 s de avatar (15 s + frases C) ≈ 1,4 min de Avatar IV | ≈ **28 créditos premium** (20 créditos/min) | artigo de 22/09/2026 sobre os preços da HeyGen (fonte secundária: confirmar na conta) |
| HeyGen — plano | Creator: US$ 29/mês, 600 créditos; o grátis pode bastar para o piloto (3 vídeos de até 1 min) | US$ 0–29 | heygen.com/pricing (01/10/2026) |
| ElevenLabs | clone instantâneo + ≈ 500 caracteres de fala | plano Starter (US$ 6/mês) cobre; confirmar se o Starter dá **chave de API** para a integração com a HeyGen | elevenlabs.io/pricing (01/10/2026) |
| Gravação do Kainan, edição e análise | — | custo zero | — |

**Decisão:** escolher **uma** combinação. Só manter HeyGen + ElevenLabs se V2 ganhar com folga em semelhança/naturalidade **e** o custo por vídeo aprovado compensar.

---

# 4A. Roteiro demonstrativo de 15 s

> Documento de planeamento. **Não autoriza nenhum gasto.**

| Campo | Valor |
|---|---|
| Formato | kainan-apresenta — convite direto do fundador gera confiança para quem ainda não joga; as telas reais provam que montar o time é simples |
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

### c01 · 00:0000–00:03.6 (3.6 s) · GANCHO — Kainan desafia
- **Origem:** HeyGen Digital Twin (piloto por fazer)
- **Em tela:** kainan-avatar
- **Material:** HeyGen Digital Twin (piloto por fazer) · ❌ FALTA — capturar: gravação de treino do avatar + consentimento (plano-avatar.md)
- **Kainan:** enquadramento plano próximo (peito para cima), olhar na lente · expressão sorriso de canto, desafio amigável · gesto mostra 8 com os dedos em 'oito vagas'
- **Fala na troca de imagem:** abre o áudio; a pergunta de T1 continua já sobre a tela do c02
- **Trechos de áudio:** T1
- **Cenário:** 
- **Personagens:** 
- **Ação:** 
- **Enquadramento:** plano próximo (peito para cima), olhar na lente
- **Câmara:** estática; zoom digital lento na montagem
- **Texto em ecrã:** "100 JUDOCOINS · 8 VAGAS" (Oswald dourado, topo)
- **Narração:** Você tem cem Judocoins e oito vagas.
- **Música:** entra com impacto no quadro 0
- **Efeitos sonoros:** ka-ching em 'cem Judocoins'
- **Transição de saída:** corte seco

### c02 · 00:03.6–00:0007 (3.4 s) · tela real: orçamento e vagas
- **Origem:** app /criar-equipa — ecrã com 100 JC e as 8 vagas vazias
- **Em tela:** tela-app — demonstra: que o time começa com 100 JC e 8 vagas (4 masculinas + 4 femininas)
- **Material:** app /criar-equipa — ecrã com 100 JC e as 8 vagas vazias · ❌ FALTA — capturar: gravação de ecrã do /criar-equipa com conta de teste, orçamento 100 JC visível, vagas vazias
- **Fala na troca de imagem:** a pergunta 'Quem entra no seu time?' e o início de T2 correm sobre a tela, sem parar
- **Trechos de áudio:** T1, T2
- **Cenário:** 
- **Personagens:** 
- **Ação:** 
- **Enquadramento:** tela cheia 9:16
- **Câmara:** estática; zoom digital lento na montagem
- **Texto em ecrã:** "4 HOMENS + 4 MULHERES" (legenda grande)
- **Narração:** Quem entra no seu time? Quatro homens, quatro mulheres
- **Música:** batida constante
- **Efeitos sonoros:** tic em cada vaga destacada
- **Transição de saída:** corte seco

### c03 · 00:0007–00:0010 (3 s) · tela real: capitão
- **Origem:** app /criar-equipa — tocar num atleta e torná-lo capitão
- **Em tela:** tela-app — demonstra: como escolher o capitão e que ele pontua em dobro
- **Material:** app /criar-equipa — tocar num atleta e torná-lo capitão · ❌ FALTA — capturar: gravação de ecrã do gesto de escolher capitão (mesma conta de teste)
- **Fala na troca de imagem:** T2 termina aqui; 'dobro' cai no momento em que a braçadeira aparece
- **Trechos de áudio:** T2
- **Cenário:** 
- **Personagens:** 
- **Ação:** 
- **Enquadramento:** tela cheia 9:16
- **Câmara:** estática; zoom digital lento na montagem
- **Texto em ecrã:** "CAPITÃO = PONTOS ×2" (Oswald dourado)
- **Narração:** e um capitão que pontua em dobro.
- **Música:** mini drop em 'dobro'
- **Efeitos sonoros:** whoosh, impacto em ×2
- **Transição de saída:** corte seco

### c04 · 00:0010–00:0015 (5 s) · CTA — Kainan convida
- **Origem:** HeyGen Digital Twin (piloto por fazer)
- **Em tela:** kainan-avatar
- **Material:** HeyGen Digital Twin (piloto por fazer) · ❌ FALTA — capturar: mesmo avatar do c01
- **Kainan:** enquadramento plano médio, olhar na lente · expressão sorriso aberto, caloroso · gesto aponta para a câmera em 'agora' e polegar em 'bio'
- **Fala na troca de imagem:** Kainan volta na palavra 'Escolhe'; nos 1,5 s finais entra por cima o botão 'MONTE SEU TIME · LINK NA BIO'
- **Trechos de áudio:** T3
- **Cenário:** 
- **Personagens:** 
- **Ação:** 
- **Enquadramento:** plano médio, olhar na lente
- **Câmara:** estática; zoom digital lento na montagem
- **Texto em ecrã:** "MONTE SEU TIME · LINK NA BIO" (botão dourado, terço inferior)
- **Narração:** Escolhe bem e monta o seu agora: o link tá na bio!
- **Música:** sobe e fecha com impacto
- **Efeitos sonoros:** botão pop, impacto final
- **Transição de saída:** corte seco

## Mapa musical

| De | Até | Faixa | Fonte / licença | Intensidade | Nota |
|---|---|---|---|---|---|
| 00:0000 | 00:0015 | Trap japonês / taiko hip hop, 95–105 BPM, instrumental | escolha do Kainan ou provisória da Máquina / uso comercial | média → alta no CTA | função: energia e convite; baixa sob a voz, sobe no final |

## Kainan em tela × referências

- Kainan em tela: **8.6 s** (avatar a gerar: **8.6 s**) · referências: **6.4 s**
- **Materiais em falta:**
  - c01: gravação de treino do avatar + consentimento (plano-avatar.md)
  - c02: gravação de ecrã do /criar-equipa com conta de teste, orçamento 100 JC visível, vagas vazias
  - c03: gravação de ecrã do gesto de escolher capitão (mesma conta de teste)
  - c04: mesmo avatar do c01

## Montagem

- Áudio aprovado primeiro; avatar gerado só para c01 e c04 (≈ 8 s) com esse áudio
- Voz contínua por baixo de todos os cortes (c01→c02→c03→c04)
- Legendas sempre ligadas (Manrope Bold, palavra-chave dourada); efeitos e música em faixas separadas
- Telas do app: gravação de ecrã real, recortada a 9:16, com zoom no elemento que a fala cita

## Consumo estimado das ferramentas pagas

| Ferramenta | O quê | Qtd. | Créditos estimados | Reserva de tentativas | Fonte do preço |
|---|---|---|---|---|---|
| Áudio | narração 35 palavras (gravação do Kainan = 0; clone ≈ 0,7 cr Higgsfield ou caracteres ElevenLabs) | 1 | 0–0,7 | 1 | 11-voz; confirmar na data |
| HeyGen Avatar IV | só c01 + c04 ≈ 8,6 s de avatar | 1 | ≈ 3 créditos premium (20/min) | 1 | fonte secundária 22/09/2026 — confirmar na conta |
| Captura de telas + montagem + som | c02, c03, legendas, efeitos, mistura | 1 | 0 | 0 | custo zero |

## Depende da aprovação do Kainan

- formato e motivo
- texto e direção vocal
- Kainan real ou avatar em c01/c04
- telas a capturar (conta de teste)
- gasto: áudio + ≈ 8,6 s de avatar + 1 tentativa

## Narração e direção vocal

- **Voz:** voz aprovada do Kainan (clone ou gravação) — consistente com o formato A · **Idioma:** PT-BR · **Velocidade de planeamento:** 2.7 palavras/s
- **Estimativa:** 35 palavras ≈ 13 s para 14.5 s disponíveis (estimativa — validar ouvindo)
- **Regra:** narração contínua, sem silêncios de respiro; a fala atravessa os cortes de cena.

| Trecho | Cenas | Texto exato | Intenção | Energia | Ritmo | Velocidade | Ênfase | Entonação | Duração | Edição |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | c01, c02 | "Você tem cem Judocoins e oito vagas. Quem entra no seu time?" | desafiar | alta: voz projetada e sorriso na voz, sem gritar | ágil e contínuo: emenda a pergunta sem parar | rápida (~2,8 palavras/s) | cem Judocoins, quem | firme em 'cem Judocoins'; sobe em 'Quem' e fecha 'time' em desafio amigável | ~4.3 s | começar no quadro 0, sem respiração antes; cortar a respiração entre 'vagas' e 'Quem' |
| T2 | c02, c03 | "Quatro homens, quatro mulheres e um capitão que pontua em dobro." | explicar | média-alta: clara, ritmo de lista | contínuo, acelera de leve na lista e trava em 'dobro' | rápida (~2,7 palavras/s) | Quatro homens, quatro mulheres, dobro | lista no mesmo nível; 'em dobro' sobe e bate como novidade | ~4.1 s | a fala atravessa o corte c02→c03 sem parar; 'dobro' em cima do ×2 na tela |
| T3 | c04 | "Escolhe bem e monta o seu agora: o link tá na bio!" | convidar | alta e calorosa: energia de final, sorriso aberto | crescente | confortável (~2,6 palavras/s) | agora, link | desce um pouco em 'Escolhe bem' (conselho) e sobe até 'bio' (convite) | ~4.2 s | emendar logo depois de 'dobro'; deixar 0,3 s de música no fim, depois da última palavra |

### Texto completo (copiar e colar — só a fala)

```
Você tem cem Judocoins e oito vagas. Quem entra no seu time? Quatro homens, quatro mulheres e um capitão que pontua em dobro. Escolhe bem e monta o seu agora: o link tá na bio!
```

## Factos usados (verificar com ippon-produto)

- Equipa de 8 atletas: 4 homens + 4 mulheres; 100 JC; capitão ×2 — fonte: 01-produto.md / lib/congelar.ts (IMPLEMENTADO · VERIFICADO)

---

# 4B. Roteiro demonstrativo de 30 s

> Documento de planeamento. **Não autoriza nenhum gasto.**

| Campo | Valor |
|---|---|
| Formato | kainan-apresenta — dúvida real da comunidade respondida pelo fundador; a tabela oficial do site e a tela do atleta tornam a regra verificável |
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

### c01 · 00:0000–00:04.3 (4.3 s) · GANCHO — Kainan pergunta
- **Origem:** HeyGen Digital Twin (piloto por fazer)
- **Em tela:** kainan-avatar
- **Material:** HeyGen Digital Twin (piloto por fazer) · ❌ FALTA — capturar: gravação de treino do avatar + consentimento
- **Kainan:** enquadramento plano próximo, olhar na lente · expressão espanto real, sobrancelhas levantadas · gesto mãos abertas, 'como assim?'
- **Fala na troca de imagem:** T1 inteiro em tela; termina a olhar para o lado onde a tabela vai entrar
- **Trechos de áudio:** T1
- **Cenário:** 
- **Personagens:** 
- **Ação:** 
- **Enquadramento:** plano próximo, olhar na lente
- **Câmara:** estática; zoom digital lento na montagem
- **Texto em ecrã:** "VENCEU… E PERDEU PONTOS?" (Oswald, vermelho em 'PERDEU')
- **Narração:** O seu atleta venceu a luta e mesmo assim te tirou pontos?
- **Música:** entra com impacto
- **Efeitos sonoros:** apito de fim de luta
- **Transição de saída:** corte seco

### c02 · 00:04.3–00:09.3 (5 s) · referência oficial: tabela de shidos
- **Origem:** ipponleague.com/como-jogar — tabela de pontuação e caixas de shido
- **Em tela:** site-publico — demonstra: que a regra é oficial e está publicada: shido sofrido −2, −3, −4
- **Material:** ipponleague.com/como-jogar — tabela de pontuação e caixas de shido · ❌ FALTA — capturar: gravação de ecrã de /como-jogar (página pública) com zoom na tabela
- **Fala na troca de imagem:** T2 corre sobre a tabela; zoom nas linhas de shido quando diz 'cada um custa mais'
- **Trechos de áudio:** T2
- **Cenário:** 
- **Personagens:** 
- **Ação:** 
- **Enquadramento:** tela cheia 9:16
- **Câmara:** estática; zoom digital lento na montagem
- **Texto em ecrã:** "REGRA OFICIAL" (etiqueta pequena)
- **Narração:** —
- **Música:** baixa e grave
- **Efeitos sonoros:** cartão a cair
- **Transição de saída:** corte seco

### c03 · 00:09.3–00:16.1 (6.8 s) · demonstração: escada de shidos
- **Origem:** estúdio animado (cartões −2, −3, −4, −9 e Dôdo), versão PT
- **Em tela:** cena-estudio — demonstra: o custo crescente até ao hansoku-make (−9)
- **Material:** estúdio animado (cartões −2, −3, −4, −9 e Dôdo), versão PT · ❌ FALTA — capturar: renderizar a cena c07 do como-pontuar em PT (custo zero)
- **Fala na troca de imagem:** T3 inteiro sobre a animação; cada número bate com um cartão
- **Trechos de áudio:** T3
- **Cenário:** 
- **Personagens:** 
- **Ação:** 
- **Enquadramento:** tela cheia 9:16
- **Câmara:** estática; zoom digital lento na montagem
- **Texto em ecrã:** "−2 · −3 · −4 = −9" (Oswald vermelho)
- **Narração:** —
- **Música:** tensão crescente
- **Efeitos sonoros:** impacto por cartão, grave no −9
- **Transição de saída:** corte seco

### c04 · 00:16.1–00:20.7 (4.6 s) · virada — Kainan alivia
- **Origem:** HeyGen Digital Twin (piloto por fazer)
- **Em tela:** kainan-avatar
- **Material:** HeyGen Digital Twin (piloto por fazer) · ❌ FALTA — capturar: mesmo avatar
- **Kainan:** enquadramento plano médio · expressão alívio, sorriso · gesto conta 1, 2, 3 com os dedos
- **Fala na troca de imagem:** Kainan volta em 'Mas'; a voz já vinha a subir desde o −9
- **Trechos de áudio:** T4
- **Cenário:** 
- **Personagens:** 
- **Ação:** 
- **Enquadramento:** plano médio
- **Câmara:** estática; zoom digital lento na montagem
- **Texto em ecrã:** "SHIDOS DO ADVERSÁRIO: +1 · +2 · +3" (Oswald verde)
- **Narração:** Mas quando é o adversário que leva, você ganha um, dois e três.
- **Música:** abre e sobe
- **Efeitos sonoros:** chime ascendente ×3
- **Transição de saída:** corte seco

### c05 · 00:20.7–00:23.9 (3.2 s) · tela real: atleta que ataca
- **Origem:** app — popup do atleta no ranking com as ações (ippons, waza-aris, shidos)
- **Em tela:** tela-app — demonstra: onde o jogador vê quem ataca e quem leva shidos antes de escolher
- **Material:** app — popup do atleta no ranking com as ações (ippons, waza-aris, shidos) · ❌ FALTA — capturar: gravação de ecrã do popup de ações de um atleta (dados reais do ranking; sem foto do atleta)
- **Fala na troca de imagem:** T5 sobre a tela; destaque nas ações ofensivas
- **Trechos de áudio:** T5
- **Cenário:** 
- **Personagens:** 
- **Ação:** 
- **Enquadramento:** tela cheia 9:16
- **Câmara:** estática; zoom digital lento na montagem
- **Texto em ecrã:** "ESCOLHA QUEM ATACA E LUTA LIMPO" (Oswald dourado)
- **Narração:** —
- **Música:** firme
- **Efeitos sonoros:** check
- **Transição de saída:** corte seco

### c06 · 00:23.9–00:0030 (6.1 s) · CTA — Kainan convida
- **Origem:** HeyGen Digital Twin (piloto por fazer)
- **Em tela:** kainan-avatar
- **Material:** HeyGen Digital Twin (piloto por fazer) · ❌ FALTA — capturar: mesmo avatar
- **Kainan:** enquadramento plano médio · expressão sorriso aberto · gesto aponta para a câmera, depois polegar
- **Fala na troca de imagem:** Kainan volta em 'Monta'; botão por cima nos 2 s finais
- **Trechos de áudio:** T6
- **Cenário:** 
- **Personagens:** 
- **Ação:** 
- **Enquadramento:** plano médio
- **Câmara:** estática; zoom digital lento na montagem
- **Texto em ecrã:** "MONTE SEU TIME · LINK NA BIO" (botão dourado)
- **Narração:** Monta o seu time agora, o link tá na bio!
- **Música:** sobe e fecha com impacto
- **Efeitos sonoros:** botão pop, impacto final
- **Transição de saída:** corte seco

## Mapa musical

| De | Até | Faixa | Fonte / licença | Intensidade | Nota |
|---|---|---|---|---|---|
| 00:0000 | 00:0030 | Trap japonês / taiko hip hop, 95–105 BPM, instrumental | escolha do Kainan ou provisória da Máquina / uso comercial | tensa → aberta → alta | função: tensão (c02–c03), virada (c04), energia no CTA |

## Kainan em tela × referências

- Kainan em tela: **15 s** (avatar a gerar: **15 s**) · referências: **15 s**
- **Materiais em falta:**
  - c01: gravação de treino do avatar + consentimento
  - c02: gravação de ecrã de /como-jogar (página pública) com zoom na tabela
  - c03: renderizar a cena c07 do como-pontuar em PT (custo zero)
  - c04: mesmo avatar
  - c05: gravação de ecrã do popup de ações de um atleta (dados reais do ranking; sem foto do atleta)
  - c06: mesmo avatar

## Montagem

- Áudio aprovado primeiro; avatar só para c01, c04 e c06 (≈ 13 s)
- A voz atravessa todos os cortes; o Kainan olha para o lado da referência no fim de c01 ('olha isto')
- Cartões de shido (c03) do estúdio animado (custo zero), já em PT
- Efeitos e música em faixas separadas; legendas sempre ligadas

## Consumo estimado das ferramentas pagas

| Ferramenta | O quê | Qtd. | Créditos estimados | Reserva de tentativas | Fonte do preço |
|---|---|---|---|---|---|
| Áudio | narração 74 palavras (gravação = 0; clone ≈ 1,5 cr Higgsfield ou caracteres ElevenLabs) | 1 | 0–1,5 | 1 | 11-voz; confirmar na data |
| HeyGen Avatar IV | só c01 + c04 + c06 ≈ 15 s de avatar | 1 | ≈ 5 créditos premium (20/min) | 1 | fonte secundária 22/09/2026 — confirmar na conta |
| Captura de telas + estúdio + montagem + som | c02, c03, c05, legendas, efeitos, mistura | 1 | 0 | 0 | custo zero |

## Depende da aprovação do Kainan

- formato e motivo
- texto e direção vocal
- Kainan real ou avatar em c01/c04/c06
- telas a capturar
- gasto: áudio + ≈ 15 s de avatar + 1 tentativa

## Narração e direção vocal

- **Voz:** voz aprovada do Kainan (clone ou gravação) — consistente com o formato A · **Idioma:** PT-BR · **Velocidade de planeamento:** 2.7 palavras/s
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

# 5. Materiais


## Já temos (prontos ou reutilizáveis sem custo)
| Material | Onde | Serve para |
|---|---|---|
| Dôdo 2D: 5 expressões × judogi branco/azul × 7 faixas (PNG/SVG) | `assets/dodo/2d/` | cenas, reações, referências lúdicas |
| Dôdo 3D: 4 imagens e 2 clipes Kling (medalha e joinha), 5 s cada | `assets/dodo/3d/` · Higgsfield (projeto Máquina) | gancho e CTA lúdicos |
| Logótipo, símbolo e fontes (Oswald, Manrope) | `assets/marca/` | todas as peças |
| Estúdio de cenas animadas (motor + 9 cenas do como-pontuar em EN) | `estudio/`, `campanhas/como-pontuar/animadas/` | referências animadas; versão PT = rerender, custo zero |
| Gerador de efeitos sonoros (24 efeitos), batida taiko-trap, mistura com ducking | `estudio/` | som de todas as peças |
| Carrossel "como pontuar" (EN e PT) e prompt de marca | `campanhas/como-pontuar/`, `para-social-media/` | consistência |
| Código do app (telas e regras reais) | repositório `main` | saber **que telas existem** e validar números |
| Narrações Archie EN e PT do como-pontuar | Higgsfield | referência de ritmo (não são a voz da marca) |

## Falta (por ordem de necessidade)
| # | Material | Quem | Como |
|---|---|---|---|
| 1 | **Gravação de teste de voz** (≈ 4 min) | Kainan | `voz/textos/teste-captacao-v1.md` |
| 2 | **Gravação de treino do avatar** (3 min, um take, 9:16) + **vídeo de consentimento** | Kainan | `kainan-apresenta/plano-avatar.md` |
| 3 | **Conta de teste no app** com time vazio (100 JC) | Kainan | sem dados pessoais reais na tela |
| 4 | **Gravações de ecrã do app**: `/criar-equipa` (orçamento + vagas), escolha do capitão, popup de ações de um atleta, `/mercado` (preços) | Kainan (celular) ou a Máquina pelo navegador, se a conta de teste o permitir | vertical, sem notificações, modo escuro |
| 5 | **Gravação de ecrã do site** `ipponleague.com/como-jogar` (tabela) | a Máquina (página pública) | pode ser feita já, sem custo |
| 6 | Fotos do Kainan / bastidores (opcional) | Kainan | só se fizer sentido na peça |
| 7 | Decisões: o Dôdo usa a voz do Kainan ou voz própria? 2.º look (judogi)? | Kainan | — |

Não usar: fotos ou vídeos de atletas reais, transmissões IJF/JudoBase, nomes de utilizadores do app sem consentimento.

---

## Perfil inicial


Legenda: ✅ confirmado · 🧪 a validar no piloto · ❓ falta informação ou decisão

| Item | Estado | Valor |
|---|---|---|
| Avatar aprovado | ❓ | nenhum (piloto por fazer) |
| Ferramenta de avatar | 🧪 | HeyGen (Digital Twin / Avatar IV), 1.ª candidata |
| Voz aprovada | ❓ | a mesma de `voz/perfil-vocal.md` (consistência entre formatos) |
| Origem da imagem por peça | ✅ regra | declarar sempre `kainan-real` ou `kainan-avatar` |
| Enquadramentos-base | 🧪 | **PM** plano médio (cintura para cima, gestos dentro do quadro) · **PP** plano próximo (peito para cima, para frases de impacto) |
| Olhar | 🧪 | direto na lente; desvio só intencional ("olha isto" para o lado da referência) |
| Aparência / looks | ❓ | look 1: camiseta lisa escura, sem logótipos grandes; look 2 (opcional): judogi branco, para identidade de judô |
| Fundo | 🧪 | parede lisa ou fundo escuro da marca (`#0C0E0D`), sem objetos que distraiam |
| Expressões de referência | 🧪 | desafio amigável (sorriso de canto), explicação (sobrancelhas neutras, mãos abertas), surpresa (olhos abertos, leve recuo), alerta (sério, dedo levantado), convite (sorriso aberto, aponta para a câmera) |
| Gestos de referência | 🧪 | contar pelos dedos; apontar para o lado onde vai entrar a referência; mão aberta para a câmera (pare/atenção); polegar no CTA |
| Pronúncias | ✅ | ver `voz/perfil-vocal.md` §3 |
| Gestos e expressões no avatar | 🧪 | **intenção de direção**: o controle exato depende da ferramenta |

## Configurações testadas
| Data | Ferramenta | Avatar/look | Voz | Resultado |
|---|---|---|---|---|

## Problemas e correções
| Data | Peça | Trecho | Problema | Correção | Regra aprovada |
|---|---|---|---|---|---|

## Exemplos aprovados
Nenhum ainda.

## Fontes consultadas (01/10/2026)
- [HeyGen — Criar o Digital Twin com Avatar IV](https://help.heygen.com/en/articles/12089286-create-your-first-digital-twin-video-avatar-with-avatar-iv)
- [HeyGen — Vídeo de consentimento](https://help.heygen.com/en/articles/12092609-recording-your-consent-video)
- [HeyGen — Preços](https://www.heygen.com/pricing)
- [HeyGen — Integrar ElevenLabs e outras vozes](https://help.heygen.com/en/articles/8310663-how-to-integrate-elevenlabs-other-third-party-voices)
- [Arcade — HeyGen pricing 2026 (créditos por minuto do Avatar IV; fonte secundária)](https://www.arcade.software/post/heygen-pricing)
- [ElevenLabs — Preços](https://elevenlabs.io/pricing)
