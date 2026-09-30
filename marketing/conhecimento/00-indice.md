# Base de conhecimento · Máquina de Conteúdo

Fonte da verdade do produto: **o código deste repositório** (branch `main`). Os documentos de marketing nunca mandam no jogo — descrevem-no.

## Estados usados em todos os documentos

| Selo | Significa | Como se confirma |
|---|---|---|
| **IMPLEMENTADO** | existe no código de `main` | ficheiro:linha indicado |
| **PUBLICADO** | visível no site em produção (www.ipponleague.com) | página e data da consulta |
| **VERIFICADO** | conferido automaticamente contra o código (`verificar-conhecimento`) ou por teste | `factos.json` / testes |
| **PLANEADO** | só em documento/especificação; não existe para o jogador | documento de origem |
| **❓ A CONFIRMAR** | informação em falta ou contraditória | ver `09-assets-ausentes.md` e o conflito indicado |

Regra: conteúdo publicado só usa factos **IMPLEMENTADO + VERIFICADO** (ou **PUBLICADO**). Nunca anunciar **PLANEADO**.

## Ficheiros

| # | Ficheiro | Conteúdo |
|---|---|---|
| 01 | `01-produto.md` | regras e funcionalidades, com fonte, data, condições e estado |
| 02 | `02-motor-pontuacao.md` | como o motor pontua e valoriza, de verdade |
| 03 | `03-identidade-visual.md` | cores, fontes, logótipo, elementos |
| 04 | `04-dodo.md` | Dôdo mestre, vistas, expressões, continuidade |
| 05 | `05-diretrizes-referencias.md` | linguagem de produção extraída das referências |
| 06 | `06-campanhas.md` | campanhas, formatos, redes, UTM |
| 07 | `07-exemplos-aprovados.md` | peças aprovadas (vazio até haver a primeira) |
| 08 | `08-aprendizados.md` | correções e regras aprendidas, datadas |
| 09 | `09-assets-ausentes.md` | o que falta e quem tem de o fornecer |
| 10 | `10-higgsfield-api.md` | o que a documentação oficial da API diz (e o que não diz) |
| — | `factos.json` | números conferidos contra o código |

Última revisão: 30/09/2026 · commit da app `e816cac`.
