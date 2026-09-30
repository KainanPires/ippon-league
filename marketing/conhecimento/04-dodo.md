# 04 · Dôdo — personagem mestre e continuidade

## Quem é
- **Ornitorrinco judoca** (comentário oficial em `components/Mascot.tsx`). NÃO é um dodô (ave). Nos prompts: "cartoon platypus judoka mascot" + referência obrigatória.
- Papel: **sensei** do jogador ("Sou o teu sensei aqui na Ippon League e vou guiar-te"). Fala na 1.ª pessoa, tom caloroso e simples.

## Mestre 2D (fonte canónica) — IMPLEMENTADO
`components/Mascot.tsx` (SVG). Renderizado sem custo para `marketing/assets/dodo/2d/` (PNG 1024×1024 transparente + SVG): 5 expressões × 7 faixas × 2 judogis.

| Parte | Cor |
|---|---|
| Cabeça oval | `#4DB6AC` (contorno `#2f8a80`) · cauda `#39998f` |
| Bico largo | `#FF8F00`, contorno `#E65100`, 2 narinas |
| Olhos | brancos, íris `#1A237E`, brilho branco |
| Sobrancelhas | laranja `#E65100` |
| Mãos | redondas `#E65100` · patas `#FF8F00` |
| Judogi | branco `#f6f3ea` (borda `#d8d1c0`) ou azul `#2f6fb3` (personalização paga) |
| Faixa | cor da faixa do jogador (ver 03) |

Expressões oficiais: `feliz` · `determinado` (sobrancelhas franzidas, sem sorriso) · `comemorando` (2 braços no ar) · `indicando` (braço direito no ar) · `sabio` (óculos redondos, para dicas).

## O Dôdo atua (regra permanente — Kainan, 30/09/2026)
O Dôdo nunca é enfeite parado. Sempre que aparece, a **pose, o gesto e a expressão mostram o que está a ser dito naquele momento** (ou o sentimento de quem ouve). Não precisa de estar sempre em movimento, mas a imagem tem de "falar" a mesma coisa que a narração.
- No roteiro, cada aparição indica: **palavra/momento da fala → pose + expressão**. Se a fala muda de emoção dentro da cena, a pose muda com ela (troca de imagem no corte).
- ippon-direcao escolhe a pose; ippon-revisao reprova cena com Dôdo neutro (braços em baixo) numa fala com intenção clara.

### Biblioteca de atuação
| Intenção da fala | Pose / gesto | Expressão | 2D existe? |
|---|---|---|---|
| Parar / interromper ("STOP!") | palma aberta virada para a lente, braço esticado | determinado | ❌ criar |
| Atenção / regra importante ("here's the rule…") | dedo indicador levantado ao lado da cara | sábio ou determinado | ❌ criar (hoje: `indicando`, braço no ar) |
| Explicar / dica | óculos, mão a apresentar | sábio | ✅ `sabio` |
| Mostrar um dado / apontar para o ecrã | braço a apontar para o lado | feliz | ✅ `indicando` (aproximado) |
| Perda / "you lost" / "it HURTS" | ombros caídos, mãos na cabeça ou a cobrir o bico | triste / aflito | ❌ criar |
| Ganho / valorizou | dois braços no ar | comemorando | ✅ `comemorando` |
| Surpresa / revelação ("changes EVERYTHING") | olhos arregalados, mãos abertas | surpreso | ❌ criar |
| Dúvida / "now what?" | mão no queixo, cabeça inclinada | pensativo | ❌ criar |
| Piscadela / truque ("NOT the Judocoins") | piscar um olho, dedo a abanar "não" | maroto | ❌ criar |
| Confiança / CTA | polegar para cima, ou aponta para a câmara | feliz / determinado | ❌ criar (polegar) |

Poses ❌: criar primeiro em **2D no estúdio de cenas (custo zero)**, a partir do mestre SVG, e só depois, se o Kainan autorizar, em 3D no Higgsfield com o mesmo gesto como imagem de partida.

## Versão 3D — existe, origem ❓
Vista no vídeo de referência (30/09/2026): aspeto de boneco de vinil, fiel ao 2D, expressão "determinado", judogi branco, **faixa preta**, cauda visível; close-ups com raios de luz e partículas douradas; aponta para a câmara. Frames em `marketing/assets/dodo/3d/`.
❓ Ficheiros de origem, ferramenta e prompt usados — pedir ao Kainan (ver 09).

## Vistas — em falta
Só existe vista **frontal** (2D) e close-ups frontais/¾ (3D). Faltam: perfil, costas, ¾ oficial, folha de proporções. Não gerar folha de personagem sem pedido explícito e orçamento.

## Regras de continuidade (valem para toda a peça)
1. Proporções do SVG: cabeça grande (≈ 1/3 da altura), corpo compacto, pernas curtas, cauda visível à direita.
2. Bico sempre laranja e largo; nunca bico de ave fino.
3. Cor da faixa coerente com a história (faixa do jogador; em peças de marca usar preta ou a faixa do tema).
4. Judogi branco por defeito; azul só quando o tema é personalização Pro.
5. Mesma versão (2D ou 3D) dentro de uma cena; 3D para gancho/viragens emocionais, 2D para ecrãs de marca.
6. Cada cena com o Dôdo indica a referência exata (ficheiro) no plano.
7. Rejeitar qualquer geração com anatomia ou cores diferentes — sem regeração automática.
