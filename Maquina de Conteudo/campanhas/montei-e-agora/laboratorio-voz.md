# Laboratório de voz · Dôdo (Archie) — v1.2 (30/09/2026)

Objetivo: dar **emoção por momento** e **pronúncia correta dos termos japoneses do judô** antes de gerar a narração final.

## 1. O que muda na forma de gerar
- ~~Uma fala por cena~~ → **substituído na v1.3**: narração em 3 blocos contínuos (A, B, C) para a emoção descer de forma gradual, como uma pessoa real. Ver §7.
- **Motor:** testar o **ElevenLabs** com a mesma voz Archie (0,6 cr por fala, preço confirmado) contra o Seed Audio usado na Etapa A (1,1 cr). O ElevenLabs costuma responder melhor a pontuação expressiva; o Seed Audio tem controlo de velocidade.
- A emoção vem da **escrita da fala**: reticências para suspense, ponto de exclamação para energia, frases curtas para impacto, maiúsculas na palavra a acentuar. Não uso parâmetros de "emoção" que não estejam na documentação.

## 2. Mapa de emoção por cena
| Cena | Momento | Emoção e ritmo | Palavra a acentuar | Fala preparada para a voz |
|---|---|---|---|---|
| 01 | gancho | alerta brincalhão, meio a sussurrar no fim | CUSTAR | "Built your team with ONLY favorites?… Careful. That can COST you Judocoins." |
| 02 | viragem | curioso → confiante, sorriso na voz | two | "Team's ready… now what? Here, you play TWO scoreboards!" |
| 03 | explicação | claro, firme, ritmo médio | next round | "Points move you UP the ranking. Judocoins decide the team you can afford… NEXT round." |
| 04 | regra | professor paciente | target | "Every athlete's price is a points TARGET. Score more than he costs? He rises! Score less?… He drops." |
| 05 | perda | tensão crescente, pausa dramática, remate grave | thirteen / five | "Look at this favorite. He cost eighteen. Won one fight by ippon… lost the next by waza-ari. Eight points. He dropped to thirteen… and YOU lost five Judocoins." |
| 06 | ganho | alívio, animado | eleven | "Now a bargain at six… who scored SIXTEEN! He rose to eleven — and you gained two and a half." |
| 07 | revelação | cúmplice, lento, "percebeste?" | half / whole | "See it?… When an athlete rises, you keep HALF. When he drops… you take the WHOLE drop." |
| 08 | equilíbrio | justo, tranquilizador | too | "Favorites rise TOO — if they score more than they cost. An eighteen who scores twenty-four goes to twenty-one." |
| 09 | piscadela | divertido, travão antes da punchline | not | "And your captain doubles the points… NOT the Judocoins." |
| 10 | conselho final | sensei confiante e caloroso, energia no CTA | more than he costs | "So don't just ask who'll win. Ask who'll score MORE than he costs! Build your team on Ippon League." |

## 3. Pronúncia dos termos do judô (japonês)
Referência: pronúncia usada no meio do judô (romanização Hepburn), sem acento inglês.

| Termo | Como deve soar | Grafia fonética de teste (para a voz inglesa) | Nota |
|---|---|---|---|
| ippon | "ip-pon", o "p" dobrado com pausa curta | "eep-pohn" | não dizer "eye-pon" |
| waza-ari | "wa-za a-ri", 4 sílabas | "wah-zah ah-ree" | não dizer "waza-airy" |
| yuko | "yu-ko" | "yoo-koh" | |
| shido | "shi-do" | "shee-doh" | não dizer "shy-doh" |
| hansoku-make | "han-so-ku ma-ke" | "hahn-soh-koo mah-keh" | "make" não é o inglês "make" |
| judo / judoka | "ju-dô", "ju-dô-ka" | "joo-doh", "joo-doh-kah" | |
| tatami | "ta-ta-mi" | "tah-tah-mee" | |
| Judocoins | nome do produto, inglês | "joo-doh-coins" | |

Na legenda e no ecrã escreve-se sempre a forma correta (ippon, waza-ari…). A grafia fonética só entra no texto enviado à voz, se o teste mostrar que é preciso.

## 4. Testes propostos (Etapa A2) — pedido de autorização
| Teste | O quê | Gerações | Créditos |
|---|---|---|---|
| T1 | Emoção: falas 01, 05 e 10 com ElevenLabs + Archie | 3 | 1,8 |
| T2 | Pronúncia, grafia normal: "Ippon. Waza-ari. Yuko. Shido. Hansoku-make. Judoka." (ElevenLabs) | 1 | 0,6 |
| T3 | Pronúncia, grafia fonética (mesma frase) (ElevenLabs) | 1 | 0,6 |
| T4 | Os teus testes escritos: escreves uma frase aqui, eu devolvo o áudio | até 3 | até 1,8 |
| **Total / teto pedido** | | **até 8** | **até 4,8** |

Sem regerações automáticas: cada novo teste conta dentro do teto; acabado o teto, peço de novo.

## 5. Como funciona o teu teste escrito (T4)
1. Escreves no chat: *"Teste: [a tua frase]"* (podes indicar a emoção, ex.: *"animado"*).
2. Eu gero com a voz e o motor escolhidos e mostro o áudio aqui (cartão do Higgsfield).
3. Dizes o que soou mal (ex.: *"shido soou shy-doh"*); eu ajusto a grafia fonética e registo a regra em `conhecimento/04-dodo.md` → "Voz e pronúncia", para ser usada sempre.

## 6. Resultados dos testes (30/09/2026) — autorizados até 4,8 créditos
Motor: ElevenLabs (via Higgsfield) · voz Archie · projeto Higgsfield "Ippon League · Máquina de Conteúdo".
| Teste | Texto | Duração | Job |
|---|---|---|---|
| T1 · cena 01 | "Built your team with ONLY favorites?… Careful. That can COST you Judocoins." | 6,2 s | 49485ac6 |
| T1 · cena 05 | "Look at this favorite… and YOU lost five Judocoins." | 13,2 s | 63dd3318 |
| T1 · cena 10 | "So don't just ask who'll win… Build your team on Ippon League." | 7,3 s | 11a42989 |
| T2 · grafia normal | "Ippon. Waza-ari. Yuko. Shido. Hansoku-make. Judoka." | 6,7 s | b69bda11 |
| T3 · grafia fonética | "Eep-pohn. Wah-zah ah-ree. Yoo-koh. Shee-doh. Hahn-soh-koo mah-keh. Joo-doh-kah." | 7,4 s | c173d970 |
Gasto: 1,8 créditos (saldo 737,8 → 736). Disponível para os teus testes (T4): **3,0 créditos**.
Ritmo ElevenLabs: ~2,1 palavras/s sem ajuste de velocidade — cabe nos ~80 s.

## 7. v1.3 — take contínuo e transição gradual
Teste gerado (0,75 cr, job f5524e44, 16,3 s): cenas 01+02 num só take — "STOP! Judo fans… … now what? Well, here you actually play two scoreboards." O STOP entra em grande e a voz desce aos poucos até à conversa.
Narração final: 3 blocos ElevenLabs + Archie (A: gancho → dois placares; B: preço-alvo → exemplos; C: regra da metade → CTA com link).
