# 11 · Identidade vocal, direção de narração e produção de áudio (módulo permanente)

Aprovado pelo Kainan em 01/10/2026. Complementa `04-dodo.md`, `05-diretrizes-referencias.md` e `08-aprendizados.md`; não substitui as regras de gasto (`CLAUDE.md`).
Perfil vocal versionado: `marketing/voz/perfil-vocal.md` · avaliações: `marketing/voz/avaliacoes.csv`.

## 1. Objetivo
- Construir uma voz **reconhecível, natural e consistente**, baseada no timbre e na maneira de falar do **Kainan**.
- Usar essa voz nos conteúdos da Ippon League e, com a direção própria da personagem, nas falas do Dôdo.
- Idiomas: **PT-BR, EN, ES, FR, DE**. Cada idioma é avaliado separadamente em naturalidade, pronúncia, identidade e duração.
- Nunca presumir que a tradução dura o mesmo que o original.
- **Nunca trocar a voz aprovada por uma voz genérica sem autorização.** Enquanto não houver voz aprovada, vale a decisão de cada peça (EN: Archie; PT: Kainan grava).

## 2. Narração contínua (regra obrigatória dos conteúdos curtos)
- Não escrever "respirar", "pausa longa", "aguardar" nem silêncios entre frases.
- **Não usar reticências** (`…` ou `...`) para criar suspense ou alongar a fala.
- Não deixar intervalos vazios na narração nem entre os áudios das cenas.
- Manter entonação, articulação e mudanças de intenção. Destacar com **ênfase, variação de velocidade e energia**.
- Só ficam as transições mínimas para a fala continuar compreensível.
- "Sem respiros" vale para o **áudio final**:
  - o Kainan pode respirar ao gravar; a edição retira os respiros e silêncios sem cortar palavras;
  - alvo técnico: silêncios internos de no máximo **~120 ms** e respirações audíveis removidas;
  - margem de 20–40 ms antes e depois de cada palavra.
- **Exceção:** pausa dramática só com campo `pausa_excecao` no plano, com `duracao_s` e `justificativa`, aprovada no roteiro.
- O `validar` bloqueia narrações com reticências, `[pausa…]` ou "respir" quando o plano tem `audio.narracao.continua = true`.

## 3. Escrever para o tempo disponível
Antes de escrever, definir:
- duração total do vídeo;
- tempo de narração (descontando o gancho visual sem fala e o final, se existirem);
- mensagem principal, objetivo e ação esperada do espectador.

Como escrever:
- Frases curtas, vocabulário simples, uma ideia por trecho.
- Se não couber, **cortar ou reformular antes de acelerar**.
- Planejar por contagem de palavras e velocidade do perfil vocal (`perfil-vocal.md` → velocidades). A duração é **estimativa** até ouvir o áudio; nunca afirmar que cabe "exatamente" em 15 ou 30 s.
- Cada idioma tem a sua redação, ajustada ao tempo e preservando o sentido e a intenção.

## 4. Direção vocal obrigatória em cada roteiro
Para **cada trecho narrado**, o roteiro traz:

| Campo | Exemplo |
|---|---|
| Texto exato | "Você tem cem Judocoins. Quem entra no seu time?" |
| Intenção | desafiar |
| Energia | alta: voz projetada, sorriso na voz, sem gritar |
| Ritmo | contínuo, emenda direto na pergunta |
| Velocidade | rápida (~2,8 palavras/s) |
| Ênfase | "cem Judocoins", "quem" |
| Entonação | sobe em "quem", termina em desafio amigável |
| Duração estimada | ~3,5 s |
| Edição | sem silêncio entre as duas frases; cortar a respiração antes de "Quem" |

- Nunca só "falar com emoção" ou "ser dinâmico": explicar **como**.
- **Texto falado e instruções sempre separados.** Rótulos, comandos e observações não vão para o texto de geração.
- Marcações dentro do texto enviado à ferramenta (tags de emoção, SSML) **só com suporte confirmado** para o motor e a voz usados. Hoje (Higgsfield → ElevenLabs) **não está confirmado**, por isso a direção fica fora do texto.

