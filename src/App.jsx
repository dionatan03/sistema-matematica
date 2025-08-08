import React, { useState } from "react";

const questions = {
  facil: [
    { question: "Quanto é 2 + 2?", answer: "4" },
    { question: "Quanto é 5 - 3?", answer: "2" },
  ],
  medio: [
    { question: "Quanto é 12 x 3?", answer: "36" },
    { question: "Quanto é 144 ÷ 12?", answer: "12" },
  ],
  dificil: [
    { question: "Resolva: (3 + 2) x (6 - 1)", answer: "25" },
    { question: "Qual é a raiz quadrada de 121?", answer: "11" },
  ],
};

export default function App() {
  const [nivel, setNivel] = useState(null);
  const [etapa, setEtapa] = useState("inicio");
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [acertos, setAcertos] = useState(0);
  const [respostas, setRespostas] = useState([]);

  const iniciar = (n) => { setNivel(n); setEtapa("explicacao"); setIndex(0); setAcertos(0); setRespostas([]); };
  const avancarExplicacao = () => { if (index + 1 >= questions[nivel].length) { setIndex(0); setEtapa("teste"); } else { setIndex(index + 1); } };
  const responder = () => {
    const correta = questions[nivel][index].answer;
    const certo = input.trim() === correta;
    if (certo) setAcertos(a => a + 1);
    setRespostas(r => [...r, { pergunta: questions[nivel][index].question, resposta: input, correta }]);
    setInput("");
    if (index + 1 >= questions[nivel].length) setEtapa("resultado"); else setIndex(i => i + 1);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {etapa === "inicio" && (
        <div className="bg-white p-6 rounded shadow w-full max-w-md text-center">
          <h1 className="text-xl font-bold mb-4">Escolha o nível de dificuldade</h1>
          <div className="flex flex-col gap-2">
            <button onClick={() => iniciar("facil")} className="bg-blue-500 text-white p-2 rounded">Fácil</button>
            <button onClick={() => iniciar("medio")} className="bg-yellow-500 text-white p-2 rounded">Médio</button>
            <button onClick={() => iniciar("dificil")} className="bg-red-500 text-white p-2 rounded">Difícil</button>
          </div>
        </div>
      )}
      {etapa === "explicacao" && (
        <div className="bg-white p-6 rounded shadow w-full max-w-md text-center">
          <h2 className="text-lg font-semibold mb-4">Vamos aprender:</h2>
          <p className="mb-4">{questions[nivel][index].question}</p>
          <button onClick={avancarExplicacao} className="bg-green-500 text-white p-2 rounded">Entendi, próximo</button>
        </div>
      )}
      {etapa === "teste" && (
        <div className="bg-white p-6 rounded shadow w-full max-w-md text-center">
          <h2 className="text-lg font-semibold mb-4">Teste seu conhecimento:</h2>
          <p className="mb-4">{questions[nivel][index].question}</p>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} className="border p-2 w-full mb-4" placeholder="Digite sua resposta" />
          <button onClick={responder} className="bg-blue-600 text-white p-2 rounded">Responder</button>
        </div>
      )}
      {etapa === "resultado" && (
        <div className="bg-white p-6 rounded shadow w-full max-w-md">
          <h2 className="text-lg font-bold mb-4">Resultado Final</h2>
          <p className="mb-2">Você acertou {acertos} de {questions[nivel].length}</p>
          <div className="space-y-2 mt-4 text-left">
            {respostas.map((r, i) => (
              <div key={i} className="border-b pb-2">
                <p><strong>Pergunta:</strong> {r.pergunta}</p>
                <p><strong>Sua resposta:</strong> {r.resposta}</p>
                <p><strong>Correta:</strong> {r.correta}</p>
              </div>
            ))}
          </div>
          <button onClick={() => setEtapa("inicio")} className="bg-gray-800 text-white p-2 mt-4 rounded">Voltar ao início</button>
        </div>
      )}
    </div>
  );
}
