# Campanhas

Uma pasta por campanha: `campanhas/<id>/`.

| Ficheiro | Quem escreve | Para quê |
|---|---|---|
| `plano.json` | conversa principal (com os especialistas) | roteiro, cenas, gerações, referências, preços — a fonte |
| `roteiro.md`, `storyboard.md`, `orcamento.md` | `maquina validar` | leitura do Kainan antes de autorizar |
| `pauta.md`, `revisao.md`, `carrossel.md` | conversa principal | entregas dos especialistas |
| `autorizacao-gasto.json` | **só** `maquina autorizar`, no terminal do Kainan (assinado) | autoriza gasto |
| `execucao/razao.jsonl` | só o executor | cada reserva, envio, request_id e estado |
| `saidas/` | executor (`acompanhar`) | ficheiros gerados |
| `entrega-capcut/` | `maquina capcut` | pacote de montagem |

Por defeito, tudo o que está aqui fica fora do git (ver `../.gitignore`) — o repositório é público.
`registro-resultados.csv` (resultados das peças publicadas) também fica aqui, fora do git; colunas em `../conhecimento/08-aprendizados.md`.
