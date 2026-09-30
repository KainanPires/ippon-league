# config

- `aprovador.pub.pem` — chave pública do aprovador (Kainan). Criada por `gerar-chaves`. Versionar. Só o Kainan a substitui.
- `limites.json` (opcional, fora do git) — `{ "teto_mensal_creditos": 500 }`.

A chave privada NUNCA fica aqui: vive em `~/.ippon-marketing/aprovador.key`, cifrada com a frase-passe do Kainan.
