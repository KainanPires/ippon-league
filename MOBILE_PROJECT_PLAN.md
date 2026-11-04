# MOBILE_PROJECT_PLAN.md — Ippon League nas lojas

**Objetivo:** apps Android (Google Play) e iOS (App Store) ligadas à mesma conta, aos mesmos dados e ao mesmo backend do site.
**Princípio:** reutilizar o site atual. Nada é reconstruído e a produção não se altera sem autorização.

## Fases
1. **Auditoria** ✅ (ver `MOBILE_AUDIT.md`)
2. **Arquitetura**: aprovar `MOBILE_DECISIONS.md` (D-01 a D-06)
3. **Desenvolvimento** (ramo `mobile`):
   - eliminação de conta
   - compras escondidas na app
   - safe areas
   - TWA Android
   - casca Capacitor iOS
   - push nativo iOS
   - deep links
4. **Testes**: automáticos onde der; manuais em Android e iPhone físicos
5. **Contas e publicação**: Play Console, Apple Developer, fichas, políticas, AAB, TestFlight, teste fechado de 14 dias
6. **Lançamento e manutenção**: correções, rejeições, monitorização, novas versões

## Caminho crítico
Conta Play → build Android → **14 dias de teste fechado** → pedido de produção → publicação.
Tudo o resto (iOS incluído) corre em paralelo com esses 14 dias.

## Manutenção (depois do lançamento)
- Alterações de conteúdo e funcionalidades: deploy normal na Vercel, e as apps atualizam sozinhas.
- Só se gera uma nova build nas lojas quando mudar algo nativo (ícone, push, permissões, versão do SDK).
- Uma revisão de dependências por mês.
