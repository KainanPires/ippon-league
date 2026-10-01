# Máquina de Conteúdo · regras para o Claude (área `marketing/`)

Esta pasta é a ferramenta interna de marketing. **Não faz parte do jogo**: não é importada por `app/`, `lib/` nem `components/`, e não é servida aos jogadores. Nunca alterar código do jogo a partir de um trabalho de marketing.

## Papéis
- **Conversa principal (tu)**: coordena o fluxo, dá contexto a cada especialista, grava as entregas em `marketing/campanhas/<id>/` e corre os comandos de planeamento.
- **Especialistas** (`.claude/agents/`): `ippon-produto`, `ippon-estrategia`, `ippon-roteiro`, `ippon-direcao`, `ippon-carrossel`, `ippon-revisao`. Só leem; devolvem texto.
- **Kainan**: aprova pautas e roteiros e é o **único** que autoriza gasto, no terminal dele, com `autorizar`.

## Fluxo
1. Ideia/dúvida/objetivo → `ippon-estrategia` → gravar `pauta.md` → **P1: Kainan aprova a pauta**.
2. `ippon-roteiro` (cenas, textos, narração) + `ippon-produto` (factos) + `ippon-direcao` (composição, câmara, prompts, referências, som) → montar `plano.json` a partir de `marketing/templates/plano.modelo.json`.
3. Vídeo → `node marketing/bin/maquina.mjs validar <id>` (gera roteiro.md, storyboard.md, orcamento.md). Carrossel → `ippon-carrossel` → `carrossel.md`.
4. `ippon-revisao` → gravar `revisao.md`. Só com "APROVADO PARA O KAINAN" se apresenta ao Kainan.
5. Preços: `confirmar-precos <id>` (estimativa oficial, não gera; precisa de credenciais). Sem preço confirmado não há autorização.
6. **P2: o Kainan autoriza no terminal dele.** Tu nunca corres `autorizar`, nunca escreves `autorizacao-gasto.json`, nunca lês `~/.ippon-marketing/`.
7. `executar <id>` (simulação) → mostrar ao Kainan. Só depois, e se ele pedir, `executar <id> --real`.
8. `acompanhar <id> --real` → rever cenas com o Kainan (**P3**). Cena má → `rejeitar`. **Nunca** propor regenerar sem nova autorização.
9. `capcut <id>` → pacote de montagem. Kainan monta e aprova (**P4**). Resultados → `08-aprendizados.md` e `registro-resultados.csv` (**P5**).

## Voz e narração
Módulo permanente em `conhecimento/11-voz-e-narracao.md`; perfil e avaliações em `voz/`. Narração contínua (sem respiros), direção vocal por trecho, bloco contínuo para copiar, faixas separadas. Nunca afirmar que um clone ou API existe sem ter executado e verificado.

## Proibido
- Gerar pelo conector MCP do Higgsfield (as ferramentas de geração estão negadas em `.claude/settings.json`). Consultas (`balance`, `models_explore`, `get_cost`) são permitidas.
- Reenviar uma geração depois de timeout/erro: corre `reconciliar` e mostra ao Kainan.
- Inventar endpoints, parâmetros, preços, regras do jogo ou funcionalidades.
- Pôr credenciais, frases-passe, e-mails ou dados de utilizadores em ficheiros, commits ou mensagens.
- Commitar planos de campanha, razões ou referências com nomes de utilizadores (o repositório é público — ver `marketing/.gitignore`).
