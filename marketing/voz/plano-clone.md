# Plano de construção e avaliação do clone da voz do Kainan · v1 (01/10/2026)

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
