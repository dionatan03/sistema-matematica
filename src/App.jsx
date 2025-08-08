import React, { useEffect, useMemo, useRef, useState } from "react";

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

function VideoPlayer({ url, title, onEnded }) {
  const isYT = isYouTube(url);
  const containerRef = useRef(null);
  const playerRef = useRef(null);

  // limpa player ao trocar url
  useEffect(() => {
    return () => {
      try { playerRef.current?.destroy?.(); } catch {}
    };
  }, [url]);

  // YouTube IFrame API
  useEffect(() => {
    if (!isYT) return;
    let cancelled = false;

    (async () => {
      const YT = await loadYouTubeAPI();
      if (!YT || cancelled || !containerRef.current) return;

      const origin =
        typeof window !== "undefined" ? window.location.origin : undefined;

      // limpa container e injeta player
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
      <div className="aspect-video rounded-lg overflow-hidden bg-black/5">
        <div ref={containerRef} className="w-full h-full" />
      </div>
    );
  }

  // MP4 direto
  return (
    <div className="aspect-video rounded-lg overflow-hidden bg-black/5">
      <video
        key={url}
        src={url}
        controls
        className="w-full h-full"
        onEnded={() => onEnded?.()}
      />
    </div>
  );
}

/* ===== Conteúdo ===== */
const conteudo = {
  facil: {
    videos: [
      { title: "Vamos aprender brincando: Somar e Subtrair em nível Fácil", url: "https://www.youtube.com/watch?v=J_q2kLadcas" },
      { title: "Boas práticas para cálculo mental", url: "https://www.youtube.com/watch?v=TS7T4_4eggQ" },
    ],
    exemplos: [
      { pergunta: "2 + 3 = ?", comoResolver: "Some 2 com 3: 2,3,4,5 → 5.", resultado: "5" },
      { pergunta: "9 - 4 = ?", comoResolver: "Tire 4 de 9: 9→8→7→6→5.", resultado: "5" },
    ],
    quiz: [
      { question: "2 + 2", answer: "4" },
      { question: "5 - 3", answer: "2" },
      { question: "7 + 1", answer: "8" },
      { question: "10 - 6", answer: "4" },
      { question: "3 + 4", answer: "7" },
    ],
  },
  medio: {
    videos: [
      { title: "Multiplicação e divisão", url: "https://www.youtube.com/watch?v=5MgKxBA1P40" },
    ],
    exemplos: [
      { pergunta: "12 × 3 = ?", comoResolver: "12=10+2 → 10×3 + 2×3 = 36.", resultado: "36" },
      { pergunta: "144 ÷ 12 = ?", comoResolver: "12×12=144 → 144 ÷ 12 = 12.", resultado: "12" },
    ],
    quiz: [
      { question: "6 × 7", answer: "42" },
      { question: "81 ÷ 9", answer: "9" },
      { question: "15 × 4", answer: "60" },
      { question: "96 ÷ 12", answer: "8" },
      { question: "9 × 9", answer: "81" },
    ],
  },
  dificil: {
    videos: [
      { title: "Expressões e raízes", url: "https://www.youtube.com/watch?v=H8jR9C6sXvE" },
    ],
    exemplos: [
      { pergunta: "(3 + 2) × (6 - 1) = ?", comoResolver: "5×5 = 25.", resultado: "25" },
      { pergunta: "√121 = ?", comoResolver: "11×11=121 → √121=11.", resultado: "11" },
    ],
    quiz: [
      { question: "(4 + 6) × 2", answer: "20" },
      { question: "√169", answer: "13" },
      { question: "3 × (5 + 7)", answer: "36" },
      { question: "(18 ÷ 3) × 4", answer: "24" },
      { question: "√81 + 5", answer: "14" },
    ],
  },
};

/* ===== App ===== */
export default function App() {
  const [nivel, setNivel] = useState(null);         // "facil" | "medio" | "dificil"
  const [etapa, setEtapa] = useState("inicio");     // "inicio" | "video" | "exemplos" | "teste" | "resultado"
  const [idx, setIdx] = useState(0);                // índice do item atual
  const [input, setInput] = useState("");
  const [acertos, setAcertos] = useState(0);
  const [historico, setHistorico] = useState([]);
  const [desbloqueados, setDesbloqueados] = useState(() => {
    const saved = localStorage.getItem("mat_desbloqueados_v1");
    return saved ? JSON.parse(saved) : ["facil"];
  });

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

  // garante idx válido ao entrar em "video"
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
    setHistorico([]);
    setInput("");
  };

  const proximoVideo = () => {
    const lista = conteudo[nivel].videos;
    const next = idx + 1;
    if (next >= lista.length) {
      setIdx(0);
      setEtapa("exemplos");
    } else {
      setIdx(next);
    }
  };

  const proximoExemplo = () => {
    const lista = conteudo[nivel].exemplos;
    const next = idx + 1;
    if (next >= lista.length) {
      setIdx(0);
      setEtapa("teste");
    } else {
      setIdx(next);
    }
  };

  const responder = () => {
    const q = conteudo[nivel].quiz[idx];
    const correta = String(q.answer).trim();
    const resposta = String(input).trim();
    const certo = resposta === correta;

    setHistorico((h) => [...h, { etapa: "teste", pergunta: q.question, resposta, correta, certo }]);
    if (certo) setAcertos((a) => a + 1);
    setInput("");
    const next = idx + 1;
    if (next >= conteudo[nivel].quiz.length) {
      setEtapa("resultado");
    } else {
      setIdx(next);
    }
  };

  // desbloqueio >= 70%
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
        className={`p-3 rounded text-white font-medium transition ${
          value === "facil"
            ? "bg-blue-600 hover:bg-blue-700"
            : value === "medio"
            ? "bg-yellow-600 hover:bg-yellow-700"
            : "bg-red-600 hover:bg-red-700"
        } ${locked ? "opacity-50 cursor-not-allowed" : ""}`}
        title={locked ? "Complete o nível anterior com ≥ 70% para desbloquear" : ""}
      >
        {label} {locked ? "🔒" : "🔓"}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg p-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Sistema de Matemática</h1>
          <div className="text-sm text-gray-600">
            Níveis:{" "}
            <span className="mr-2">Fácil {desbloqueados.includes("facil") ? "🔓" : "🔒"}</span>
            <span className="mr-2">Médio {desbloqueados.includes("medio") ? "🔓" : "🔒"}</span>
            <span>Difícil {desbloqueados.includes("dificil") ? "🔓" : "🔒"}</span>
          </div>
        </div>

        {/* INÍCIO */}
        {etapa === "inicio" && (
          <div className="space-y-4">
            <p className="text-gray-700">
              Assista aos vídeos, veja os exemplos e depois faça o teste. Para desbloquear o próximo nível,
              alcance <b>≥ 70%</b>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <NivelButton label="Fácil" value="facil" />
              <NivelButton label="Médio" value="medio" />
              <NivelButton label="Difícil" value="dificil" />
            </div>
          </div>
        )}

        {/* VÍDEOS */}
        {etapa === "video" &&
          nivel &&
          Array.isArray(conteudo[nivel]?.videos) &&
          conteudo[nivel].videos.length > 0 && (
            (() => {
              const lista = conteudo[nivel].videos;
              const item = lista[idx] || lista[0];
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Vídeos • {String(nivel).toUpperCase()}</h2>
                    <span className="text-sm text-gray-600">
                      {Math.min(idx + 1, lista.length)}/{lista.length}
                    </span>
                  </div>

                  <VideoPlayer
                    url={item?.url}
                    title={item?.title}
                    onEnded={() => setCanNextVideo(true)}
                  />

                  <p className="text-gray-700">{item?.title || "Vídeo"}</p>

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
                        }
                      }}
                      disabled={!canNextVideo}
                      className={`px-4 py-2 rounded text-white transition ${
                        canNextVideo ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 cursor-not-allowed"
                      }`}
                    >
                      Concluir vídeo
                    </button>
                  </div>
                </div>
              );
            })()
          )}

        {/* EXEMPLOS */}
        {etapa === "exemplos" && nivel && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Exemplos • {nivel.toUpperCase()}</h2>
              <span className="text-sm text-gray-600">
                {idx + 1}/{conteudo[nivel].exemplos.length}
              </span>
            </div>

            <div className="rounded-lg border p-4">
              <p className="font-medium mb-2">
                Pergunta: {conteudo[nivel].exemplos[idx].pergunta}
              </p>
              <p className="text-gray-700 mb-2">
                Como resolver: {conteudo[nivel].exemplos[idx].comoResolver}
              </p>
              <p className="text-emerald-700">
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
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
              >
                Entendi, próximo
              </button>
            </div>
          </div>
        )}

        {/* TESTE */}
        {etapa === "teste" && nivel && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Teste • {nivel.toUpperCase()}</h2>
              <span className="text-sm text-gray-600">
                {idx + 1}/{conteudo[nivel].quiz.length}
              </span>
            </div>

            <div className="w-full h-2 bg-gray-200 rounded">
              <div
                className="h-2 bg-indigo-600 rounded"
                style={{ width: `${Math.round((idx / conteudo[nivel].quiz.length) * 100)}%` }}
              />
            </div>

            <div className="rounded-lg border p-4">
              <p className="font-medium mb-2">
                {conteudo[nivel].quiz[idx].question} = ?
              </p>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="border rounded p-2 w-full"
                placeholder="Digite sua resposta"
                onKeyDown={(e) => e.key === "Enter" && responder()}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={responder}
                className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Responder
              </button>
            </div>
          </div>
        )}

        {/* RESULTADO */}
        {etapa === "resultado" && nivel && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Resultado • {nivel.toUpperCase()}</h2>
            <p>
              Você acertou <b>{acertos}</b> de <b>{conteudo[nivel].quiz.length}</b> • <b>{percentual}%</b>
            </p>

            {nivel !== "dificil" && (
              <div className={`p-3 rounded ${percentual >= 70 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {percentual >= 70 ? "Parabéns! Próximo nível desbloqueado. 🎉" : "Alcance pelo menos 70% para desbloquear o próximo nível."}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => iniciarNivel(nivel)}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
              >
                Rever conteúdo do nível
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => { setEtapa("inicio"); setNivel(null); setIdx(0); setAcertos(0); setHistorico([]); setInput(""); }}
                  className="px-4 py-2 rounded bg-gray-800 text-white hover:bg-black"
                >
                  Voltar ao início
                </button>
                {nivel === "facil" && desbloqueados.includes("medio") && (
                  <button
                    onClick={() => iniciarNivel("medio")}
                    className="px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-700 text-white"
                  >
                    Ir para MÉDIO
                  </button>
                )}
                {nivel === "medio" && desbloqueados.includes("dificil") && (
                  <button
                    onClick={() => iniciarNivel("dificil")}
                    className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white"
                  >
                    Ir para DIFÍCIL
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}