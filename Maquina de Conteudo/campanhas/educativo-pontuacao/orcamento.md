# Orçamento · educativo-pontuacao (versão 1)

> O orçamento é uma proposta do planeador. **Só o Kainan autoriza**, com `autorizar` no terminal.

| Cena | Endpoint | Qtd | Créditos/unid. | Fonte do preço | Data | Subtotal |
|---|---|---|---|---|---|---|
| c02 | `kling-video/v3.0-turbo/image-to-video` | 1 | ❓ não confirmado | — | — | — |
| c10 | `kling-video/v3.0-turbo/image-to-video` | 1 | ❓ não confirmado | — | — | — |

**Total máximo:** INDETERMINADO — faltam preços confirmados em c02, c10
**Cenas sem custo de geração:** c01 (motion (CapCut)), c03 (motion (CapCut)), c04 (motion (CapCut) + gravação de ecrã opcional de /como-jogar), c05 (motion (CapCut)), c06 (motion (CapCut)), c07 (motion (CapCut)), c08 (motion (CapCut) + gravação de ecrã do Meu Time (moldura de capitão)), c09 (motion (CapCut) + gravação de ecrã do ranking de uma liga (conta de teste) + barra de faixas)

Regras aplicadas pelo executor:
- o preço é reconfirmado no fornecedor antes de cada envio; se subir, bloqueia;
- falhas e cenas rejeitadas **não** são regeradas automaticamente;
- o custo reservado conta contra o teto mesmo que a geração falhe (não se presume devolução).

## Para autorizar

```
pacote: 7e3d147376073960b69118a0e5ed835218dd2f310455ea62a84ca6b954fcca8d
```

No teu terminal (não no Claude):

```
node marketing/bin/maquina.mjs autorizar educativo-pontuacao --teto <créditos> --validade-horas <h>
```
