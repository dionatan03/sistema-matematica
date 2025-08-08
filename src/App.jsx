import React, { useEffect, useMemo, useRef, useState } from "react";

/* ========================= CONFIG FÁCIL: Nº DE CARTAS ========================= */
const CARD_COUNT = {
  facil: 6,
  medio: 8,
  dificil: 10,
};

/* ============================ MODAL PARABÉNS ============================ */
function CongratsModal({ open, onNext }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-[90%] max-w-sm pop-in">
        <h3 className="text-2xl font-extrabold text-center text-grad-title text-charm">
          Parabéns! 🎉
        </h3>
        <p className="text-center mt-3">
          Você encontrou a <b>resposta correta</b>!
        </p>
        <button onClick={onNext} className="mt-5 w-full btn-theme">
          Vamos prosseguir ➜
        </button>
      </div>
    </div>
  );
}

/* ============================ SELETOR DE TEMA ============================ */
function ThemePicker({ value, onChange }) {
  const Opt = ({ val, label, grad }) => (
    <button
      onClick={() => onChange(val)}
      className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm border transition ${value === val ? `text-white ${grad}` : "bg-white/70 hover:bg-white"
        }`}
      title={`Tema ${label}`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-2">
      <Opt val="padrao" label="Padrão" grad="bg-gradient-to-r from-fuchsia-500 to-orange-500" />
      <Opt val="oceano" label="Oceano" grad="bg-gradient-to-r from-cyan-500 to-indigo-500" />
      <Opt val="floresta" label="Floresta" grad="bg-gradient-to-r from-emerald-500 to-lime-500" />
      <Opt val="espaco" label="Espaço" grad="bg-gradient-to-r from-purple-600 to-blue-500" />
    </div>
  );
}

function isYouTube(url) {
  return /youtube\.com|youtu\.be/.test(url || "");
}
function getYouTubeId(url) {
  const m =
    (url || "").match(/[?&]v=([^&#]+)/) ||
    (url || "").match(/youtu\.be\/([^?&#/]+)/);
  return m ? m[1] : null;
}
function loadYouTubeAPI() {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.YT && window.YT.Player) {
      return resolve(window.YT);
    }
    if (typeof window === "undefined") return resolve(null);
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    document.head.appendChild(tag);
  });
}

// ==== VideoPlayer com barra de progresso e onEnded ====
function VideoPlayer({ url, onEnded }) {
  const isYT = isYouTube(url);
  const containerRef = React.useRef(null);
  const playerRef = React.useRef(null);
  const onEndedRef = React.useRef(onEnded);

  // manter callback atual sem recriar player
  React.useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  // destruir player só quando URL mudar / desmontar
  React.useEffect(() => {
    return () => { try { playerRef.current?.destroy?.(); } catch { } };
  }, [url]);

  // cria player quando (YouTube) e quando a URL muda
  React.useEffect(() => {
    if (!isYT) return;
    let cancelled = false;

    (async () => {
      const YT = await loadYouTubeAPI();
      if (!YT || cancelled || !containerRef.current) return;

      const origin =
        typeof window !== "undefined" ? window.location.origin : undefined;

      // limpar container e injetar alvo
      containerRef.current.innerHTML = "";
      const div = document.createElement("div");
      div.style.width = "100%";
      div.style.height = "100%";
      containerRef.current.appendChild(div);

      playerRef.current = new YT.Player(div, {
        host: "https://www.youtube-nocookie.com",
        width: "100%",
        height: "100%",
        videoId: getYouTubeId(url) || undefined,
        playerVars: {
          controls: 1,         // <-- mostra a barra de progresso
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          fs: 0,
          disablekb: 1,
          cc_load_policy: 0,
          playsinline: 1,
          origin,
        },
        events: {
          onStateChange: (e) => {
            if (e?.data === YT.PlayerState.ENDED) {
              onEndedRef.current?.(); // libera "Concluir vídeo"
            }
          },
        },
      });
    })();

    return () => {
      cancelled = true;
      try { playerRef.current?.destroy?.(); } catch { }
    };
  }, [isYT, url]);

// YouTube
if (isYT) {
  return (
    <div className="youtube-wrapper">
      <div ref={containerRef} className="yt-target" />
      <div className="yt-mask" aria-hidden="true" />
    </div>
  );
}



  // MP4 direto (também mantém barra nativa e onEnded)
  return (
    <div className="aspect-video rounded-xl overflow-hidden bg-black/5 shadow-inner">
      <video
        key={url}
        src={url}
        controls
        className="w-full h-full"
        onEnded={() => onEndedRef.current?.()}
      />
    </div>
  );
}


/* ======================= JOGO DE CARTAS (FÁCIL) ======================= */
function buildSumDeck(target, size = 6) {
  const deck = [];
  const a = Math.floor(Math.random() * (target + 1));
  const b = target - a;
  deck.push(a, b);

  const maxNumber = Math.max(target + 20, 50);
  while (deck.length < size) {
    const n = Math.floor(Math.random() * (maxNumber + 1));
    if (deck.includes(n)) continue;
    let criaOutroPar = false;
    for (const d of deck) {
      if (d + n === target) { criaOutroPar = true; break; }
    }
    if (criaOutroPar) continue;
    deck.push(n);
  }

  // embaralha
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.map((value, idx) => ({ id: `card-${idx}`, value }));
}

function SumPairGame({ target, size = 6, onSolved }) {
  const [deck, setDeck] = useState(() => buildSumDeck(target, size));
  const [flipped, setFlipped] = useState([]);
  const [locked, setLocked] = useState(false);
  const [moves, setMoves] = useState(0);

  // quando target ou size mudam, regenera com nova quantidade
  useEffect(() => {
    const novo = buildSumDeck(target, size);
    setDeck(novo);
    setFlipped([]);
    setLocked(false);
    setMoves(0);
  }, [target, size]);

  const handleClick = (idx) => {
    if (locked) return;
    if (flipped.includes(idx)) return;
    if (flipped.length === 2) return;
    setFlipped((f) => [...f, idx]);
  };

  useEffect(() => {
    if (flipped.length < 2) return;
    const [i, j] = flipped;
    const v1 = deck[i].value;
    const v2 = deck[j].value;
    setLocked(true);
    setMoves((m) => m + 1);

    const t = setTimeout(() => {
      if (v1 + v2 === target) {
        onSolved?.({ moves: moves + 1 });
      } else {
        setFlipped([]);
        setLocked(false);
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="display-title">
          Encontre <b>duas cartas</b> que somam o <b>resultado da pergunta</b>
        </h3>
        <div className="text-sm text-gray-600">
          Tentativas: <b>{moves}</b>
        </div>
      </div>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}
      >
        {deck.map((card, idx) => {
          const isFlipped = flipped.includes(idx);
          return (
            <button
              key={card.id}
              onClick={() => handleClick(idx)}
              disabled={locked && !isFlipped}
              className="card3d"
              title="Clique para virar"
            >
              <div className={`card-inner ${isFlipped ? "flipped" : ""}`}>
                <div className="card-face card-front">?</div>
                <div className="card-face card-back">{card.value}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ======================= JOGO MÉDIO: MÚLTIPLA ESCOLHA ======================= */
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}
function MultipleChoiceGame({ correta, onCorrect }) {
  const correct = String(correta);
  const [options, setOptions] = useState(() => {
    // 3 distratores próximos da correta
    const base = Number(correta);
    const pool = new Set([correct]);
    while (pool.size < 4) {
      const delta = Math.floor(Math.random() * 6) - 3; // -3..+2
      const cand = String(Math.max(0, base + delta));
      pool.add(cand);
    }
    return shuffle([...pool]);
  });
  const [feedback, setFeedback] = useState("");

  const choose = (val) => {
    if (String(val) === correct) {
      setFeedback("");
      onCorrect?.();
    } else {
      setFeedback("Ops! Tente outra opção 😉");
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {options.map((opt) => (
          <button key={opt} className="btn-theme" onClick={() => choose(opt)}>
            {opt}
          </button>
        ))}
      </div>
      {feedback && <p className="text-rose-600 text-sm">{feedback}</p>}
    </div>
  );
}

/* ======================= JOGO DIFÍCIL: TECLADO NUMÉRICO ======================= */
function KeypadGame({ correta, onCorrect }) {
  const correct = String(correta);
  const [val, setVal] = useState("");
  const press = (k) => {
    if (k === "C") return setVal("");
    if (k === "←") return setVal((s) => s.slice(0, -1));
    if (k === "OK") {
      if (val.trim() === correct) onCorrect?.();
      return;
    }
    if (val.length < 6) setVal((s) => s + k);
  };
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "C", "0", "OK"];

  return (
    <div className="space-y-3">
      <div className="card-var flex items-center justify-between">
        <input
          readOnly
          value={val}
          className="flex-1 bg-white rounded-xl border px-4 py-3 mr-3"
          placeholder="Sua resposta"
        />
        <button className="btn-theme" onClick={() => press("OK")}>Verificar</button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k) => (
          <button
            key={k}
            className={`rounded-2xl px-4 py-3 font-bold shadow-sm ${k === "OK" ? "btn-theme" : "bg-white border"
              }`}
            onClick={() => press(k)}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ======================= DICAS POR OPERAÇÃO ======================= */
function hintFor(question) {
  const q = question.replace(/\s/g, "");
  if (q.includes("+")) {
    return "Some os dois números. Dica: conte nos dedos ou com bolinhas. Ex.: 5 + 4 → faça 5 e conte mais 4: 6, 7, 8, 9.";
  }
  if (q.includes("-")) {
    return "Comece pelo número maior e tire o menor, contando para trás. Ex.: 9 − 4 → 9, 8, 7, 6, 5.";
  }
  if (/[×x\*]/.test(q)) {
    return "Multiplicação é somar o mesmo número várias vezes. Ex.: 3 × 4 = 3 + 3 + 3 + 3 = 12.";
  }
  if (/[÷/]/.test(q)) {
    return "Divisão é repartir igualmente: 12 ÷ 3 → 4 para cada grupo.";
  }
  if (q.includes("√")) {
    return "Raiz quadrada é o número que multiplicado por ele mesmo dá o valor. Ex.: √81 → 9×9=81.";
  }
  return "Resolva a operação com calma. Se precisar, desenhe bolinhas ou use os dedos.";
}

/* ======================= CONTEÚDO (10 questões p/ nível) ======================= */
const conteudo = {
  facil: {
    videos: [
      { title: "Vamos aprender brincando: Somar e Subtrair (nível Fácil)", url: "https://www.youtube.com/watch?v=J_q2kLadcas" },
      { title: "Boas práticas para cálculo mental", url: "https://www.youtube.com/watch?v=TS7T4_4eggQ" },
    ],
    exemplos: [
      { pergunta: "2 + 3 = ?", comoResolver: "Você tem 2 balas e ganha mais 3: conte 1,2,3,4,5.", resultado: "5" },
      { pergunta: "9 - 4 = ?", comoResolver: "Conte voltando 4 passos: 9,8,7,6,5.", resultado: "5" },
    ],
    quiz: [
      { question: "2 + 5", answer: "7" },
      { question: "9 - 4", answer: "5" },
      { question: "6 + 3", answer: "9" },
      { question: "8 - 2", answer: "6" },
      { question: "4 + 7", answer: "11" },
      { question: "12 - 5", answer: "7" },
      { question: "3 + 8", answer: "11" },
      { question: "15 - 9", answer: "6" },
      { question: "7 + 6", answer: "13" },
      { question: "14 - 7", answer: "7" },
    ],
  },
  medio: {
    videos: [
      { title: "Multiplicação e divisão", url: "https://www.youtube.com/watch?v=5MgKxBA1P40" },
    ],
    exemplos: [
      { pergunta: "12 × 3 = ?", comoResolver: "12 = 10 + 2 → 10×3 + 2×3 = 30 + 6 = 36.", resultado: "36" },
      { pergunta: "144 ÷ 12 = ?", comoResolver: "Se 12×12=144, então 144 ÷ 12 = 12.", resultado: "12" },
    ],
    quiz: [
      { question: "6 × 7", answer: "42" },
      { question: "81 ÷ 9", answer: "9" },
      { question: "15 × 4", answer: "60" },
      { question: "96 ÷ 12", answer: "8" },
      { question: "9 × 9", answer: "81" },
      { question: "7 × 8", answer: "56" },
      { question: "56 ÷ 7", answer: "8" },
      { question: "11 × 6", answer: "66" },
      { question: "72 ÷ 8", answer: "9" },
      { question: "12 × 12", answer: "144" },
    ],
  },
  dificil: {
    videos: [
      { title: "Expressões e raízes", url: "https://www.youtube.com/watch?v=H8jR9C6sXvE" },
    ],
    exemplos: [
      { pergunta: "(3 + 2) × (6 - 1) = ?", comoResolver: "Parênteses primeiro: 5 × 5 = 25.", resultado: "25" },
      { pergunta: "√121 = ?", comoResolver: "11 × 11 = 121 → √121 = 11.", resultado: "11" },
    ],
    quiz: [
      { question: "(4 + 6) × 2", answer: "20" },
      { question: "√169", answer: "13" },
      { question: "3 × (5 + 7)", answer: "36" },
      { question: "(18 ÷ 3) × 4", answer: "24" },
      { question: "√81 + 5", answer: "14" },
      { question: "√144", answer: "12" },
      { question: "(10 - 3) × 4", answer: "28" },
      { question: "9 × (2 + 1)", answer: "27" },
      { question: "100 ÷ (5 × 4)", answer: "5" },
      { question: "(6 + 6) × (3 - 1)", answer: "24" },
    ],
  },
};

/* =============================== APP =============================== */
export default function App() {
  const [nivel, setNivel] = useState(null);
  const [etapa, setEtapa] = useState("inicio");
  const [idx, setIdx] = useState(0);
  const [acertos, setAcertos] = useState(0);

  // desbloqueios
  const [desbloqueados, setDesbloqueados] = useState(() => {
    const saved = localStorage.getItem("mat_desbloqueados_v1");
    return saved ? JSON.parse(saved) : ["facil"];
  });

  // tema + hue (espaco)
  const [tema, setTema] = useState(() => localStorage.getItem("mat_tema_v1") || "padrao");
  useEffect(() => { localStorage.setItem("mat_tema_v1", tema); }, [tema]);
  const [hue, setHue] = useState(() => Number(localStorage.getItem("mat_hue_v1") || 260));
  useEffect(() => { localStorage.setItem("mat_hue_v1", String(hue)); }, [hue]);

  // modal
  const [showCongrats, setShowCongrats] = useState(false);

  // vídeo: bloquear até terminar
  const [canNextVideo, setCanNextVideo] = useState(false);

  const totalQuestoes = useMemo(
    () => (nivel ? conteudo[nivel].quiz.length : 0),
    [nivel]
  );
  const percentual = useMemo(
    () => (totalQuestoes > 0 ? Math.round((acertos / totalQuestoes) * 100) : 0),
    [acertos, totalQuestoes]
  );

  useEffect(() => {
    localStorage.setItem("mat_desbloqueados_v1", JSON.stringify(desbloqueados));
  }, [desbloqueados]);

  useEffect(() => {
    if (etapa === "video") setCanNextVideo(false);
  }, [etapa, idx, nivel]);

  useEffect(() => {
    if (!nivel || etapa !== "video") return;
    const total = conteudo[nivel]?.videos?.length ?? 0;
    if (total && idx >= total) setIdx(0);
  }, [nivel, etapa, idx]);

  const iniciarNivel = (n) => {
    setNivel(n);
    setEtapa("video");
    setIdx(0);
    setAcertos(0);
  };

  // desbloqueio >=70%
  useEffect(() => {
    if (etapa !== "resultado" || !nivel) return;
    const prox = nivel === "facil" ? "medio" : nivel === "medio" ? "dificil" : null;
    if (prox && percentual >= 70 && !desbloqueados.includes(prox)) {
      setDesbloqueados((d) => [...d, prox]);
    }
  }, [etapa, nivel, percentual, desbloqueados]);

  const NivelButton = ({ label, value }) => {
    const locked =
      (value === "medio" && !desbloqueados.includes("medio")) ||
      (value === "dificil" && !desbloqueados.includes("dificil"));
    return (
      <button
        disabled={locked}
        onClick={() => iniciarNivel(value)}
        className={`btn-theme w-full ${locked ? "opacity-50 cursor-not-allowed" : ""}`}
        title={locked ? "Complete o nível anterior com 70% para desbloquear" : ""}
      >
        {label} {locked ? "🔒" : "🔓"}
      </button>
    );
  };

  return (
    <div
      className={`${tema === "oceano" ? "theme-oceano" : tema === "floresta" ? "theme-floresta" : tema === "espaco" ? "theme-espaco" : ""} min-h-screen flex flex-col bg-theme`}
      style={tema === "espaco" ? { ["--hue"]: hue } : undefined}
    >
      {/* Cabeçalho centralizado */}
      <header className="sticky top-0 z-10 glass">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">🧠</span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-grad-title text-charm display-title">
              Matemática Divertida
            </h1>
          </div>

          <div className="mt-3 flex flex-col items-center justify-center gap-2">
            <ThemePicker value={tema} onChange={setTema} />
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <span className="pill pill-ok">Fácil {desbloqueados.includes("facil") ? "🔓" : "🔒"}</span>
              <span className="pill pill-warn">Médio {desbloqueados.includes("medio") ? "🔓" : "🔒"}</span>
              <span className="pill">Difícil {desbloqueados.includes("dificil") ? "🔓" : "🔒"}</span>
            </div>
          </div>

          {tema === "espaco" && (
            <div className="mt-3">
              <label className="block text-xs text-gray-700 mb-1 text-center">Cores do Espaço</label>
              <div className="max-w-md mx-auto">
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={hue}
                  onChange={(e) => setHue(Number(e.target.value))}
                  className="w-full hue-range"
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-6 w-full">
        <div className="w-full card-var">
          {/* INÍCIO */}
          {etapa === "inicio" && (
            <div className="space-y-6">
              <div className="card-var">
                <h2 className="text-xl font-extrabold text-grad-section display-title">Como funciona?</h2>
                <p className="text-gray-700 mt-1">
                  Assista aos vídeos, veja exemplos e jogue o quiz. Para desbloquear o próximo nível, alcance <b>70%</b>.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <NivelButton label="Fácil" value="facil" />
                <NivelButton label="Médio" value="medio" />
                <NivelButton label="Difícil" value="dificil" />
              </div>
            </div>
          )}

          {/* VÍDEOS */}
          {etapa === "video" && nivel && conteudo[nivel].videos.length > 0 && (() => {
            const lista = conteudo[nivel].videos;
            const item = lista[idx] || lista[0];
            return (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-extrabold text-grad-section display-title">
                    Vídeos • {String(nivel).toUpperCase()}
                  </h2>
                  <span className="pill pill-warn">
                    {Math.min(idx + 1, lista.length)}/{lista.length}
                  </span>
                </div>

                <VideoPlayer url={item.url} onEnded={() => setCanNextVideo(true)} />

                <p className="text-gray-800 font-medium">{item.title}</p>
                {!canNextVideo && (
                  <p className="text-sm text-gray-800 display-hint">
                    Assista ao vídeo até o fim para desbloquear o próximo.
                  </p>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      const next = idx + 1;
                      if (next >= lista.length) { setIdx(0); setEtapa("exemplos"); }
                      else { setIdx(next); setCanNextVideo(false); }
                    }}
                    disabled={!canNextVideo}
                    className={canNextVideo ? "btn-theme" : "btn-disabled"}
                  >
                    Concluir vídeo
                  </button>
                </div>
              </div>
            );
          })()}

          {/* EXEMPLOS */}
          {etapa === "exemplos" && nivel && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-extrabold text-grad-section display-title">
                  Exemplos • {nivel.toUpperCase()}
                </h2>
                <span className="pill pill-ok">
                  {idx + 1}/{conteudo[nivel].exemplos.length}
                </span>
              </div>

              <div className="card-var">
                <p className="font-bold mb-2 text-accent display-title">
                  Pergunta: {conteudo[nivel].exemplos[idx].pergunta}
                </p>
                <p className="text-gray-800 mb-2 display-hint">
                  Como resolver: {conteudo[nivel].exemplos[idx].comoResolver}
                </p>
                <p className="text-emerald-700 font-semibold">
                  Resposta: {conteudo[nivel].exemplos[idx].resultado}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    const next = idx + 1;
                    const total = conteudo[nivel].exemplos.length;
                    if (next >= total) { setIdx(0); setEtapa("teste"); }
                    else { setIdx(next); }
                  }}
                  className="btn-theme"
                >
                  Entendi, próximo
                </button>
              </div>
            </div>
          )}

          {/* TESTE (jogos por nível) */}
          {etapa === "teste" && nivel && (() => {
            const q = conteudo[nivel].quiz[idx];
            const alvo = Number(q.answer);

            const onAcertou = () => {
              setAcertos((a) => a + 1);
              setShowCongrats(true);
            };
            const proxima = () => {
              setShowCongrats(false);
              const next = idx + 1;
              if (next >= conteudo[nivel].quiz.length) { setIdx(0); setEtapa("resultado"); }
              else { setIdx(next); }
            };

            return (
              <>
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-extrabold text-grad-section display-title">
                      {nivel === "facil" ? "Desafio de Cartas" : nivel === "medio" ? "Múltipla escolha" : "Teclado numérico"}
                    </h2>
                    <span className="pill pill-warn">
                      {idx + 1}/{conteudo[nivel].quiz.length}
                    </span>
                  </div>

                  <div className="card-var">
                    <p className="text-lg font-bold text-accent display-title">
                      {q.question} = ?
                    </p>
                    <p className="mt-2 text-sm text-gray-800 display-hint">
                      <b>Dica:</b> {hintFor(q.question)}
                    </p>
                  </div>

                  {nivel === "facil" ? (
                    <SumPairGame target={alvo} size={CARD_COUNT.facil} onSolved={onAcertou} />
                  ) : nivel === "medio" ? (
                    <MultipleChoiceGame correta={q.answer} onCorrect={onAcertou} />
                  ) : (
                    <KeypadGame correta={q.answer} onCorrect={onAcertou} />
                  )}
                </div>

                <CongratsModal open={showCongrats} onNext={proxima} />
              </>
            );
          })()}

          {/* RESULTADO */}
          {etapa === "resultado" && nivel && (
            <div className="space-y-6">
              <h2 className="text-xl font-extrabold display-title">
                Resultado • {nivel.toUpperCase()}
              </h2>

              <div className="progress">
                <div className="progress-fill" style={{ width: `${percentual}%` }} />
              </div>

              <p className="text-lg">
                Você acertou <b>{acertos}</b> de <b>{conteudo[nivel].quiz.length}</b> • <b>{percentual}%</b>
              </p>

              {nivel !== "dificil" && (
                <div className={`p-4 rounded-xl shadow-sm ${percentual >= 70 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {percentual >= 70
                    ? "Parabéns! Próximo nível desbloqueado. 🎉"
                    : "Alcance pelo menos 70% para desbloquear o próximo nível."}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button onClick={() => iniciarNivel(nivel)} className="btn-theme">
                  Rever conteúdo do nível
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setEtapa("inicio"); setNivel(null); setIdx(0); setAcertos(0); }}
                    className="px-5 py-3 rounded-2xl bg-gray-800 text-white hover:bg-black"
                  >
                    Voltar ao início
                  </button>
                  {nivel === "facil" && desbloqueados.includes("medio") && (
                    <button onClick={() => iniciarNivel("medio")} className="btn-theme">
                      Ir para MÉDIO
                    </button>
                  )}
                  {nivel === "medio" && desbloqueados.includes("dificil") && (
                    <button onClick={() => iniciarNivel("dificil")} className="btn-theme">
                      Ir para DIFÍCIL
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Rodapé */}
      <footer className="border-t bg-white/70">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-gray-600">
          Feito com ❤️ para crianças curiosas • © {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}