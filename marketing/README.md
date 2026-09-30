# Máquina de Conteúdo · Ippon League

Ferramenta interna de marketing que usa a app como fonte de conhecimento e transforma ideias em vídeos, carrosséis e posts. **Não faz parte do jogo** e não é servida aos jogadores (vive fora de `app/`, `public/`, `lib/` e `components/`; nada do jogo a importa).

Modo por defeito: **planeamento e simulação, sem gasto**.

## Estrutura

```
marketing/
  CLAUDE.md                  regras e fluxo para o Claude nesta pasta
  conhecimento/              base de conhecimento (00-índice … 10-higgsfield-api) + factos.json
  assets/                    logótipo vetorial, Dôdo 2D (do código) e 3D (quadros)
  templates/plano.modelo.json
  campanhas/<id>/            plano, roteiro, storyboard, orçamento, autorização, razão, saídas, entrega CapCut
  config/                    aprovador.pub.pem (chave pública) · limites.json (opcional, fora do git)
  bin/maquina.mjs            linha de comandos
  lib/                       plano, documentos, autorização, razão, executor, CapCut, fornecedores
  tests/                     testes com fornecedor simulado
.claude/
  agents/ippon-*.md          6 especialistas
  settings.json              proibições (autorização, chave, geração via MCP) e confirmações
```

Sem dependências novas: só Node.js (≥ 18; testado em 22).

## Configuração (uma vez, no teu computador)

1. **Chave do aprovador** — num terminal teu (PowerShell ou outro), na raiz do repositório:
   ```
   node marketing/bin/maquina.mjs gerar-chaves
   ```
   Escolhe uma frase-passe que só tu sabes (nunca a dês ao Claude). A chave privada fica cifrada em `~/.ippon-marketing/aprovador.key`, fora do repositório. Faz commit de `marketing/config/aprovador.pub.pem`.
2. **Credenciais da API Higgsfield** (só quando fores gerar a sério) — criar no console (console.higgsfield.ai) e pôr no ambiente de execução, nunca em ficheiros do repositório:
   ```
   # PowerShell (sessão atual)
   $env:HF_API_KEY_ID="..." ; $env:HF_API_KEY_SECRET="..."
   node marketing/bin/maquina.mjs verificar-credenciais   # não gera nada
   ```
3. **Teto mensal** (opcional): `marketing/config/limites.json` → `{ "teto_mensal_creditos": 500 }`.

## Uso

```
node marketing/bin/maquina.mjs ajuda
node marketing/bin/maquina.mjs validar <id>              # roteiro.md, storyboard.md, orcamento.md
node marketing/bin/maquina.mjs confirmar-precos <id>     # estimativa oficial (não gera)
node marketing/bin/maquina.mjs autorizar <id> --teto 60 --validade-horas 24   # SÓ TU, no teu terminal
node marketing/bin/maquina.mjs executar <id>             # simulação
node marketing/bin/maquina.mjs executar <id> --real      # envio real
node marketing/bin/maquina.mjs acompanhar <id> --real    # estados + download
node marketing/bin/maquina.mjs rejeitar <id> --cena c03 --motivo "Dôdo deformado"
node marketing/bin/maquina.mjs reconciliar <id> --unidade 1/c01#1 --request-id <id>
node marketing/bin/maquina.mjs capcut <id>               # pacote de montagem
node marketing/bin/maquina.mjs verificar-conhecimento    # base vs código
node --test marketing/tests/*.test.mjs                   # testes
```

## Travas de gasto
- **Planeador ≠ executor.** O planeador gera documentos e orçamento; não assina.
- **Autorização assinada (Ed25519)** com a chave privada do Kainan, cifrada por frase-passe e fora do repositório; o comando `autorizar` exige terminal interativo. O executor só aceita autorizações assinadas por essa chave.
- A autorização vincula **campanha + versão + hash do pacote** (cenas, referências com hash do ficheiro e do URL publicado, endpoint, parâmetros/prompt, quantidade, preço unitário) + **teto** + **validade**. Qualquer mudança relevante invalida-a.
- **Preço aplicável** confirmado pelo fornecedor antes de cada envio; se for maior que o autorizado, bloqueia. Sem preço, bloqueia.
- **Razão só-de-acrescentar** com trinco: reserva gravada antes do envio; `request_id` registado; timeout/erro de rede/5xx → estado incerto e paragem; nada é reenviado sem reconciliação; nenhuma regeração automática; custo reservado conta sempre (não se presume devolução).

## Entrega para o CapCut
`campanhas/<id>/entrega-capcut/v<versão>/`: `cenas/NN_cXX.*` numeradas (ou `_PENDENTE.txt`), `textos-ecra.csv`, `narracao/NN_cXX.txt` + `narracao-corrida.txt`, `legendas-narracao.srt`, `mapa-musical.csv`, `efeitos-transicoes.csv`, `00_LEIA-ME.md` com os passos. Montagem manual; não é um projeto nativo do CapCut (formato não documentado/validado).

## Dôdo
Os PNG/SVG em `assets/dodo/2d/` foram renderizados de `components/Mascot.tsx` (5 expressões × 7 faixas × 2 judogis). Se o componente mudar, voltar a renderizar e atualizar `conhecimento/04-dodo.md`.

## Limitações conhecidas
- A trava protege o caminho da **API**. O conector MCP do Higgsfield noutras apps (ex.: Cowork) é outro caminho, protegido só pela confirmação por chamada; no Claude Code deste repositório as ferramentas de geração dele estão negadas.
- Tudo corre na mesma conta do sistema operativo: um agente determinado podia substituir a chave pública e o código. As regras em `.claude/settings.json` e o histórico do git tornam isso visível, mas isolamento total exigiria aprovar noutra máquina/conta.
- Não há endpoint documentado de saldo da API; o "orçamento disponível" é o teto autorizado (e o teto mensal opcional), não o saldo real da conta.
