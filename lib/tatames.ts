// lib/tatames.ts
//
// Os 5 temas de cor do tatame (personalização Pro Max). Fonte única de verdade:
// o Meu Time (grelha) e o seletor leem daqui.
//
// Cada tema tem a cor de DENTRO (área de combate) e a de FORA (área de segurança),
// cada uma com a sua borda. O tema "amarelo_azul" é o histórico (o que todos
// viam antes) e é o default — por isso quem nunca escolheu continua a vê-lo.

export type TatameId = "amarelo_azul" | "amarelo_vermelho" | "azul_vermelho" | "amarelo_verde" | "verde_vermelho";

export type Tatame = {
  id: TatameId;
  nome: string;
  foraBg: string;    // cor da área de fora (contentor exterior)
  foraBorda: string;
  dentroBg: string;  // cor da área de dentro (onde estão os atletas)
  dentroBorda: string;
};

export const TATAMES: Tatame[] = [
  { id: "amarelo_azul",     nome: "Amarelo / Azul",     foraBg: "#2f6fb3", foraBorda: "#25588f", dentroBg: "#e6b422", dentroBorda: "#f0cf6a" },
  { id: "amarelo_vermelho", nome: "Amarelo / Vermelho", foraBg: "#b33f3f", foraBorda: "#8f2525", dentroBg: "#e6b422", dentroBorda: "#f0cf6a" },
  { id: "azul_vermelho",    nome: "Azul / Vermelho",    foraBg: "#b33f3f", foraBorda: "#8f2525", dentroBg: "#2f6fb3", dentroBorda: "#4a90d9" },
  { id: "amarelo_verde",    nome: "Amarelo / Verde",    foraBg: "#3f9962", foraBorda: "#2f7d4f", dentroBg: "#e6b422", dentroBorda: "#f0cf6a" },
  { id: "verde_vermelho",   nome: "Verde / Vermelho",   foraBg: "#b33f3f", foraBorda: "#8f2525", dentroBg: "#3f9962", dentroBorda: "#5fb87f" },
];

export const TATAME_DEFAULT: TatameId = "amarelo_azul";

// Devolve sempre um tema válido (cai no default se o id for desconhecido/null).
export function tatamePorId(id: string | null | undefined): Tatame {
  return TATAMES.find((t) => t.id === id) ?? TATAMES[0];
}
