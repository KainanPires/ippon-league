# Roteiro · Mundial de Baku — corte de 15 s (versão 0.1)

> Documento de planeamento. **Não autoriza nenhum gasto.**

| Campo | Valor |
|---|---|
| Objetivo | Levar fãs de judo a montar equipa para o Mundial de Baku |
| Público | fãs de judo que vão ver o Mundial |
| Promessa | Vive o Mundial a jogar: 8 atletas, 100 JC, 1 capitão |
| Hipótese | Um gancho com o Dôdo 3D + 'não é bet' aumenta a conclusão face a um tutorial |
| Formato / redes | TikTok, Instagram Reels, YouTube Shorts |
| Duração total | 15 s |
| Idioma | ❓ PT-BR ou PT-PT |
| CTA | Monta a tua equipa — link na bio |
| Link UTM | https://www.ipponleague.com/?utm_source=tiktok&utm_medium=video&utm_campaign=mundial-baku&utm_content=nao-e-bet-v1 |

## Cenas

### c01 · 00:0000–00:0003 (3 s) · gancho
- **Origem:** higgsfield
- **Cenário:** estúdio escuro, raios de luz dourados, partículas
- **Personagens:** Dôdo 3D, determinado, faixa preta
- **Ação:** Dôdo aponta para a câmara
- **Enquadramento:** plano médio → close
- **Câmara:** push-in lento
- **Texto em ecrã:** "FANTASY" (Oswald dourado) · "DE JUDÔ" (Oswald creme)
- **Narração:** —
- **Música:** entra a batida
- **Efeitos sonoros:** whoosh
- **Transição de saída:** corte seco
- **Geração:** `kling-video/v3.0-turbo/image-to-video` × 1
  - Parâmetros: `{"prompt":"The cartoon platypus judoka mascot from the reference image (vinyl toy look, teal head, wide orange bill, white judogi, black belt) points at the camera with a determined face; slow push-in; dark studio, golden light rays and particles; keep exact character design","image_url":"https://referencia-por-alojar.invalid/dodo3d_3.jpg","duration":3,"resolution":"1080p"}`
  - Referências: assets/dodo/3d/dodo3d_3.jpg

### c02 · 00:0003–00:0006 (3 s) · o que é
- **Origem:** gravacao
- **Cenário:** —
- **Personagens:** 
- **Ação:** gravação de ecrã: mercado a montar a equipa
- **Enquadramento:** telemóvel inclinado com brilho dourado
- **Câmara:** leve rotação
- **Texto em ecrã:** "8 ATLETAS · 100 JC · 1 CAPITÃO" (Oswald dourado)
- **Narração:** —
- **Música:** batida
- **Efeitos sonoros:** cliques de interface
- **Transição de saída:** deslize para cima

### c03 · 00:0006–00:0009 (3 s) · posicionamento
- **Origem:** motion (CapCut)
- **Cenário:** —
- **Personagens:** 
- **Ação:** texto 'NÃO É BET.' riscado a vermelho; entra 'É JOGO.'
- **Enquadramento:** —
- **Câmara:** —
- **Texto em ecrã:** "NÃO É BET." (creme, risco vermelho) · "É JOGO." (dourado grande)
- **Narração:** —
- **Música:** pico
- **Efeitos sonoros:** risco
- **Transição de saída:** corte seco

### c04 · 00:0009–00:0012 (3 s) · evento
- **Origem:** motion (CapCut)
- **Cenário:** —
- **Personagens:** 
- **Ação:** chips D1–D7 acendem; 'MUNDIAL DE BAKU · 4 OUT'
- **Enquadramento:** —
- **Câmara:** —
- **Texto em ecrã:** "MUNDIAL DE BAKU" (Oswald dourado) · "COMEÇA A 4 DE OUTUBRO" (Manrope creme)
- **Narração:** —
- **Música:** batida
- **Efeitos sonoros:** ticks
- **Transição de saída:** fundido

### c05 · 00:0012–00:0015 (3 s) · CTA
- **Origem:** asset (logótipo + Dôdo 2D)
- **Cenário:** —
- **Personagens:** 
- **Ação:** Dôdo 2D a comemorar + logótipo + botão
- **Enquadramento:** —
- **Câmara:** —
- **Texto em ecrã:** "MONTA A TUA EQUIPA" (botão dourado) · "LINK NA BIO" (rodapé)
- **Narração:** —
- **Música:** final
- **Efeitos sonoros:** ding
- **Transição de saída:** fim

## Mapa musical

| De | Até | Faixa | Fonte / licença | Intensidade | Nota |
|---|---|---|---|---|---|
| 00:0000 | 00:0015 | ❓ a escolher | ❓ / ❓ | crescente | batida sobe no c03 |

## Factos usados (verificar com ippon-produto)

- Equipa de 8 atletas com 100 Judocoins e 1 capitão — fonte: lib/team.ts (IMPLEMENTADO · VERIFICADO)
- Mundial de Baku começa a 04/10/2026 no calendário do jogo — fonte: lib/calendario.ts (IMPLEMENTADO)
