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
