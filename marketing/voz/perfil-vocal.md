# Perfil vocal · v0.1 (01/10/2026) — PROPOSTA, a validar

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
