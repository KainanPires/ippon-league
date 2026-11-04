# MOBILE_RELEASE_CHECKLIST.md

## Comum
- [ ] Eliminação de conta dentro da app + URL web pública para pedir eliminação
- [ ] Sem compras Stripe nem links para pagamento visíveis nas apps (D-02)
- [ ] Política de privacidade e termos atualizados (apps, push, IA, analytics)
- [ ] Contacto de suporte (email + página)
- [ ] Conta de demonstração para os revisores (email/password) com dados preenchidos
- [ ] Ícone 1024×1024 e 512×512, sem transparência no iOS
- [ ] Capturas de ecrã (telemóvel 6,7"/6,5" iOS; telemóvel Android)
- [ ] Descrições em PT (e EN)
- [ ] Classificação etária (questionários das duas lojas)

## Google Play
- [ ] Conta pessoal verificada
- [ ] Package name definido (ex.: `com.ipponleague.app`), **não muda depois de publicado**
- [ ] AAB assinado; chave de upload guardada fora do repositório
- [ ] `/.well-known/assetlinks.json` em produção
- [ ] Data Safety preenchido
- [ ] Teste fechado: ≥12 testadores durante 14 dias seguidos
- [ ] Pedido de acesso a produção

## Apple
- [ ] Apple Developer individual ativo
- [ ] Bundle ID (ex.: `com.ipponleague.app`)
- [ ] Estado de trader DSA + morada/apartado, telefone e email
- [ ] Etiquetas de privacidade ("nutrition labels")
- [ ] Push (APNs) configurado
- [ ] `apple-app-site-association` em produção
- [ ] Build no TestFlight testada num iPhone real
- [ ] Notas para o revisor (funções nativas, multiplataforma)
