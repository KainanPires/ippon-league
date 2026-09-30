# 01 · Regras e funcionalidades

Consultado a 30/09/2026 · código `main@e816cac` · site www.ipponleague.com.
Números marcados VERIFICADO estão em `factos.json` e são conferidos por `node marketing/bin/maquina.mjs verificar-conhecimento`.

## Jogo base

| Regra / funcionalidade | Condições | Fonte | Estado |
|---|---|---|---|
| Orçamento inicial de **100 Judocoins (JC)** | por época (ano civil) | `lib/team.ts` START_JC | IMPLEMENTADO · VERIFICADO · PUBLICADO (guia "Como se joga") |
| Equipa de **8 atletas: 4 masculinos + 4 femininos** + **1 capitão** | equipa só é completa com os 3 requisitos | `lib/team.ts` isComplete | IMPLEMENTADO · VERIFICADO |
| **Capitão pontua a dobrar** | tudo o que o capitão faz ×2 | `lib/engine.ts` scoreAthlete; `lib/congelar.ts` | IMPLEMENTADO · PUBLICADO |
| Pontua-se pelas **ações nas lutas**, não por medalhas | ver 02 | `lib/engine.ts`, `lib/ijf.ts` | IMPLEMENTADO · PUBLICADO |
| Cada competição do calendário é uma **rodada**; o mercado fecha antes | calendário montado à mão por ano | `lib/calendario.ts` | IMPLEMENTADO |
| **Rodadas clássicas**: semanas sem competição real usam competições antigas (2015–2025) | marcadas "Clássico" | `lib/classicos.ts` | IMPLEMENTADO |
| Equipa acima do orçamento fica **inativa** na rodada (0 pontos, património não mexe) | | `lib/congelar.ts` | IMPLEMENTADO |
| **7 faixas** por percentil mensal: branca → azul → amarela → verde → roxa → marrom → preta | sobe e desce todos os meses | `lib/engine.ts`, `lib/faixas.ts` | IMPLEMENTADO · VERIFICADO |
| A faixa muda o visual do jogo e a faixa do Dôdo | | `lib/faixas.ts`, `components/Mascot.tsx` | IMPLEMENTADO |
| 5 línguas: PT (origem), EN, ES, FR, DE | termos de judo e nomes de produto não se traduzem | `lib/i18n.ts` | IMPLEMENTADO |
| PWA (instalar no ecrã inicial) | | `public/sw.js`, `components/InstalarApp.tsx` | IMPLEMENTADO |

## Ligas e competições entre jogadores

| Regra | Condições | Fonte | Estado |
|---|---|---|---|
| Ligas de amigos por código de convite; formato **pontos** ou **copa (mata-mata)** | limites por plano abaixo | `app/api/liga/*`, `lib/planos.ts` | IMPLEMENTADO |
| Limites: Grátis 1 + 1 copa · Pro 5 + 5 · Pro Max 10 + 10 | contados por formato | `lib/planos.ts` LIMITES | IMPLEMENTADO · VERIFICADO |
| Ligas oficiais **Mundial** e **continental** | entrada automática só para **Pro/Pro Max** | `lib/ligasOficiais.ts` | IMPLEMENTADO |
| **Copa do Dôdo**: mata-mata mundial, **32 lugares**, **6 por continente** (EUR, PAN, ASI, AFR, OCE) + vagas que sobram sorteadas entre todos | só **Pro ou Pro Max** se inscrevem; entrada por sorteio, sem garantia | `lib/sorteioDodo.ts`, `app/api/dodo` | IMPLEMENTADO · VERIFICADO |
| O guia fala em liga "nacional" | o código só tem mundial + continental | `lib/i18n.ts` cj.s7 vs `lib/ligasOficiais.ts` | ❓ CONFLITO C16 — não usar "nacional" |

## Planos pagos

| Regra | Condições | Fonte | Estado |
|---|---|---|---|
| **Ippon Pro 5,99 €/mês** (promoção) · 8,99 € cheio | promoção: janela de **90 dias** após o lançamento, **6 meses** de desconto por pessoa; a data de lançamento não está no código | `lib/precos.ts` | IMPLEMENTADO · VERIFICADO · PUBLICADO (5,99 €, 30/09) |
| **Ippon Pro Max 6,99 €/mês** (promoção) · 9,99 € cheio | idem | `lib/precos.ts` | IMPLEMENTADO · VERIFICADO |
| Mensal, renova sozinho; cancelar mantém acesso até ao fim do mês pago; **7 dias grátis** | cobrado em euros, convertido na moeda local | `lib/precos.ts`; `/sobre-pro` | IMPLEMENTADO · PUBLICADO |
| Subir de Pro para Pro Max depois do teste: **taxa única 0,99 €** | | `lib/precos.ts` | IMPLEMENTADO |
| Pro: scout (histórico), análise do time e dica de capitão, chave **congelada**, ligas oficiais, até 5 ligas, Copa do Dôdo, cor do judogi do Dôdo | "o Pro não joga por ti" | `lib/i18n.ts` tbv.pro*, `app/api/judogui` | IMPLEMENTADO |
| Pro Max: tudo do Pro + **chave ao vivo**, **aviso quando o atleta favorito vai lutar**, grupo WhatsApp (aprovado por admin), até 10 ligas, **cor do tatame** | | `lib/i18n.ts` tbv.max*, `app/api/tatame` | IMPLEMENTADO |
| Fase atual **sem prémios** ("joga com mais informação e compete pelo topo do ranking") | | `lib/precos.ts` premios | IMPLEMENTADO |
| ⚠️ O tour do Pro Max apresenta a Copa do Dôdo e a cor do judogi como exclusivas do Max | o servidor permite Pro | `lib/i18n.ts` tbv.max1Txt vs `app/api/judogui` | CONFLITO C7/C8 — em conteúdo dizer "Pro e Pro Max" |

## Judocoins pagos — NÃO usar em conteúdo

Pacotes de 10 JC/20 € a 100 JC/70 € (`lib/planos.ts`), expiram a 30/12, nunca permitem trocas com o mercado fechado. A spec antiga dizia "1 JC = 1 €" (C5) e há alerta jurídico pendente. Estado: IMPLEMENTADO no código, **bloqueado para marketing até decisão do Kainan**.

## Planeado — nunca anunciar

| Item | Documento | Estado |
|---|---|---|
| Ippon Studio (simulador de cenas para gravar, `/admin/studio`) | `plano-ippon-studio.md` | PLANEADO (não existe) |

## Regras de conteúdo que vêm do produto
- Nunca fotos/vídeos reais de atletas nem imagens das transmissões IJF/JudoBase.
- Nunca logótipos da IJF/federações/JudoBase como parceiros. Citar a JudoBase como fonte de dados ❓ validar (C13).
- Não revelar escalações de rivais.
- Funcionalidades pagas mostradas em vídeo levam o selo do plano (Pro / Pro Max).
