# Orçamento · montei-e-agora (versão 1.5)

> O orçamento é uma proposta do planeador. **Só o Kainan autoriza**, com `autorizar` no terminal.

| Cena | Endpoint | Qtd | Créditos/unid. | Fonte do preço | Data | Subtotal |
|---|---|---|---|---|---|---|
| c01 | `kling3_0` | 1 | 8.75 | Higgsfield (conector Cowork) get_cost — kling3_0, 9:16, 5 s, pro, sem som, sem imagem | 2026-09-30 | 8.75 |
| c10 | `kling3_0` | 1 | 8.75 | Higgsfield (conector Cowork) get_cost — kling3_0, 9:16, 5 s, pro, sem som, sem imagem | 2026-09-30 | 8.75 |

**Total máximo:** 17.5 créditos
**Cenas sem custo de geração:** c02 (motion (estúdio de cenas) + Dôdo 2D), c03 (motion (estúdio de cenas)), c04 (motion (estúdio de cenas)), c05 (motion (estúdio de cenas)), c06 (motion (estúdio de cenas)), c07 (motion (estúdio de cenas)), c08 (motion (estúdio de cenas)), c09 (motion (estúdio de cenas))

Regras aplicadas pelo executor:
- o preço é reconfirmado no fornecedor antes de cada envio; se subir, bloqueia;
- falhas e cenas rejeitadas **não** são regeradas automaticamente;
- o custo reservado conta contra o teto mesmo que a geração falhe (não se presume devolução).

## Para autorizar

```
pacote: e1769738de82778d5366c50384e4abbc22f7ab25961f0150ed42e4ba43f6330f
```

No teu terminal (não no Claude):

```
node marketing/bin/maquina.mjs autorizar montei-e-agora --teto <créditos> --validade-horas <h>
```
