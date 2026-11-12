// app/api/admin/importar-molduras/route.ts
//
// IMPORTAÇÃO EM LOTE DAS MOLDURAS (chave_atletas) — ferramenta do fundador para
// montar as chaves de uma competição a partir dos prints oficiais da IJF, sem ter
// de colocar centenas de atletas à mão no editor.
//
// Os pools vêm aqui definidos por NOME (na ordem da chave da IJF). O endpoint
// resolve nome -> id_person a partir do atletas_cache da competição, aplica os
// byes automáticos (calcByes, igual ao editor) e grava em chave_atletas com o
// MESMO formato que o editor usa { A, B, C, D, byes:{A,B,C,D} }.
//
//   GET /api/admin/importar-molduras?key=<CRON_SECRET>&comp=3159
//        &seco=1   -> ENSAIO: só mostra o que casaria e o que NÃO casou, sem gravar.
//        &cat=-60  -> só essa categoria (para testar uma de cada vez).
//
// Anti-erro: uma categoria só é gravada se TODOS os nomes dela casarem. As que
// tiverem nomes por casar ficam de fora e aparecem no relatório (com sugestões
// de nomes parecidos do cache, para corrigir).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function autorizado(key: string | null): boolean {
  const a = process.env.CRON_SECRET;
  const b = process.env.LEMBRETE_CRON_SECRET;
  if (!key) return false;
  return (!!a && key === a) || (!!b && key === b);
}

const norm = (s: unknown): string =>
  String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Byes automáticos: os primeiros (próxima potência de 2 − n) atletas da ordem.
// Igual ao calcByes do editor — garante que o nº de slots é potência de 2 e o
// motor nunca encrava.
function calcByes(order: string[]): string[] {
  const n = order.length;
  if (n <= 1) return [];
  let pow = 1;
  while (pow < n) pow *= 2;
  return order.slice(0, pow - n);
}

type Pools = { A: string[]; B: string[]; C: string[]; D: string[] };
type CatMold = { genero: "M" | "F"; pools: Pools };

