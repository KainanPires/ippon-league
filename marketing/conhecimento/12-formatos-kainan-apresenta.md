# 12 · Formatos de produção e "Kainan apresenta" (módulo permanente)

Aprovado pelo Kainan em 01/10/2026. Complementa `11-voz-e-narracao.md`; todas as regras de narração, aprovação e gasto continuam válidas.
Perfil versionado: `marketing/kainan-apresenta/perfil.md` · plano do avatar: `kainan-apresenta/plano-avatar.md` · teste de voz: `kainan-apresenta/teste-comparativo-voz.md`.

## 1. Formatos prioritários
| Código | Formato | Quando recomendar |
|---|---|---|
| `ludico-narrado` | **A · Lúdico narrado.** A voz conduz; aparecem o Dôdo, cenas criativas, demonstrações do app, desenhos e efeitos. | explicar regras, números, mecânicas; conteúdo divertido, viral, sem rosto; multi-idioma rápido |
| `kainan-apresenta` | **B · Kainan apresenta.** O Kainan fala com o público; a imagem alterna entre ele e referências (telas reais do app, fotos permitidas, gráficos, Dôdo, cenas). | confiança, opinião, novidades e lançamentos, bastidores, convites, respostas a dúvidas da comunidade, anúncios |

- **Frente futura (não bloqueia A nem B):** "Luta real e impacto no app" (`luta-real`), provavelmente com editor humano.
- **Em cada pedido**, a Máquina recomenda o formato e explica a escolha em uma ou duas frases (campo `campanha.formato_producao` + `campanha.formato_motivo`).

## 2. Regras de "Kainan apresenta"
1. **A origem da imagem do Kainan é sempre declarada:** `kainan-real` (gravação verdadeira) ou `kainan-avatar` (gerado). Nunca se mistura sem dizer.
2. **A voz não para nas trocas de imagem.** A narração é um áudio contínuo; o Kainan pode sair da tela enquanto a fala segue sobre a referência.
3. **Para cada cena, o roteiro indica:**
   - quem aparece (Kainan ou referência) e o que a referência demonstra;
   - como a fala continua na troca de imagem;
   - quando o Kainan volta;
   - enquadramento, expressão e gesto pretendidos.
4. **As referências precisam ter função.** Priorizar **telas reais** do app e informações verificadas. Se o material não existe, listar o que capturar. **Nunca inventar telas, dados ou funcionalidades.**
5. **Fotos e vídeos de atletas reais continuam proibidos** (direito de imagem; 03-identidade).
6. **Gestos e expressões são intenções de direção.** Não prometer controle exato quando a ferramenta não o oferece.
7. **Áudio primeiro:** quando a voz é externa, o áudio é finalizado e aprovado **antes** de gerar o avatar, para a boca acompanhar o ritmo aprovado.
   - Se mudar o áudio depois, gerar de novo só o trecho de avatar afetado (com autorização) ou ajustar sem quebrar a sincronia.
8. **Gerar só os trechos de avatar que entram na montagem** (`audio_trecho` + `duracao_s` de cada cena `kainan-avatar`). Nunca gerar o Kainan falando o vídeo inteiro se parte dele fica coberta por referências.
   - Tecnicamente: gerar o avatar por trecho de áudio, ou um único take curto que cubra só esses trechos. Escolher o mais barato que mantenha a continuidade.
9. **Consistência de voz entre formatos:** a voz do Kainan no formato A e no formato B é a mesma voz aprovada (`voz/perfil-vocal.md`). Não alternar vozes perceptivelmente diferentes sem aprovação.
10. **Idiomas:** validar primeiro em PT-BR; só depois multiplicar (EN, ES, FR, DE), adaptando texto e tempo em cada idioma.

## 3. Fluxo de produção (formato B)
1. **Pedido** → formato recomendado + motivo.
2. **Roteiro completo** (12 itens, secção 4) → aprovação P1/P2 do roteiro e do gasto.
3. **Áudio:**
   - gravação real do Kainan, **ou** voz clonada aprovada;
   - edição sem respiros;
   - aprovação do áudio.
4. **Imagem do Kainan:**
   - `kainan-real`: o Kainan grava as falas das cenas em que aparece (podem ser cortes curtos);
   - `kainan-avatar`: gera-se o avatar **só para os trechos aprovados**, com o áudio aprovado.
5. **Referências:** captura de telas reais, cenas do estúdio animado (custo zero), Dôdo.
6. **Montagem pela Máquina:**
   - voz contínua;
   - cortes entre o Kainan e as referências;
   - legendas, efeitos e música;
   - entrega organizada por cena, com faixas separadas e o MP4 final.
7. **Revisão do Kainan (P3/P4)** → avaliações registradas no perfil (secção 6).

## 4. Entrega do roteiro (12 itens)
1. Objetivo, público, mensagem principal, ação esperada.
2. Formato recomendado e motivo.
3. Roteiro por cena com duração estimada.
4. Texto da fala e direção vocal por trecho (11-voz §4).
5. Em cada cena: Kainan em tela (real ou avatar) ou referência visual.
6. Expressão, gesto, enquadramento e transição.
7. Materiais necessários, origem de cada um e se já existem.
8. Narração completa num bloco limpo.
9. Música, legendas e efeitos.
10. Montagem (CapCut ou Máquina).
11. Consumo estimado por ferramenta, incluindo **segundos de avatar**.
12. Pontos que precisam de aprovação.

A duração é estimativa até validar o áudio. O `validar` confere os campos obrigatórios do formato B.

## 5. Ferramentas (verificar na data; nada contratado)
- **Avatar:**
  - **HeyGen** é a 1.ª candidata (Digital Twin / Avatar IV);
  - o Higgsfield não está confirmado para avatar pessoal com sincronia labial a partir de áudio. **Hipótese a testar só se for preciso.**
- **Voz:**
  - o clone de voz da HeyGen, **ou**
  - a voz da ElevenLabs importada na HeyGen (por chave de API), **ou**
  - um áudio externo carregado na HeyGen (**a confirmar** no plano escolhido).
- **Não contratar as duas** sem o teste comparativo provar que compensa.

## 6. Registro e melhoria
- Perfil versionado em `kainan-apresenta/perfil.md`:
  - avatar e voz aprovados;
  - referências de interpretação;
  - aparência e enquadramentos aprovados;
  - pronúncias;
  - configurações testadas;
  - problemas e correções;
  - exemplos aprovados.
- As avaliações vão para `voz/avaliacoes.csv` (coluna `conteudo` com o formato) ou para a tabela do perfil.
- A plataforma não aprende sozinha: os registros alimentam as próximas propostas e, se suportado, uma nova versão do avatar ou da voz.
