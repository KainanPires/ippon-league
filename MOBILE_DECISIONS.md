# MOBILE_DECISIONS.md — Registo de decisões

Formato: ID · data · estado (proposta / aprovada / rejeitada) · decisão · porquê.

| ID | Data | Estado | Decisão | Porquê |
|---|---|---|---|---|
| D-01 | 2026-11-04 | **Aprovada** | Não reconstruir. As apps carregam o site em produção (`www.ipponleague.com`): **TWA em Android**, **Capacitor (URL remota) em iOS** | Backend com 102 API routes, impossível exportar como estático; 100% do código reutilizado; deploys web atualizam as apps |
| D-02 | 2026-11-04 | **Aprovada** | **v1 das apps sem compras**: esconder Pro/Pro Max/Judocoins/loja quando a página está dentro da app | Stripe é proibido para bens digitais nas lojas; a faturação alternativa da Google na EEE exige empresa |
| D-03 | 2026-11-04 | **Aprovada** | iOS v1 **não** mostra funções Pro a quem pagou na web; Pro continua no site (Android: a rever com D-02) | 3.1.3(b) exige IAP disponível; mostrar dá risco de rejeição, esconder pode frustrar os assinantes |
| D-04 | 2026-11-04 | **Aprovada** | Adicionar eliminação de conta self-service (web + apps) antes de qualquer submissão | Obrigatório nas duas lojas |
| D-05 | 2026-11-04 | **Aprovada** | Todo o trabalho mobile num ramo `mobile` + Preview da Vercel; nada no ramo principal sem a tua autorização | Regra de segurança 1 e 7 |
| D-06 | 2026-11-04 | Proposta | Publicar como pessoa singular; avaliar empresa mais tarde (dispensa o teste de 14 dias em contas novas e permite faturação alternativa) | Pedido do fundador |
| D-07 | 2026-11-04 | **Aprovada** | Ao apagar a conta, ligas de amigos ativas criadas pela pessoa passam a um membro Pro; senão ao membro mais antigo (mesmo gratuito). Só são apagadas se não houver mais membros | Não destruir ligas de amigos |
| D-08 | 2026-11-04 | **Aprovada** | Eliminação cancela já a assinatura Stripe; `compras_judocoins` mantém-se (registo contabilístico); Academy apagada em cascata. **Quando a Academy for paga, a eliminação terá de cancelar também essa cobrança** | Academy ainda não é paga |
| D-09 | 2026-11-04 | **Aprovada** | No iPhone o nível "grátis" é **só de ecrã**: nunca dispara ações contra o assinante (ex.: o redirecionamento para `/resolver-ligas` fica desligado no iOS). Limitação conhecida da v1: no iPhone um Pro vê os limites do grátis ao criar ligas (o servidor continua a aplicar o nível real) | Encontrado no teste de 4 nov: um Pro Max foi enviado para "Resolve as tuas ligas" |
| D-10 | 2026-11-04 | **Aprovada** | Lançar v1 das apps **sem compras**; acrescentar compras na **v1.1** com Apple IAP + Google Play Billing (provavelmente via RevenueCat), ligadas a `is_pro`/`is_pro_max`/Judocoins na mesma base de dados. O site continua a vender pela Stripe | Lançamento mais rápido e primeira aprovação mais segura; IAP acrescenta 1–3 semanas e risco de rejeição |