// ---------------------------------------------------------------------------
// MOLDURAS — por NOME, na ordem da chave oficial (cima -> baixo de cada pool).
// Zagreb Grand Prix (3159), MASCULINO.
// ---------------------------------------------------------------------------
const MOLDURAS: Record<string, CatMold> = {
  "-60": { genero: "M", pools: {
    A: ["Michel Augusto", "Wei-Jie Chiu", "Abdulrahman Alsaiari", "David Starkel", "Olivier Naert", "Bart Weling", "James Zahra"],
    B: ["Dilshot Khalmatov", "Asier Murillo Martinez De Lizarrondo", "Ivan Simeonov", "Andrea Carlino", "Aman Bakytzhan", "Harsh Singh", "Joshua Yang", "Ariel Shulman"],
    C: ["Yung Wei Yang", "Yehonatan Veksler", "Lyuboslav Grigorov", "Luis Barroso Lopez", "Daniel Leutgeb", "Maximilian Heyder", "Rodrigo Barrios"],
    D: ["Luka Mkheidze", "Murad Muradli", "Emiel Jaring", "Nuradil Alzhan", "Csanad Feczko", "Joshua Katz", "Charlie Ayre", "Ksawery Ignasiak"],
  }},
  "-66": { genero: "M", pools: {
    A: ["Ronald Lima", "Roko Rozga", "Klajdi Bitri", "Petros Christodoulides", "Vas Middleton", "Julien Frascadore", "Bence Pongracz", "Joaquin Tovagliari", "Chong-You Lin", "Lenny Sheynfeld"],
    B: ["Daikii Bouba", "Nizami Imranov", "Vadym Chernov", "Matteo Piras", "Carl-Gustav Kont", "Azizbek Ortikov", "Felipe Dacruz", "Abderrahmane Boushita", "Adam Anastasopoulos", "Matan Kokolayev", "Charlie Young"],
    C: ["Valerio Accogli", "Adam Jazan", "Kelvin Ray", "Matija Jeremic", "Alexandru Matei", "Georgios Balarjishvili", "Turan Bayramov", "Florian Boecker", "Narmandakh Bayanmunkh", "Kristian Butuci", "Bence Mathe"],
    D: ["Nurkanat Serikbayev", "Minoru Tamashiro", "Franco Baltazar", "Dani Klacar", "Robin Jara", "Chrystian Silva", "Adrian Nieto Chinarro", "Michael Fryer", "Miguel Nery Gago", "Nazar Viskov", "Jochem Van Harten"],
  }},
  "-73": { genero: "M", pools: {
    A: ["Hassan Doukkali", "Chusniddin Karimov", "Nathan Cadignan", "Nariman Mirzayev", "Valtteri Olin", "Benjamin Levy", "Abdul Malik Umayev", "Akil Gjakova", "Lucian Bors Dumitrescu", "Serhii Nebotov", "Jusuf Nurkovic", "Alexander Bernd Gabler", "Alen Hristov", "Karim Abdulaev", "Niels Thijssen"],
    B: ["Justin Lemire", "Karim Adarvez", "Morgan Errboe", "Martin Hojak", "Davit Liparteliani Gugava", "Bakhitzhan Abdurakhmanov", "Aron Gabor", "Yehonatan Elbaz", "Nikolaos Gkinis", "Robert Klacar", "Jeferson Santos Junior", "Juan Hernandez", "Anthony De Angelis", "Giorgi Loladze"],
    C: ["Messaoud Redouane Dris", "Ioan Dzitac", "Oscar Pertelson", "Nikola Zorotovic", "Anton Shuhalieiev", "Otari Kvantidze", "Ohad Moritz", "Guilherme De Oliveira", "Tomas Sosa", "Ray Marinx", "Petar Radovic", "Cheng-Yu Lin", "Joshua Green", "Balint Gombas"],
    D: ["Ethan Nairne", "Kevin Abeltshauser", "Luka Brici", "Daniyar Shamshayev", "Dardan Cena", "Luka Katic", "Rufat Shovlatov", "Said-Magomed Khalidov", "Tomas Demcak", "Giorgi Terashvili", "Konstantinos Tsaparas", "Mark Hristov", "Maxime Gobert", "Georgios Kalaitsidis"],
  }},
  "-81": { genero: "M", pools: {
    A: ["Francois Gauthier Drapeau", "Alain Mikael Aprahamian", "Martin Brekke-Jenssen", "Giorgi Sherazadishvili", "Adrian Gandia", "Vladyslav Kolobov", "Oskari Makinen", "Arnaud Aregba", "Ante Ivan Begic", "Nouh Lahmouri"],
    B: ["Arslonbek Tojiev", "Magamed Borchashvili", "Thien Oulevey", "Georgii Elbakiev", "Igor Tsurkan", "David Lima", "Bright Maddaloni Nosa", "Itay Bibitko", "Rory Tyrrell", "Jon Vrenozi"],
    C: ["Mykhailo Svidrak", "Gabriel Falcao", "Ramon Hernandez Jr", "Alpha Oumar Djalo", "Nace Herkovic", "Aurelien Bonferroni", "Jose Maria Mendiola Izquieta", "Odysseas Georgakis", "Luke Davies", "Gilberto Cardoso"],
    D: ["Murodjon Yuldoshev", "Samuel Daniel Olaiya", "Antonio Esposito", "Aris Zaragkas", "Luka Zorotovic", "Zaur Dvalashvili", "Aleksa Bubalo", "Jahja Nurkovic", "Agustin Gil", "Olivier Gagnon"],
  }},
  "-90": { genero: "M", pools: {
    A: ["Guilherme Schimidt", "Kevin Budain", "George Rotaru", "Peng-Yu Chen", "Bruno Rozga", "John Jayne", "Gadzhimurad Omarov", "Keagan Young", "Medickson Del Orbe Cortorreal", "Yermakhan Anuarbekov"],
    B: ["Kenny Komi Bedel", "Roy Sivan", "Artem Bubyr", "Josip Bulic", "Gergely Nerpel", "Alex Barto", "Daniel Paz Albarracin", "Yuta Galarreta", "Lachlan Moorhead", "Radomir Musil", "Aharon Santamaria Rodriguez"],
    C: ["Rafael Macedo", "Dominik Druzeta", "Davlat Bobonov", "Vasilije Grujicic", "Novo Raicevic", "Luka Javakhishvili", "Vlad Visan", "Nurzhan Bissenov", "Peter Zilka", "Kornelius Eilertsen"],
    D: ["Theodoros Tselidis", "Peter Safrany", "Vugar Talibov", "Segev Ben Haroch", "Ian Van Herk", "Thomas Scharfetter", "Daniel Nieto Trinidad", "Artur Kanevets", "Lovre Mrkovic", "Noah Christiaens"],
  }},
  "-100": { genero: "M", pools: {
    A: ["Anton Savytskiy", "Bogdan Petre", "Martin Bezdek", "Ronald Proell", "Francisco Balanta", "Darko Brasnjovic", "Maksims Duinovs", "Oliver Barratt", "Jean Carletti", "Peter Kenderesi"],
    B: ["Daniel Eich", "Daryl Yamamoto", "Azhdar Baghirov", "Michael Korrel", "Nikoloz Sherazadishvili", "Bozidar Vucurevic", "Aristos Michael", "Benjamin Mataseje", "Boris Georgiev"],
    C: ["Dzhafar Kostoev", "Yaroslav Davydchuk", "Nikola Pavlovski", "Tornike Poladishvili", "Jorge Fonseca", "Giovani Ferreira", "Max Gregory", "Mathias Madsen", "Vojin Mandic", "George Udsilauri"],
    D: ["Zsombor Veg", "Gal Bertalanic Zizek", "Adam Borchashvili", "Koussay Ben Ghares", "Iosif Simin", "Tanou Mamadou Keita", "Ivan Rozga", "Joes Schell", "Piotr Kuczera"],
  }},
  "+100": { genero: "M", pools: {
    A: ["Ushangi Kokauri", "Igor Vracar", "Moustapha Fofana", "Yakiv Khammo", "Yerassyl Kazhybayev", "John Messe A Bessong", "Gabriel Arevalo"],
    B: ["Losseni Kone", "Darius Dobre", "Jelle Snippe", "Mikita Sviryd", "Harun Sadikovic", "Stephan Hegyi"],
    C: ["Kanan Nasibov", "Mortaza Suha", "Zhantilek Nurtilepuly", "Tieman Diaby", "Mohammed Lahboub", "Mohamed El Mehdi Lili", "Tommaso Fava"],
    D: ["Saba Inaneishvili", "Movli Borchashvili", "Marius Fizel", "Yevheniy Balyevskyy", "Vidak Maljevic", "Andrey Coelho", "Levente Dobos"],
  }},
};

