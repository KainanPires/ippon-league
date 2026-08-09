import { defineConfig, globalIgnores } from "eslint/config";

import nextVitals from "eslint-config-next/core-web-vitals";

import nextTs from "eslint-config-next/typescript";

// ---------------------------------------------------------------------------
// A REGRA DO NÍVEL DE SUBSCRIÇÃO
//
// O nível (is_pro / is_pro_max) vive na TABELA `users`. Nunca no user_metadata.
//
// O webhook da Stripe escreve em `public.users`. O user_metadata deixou de ser
// sincronizado quando o is_pro saiu do trigger ippon_sync_user — e ficou lá
// congelado com o valor que tinha antes de a pessoa pagar, normalmente false.
//
// Quem lê do metadata vê um subscritor que pagou como se fosse gratuito. O bug
// não dá erro nenhum: a página simplesmente oferece a comprar o que ele já tem,
// ou bloqueia o que ele já pagou.
//
// Foi encontrado em CINCO ficheiros: /api/liga, /criar-liga, /oficial/[tipo],
// /sobre-pro e /api/copa/podio. Todos corrigidos, mas nada impedia o sexto.
//
// A REGRA CERTA:
//   • no cliente  -> useNivel()        (lib/useNivel.ts)
//   • no servidor -> nivelDoPedido()   ou uma consulta a `users`
//
// O que continua livre: user_metadata.nome, .tutoriais, .pais_iso,
// .app_instalado, .desempenhos_vistos, .faixa. São preferências e dados
// informativos, e o metadata é o sítio certo para eles. Só o NÍVEL é proibido.
// ---------------------------------------------------------------------------

const MENSAGEM =
  "O nível de subscrição não se lê do user_metadata — ele deixou de ser sincronizado e mostra false a quem pagou. " +
  "Usa useNivel() no cliente ou nivelDoPedido() / uma consulta a `users` no servidor. " +
  "Ver o cabeçalho do lib/useNivel.ts.";

const proibirNivelNoMetadata = [
  // u.user_metadata.is_pro   e   u?.user_metadata?.is_pro_max
  {
    selector:
      'MemberExpression[object.property.name="user_metadata"][property.name=/^is_pro(_max)?$/]',
    message: MENSAGEM,
  },

  // A forma que apareceu nos cinco ficheiros:
  //   const meta = sess.session?.user?.user_metadata as { is_pro?: boolean };
  //
  // Aqui o is_pro nunca aparece colado ao user_metadata — é lido depois, via
  // `meta?.is_pro`. Sem esta segunda regra, os cinco casos reais passavam todos.
  {
    selector: 'TSAsExpression TSPropertySignature[key.name=/^is_pro(_max)?$/]',
    message: MENSAGEM,
  },

  // A mesma ideia, mas declarada em vez de assertada:
  //   const meta: { is_pro?: boolean } = ...
  {
    selector:
      'TSTypeAnnotation > TSTypeLiteral > TSPropertySignature[key.name=/^is_pro(_max)?$/]',
    message: MENSAGEM,
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,

  ...nextTs,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...proibirNivelNoMetadata],
    },
  },

  {
    // As DUAS peças autorizadas a falar do assunto:
    //   • useNivel.ts é a fonte oficial do nível no cliente
    //   • o webhook da Stripe é a única peça que dá e tira acesso
    //
    // Se alguma delas precisar de mexer nestes campos, é legítimo. Qualquer
    // outro ficheiro tem de passar por elas.
    files: ["lib/useNivel.ts", "app/api/stripe/webhook/route.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
]);

export default eslintConfig;
