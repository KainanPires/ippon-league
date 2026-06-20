// app/chave/page.tsx
//
// A chave antiga foi substituída pela /chave-atletas (motor próprio + Paywall no
// servidor). Esta página deixa de existir como tal e redireciona quem lá chegar
// (por link antigo ou endereço direto) para a nova. Mantemos o ficheiro só para
// não quebrar endereços já partilhados.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ChaveAntigaRedirect() {
  redirect("/chave-atletas");
}
