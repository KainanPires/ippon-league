"use client";

// components/HubCarrossel.tsx
//
// O BLOG DO DÔDO, em carrossel — no fim do ecrã inicial.
//
// ---------------------------------------------------------------------------
// PORQUE EXISTE
//
// O plano original do projeto apontou a retenção entre competições como um dos
// riscos principais: "o utilizador precisa de voltar entre competições". Num dia
// sem judô, a app não tem nada a dizer. As notícias dão motivo para abrir.
//
// As notícias são geradas a partir dos dados (ver lib/gerarNoticias.ts) — não há
// ninguém a escrever, e não há custo por notícia.
//
// ---------------------------------------------------------------------------
// DETALHES QUE PARECEM PEQUENOS E NÃO SÃO
//
// PASSA SOZINHO, mas PARA quando se toca. Um carrossel que continua a andar
// enquanto a pessoa está a ler é a forma mais rápida de a irritar.
//
// RESPEITA QUEM PREFERE MENOS MOVIMENTO. Se o sistema tiver "reduzir movimento"
// ligado (uma preferência de acessibilidade), não roda sozinho de todo — quem a
// ativa costuma tê-la por uma razão, e uma dessas razões é enjoo com animações.
//
// NÃO APARECE VAZIO. Sem notícias, o componente não desenha nada. Um bloco a
// dizer "ainda não há notícias" é pior do que não haver bloco nenhum.
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
// O escudo das equipas é DESENHADO a partir de uma configuração, não é um
// ficheiro. Por isso vem no campo `dados` da notícia e é o componente que o
// desenha — ajusta-se a qualquer tamanho e não ocupa espaço nenhum.
import { Escudo, type Identity } from "@/components/Escudo";
// As notícias da região do leitor aparecem primeiro. Nenhuma é escondida — ver
// a nota em lib/ordenarNoticias.
import { ordenarPorRegiao } from "@/lib/ordenarNoticias";
import { useT } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

/** Cada tipo tem o seu ícone e cor — dá para reconhecer a notícia de relance. */
const ESTILO: Record<string, { icone: string; cor: string }> = {
  melhor_rodada: { icone: "🥇", cor: GOLD },
  atleta_destaque: { icone: "🔥", cor: "#e2655a" },
  valorizacao: { icone: "📈", cor: "#7fd1a3" },
  desvalorizacao: { icone: "📉", cor: "#ef8d83" },
  mais_escalado: { icone: "👥", cor: "#7fb8f5" },
  faixas: { icone: "🥋", cor: "#b79be0" },
  copa_campeao: { icone: "🏆", cor: GOLD },
  mais_rico: { icone: "💰", cor: GOLD },
  lider_pontos: { icone: "👑", cor: GOLD },
  percurso_campeao: { icone: "🏆", cor: GOLD },
  campeao_ano: { icone: "🏅", cor: GOLD },
  rico_ano: { icone: "💎", cor: GOLD },
  curiosidade: { icone: "💡", cor: "#aee9c9" },
};

interface Noticia {
  id: string;
  tipo: string;
  titulo: string;
  resumo: string | null;
  corpo: string;
  nome_competicao: string | null;
  pais: string | null;
  continente: string | null;
  imagem_url: string | null;   // só as escritas por pessoas têm
  dados: { escudo?: Identity | null } | null;
  estado: string;   // um EDITOR vê também as que ainda não estão no ar  // as geradas trazem o escudo da equipa
}

/** De quanto em quanto tempo passa. 6s: dá para ler um título sem pressa. */
const INTERVALO_MS = 6000;

/**
 * Quanto tempo fica parado depois de um gesto, antes de voltar a andar.
 *
 * 12 segundos — o dobro do intervalo normal. Quem acabou de escolher uma
 * notícia quer lê-la; retomar de imediato faria o trabalho dela desaparecer.
 * Mas também não pode parar para sempre: a rotação automática é o que dá vida
 * ao mural para quem só passa o olho.
 */
const PAUSA_APOS_GESTO = 12000;

