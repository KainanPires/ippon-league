// Fonte de dados de atletas (provisória, realista).
// Mais tarde substituímos esta lista por uma importação do JudoBase — sem mexer no ecrã.

export type Gender = "M" | "F";
export type AthleteStatus = "Elite" | "Em alta" | "Em baixa" | "Barganha" | "Aposta";

export type Athlete = {
  id: string;
  name: string;
  countryIso: string; // ISO2 (ex: JP, FR, BR, GE)
  gender: Gender;
  category: string; // ex: "-66" ou "+100" (sem "kg")
  priceJc: number;
  variation: number; // % (pode ser negativo)
  avg: number; // média
  last: number; // última pontuação
  status: AthleteStatus;
};

export const CATEGORIES: Record<Gender, string[]> = {
  M: ["-60", "-66", "-73", "-81", "-90", "-100", "+100"],
  F: ["-48", "-52", "-57", "-63", "-70", "-78", "+78"],
};

export const STATUS_LEGEND: { label: AthleteStatus; color: string; desc: string }[] = [
  { label: "Elite", color: "#d9a441", desc: "Dos melhores e mais caros." },
  { label: "Em alta", color: "#7fd1a3", desc: "A valorizar nas últimas rodadas." },
  { label: "Em baixa", color: "#ef8d83", desc: "A desvalorizar." },
  { label: "Barganha", color: "#7fb8f5", desc: "Bom preço para o que rende." },
  { label: "Aposta", color: "#b79be0", desc: "Barato e arriscado — pode surpreender." },
];