export async function GET(req: Request) {
  const t0 = Date.now();
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  const { searchParams } = new URL(req.url);
  if (!autorizado(searchParams.get("key"))) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  const comp = (searchParams.get("comp") || "3159").trim();
  const seco = searchParams.get("seco") === "1";
  const soCat = (searchParams.get("cat") || "").trim();

  // Cache de atletas da competição -> mapa nome normalizado -> { id, name, cat, gen }
  const { data: cacheRow } = await supabaseAdmin
    .from("atletas_cache").select("atletas").eq("id_competition", comp).maybeSingle();
  const lista = Array.isArray(cacheRow?.atletas) ? (cacheRow!.atletas as Array<Record<string, unknown>>) : [];
  if (lista.length === 0) {
    return NextResponse.json({ ok: false, erro: `Sem atletas no cache para a competição ${comp}.` }, { status: 400 });
  }
  const porNome = new Map<string, { id: string; name: string; cat: string; gen: string }>();
  const todos: Array<{ id: string; name: string; cat: string; gen: string; nn: string }> = [];
  for (const a of lista) {
    const id = a?.id != null ? String(a.id) : "";
    const name = String(a?.name || "");
    if (!id || !name) continue;
    const rec = { id, name, cat: String(a?.category || ""), gen: String(a?.gender || "") };
    const nn = norm(name);
    porNome.set(nn, rec);
    todos.push({ ...rec, nn });
  }

  // Sugestões para um nome que não casou: candidatos que partilham o último
  // token (apelido) OU uma palavra, dentro do mesmo género.
  const sugerir = (nome: string, gen: string): string[] => {
    const toks = norm(nome).split(" ").filter(Boolean);
    const last = toks[toks.length - 1] || "";
    const set = new Set(toks);
    return todos
      .filter((c) => c.gen.toUpperCase() === gen && (c.nn.includes(last) || c.nn.split(" ").some((w) => set.has(w))))
      .map((c) => c.name)
      .slice(0, 5);
  };

  const cats = Object.keys(MOLDURAS).filter((c) => !soCat || c === soCat);
  const relatorio: Array<Record<string, unknown>> = [];
  let gravadas = 0;

  for (const cat of cats) {
    const mold = MOLDURAS[cat];
    const poolsIds: Pools = { A: [], B: [], C: [], D: [] };
    const misses: Array<{ nome: string; pool: string; sugestoes: string[] }> = [];
    let total = 0;
    for (const p of ["A", "B", "C", "D"] as const) {
      for (const nome of mold.pools[p]) {
        total++;
        const rec = porNome.get(norm(nome));
        if (rec) poolsIds[p].push(rec.id);
        else misses.push({ nome, pool: p, sugestoes: sugerir(nome, mold.genero) });
      }
    }
    const byes = {
      A: calcByes(poolsIds.A), B: calcByes(poolsIds.B),
      C: calcByes(poolsIds.C), D: calcByes(poolsIds.D),
    };
    const poolsObj = { ...poolsIds, byes };
    const ok = misses.length === 0;

    let gravou: string | null = null;
    if (ok && !seco) {
      const { data: ex } = await supabaseAdmin
        .from("chave_atletas").select("id").eq("id_competicao", comp).eq("weight_category", cat).maybeSingle();
      if (ex?.id) {
        const { error } = await supabaseAdmin.from("chave_atletas").update({ genero: mold.genero, pools: poolsObj }).eq("id", ex.id);
        gravou = error ? `erro: ${error.message}` : "atualizada";
      } else {
        const { error } = await supabaseAdmin.from("chave_atletas").insert({ id_competicao: comp, weight_category: cat, genero: mold.genero, pools: poolsObj });
        gravou = error ? `erro: ${error.message}` : "criada";
      }
      if (gravou === "criada" || gravou === "atualizada") gravadas++;
    }

    relatorio.push({
      cat, genero: mold.genero, total,
      casados: total - misses.length,
      tamanhos: { A: poolsIds.A.length, B: poolsIds.B.length, C: poolsIds.C.length, D: poolsIds.D.length },
      byes: { A: byes.A.length, B: byes.B.length, C: byes.C.length, D: byes.D.length },
      por_casar: misses,
      estado: seco ? (ok ? "pronta (ensaio)" : "tem nomes por casar") : (gravou ?? "não gravada (nomes por casar)"),
    });
  }

  return NextResponse.json({
    ok: true, comp, modo: seco ? "ensaio" : "gravacao",
    categorias: cats.length, gravadas, atletas_no_cache: lista.length,
    relatorio, ms: Date.now() - t0,
  });
}