export function HubCarrossel() {
  const t = useT();
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [i, setI] = useState(0);
  const [parado, setParado] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Onde o dedo tocou, e quanto andou. Serve para distinguir ARRASTAR de TOCAR:
  // o cartão inteiro é uma ligação, e sem esta distinção cada deslize abriria
  // uma notícia por engano.
  const toqueX = useRef<number | null>(null);
  const toqueY = useRef<number | null>(null);
  const arrastou = useRef(false);
  const retomaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ao sair do ecrã, não deixa temporizadores pendurados.
  useEffect(() => () => { if (retomaTimer.current) clearTimeout(retomaTimer.current); }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      // País do leitor, para as notícias da região dele virem primeiro.
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      let meuPais: string | null = null;
      let meuCont: string | null = null;
      if (uid) {
        const { data: u } = await supabase.from("users").select("country_code, continente").eq("id", uid).maybeSingle();
        meuPais = u?.country_code ? String(u.country_code) : null;
        meuCont = u?.continente ? String(u.continente) : null;
      }
      await supabase
      .from("hub_noticias")
      .select("id, tipo, titulo, resumo, corpo, nome_competicao, imagem_url, dados, pais, continente, estado")
      .order("destaque", { ascending: false })
      .order("criada_em", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (!vivo || !data) return;
        setNoticias(ordenarPorRegiao(data as Noticia[], meuPais, meuCont));
      });
    })();
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (noticias.length <= 1 || parado) return;
    // Preferência de acessibilidade: quem pede menos movimento não leva um
    // carrossel a rodar sozinho.
    try {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    } catch { /* sem matchMedia: segue */ }
    timer.current = setInterval(() => setI((x) => (x + 1) % noticias.length), INTERVALO_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [noticias.length, parado]);

  // --- Arrastar para mudar de notícia ---
  //
  // Num telemóvel, arrastar é o gesto natural para um carrossel — esperar 6
  // segundos ou acertar numa bolinha de 6px não é.
  //
  // 45px é o mínimo para contar como deslize. Abaixo disso é um toque com a mão
  // pouco firme, e deve abrir a notícia como qualquer toque.
  const MIN_ARRASTO = 45;

  function inicioToque(e: React.TouchEvent) {
    const tp = e.touches[0];
    toqueX.current = tp.clientX;
    toqueY.current = tp.clientY;
    arrastou.current = false;
    // Para ENQUANTO o dedo está em cima — não para sempre. As duas coisas
    // convivem: passa sozinho de 6 em 6 segundos, e quem quiser escolher
    // arrasta. Depois de largar, volta a andar (ver fimToque).
    setParado(true);
  }

  function moveToque(e: React.TouchEvent) {
    if (toqueX.current === null || toqueY.current === null) return;
    const dx = e.touches[0].clientX - toqueX.current;
    const dy = e.touches[0].clientY - toqueY.current;
    // Só conta como arrasto do carrossel se for mais horizontal que vertical —
    // senão estamos a impedir a pessoa de fazer scroll na página.
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) arrastou.current = true;
  }

  function fimToque(e: React.TouchEvent) {
    if (toqueX.current === null) { retomar(); return; }
    const dx = e.changedTouches[0].clientX - toqueX.current;
    toqueX.current = null;
    toqueY.current = null;
    if (arrastou.current && Math.abs(dx) >= MIN_ARRASTO) {
      // Roda em círculo: da última salta para a primeira, e ao contrário. Um
      // carrossel que trava nas pontas parece avariado.
      setI((x) => (dx < 0 ? (x + 1) % noticias.length : (x - 1 + noticias.length) % noticias.length));
    }
    retomar();
  }

  /**
   * Volta a andar sozinho, depois de uma pausa.
   *
   * Espera um pouco antes de retomar: se voltasse a rodar no instante em que o
   * dedo se levanta, a notícia que a pessoa acabou de escolher desaparecia
   * quase de imediato. Este intervalo dá tempo de a ler.
   */
  function retomar() {
    if (retomaTimer.current) clearTimeout(retomaTimer.current);
    retomaTimer.current = setTimeout(() => setParado(false), PAUSA_APOS_GESTO);
  }

  // Sem notícias, não desenha nada. Ver a nota no topo.
  if (noticias.length === 0) return null;

  const n = noticias[Math.min(i, noticias.length - 1)];
  const est = ESTILO[n.tipo] || ESTILO.curiosidade;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#cdb86a" }}>
          {t("hub.blogTitulo")}
        </span>
        <a href="/blog" style={{ fontFamily: FD, fontSize: 11.5, fontWeight: 700, color: GOLD, textDecoration: "none" }}>
          {t("hub.verTudo")}
        </a>
      </div>

      <a
        // Vai direto para ESTA notícia, não para a lista: quem toca quer ler o
        // que está a ver, não voltar a procurá-lo no meio de outras vinte.
        href={`/blog/${n.id}`}
        // Se foi um ARRASTO, não abre a notícia — só mudou de cartão. Sem isto,
        // cada deslize abriria a notícia por engano.
        onClick={(e) => { if (arrastou.current) { e.preventDefault(); arrastou.current = false; } }}
        // Para de rodar enquanto o dedo (ou o rato) está em cima: ninguém quer
        // que a notícia mude a meio da leitura.
        onMouseEnter={() => setParado(true)}
        onMouseLeave={() => retomar()}
        onTouchStart={inicioToque}
        onTouchMove={moveToque}
        onTouchEnd={fimToque}
        style={{ display: "block", background: "#121815", border: `1px solid ${est.cor}33`, borderLeft: `3px solid ${est.cor}`, borderRadius: 13, padding: "13px 14px", textDecoration: "none", color: "inherit", minHeight: 92 }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {/* Com imagem, mostra a imagem; sem ela, o ícone do tipo. As geradas
              nunca têm imagem — e o ícone dá-lhes identidade sem precisar de uma. */}
          {n.imagem_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={n.imagem_url} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
          ) : n.dados?.escudo ? (
            // Notícia sobre uma equipa: mostra o escudo dela. Vale muito mais
            // do que um ícone genérico — é a cara da pessoa no jogo.
            <span style={{ flexShrink: 0, display: "flex" }}><Escudo config={n.dados.escudo} size={44} /></span>
          ) : (
            <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.2 }} aria-hidden="true">{est.icone}</span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f1ede2", lineHeight: 1.3 }}>
              {/* Só um editor vê notícias por publicar. A marca evita que ele
                  pense que já está no ar o que ainda está à espera. */}
              {n.estado && n.estado !== "publicada" && (
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 5px", borderRadius: 4, background: "#2a1f1c", color: "#ef8d83", marginRight: 6, verticalAlign: "middle" }}>
                  {n.estado === "revisao" ? t("hub.aRever") : n.estado === "agendada" ? t("hub.agendada") : t("hub.rascunho")}
                </span>
              )}
              {n.titulo}
            </div>
            {/* Duas linhas e corta: o carrossel é uma montra, não o artigo. */}
            <p style={{ fontSize: 12.5, color: "#93a39a", lineHeight: 1.45, margin: "5px 0 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {n.resumo || n.corpo}
            </p>
          </div>
        </div>
      </a>

      {/* As bolinhas. Também servem de navegação — tocar salta para essa
          notícia e para a rotação, que é o que se espera ao interagir.
          Ao lado, uma dica de que se pode arrastar: um gesto que não se anuncia
          é um gesto que ninguém descobre. */}
      {noticias.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 9 }}>
          <span style={{ fontSize: 10, color: "#3c463f", marginRight: 2 }} aria-hidden="true">‹</span>
          {noticias.map((x, idx) => (
            <button
              key={x.id}
              onClick={() => { setI(idx); setParado(true); retomar(); }}
              aria-label={t("hub.noticiaDe", { n: idx + 1, total: noticias.length })}
              style={{
                width: idx === i ? 18 : 6, height: 6, borderRadius: 999, border: "none", padding: 0,
                background: idx === i ? GOLD : "#2a3a33",
                cursor: "pointer", transition: "width .25s, background .25s",
              }}
            />
          ))}
          <span style={{ fontSize: 10, color: "#3c463f", marginLeft: 2 }} aria-hidden="true">›</span>
        </div>
      )}
    </div>
  );
}