## 5. Construção da voz do Kainan — três conjuntos separados
| Conjunto | Para quê | Regra |
|---|---|---|
| **A · Base de clonagem** | treinar o clone | gravações limpas, estilo natural e **consistente**, sem música, uma voz. Não misturar todas as emoções aqui. |
| **B · Biblioteca de interpretação** | referência de como ele soa a desafiar, explicar, surpreender, entusiasmar, refletir e convidar | não entra automaticamente na base; usar só se a ferramenta pedir |
| **C · Avaliação** | comparar clone × voz real | frases novas, **nunca** usadas no treino |

- Começar com um **teste curto de captação** e um **piloto de clonagem**. A sessão longa só depois de avaliar o piloto.
- Nas gravações para clonagem, respirar normalmente; a regra de "sem respiros" vale só para o áudio final dos conteúdos.
- Pasta: `marketing/voz/` (no repositório só os textos e as fichas; os áudios ficam fora do repositório público, em `Maquina de Conteudo\voz\` no PC do Kainan).

## 6. Ferramentas
- **Candidatas:** ElevenLabs (1.ª), Fish Audio (comparação) e o **clone de voz do Higgsfield** (`create_voice`), que já está integrado e controlado pelo fluxo de gasto. Se o clone do Higgsfield puder ser usado com o motor ElevenLabs (`voice_type: element`), evita uma assinatura extra. **Hipótese a validar.**
- Antes de recomendar contratação ou integração, verificar recursos, preços, requisitos, idiomas, termos e API **na data**.
- Comparar todas com **o mesmo material do Kainan**. Critérios: semelhança, naturalidade, controle de interpretação, pronúncia nos 5 idiomas, **custo por conteúdo aprovado (incluindo novas tentativas)** e integração.
- Nunca afirmar que uma API está ligada ou que um clone existe sem execução e verificação.
- **Dois caminhos de produção:**
  1. texto → clone aprovado;
  2. gravação real do Kainan em PT → dublagem para outros idiomas (quando a interpretação original importa).

## 7. Entrega completa para aprovação (todo vídeo)
1. Objetivo, público, dor/dúvida e ideia central.
2. Roteiro visual por cena: ação, enquadramento, câmera, elementos, efeitos.
3. Narração com direção vocal por trecho (secção 4).
4. **Narração completa num único bloco**, pronta para copiar, sem instruções misturadas.
5. Duração estimada por cena e total.
6. Música e efeitos sonoros.
7. Orientações de montagem (CapCut ou montagem pela Máquina).
8. Estimativa de consumo das ferramentas pagas.
9. Pontos que dependem da aprovação do Kainan.

- As cenas são cortes de imagem. **A fala pode atravessar cortes**: a narração não para na troca de cena.
- Áudio em partes: mesma voz, volume (−16 LUFS por parte antes da mistura), intenção e velocidade. Unir com **crossfade de 10–30 ms** e sem silêncio.

## 8. Música e montagem
- Entregar **voz, música e efeitos em faixas separadas** e também o vídeo final mixado.
- Descrever a função da música (expectativa, energia, acompanhar explicação, virada).
- Indicar onde a música baixa para a voz ser entendida e onde sobe.
- Na montagem: retirar respiros e silêncios, preservar o início e o fim das palavras, e manter a fala colada aos movimentos e cortes.

## 9. Aprovação e créditos
- Nada vai para geração paga sem aprovação explícita do roteiro **e** do gasto.
- A aprovação diz o que será gerado: cenas, idiomas, duração e número de versões.
- Mudança fora do escopo aprovado: apresentar a alteração e o consumo extra **antes** de executar.

## 10. Lapidação e memória
- Cada avaliação do Kainan entra em `voz/avaliacoes.csv`: problema, trecho, ajuste, resultado da nova avaliação e regra aprovada.
- Regras aprovadas sobem para `perfil-vocal.md` (nova versão) e, se gerais, para `08-aprendizados.md`.
- A ferramenta **não aprende sozinha** com as correções. Os registros servem para atualizar as diretrizes e, quando suportado, rever a base de voz.
