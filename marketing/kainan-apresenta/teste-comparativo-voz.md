# Teste comparativo de voz para o avatar · v1 (01/10/2026)

**Texto (igual para todas as versões):**
- o roteiro de 15 s (`templates/exemplos/demo-ka-15s.plano.json`), com 35 palavras e ≈ 13 s;
- as 3 frases de avaliação do conjunto C (`voz/textos/teste-captacao-v1.md`), ≈ 15 s.

**Ordem obrigatória:** primeiro o áudio de cada versão é **aprovado**, depois gera-se o avatar com ele. Em V1 a HeyGen gera voz e boca juntas.

| Versão | Voz | Como entra no avatar | Para que serve |
|---|---|---|---|
| **V0 · referência** | gravação real do Kainan, editada sem respiros | carregar o áudio no avatar (upload de áudio **a confirmar** no plano) | padrão-ouro de sincronia e identidade; testa também o caminho "Kainan grava, avatar aparece" |
| **V1** | clone de voz **da HeyGen** (feito com o áudio da gravação de treino) | nativo | uma só ferramenta |
| **V2** | clone **ElevenLabs** (clone instantâneo com o conjunto A) | voz importada na HeyGen por chave de API da ElevenLabs (integração documentada) **ou** áudio exportado e carregado | qualidade de voz ElevenLabs + avatar HeyGen |

**Avaliação às cegas** (o Kainan não sabe qual é qual):
- semelhança com a voz real;
- naturalidade;
- interpretação (segue a direção?);
- pronúncia (ippon, waza-ari, shido, Judocoins);
- **sincronia da boca**;
- **custo por vídeo aprovado**, incluindo novas tentativas.

Registrar tudo em `voz/avaliacoes.csv`.

## Consumo estimado (verificar no dia — preços mudam)
| Ferramenta | O que | Estimativa | Fonte |
|---|---|---|---|
| HeyGen | 3 versões × ≈ 28 s de avatar (15 s + frases C) ≈ 1,4 min de Avatar IV | ≈ **28 créditos premium** (20 créditos/min) | artigo de 22/09/2026 sobre os preços da HeyGen (fonte secundária: confirmar na conta) |
| HeyGen — plano | Creator: US$ 29/mês, 600 créditos; o grátis pode bastar para o piloto (3 vídeos de até 1 min) | US$ 0–29 | heygen.com/pricing (01/10/2026) |
| ElevenLabs | clone instantâneo + ≈ 500 caracteres de fala | plano Starter (US$ 6/mês) cobre; confirmar se o Starter dá **chave de API** para a integração com a HeyGen | elevenlabs.io/pricing (01/10/2026) |
| Gravação do Kainan, edição e análise | — | custo zero | — |

**Decisão:** escolher **uma** combinação. Só manter HeyGen + ElevenLabs se V2 ganhar com folga em semelhança/naturalidade **e** o custo por vídeo aprovado compensar.
