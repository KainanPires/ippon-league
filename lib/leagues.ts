import { DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
export type LeagueFormat = "pontos" | "copa";
// Privacidade da liga:
//   "aberta"          → aparece no mercado e qualquer um entra direto
//   "mediante_pedido" → aparece no mercado, mas o dono aprova quem entra
//   "fechada"         → não aparece no mercado; só se entra por código
export type LeaguePrivacy = "fechada" | "aberta" | "mediante_pedido";
export type MyLeague = {
  id: string;
  name: string;
  format: LeagueFormat;
  formatName: string; // nome dado pelo criador (ex.: "Copa do Dojo")
  privacy: LeaguePrivacy;
  cfg: Identity; // escudo da liga
  inviteCode: string;
  createdAt: number;
};
const KEY = "ippon_my_leagues";
export function loadLeagues(): MyLeague[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
export function saveLeagues(list: MyLeague[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}
export function addLeague(l: MyLeague) {
  const list = loadLeagues();
  list.unshift(l);
  saveLeagues(list);
}
export function newInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
export function newId(): string {
  return "lg_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
export const DEFAULT_LEAGUE_SHIELD: Identity = {
  ...DEFAULT_IDENTITY,
  name: "A minha liga",
  bg1: "#1c3a2e",
  bg2: "#102a20",
  border: "#d9a441",
  symbol: "trofeu",
};
