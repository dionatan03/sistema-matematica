// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/* ========= Modal de Parabéns (sem revelar o número) ========= */
function CongratsModal({ open, onNext }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-[90%] max-w-sm pop-in">
        <h3 className="text-2xl font-extrabold text-center bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent text-charm">
          Parabéns! 🎉
        </h3>
        <p className="text-center mt-3">
          Você encontrou as <b>duas cartas corretas</b>!
        </p>
        <button
          onClick={onNext}
          className="mt-5 w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-md"
        >
          Vamos prosseguir ➜
        </button>
      </div>
    </div>
  );
}

/* ========= Seletor de Tema ========= */
function ThemePicker({ value, onChange }) {
  const Opt = ({ val, label, grad }) => (
    <button
      onClick={() => onChange(val)}
      className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm border transition ${
        value === val ? `text-white ${grad}` : "bg-white/70 hover:bg-white"
      }`}
      title={`Tema ${label}`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-2">
      <Opt val="padrao"   label="Padrão"   grad="bg-gradient-to-r from-fuchsia-500 to-orange-500" />
      <Opt val="oceano"   label="Oceano"   grad="bg-gradient-to-r from-cyan-500 to-indigo-500" />
      <Opt val="floresta" label="Floresta" grad="bg-gradient-to-r from-emerald-500 to-lime-500" />
    </div>
  );
}

/* ===== Player que aceita YouTube e MP4, com onEnded ===== */
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
function VideoPlayer({ url, onEnded }) {
  const isYT = isYouTube(url);
  const containerRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    return () => {
      try { playerRef.current?.destroy?.(); } catch {}
    };
  }, [url]);

  useEffect(() => {
    if (!isYT) return;
    let cancelled = false;

    (async () => {
      const YT = await loadYouTubeAPI();
      if (!YT || cancelled || !containerRef.current) return;
      const origin =
        typeof window !== "undefined" ? window.location.origin : undefined;

      containerRef.current.innerHTML = "";
      const div = document.createElement("div");
      div.style.width = "100%";
      div.style.height = "100%";
      containerRef.current.appendChild(div);

      playerRef.current = new YT.Player(div, {
        width: "100%",
        height: "100%",
        videoId: getYouTubeId(url) || undefined,
        playerVars: { rel: 0, playsinline: 1, origin },
        events: {
          onStateChange: (e) => {
            if (e?.data === YT.PlayerState.ENDED) onEnded?.();
          },
        },
      });
    })();

    return () => {
      cancelled = true;
      try { playerRef.current?.destroy?.(); } catch {}
    };
  }, [isYT, url, onEnded]);

  if (isYT) {
    return (
      <div className="aspect-video rounded-xl overflow-hidden bg-black/5 shadow-inner">
        <div ref={containerRef} className="w-full h-full" />
      </div>
    );
  }

  return (
    <div className="aspect-video rounded-xl overflow-hidden bg-black/5 shadow-inner">
      <video key={url} src={url} controls className="w-full h-full" onEnded={() => onEnded?.()} />
    </div>
  );
}

/* ===== Jogo: encontre 2 cartas que somam o alvo =====
   - Garante SEMPRE 1 par correto (a,b) e NENHUM outro par soma o alvo.
*/
function buildSumDeck(target, size = 10) {
  const deck = [];
  // Par correto
  const a = Math.floor(Math.random() * (target + 1));
  const b = target - a;
  deck.push(a, b);

  const maxNumber = Math.max(target + 20, 50); // espaço grande pra distratores
  while (deck.length < size) {
    const n = Math.floor(Math.random() * (maxNumber + 1)); // 0..maxNumber
    // impede duplicados
    if (deck.includes(n)) continue;
    // impede criar QUALQUER outro par válido com números já no deck
    let criaOutroPar = false;
    for (const d of deck) {
      if (d + n === target) { criaOutroPar = true; break; }
    }
    if (criaOutroPar) continue;
    deck.push(n);
  }

  // Embaralha
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  // Mapeia pra cartas
  return deck.map((value, idx) => ({ id: `card-${idx}`, value }));
}

function SumPairGame({ target, size = 10, onSolved }) {
  const [deck, setDeck] = useState(() => buildSumDeck(target, size));
  const [flipped, setFlipped] = useState([]);
  const [locked, setLocked] = useState(false);
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    setDeck(buildSumDeck(target, size));
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
        <h3 className="font-semibold text-lg">
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
              className={
                "h-24 rounded-2xl border transition shadow-sm " +
                (isFlipped
                  ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white border-indigo-600 scale-[1.02]"
                  : "bg-white hover:bg-indigo-50 border-indigo-200")
              }
              title="Clique para virar"
            >
              <div className="h-full w-full flex items-center justify-center text-2xl font-extrabold">
                {isFlipped ? card.value : "?"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ===== Dicas por operação (para a seção do TESTE) ===== */
function hintFor(question) {
  const q = question.replace(/\s/g, "");
  if (q.includes("+")) {
    return "Some os dois números. Dica: conte nos dedos ou com bolinhas. Ex.: 5 + 4 → faça 5 e conte mais 4: 6, 7, 8, 9.";
  }
  if (q.includes("-")) {
    return "Comece pelo número maior e tire o menor, contando para trás. Ex.: 9 − 4 → 9, 8, 7, 6, 5 (foram 4 passos).";
  }
  if (/[×x\*]/.test(q)) {
    return "Multiplicação é somar o mesmo número várias vezes. Ex.: 3 × 4 = 3 + 3 + 3 + 3 (quatro vezes) = 12.";
  }
  if (/[÷/]/.test(q)) {
    return "Divisão é repartir igualmente. Ex.: 12 ÷ 3 → separe 12 em 3 grupos com a mesma quantidade: 4 para cada.";
  }
  if (q.includes("√")) {
    return "Raiz quadrada é o número que multiplicado por ele mesmo dá o valor. Ex.: √81 → qual número × ele mesmo = 81? (9).";
  }
  return "Resolva a operação com calma. Se precisar, desenhe bolinhas ou use os dedos para contar.";
}

/* ===== Conteúdo ===== */
const conteudo = {
  facil: {
    videos: [
      { title: "Vamos aprender brincando: Somar e Subtrair (nível Fácil)", url: "https://www.youtube.com/watch?v=J_q2kLadcas" },
      { title: "Boas práticas para cálculo mental", url: "https://www.youtube.com/watch?v=TS7T4_4eggQ" },
    ],
    exemplos: [
      {
        pergunta: "2 + 3 = ?",
        comoResolver: "Você tem 2 balas 🍬🍬. Ganhou mais 3 🍬🍬🍬. Conte tudo: 1, 2, 3, 4, 5. Então 2 + 3 = 5.",
        resultado: "5",
      },
      {
        pergunta: "9 - 4 = ?",
        comoResolver: "Você tem 9 brinquedos 🧸… Empresta 4. Conte voltando: 9, 8, 7, 6, 5. Então 9 − 4 = 5.",
        resultado: "5",
      },
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
      { pergunta: "144 ÷ 12 = ?", comoResolver: "Sabendo 12×12=144, então 144 ÷ 12 = 12.", resultado: "12" },
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
      { pergunta: "(3 + 2) × (6 - 1) = ?", comoResolver: "Faça as contas dentro dos parênteses: 5 × 5 = 25.", resultado: "25" },
      { pergunta: "√121 = ?", comoResolver: "Qual número × ele mesmo dá 121? 11.", resultado: "11" },
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

/* ===== App ===== */
export default function App() {
  const [nivel, setNivel] = useState(null);
  const [etapa, setEtapa] = useState("inicio");
  const [idx, setIdx] = useState(0);
  const [acertos, setAcertos] = useState(0);
  const [desbloqueados, setDesbloqueados] = useState(() => {
    const saved = localStorage.getItem("mat_desbloqueados_v1");
    return saved ? JSON.parse(saved) : ["facil"];
  });
  // tema
  const [tema, setTema] = useState(() => localStorage.getItem("mat_tema_v1") || "padrao");
  useEffect(() => { localStorage.setItem("mat_tema_v1", tema); }, [tema]);

  // modal de Parabéns
  const [showCongrats, setShowCongrats] = useState(false);

  // trava "próximo vídeo" até terminar
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

  // desbloqueio >= 70%
  useEffect(() => {
    if (etapa !== "resultado" || !nivel) return;
    const prox = nivel === "facil" ? "medio" : nivel === "medio" ? "dificil" : null;
    if (prox && percentual >= 70 && !desbloqueados.includes(prox)) {
      setDesbloqueados((d) => [...d, prox]);
    }
  }, [etapa, nivel, percentual, desbloqueados]);

  const NivelButton = ({ label, value, color }) => {
    const locked =
      (value === "medio" && !desbloqueados.includes("medio")) ||
      (value === "dificil" && !desbloqueados.includes("dificil"));
    const palette =
      color === "blue"
        ? ["from-sky-400", "to-indigo-500"]
        : color === "yellow"
        ? ["from-amber-400", "to-orange-500"]
        : ["from-rose-400", "to-pink-500"];
    return (
      <button
        disabled={locked}
        onClick={() => iniciarNivel(value)}
        className={`p-4 rounded-2xl text-white font-bold transition shadow-md bg-gradient-to-br ${palette[0]} ${palette[1]} ${
          locked ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02]"
        }`}
        title={locked ? "Complete o nível anterior com 70% para desbloquear" : ""}
      >
        {label} {locked ? "🔒" : "🔓"}
      </button>
    );
  };

  return (
    <div className={`${tema === "oceano" ? "theme-oceano" : tema === "floresta" ? "theme-floresta" : ""} min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-sky-50 to-pink-50 bg-bolinhas`}>
      {/* Cabeçalho */}
      <header className="sticky top-0 z-10 backdrop-blur bg-white/60 border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <h1 className="text-xl sm:text-2xl font-extrabold bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-500 bg-clip-text text-transparent text-charm">
              Matemática Divertida
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-700 hidden sm:block">
              <span className="mr-3">Fácil {desbloqueados.includes("facil") ? "🔓" : "🔒"}</span>
              <span className="mr-3">Médio {desbloqueados.includes("medio") ? "🔓" : "🔒"}</span>
              <span>Difícil {desbloqueados.includes("dificil") ? "🔓" : "🔒"}</span>
            </div>
            <ThemePicker value={tema} onChange={setTema} />
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-6 w-full">
        <div className="w-full bg-white rounded-2xl shadow-lg p-6">
          {/* INÍCIO */}
          {etapa === "inicio" && (
            <div className="space-y-6">
              <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-pink-50 border p-4">
                <h2 className="text-xl font-extrabold bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent text-charm">
                  Como funciona?
                </h2>
                <p className="text-gray-700 mt-1">
                  Assista aos vídeos, veja exemplos e jogue o quiz. Para desbloquear o próximo nível, alcance <b>70%</b>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <NivelButton label="Fácil" value="facil" color="blue" />
                <NivelButton label="Médio" value="medio" color="yellow" />
                <NivelButton label="Difícil" value="dificil" color="red" />
              </div>
            </div>
          )}

          {/* VÍDEOS */}
          {etapa === "video" &&
            nivel &&
            conteudo[nivel].videos.length > 0 && (() => {
              const lista = conteudo[nivel].videos;
              const item = lista[idx] || lista[0];
              return (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-extrabold bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent text-charm">
                      Vídeos • {String(nivel).toUpperCase()}
                    </h2>
                    <span className="text-sm text-gray-600">
                      {Math.min(idx + 1, lista.length)}/{lista.length}
                    </span>
                  </div>

                  <VideoPlayer url={item.url} onEnded={() => setCanNextVideo(true)} />

                  <p className="text-gray-700">{item.title}</p>
                  {!canNextVideo && (
                    <p className="text-sm text-gray-500">
                      Assista ao vídeo até o fim para desbloquear o próximo.
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        const next = idx + 1;
                        if (next >= lista.length) {
                          setIdx(0);
                          setEtapa("exemplos");
                        } else {
                          setIdx(next);
                          setCanNextVideo(false);
                        }
                      }}
                      disabled={!canNextVideo}
                      className={`px-5 py-3 rounded-2xl text-white font-bold transition shadow-md ${
                        canNextVideo
                          ? "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                          : "bg-gray-300 cursor-not-allowed"
                      }`}
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
                <h2 className="text-xl font-extrabold bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent text-charm">
                  Exemplos • {nivel.toUpperCase()}
                </h2>
                <span className="text-sm text-gray-600">
                  {idx + 1}/{conteudo[nivel].exemplos.length}
                </span>
              </div>

              <div className="card-soft">
                <p className="font-bold mb-2 text-pink-600">
                  Pergunta: {conteudo[nivel].exemplos[idx].pergunta}
                </p>
                <p className="text-gray-700 mb-2">
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
                    if (next >= total) {
                      setIdx(0);
                      setEtapa("teste");
                    } else {
                      setIdx(next);
                    }
                  }}
                  className="btn btn-indigo"
                >
                  Entendi, próximo
                </button>
              </div>
            </div>
          )}

          {/* TESTE (cartas) */}
          {etapa === "teste" && nivel && (() => {
            const q = conteudo[nivel].quiz[idx];
            const alvo = Number(q.answer);

            const handleSolved = () => {
              setAcertos((a) => a + 1);
              setShowCongrats(true);
            };
            const goNext = () => {
              setShowCongrats(false);
              const next = idx + 1;
              if (next >= conteudo[nivel].quiz.length) {
                setIdx(0);
                setEtapa("resultado");
              } else {
                setIdx(next);
              }
            };

            return (
              <>
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-extrabold bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent text-charm">
                      Desafio de Cartas
                    </h2>
                    <span className="text-sm text-gray-700">
                      {idx + 1}/{conteudo[nivel].quiz.length}
                    </span>
                  </div>

                  <div className="card">
                    <p className="text-lg font-semibold">
                      <span className="mr-1">Pergunta:</span>
                      <span className="text-pink-600">{q.question} = ?</span>
                    </p>
                    <p className="mt-2 text-sm text-gray-700">
                      <b>Dica:</b> {hintFor(q.question)}
                    </p>
                  </div>

                  <SumPairGame target={alvo} size={10} onSolved={handleSolved} />
                </div>

                <CongratsModal open={showCongrats} onNext={goNext} />
              </>
            );
          })()}

          {/* RESULTADO */}
          {etapa === "resultado" && nivel && (
            <div className="space-y-6">
              <h2 className="text-xl font-extrabold">
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
                <button onClick={() => iniciarNivel(nivel)} className="px-5 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200">
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
                    <button onClick={() => iniciarNivel("medio")} className="btn btn-amber">
                      Ir para MÉDIO
                    </button>
                  )}
                  {nivel === "medio" && desbloqueados.includes("dificil") && (
                    <button onClick={() => iniciarNivel("dificil")} className="btn btn-rose">
                      Ir para DIFÍCIL
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Rodapé (sempre no fim graças ao flex layout) */}
      <footer className="mt-10 border-t bg-white/70">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-gray-600">
          Feito com ❤️ para crianças curiosas • © {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}