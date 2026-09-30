# Orçamento · exemplo-mundial-baku (versão 0.1)

> O orçamento é uma proposta do planeador. **Só o Kainan autoriza**, com `autorizar` no terminal.

| Cena | Endpoint | Qtd | Créditos/unid. | Fonte do preço | Data | Subtotal |
|---|---|---|---|---|---|---|
| c01 | `kling-video/v3.0-turbo/image-to-video` | 1 | ❓ não confirmado | — | — | — |

**Total máximo:** INDETERMINADO — faltam preços confirmados em c01
**Cenas sem custo de geração:** c02 (gravacao), c03 (motion (CapCut)), c04 (motion (CapCut)), c05 (asset (logótipo + Dôdo 2D))

Regras aplicadas pelo executor:
- o preço é reconfirmado no fornecedor antes de cada envio; se subir, bloqueia;
- falhas e cenas rejeitadas **não** são regeradas automaticamente;
- o custo reservado conta contra o teto mesmo que a geração falhe (não se presume devolução).

## Para autorizar

```
pacote: 96c3b29553eaf436abe13f224e5c3fef1c109d78cbba183cfac1a76fd0e1b1c4
```

No teu terminal (não no Claude):

```
node marketing/bin/maquina.mjs autorizar exemplo-mundial-baku --teto <créditos> --validade-horas <h>
```
