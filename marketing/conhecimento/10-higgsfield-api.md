# 10 · Higgsfield — o que a documentação oficial diz

Consultado a **30/09/2026** em https://docs.higgsfield.ai (índice: `/docs/llms.txt`). Revalidar antes de mudar o cliente.

| Tema | Documentação oficial | Onde |
|---|---|---|
| Base | `https://api.higgsfield.ai` | api-reference/overview |
| Autenticação | `Authorization: Key <KEY_ID>:<KEY_SECRET>`; credenciais criadas no console; só em código de servidor; nunca em URLs ou registos | authentication |
| Envio | `POST https://api.higgsfield.ai/<endpoint-do-modelo>` com JSON; resposta `{status:"queued", request_id, status_url, cancel_url}` | quickstart, concepts/requests |
| Endpoints de modelo | dependem da conta; descobrir no console e na página de cada modelo (ex.: `kling-video/v3.0-turbo/image-to-video`: `prompt` ≤ 2500, `image_url` público, `duration` 3–15, `resolution` 720p/1080p) | models/kling-3/turbo-image-to-video |
| Estado | `GET /requests/{request_id}/status` → `queued`, `in_progress`, `completed`, `failed`, `nsfw`, `canceled` | api-reference/requests/get-request-status |
| Saídas | `images[].url`, `video.url`, `audio.url`, `audios[].url`; disponíveis ≥ 7 dias | concepts/requests, billing-and-retention |
| Cancelar | `POST /requests/{id}/cancel` — só enquanto `queued` | concepts/requests |
| Acompanhamento | polling 2 s → até 10 s com jitter; webhooks recomendados em produção | concepts/polling, how-to/webhooks |
| Estimativa | `POST /estimate/<endpoint-do-modelo>` com o mesmo corpo → `{credits, usd}` | concepts/billing-and-retention |
| Cobrança | cobra pedidos concluídos; `failed`/`nsfw` não cobrados e créditos reservados devolvidos; cancelamento em fila devolvido; créditos expiram 1 ano após entrada | concepts/billing-and-retention, errors |
| Idempotência | cabeçalho opcional `Idempotency-Key`; reutilizar com parâmetros diferentes → 422 | concepts/idempotency |
| Erros | 400, 401, 403 (financiar conta), 404, 422, 423, 500, 503 | concepts/errors |
| Limites de taxa | dependem da conta e do modelo | help/faq |

## Decisões do executor (mais conservadoras do que a documentação)
- **Não presume devolução**: o custo reservado conta contra o teto mesmo que a geração falhe.
- **Não confia na idempotência**: envia o cabeçalho (documentado), mas timeout/rede/5xx deixam a unidade "incerta" e bloqueiam novos envios até reconciliação. Nunca reenvia sozinho.
- **Preço aplicável** = estimativa oficial pedida imediatamente antes de cada envio; tem de ser ≤ preço autorizado.
- **Verificar credenciais sem gerar**: `GET /requests/<uuid inexistente>/status` → 404 = aceites, 401 = rejeitadas.

## O que a documentação NÃO esclarece (❓)
- Se os créditos da API são os mesmos da subscrição usada no site/conector MCP.
- Janela temporal da idempotência.
- Endpoint exato de cada modelo para esta conta (ver no console).

## Conector MCP (outro caminho)
O conector Higgsfield do Claude (usado a 30/09 para consultar saldo e preços com `get_cost`) gasta créditos da conta a cada geração e pede confirmação por chamada, a não ser que se ative "Always Allow". **Não passa pelo executor nem pela autorização assinada.** No Claude Code deste repositório, as ferramentas de geração do conector estão negadas em `.claude/settings.json`.
Preços vistos com `get_cost` a 30/09 (conta Plus, 5 s, 9:16): seedance_2_5 480p rascunho 15 · 720p 35 · 1080p 60; kling3_0 10; grok_video_v15 720p 22,5; gpt_image_2_5 0,25. Estes preços são do conector — o executor usa `/estimate` da API.
