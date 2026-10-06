# Laboratório de voz · Dôdo (Archie) — v1.2 (30/09/2026)

Objetivo: dar **emoção por momento** e **pronúncia correta dos termos japoneses do judô** antes de gerar a narração final.

## 1. O que muda na forma de gerar
- **Uma fala por cena** (10 gerações curtas) em vez de um take único. Cada fala recebe a sua emoção, e uma cena má refaz-se sozinha — com autorização.
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
