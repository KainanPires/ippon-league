# 03 · Identidade visual

Fontes: `app/layout.tsx`, `app/entrar/page.tsx`, `app/inicio/page.tsx`, `lib/faixas.ts`, `lib/tatames.ts`, referências de 30/09/2026. Estado: IMPLEMENTADO na app.

## Cores
| Papel | Hex |
|---|---|
| Fundo principal | `#0c0e0d` |
| Superfícies / cartões | `#121815` · `#141a17` · `#1b211e` |
| Bordas | `#243029` |
| Verde de superfície (tatame/brilho) | `#1c3a2e` · gradiente de entrada `#143026` |
| Texto principal (creme) | `#f1ede2` |
| Texto secundário | `#93a39a` · `#7c8a82` |
| **Dourado (marca / Pro)** | `#d9a441` |
| Azul "LEAGUE" no logótipo | `#8fbef0` |
| Azul Pro Max | `#7fb8f5` |
| Positivo / valorização | `#7fd1a3` · `#aee9c9` |
| Negativo | `#e2655a` |

Faixas: branca `#efeadd` · azul `#3b6fb5` · amarela `#e8c84b` · verde `#3f8f5a` · roxa `#7a4fa3` · marrom `#6b4a2f` · preta `#1a1a1a`.
Tatames (Pro Max), dentro/fora: Amarelo/Azul `#e6b422`/`#2f6fb3` (padrão) · Amarelo/Vermelho `#e6b422`/`#b33f3f` · Azul/Vermelho `#2f6fb3`/`#b33f3f` · Amarelo/Verde `#e6b422`/`#3f9962` · Verde/Vermelho `#3f9962`/`#b33f3f`.

## Tipografia
- **Oswald** (700, MAIÚSCULAS, espaçamento largo) — títulos, números, rótulos. Na app aparece como variável `--font-geist-mono` (nome herdado, enganador).
- **Manrope** — texto corrido (`--font-geist-sans`).
- Ambas Google Fonts (licença SIL OFL).

## Logótipo
- Na app: círculo dourado `#d9a441` com barra `#1b211e` + "IPPON" creme + "LEAGUE" azul `#8fbef0`, Oswald 700 (`app/entrar/page.tsx`).
- Versão vetorial criada a partir disso a 30/09/2026 (letras em curvas): `marketing/assets/marca/` — horizontal (escuro, claro, mono), vertical com Dôdo, símbolo. Estado: **proposta, ❓ aprovação do Kainan pendente**.
- Não existe manual de uso do logótipo (margens, tamanho mínimo). ❓

## Elementos de marca
Tatame; avatares de kimono de costas com back number e sigla de país; escudo da equipa (`components/Escudo.tsx`); troféu da Copa do Dôdo (`components/TrofeuDodo.tsx`); cards de desempenho/certificado; fundo escuro com textura diagonal e partículas douradas (referências).

## Proibido
Fotos/vídeos de atletas reais · imagens de transmissões IJF/JudoBase · logos IJF/federações/JudoBase · alterar anatomia ou cores do Dôdo · landing antiga azul/amarela (`#1565C0`/`#FDD835`, Nunito) — obsoleta.
