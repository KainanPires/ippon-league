# Ippon League — KPIs de Lançamento

**Objetivo desta fase:** provar que as pessoas *querem jogar* (validação), não acumular seguidores.
**Estrela-guia (a única métrica que decide tudo):** **jogadores que voltam de uma competição para a seguinte.** Se voltam, tens produto. Tudo o resto alimenta isto.

---

## 1. O funil — as etapas e o KPI de cada uma

Pensa em tudo como um funil. Cada etapa tem UM número principal. Se um número está mau, é aí que atacas.

| Etapa | Pergunta | KPI principal | Onde medir |
|---|---|---|---|
| 1. Alcance | Quantos me viram? | Impressões / views | Analytics nativas de cada rede |
| 2. Envolvimento | O conteúdo prende? | Taxa de retenção do vídeo, saves, partilhas | Analytics nativas |
| 3. Tráfego | Quantos clicaram para a app? | Cliques no link (por canal, via UTM) | UTMs + analytics do site |
| 4. Registo | Quantos criaram conta? | **Taxa de conversão visita→conta** | Supabase + analytics |
| 5. Ativação | Quantos *jogaram* mesmo? | % que montou equipa + escolheu capitão | Supabase |
| 6. Retenção | Quantos voltam? | **% que volta na competição seguinte** ← estrela-guia | Supabase |
| 7. Viralidade | Trazem amigos? | Ligas de amigos criadas, convites aceites | Supabase |
| 8. Receita | Quantos pagam? | Início de teste Pro → conversão em pago | Stripe |

**Regra:** no lançamento, as etapas 4, 5 e 6 mandam. Pagamentos (8) são um sinal *tardio* — não te assustes se forem baixos na semana 1; primeiro valida que jogam e voltam.

---

## 2. Resultados a procurar em CADA rede

O "resultado" não é o mesmo em todas — cada rede tem um trabalho diferente no funil:

| Rede | Trabalho principal | KPI que importa | O que é "bom" (ponto de partida) |
|---|---|---|---|
| **TikTok** | Alcance frio (descoberta) | Views + taxa de conclusão do vídeo | Vídeos que passam de ~40–50% de conclusão são candidatos a impulsionar |
| **Reels (IG)** | Alcance + comunidade | Views + saves + partilhas | Saves altos = conteúdo "útil" (dicas) a funcionar |
| **YouTube Shorts** | Alcance duradouro | Views + subscritores ganhos | Cresce mais devagar mas dura mais |
| **X/Twitter** | Tempo real no Mundial | Cliques no link + reposts | Picos durante as lutas |
| **Instagram (feed/stories)** | Conversão + confiança | Cliques no link da bio + registos | É onde a decisão acontece |

Para cada rede, segue **1 número de alcance** (views) e **1 número de ação** (cliques ou registos atribuídos). Ignora o resto no início.

---

## 3. A mensagem que mais converte (teste de mensagem)

Não adivinhes qual frase converte — **mede.** Método simples:

1. Escolhe 3–4 mensagens-ângulo (ex.: *"You watch the Worlds. Now play it."* vs *"100 coins, 8 athletes, beat your friends."* vs *"Climb from white to black belt."*).
2. Usa um **link UTM diferente por mensagem** (ver secção 7) — ou publica cada uma em posts distintos.
3. Mede a **taxa de registo por mensagem**: de quem clicou nessa mensagem, quantos criaram conta.

**KPI de mensagem vencedora:** `registos ÷ cliques` (ou `registos por 1000 views`). A mensagem com a maior taxa é a que passas a usar em todo o lado — inclusive nos anúncios pagos.

---

## 4. O formato vencedor por plataforma

Cada plataforma "gosta" de formatos diferentes. Testa 3–5 formatos por plataforma nas primeiras 2 semanas e deixa os dados escolherem:

Formatos a testar: *"How to play in 20s"* · *"belt reveal"* (branca→preta) · *"biggest scorer of the round"* · *"build a 100-coin team"* · *"this shido just scored me points"*.

**KPI de formato vencedor:**
- Vídeo curto (TikTok/Reels/Shorts): **taxa de conclusão + partilhas**.
- Carrossel (IG): **saves**.
- X: **cliques no link**.

Ao fim de 2 semanas, cada plataforma terá 1–2 formatos claramente à frente. Fazes **mais desses** e é esses que impulsionas com o orçamento pago. Revê o vencedor a cada 2–3 semanas (os formatos cansam).

---

## 5. Crescimento de contas criadas

Da base (Supabase). Segue semanalmente:
- **Novas contas / dia** e **/ semana**.
- **Total acumulado**.
- **Taxa de crescimento semana-a-semana** (%).
- **Ativação:** das contas novas, **% que montou equipa** (conta que não monta equipa não conta como jogador).
- **Fonte:** quantas contas vieram de cada canal (via UTM) — diz-te onde investir.

Meta: no lançamento, o número sobe com o Mundial; o que interessa é que **não caia a pique quando o Mundial acabar** — isso mede o teu apelo real, não só a boleia do evento.

---

## 6. Pagamentos (receita)

Do Stripe. Ainda não é o foco, mas mede desde já para teres a linha de base:
- **Inícios de teste Pro** (quantos começam os 7 dias).
- **Conversão teste→pago** (% que fica depois do teste).
- **Assinantes ativos** (Pro + Pro Max) e **MRR** (receita mensal recorrente).
- **Churn** (% que cancela por mês).
- **Conversão global grátis→pago** (dos jogadores todos, quantos pagam).

Referências de freemium (ponto de partida, não promessa): grátis→pago costuma andar por **2–5%**; teste→pago varia muito conforme pedes cartão no início ou não. Mede o *teu* número e melhora a partir daí.

---

## 7. Como medir (os pré-requisitos)

Para os KPIs acima funcionarem, precisas de duas coisas simples:

**A) Links UTM (atribuição por canal e mensagem).** Em vez de pores `ipponleague.com` na bio, usas links com etiquetas, ex.:
`ipponleague.com/?utm_source=tiktok&utm_medium=social&utm_campaign=worlds&utm_content=howtoplay`
Muda `utm_source` por rede e `utm_content` por mensagem/formato. Assim sabes exatamente de onde vêm os cliques e os registos. (Posso gerar-te já o conjunto completo de links.)

**B) Analytics do site + evento de registo.** Precisas de saber, no momento em que alguém cria conta, de que `utm_source` veio. Isto é uma pequena adição ao código (guardar o UTM na chegada e associá-lo à conta no Supabase). Se ainda não tiveres analytics no site, o Vercel Web Analytics ou o Plausible são simples de ligar. (Posso ajudar-te a montar isto.)

Sem isto, ainda medes tudo o que é "dentro da app" (contas, equipas, retenção, pagamentos) pelo Supabase e Stripe — só não sabes *qual canal/mensagem* os trouxe.

---

## 8. Ritmo de revisão

**Toda a segunda-feira**, 20 minutos, preenche o teu tracker e responde a 4 perguntas:
1. Que **formato/mensagem** ganhou esta semana? → faço mais desse.
2. As **contas novas** subiram ou desceram? → porquê?
3. Dos que jogaram o último evento, **quantos voltaram**? → a estrela-guia.
4. Onde está o **maior estrangulamento** do funil? → é aí que trabalho na próxima semana.

Uma decisão de cada vez, guiada pelo número mais fraco.
