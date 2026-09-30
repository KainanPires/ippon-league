# 06 · Campanhas e formatos

## Objetivo da fase (brief de marketing)
Validar com gasto mínimo se há apetite e pagantes. Estrela-guia: **jogadores que voltam de uma competição para a seguinte**.

## Tipos de peça (Kainan, 30/09/2026)
Vídeos curtos · carrosséis · posts fixados (apresentação do produto) · anúncios · vídeos híbridos (Dôdo animado a interagir com vídeo real — ❓ só material próprio ou licenciado; nunca atletas reais nem transmissões).

## Redes e formatos (❓ lista final por confirmar — conflito C9)
| Rede | Formato | KPI |
|---|---|---|
| TikTok | 9:16, 15–30 s | views + conclusão |
| Instagram Reels | 9:16 | views + saves + partilhas |
| Instagram feed | 4:5, post/carrossel | saves |
| YouTube Shorts | 9:16 | views + subscritores |
| X | texto + gráfico | cliques |

## Calendário de rodadas (do código, `lib/calendario.ts`)
Mundial de Baku 04/10 · GP Marrakech 2019 (Clássico) 17/10 · GP Zagreb 2021 (Clássico) 22/10 · Abu Dhabi GS 29/10 · Montreal Open 07/11 · Zagreb GP 13/11 · Kowloon Open 21/11 · Rome Open 28/11 · Tokyo GS 05/12 · Dar Es Salaam Open 13/12 · World Masters 18/12 · GS Tel Aviv 2022 (Clássico) 26/12.

## Ângulos a testar (brief)
`como-jogar` · `emocao` · `posicionamento` · `amigos` · (novo, das referências) `nao-e-bet`.

## Links UTM
Base `https://www.ipponleague.com/` · minúsculas, sem acentos, hífens · um link por variante. `utm_source` rede · `utm_campaign` tema/rodada · `utm_content` variante · `utm_term` gancho.
❓ C12: `utm_medium` — brief (`reel/short/bio/story`) vs construtor `/admin/utm` (`social/video/story/bio/…`). Escolher um.

## Campanhas registadas
| id | Estado | Pasta |
|---|---|---|
| `exemplo-mundial-baku` | exemplo de formato, **não aprovado** | `campanhas/exemplo-mundial-baku/` |