export const ATHLETES: Athlete[] = [
  // ===== Masculino =====
  { id: "m-smetov", name: "Yeldos Smetov", countryIso: "KZ", gender: "M", category: "-60", priceJc: 14.0, variation: 3, avg: 7.0, last: 9, status: "Elite" },
  { id: "m-nagayama", name: "Ryuju Nagayama", countryIso: "JP", gender: "M", category: "-60", priceJc: 13.5, variation: 5, avg: 6.8, last: 11, status: "Em alta" },
  { id: "m-mkheidze", name: "Luka Mkheidze", countryIso: "FR", gender: "M", category: "-60", priceJc: 9.0, variation: 7, avg: 5.6, last: 10, status: "Barganha" },

  { id: "m-habe", name: "Hifumi Abe", countryIso: "JP", gender: "M", category: "-66", priceJc: 18.5, variation: 6, avg: 8.2, last: 14, status: "Elite" },
  { id: "m-maruyama", name: "Joshiro Maruyama", countryIso: "JP", gender: "M", category: "-66", priceJc: 15.0, variation: -3, avg: 7.1, last: 4, status: "Em baixa" },
  { id: "m-cargnin", name: "Daniel Cargnin", countryIso: "BR", gender: "M", category: "-66", priceJc: 8.0, variation: 12, avg: 5.4, last: 11, status: "Aposta" },

  { id: "m-hashimoto", name: "Soichi Hashimoto", countryIso: "JP", gender: "M", category: "-73", priceJc: 12.5, variation: 9, avg: 6.8, last: 12, status: "Em alta" },
  { id: "m-heydarov", name: "Hidayat Heydarov", countryIso: "AZ", gender: "M", category: "-73", priceJc: 17.0, variation: 2, avg: 7.8, last: 9, status: "Elite" },
  { id: "m-shavdatuashvili", name: "Lasha Shavdatuashvili", countryIso: "GE", gender: "M", category: "-73", priceJc: 10.0, variation: -2, avg: 6.2, last: 5, status: "Em baixa" },

  { id: "m-grigalashvili", name: "Tato Grigalashvili", countryIso: "GE", gender: "M", category: "-81", priceJc: 17.5, variation: 4, avg: 7.9, last: 10, status: "Elite" },
  { id: "m-casse", name: "Matthias Casse", countryIso: "BE", gender: "M", category: "-81", priceJc: 16.0, variation: 1, avg: 7.6, last: 8, status: "Elite" },
  { id: "m-albayrak", name: "Vedat Albayrak", countryIso: "TR", gender: "M", category: "-81", priceJc: 7.0, variation: 8, avg: 5.0, last: 9, status: "Aposta" },

  { id: "m-bekauri", name: "Lasha Bekauri", countryIso: "GE", gender: "M", category: "-90", priceJc: 13.0, variation: 5, avg: 6.7, last: 10, status: "Em alta" },
  { id: "m-bobonov", name: "Davlat Bobonov", countryIso: "UZ", gender: "M", category: "-90", priceJc: 11.0, variation: 2, avg: 6.3, last: 8, status: "Barganha" },
  { id: "m-trippel", name: "Eduard Trippel", countryIso: "DE", gender: "M", category: "-90", priceJc: 8.5, variation: 6, avg: 5.5, last: 9, status: "Aposta" },

  { id: "m-wolf", name: "Aaron Wolf", countryIso: "JP", gender: "M", category: "-100", priceJc: 14.0, variation: 2, avg: 7.0, last: 8, status: "Elite" },
  { id: "m-kotsoiev", name: "Zelym Kotsoiev", countryIso: "AZ", gender: "M", category: "-100", priceJc: 13.5, variation: 7, avg: 6.9, last: 12, status: "Em alta" },
  { id: "m-liparteliani", name: "Varlam Liparteliani", countryIso: "GE", gender: "M", category: "-100", priceJc: 9.0, variation: -4, avg: 5.8, last: 3, status: "Em baixa" },

  { id: "m-riner", name: "Teddy Riner", countryIso: "FR", gender: "M", category: "+100", priceJc: 19.5, variation: 1, avg: 8.5, last: 9, status: "Elite" },
  { id: "m-tasoev", name: "Inal Tasoev", countryIso: "RU", gender: "M", category: "+100", priceJc: 15.0, variation: 4, avg: 7.4, last: 10, status: "Em alta" },
  { id: "m-tushishvili", name: "Guram Tushishvili", countryIso: "GE", gender: "M", category: "+100", priceJc: 10.0, variation: -2, avg: 6.1, last: 5, status: "Barganha" },

  // ===== Feminino =====
  { id: "f-krasniqi", name: "Distria Krasniqi", countryIso: "XK", gender: "F", category: "-48", priceJc: 16.0, variation: -4, avg: 7.5, last: 3, status: "Em baixa" },
  { id: "f-tsunoda", name: "Natsumi Tsunoda", countryIso: "JP", gender: "F", category: "-48", priceJc: 18.0, variation: 3, avg: 8.0, last: 11, status: "Elite" },
  { id: "f-koga", name: "Wakana Koga", countryIso: "JP", gender: "F", category: "-48", priceJc: 8.0, variation: 6, avg: 5.3, last: 9, status: "Aposta" },

  { id: "f-uabe", name: "Uta Abe", countryIso: "JP", gender: "F", category: "-52", priceJc: 19.0, variation: 5, avg: 8.6, last: 14, status: "Elite" },
  { id: "f-buchard", name: "Amandine Buchard", countryIso: "FR", gender: "F", category: "-52", priceJc: 14.0, variation: 2, avg: 7.2, last: 9, status: "Em alta" },
  { id: "f-giuffrida", name: "Odette Giuffrida", countryIso: "IT", gender: "F", category: "-52", priceJc: 10.0, variation: 4, avg: 6.0, last: 8, status: "Barganha" },

  { id: "f-deguchi", name: "Christa Deguchi", countryIso: "CA", gender: "F", category: "-57", priceJc: 16.5, variation: 7, avg: 7.2, last: 12, status: "Elite" },
  { id: "f-klimkait", name: "Jessica Klimkait", countryIso: "CA", gender: "F", category: "-57", priceJc: 15.0, variation: 1, avg: 7.0, last: 8, status: "Elite" },
  { id: "f-tamaoki", name: "Momo Tamaoki", countryIso: "JP", gender: "F", category: "-57", priceJc: 9.0, variation: 8, avg: 5.7, last: 10, status: "Aposta" },

  { id: "f-agbegnenou", name: "Clarisse Agbegnenou", countryIso: "FR", gender: "F", category: "-63", priceJc: 18.0, variation: 2, avg: 8.1, last: 10, status: "Elite" },
  { id: "f-trstenjak", name: "Tina Trstenjak", countryIso: "SI", gender: "F", category: "-63", priceJc: 12.0, variation: -2, avg: 6.6, last: 5, status: "Em baixa" },
  { id: "f-leski", name: "Andreja Leski", countryIso: "SI", gender: "F", category: "-63", priceJc: 11.0, variation: 6, avg: 6.2, last: 10, status: "Em alta" },

  { id: "f-matic", name: "Barbara Matic", countryIso: "HR", gender: "F", category: "-70", priceJc: 14.5, variation: 8, avg: 7.0, last: 12, status: "Em alta" },
  { id: "f-vandijke", name: "Sanne van Dijke", countryIso: "NL", gender: "F", category: "-70", priceJc: 11.0, variation: 2, avg: 6.3, last: 8, status: "Barganha" },
  { id: "f-gahie", name: "Marie-Eve Gahie", countryIso: "FR", gender: "F", category: "-70", priceJc: 12.5, variation: 3, avg: 6.7, last: 9, status: "Em alta" },

  { id: "f-malonga", name: "Madeleine Malonga", countryIso: "FR", gender: "F", category: "-78", priceJc: 13.0, variation: 3, avg: 6.8, last: 9, status: "Em alta" },
  { id: "f-aguiar", name: "Mayra Aguiar", countryIso: "BR", gender: "F", category: "-78", priceJc: 12.0, variation: -1, avg: 6.5, last: 6, status: "Barganha" },
  { id: "f-wagner", name: "Anna-Maria Wagner", countryIso: "DE", gender: "F", category: "-78", priceJc: 14.0, variation: 4, avg: 7.0, last: 10, status: "Elite" },

  { id: "f-sone", name: "Akira Sone", countryIso: "JP", gender: "F", category: "+78", priceJc: 18.5, variation: 2, avg: 8.0, last: 10, status: "Elite" },
  { id: "f-dicko", name: "Romane Dicko", countryIso: "FR", gender: "F", category: "+78", priceJc: 17.0, variation: 5, avg: 7.7, last: 12, status: "Em alta" },
  { id: "f-souza", name: "Beatriz Souza", countryIso: "BR", gender: "F", category: "+78", priceJc: 13.5, variation: 6, avg: 6.9, last: 12, status: "Em alta" },
];
