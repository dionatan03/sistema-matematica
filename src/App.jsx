import React, { useEffect, useMemo, useRef, useState } from "react";
import "./index.css";
import "./material.css";

/* ==================== CONFIG ==================== */
const CARD_COUNT = 6;        // nº de cartas no Fácil
const MAX_LIVES = 4;
const BALLOON_TIME = 45;     // tempo por rodada (s)

/* ==================== ÁUDIO (sintetizado) ==================== */
function useAudio() {
  const ctxRef = useRef(null);
  const ensure = () => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new AC();
    }
    return ctxRef.current;
  };
  const beep = (f = 600, d = 0.12, type = "triangle", g = 0.22) => {
    try {
      const ctx = ensure();
      const o = ctx.createOscillator();
      const gain = ctx.createGain();
      o.type = type;
      gain.gain.setValueAtTime(g, ctx.currentTime);
      o.frequency.setValueAtTime(f, ctx.currentTime);
      o.connect(gain); gain.connect(ctx.destination);
      o.start();
      o.frequency.exponentialRampToValueAtTime(Math.max(80, f / 3), ctx.currentTime + d * 0.9);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d);
      o.stop(ctx.currentTime + d + 0.02);
    } catch {}
  };
  return {
    flip:   () => beep(720, 0.10, "square",   0.14),
    ok:     () => beep(900, 0.18, "sine",     0.24),
    wrong:  () => beep(220, 0.22, "sawtooth", 0.30),
    pop:    () => beep(520, 0.10, "triangle", 0.22),
    bomb:   () => beep(150, 0.22, "sawtooth", 0.30),
    swoosh: () => beep(680, 0.06, "sine",     0.10),
  };
}

/* ==================== YOUTUBE ==================== */
function isYouTube(url){ return /youtube\.com|youtu\.be/.test(url||""); }
function getYtId(url){
  const m = (url||"").match(/[?&]v=([^&#]+)/) || (url||"").match(/youtu\.be\/([^?&#/]+)/);
  return m ? m[1] : null;
}
function loadYT(){
  return new Promise(res=>{
    if(window.YT?.Player) return res(window.YT);
    const s=document.createElement("script");
    s.src="https://www.youtube.com/iframe_api";
    window.onYouTubeIframeAPIReady=()=>res(window.YT);
    document.head.appendChild(s);
  });
}
function VideoPlayer({ url, onEnded }){
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const onEndedRef = useRef(onEnded);
  useEffect(()=>{ onEndedRef.current = onEnded; },[onEnded]);

  useEffect(()=>{
    if(!isYouTube(url)) return;
    let cancel=false;
    (async()=>{
      const YT=await loadYT(); if(cancel||!YT||!hostRef.current) return;
      hostRef.current.innerHTML="";
      const div=document.createElement("div");
      div.className="yt-holder";
      hostRef.current.appendChild(div);
      playerRef.current=new YT.Player(div,{
        host:"https://www.youtube-nocookie.com",
        width:"100%",height:"100%",
        videoId:getYtId(url)||undefined,
        playerVars:{ rel:0, modestbranding:1, playsinline:1, fs:0, iv_load_policy:3, disablekb:1 },
        events:{ onStateChange:(e)=>{ if(e.data===YT.PlayerState.ENDED) onEndedRef.current?.(); } }
      });
    })();
    return ()=>{ cancel=true; try{playerRef.current?.destroy?.();}catch{} };
  },[url]);

  if(!isYouTube(url)){
    return (
      <div className="video-box">
        <video src={url} controls className="video-el" onEnded={()=>onEndedRef.current?.()} />
      </div>
    );
  }
  return (
    <div className="video-box yt">
      <div ref={hostRef} className="yt-target"/>
      <div className="yt-fade" aria-hidden="true"/>
    </div>
  );
}

/* ==================== FÁCIL — Cartas (soma OU subtração) ==================== */
/**
 * Cria um deck com 1 par correto. Para subtração, representamos como soma com sinal,
 * ex.: alvo=7 → par (11, -4) pois 11 + (-4) = 7 (equivalente a 11 - 4).
 */
function buildDeckAddOrSubSigned(target, size = CARD_COUNT) {
  // decide se o par correto será por soma pura ou por “subtração” (sinal)
  const useSub = Math.random() < 0.5;

  let a, b;
  if (!useSub) {
    // soma: a + b = target
    a = Math.floor(Math.random() * (target + 1));
    b = target - a; // ambos podem sair positivos/zero
  } else {
    // subtração: a - b = target  → representamos como a + (-b) = target
    b = Math.floor(Math.random() * 10) + 1;           // 1..10
    a = target + b;                                   // garante a - b = target
    b = -b;                                           // mostra -b na carta
  }

  const deck = [a, b];
  const used = new Set(deck);

  // impedir que distratores criem outro par válido
  const makesAnotherPair = (n) => {
    for (const x of used) {
      if (x + n === target) return true;
      if (x + n === target) return true;
    }
    return false;
  };

  const MAX = Math.max(50, target + 30);
  while (deck.length < size) {
    // distratores podem ser positivos ou negativos (mas evitando duplicar o par)
    let n = Math.floor(Math.random() * (MAX + 1));
    if (Math.random() < 0.35) n = -n;

    if (used.has(n)) continue;
    // se ao somar com algum existente formar target, pula
    let bad = false;
    for (const x of used) if (x + n === target) { bad = true; break; }
    if (bad) continue;

    used.add(n); deck.push(n);
  }

  // embaralha
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.map((v, i) => ({ id: `c${i}`, value: v }));
}

function SumPairGame({ target, size = CARD_COUNT, onSolved }) {
  const snd = useAudio();
  const [deck, setDeck] = useState(() => buildDeckAddOrSubSigned(target, size));
  const [flip, setFlip] = useState([]);
  const [lock, setLock] = useState(false);
  const [moves, setMoves] = useState(0);

  useEffect(()=>{ document.body.classList.add("no-scroll"); return ()=>document.body.classList.remove("no-scroll"); },[]);
  useEffect(()=>{ setDeck(buildDeckAddOrSubSigned(target,size)); setFlip([]); setLock(false); setMoves(0); },[target,size]);

  const click = (i)=>{
    if(lock) return;
    if(flip.includes(i)) return;
    if(flip.length===2) return;
    snd.flip();
    setFlip(f=>[...f,i]);
  };

  useEffect(()=>{
    if(flip.length<2) return;
    const [i,j]=flip;
    const v1=deck[i].value, v2=deck[j].value;
    setLock(true); setMoves(m=>m+1);
    const t=setTimeout(()=>{
      const hit = (v1 + v2 === target); // com sinal já cobre soma e “subtração”
      if(hit){ snd.ok(); onSolved?.(); }
      else{ snd.wrong(); setFlip([]); setLock(false); }
    },420);
    return ()=>clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[flip]);

  const format = (v)=> (v>0?`+${v}`:String(v)); // exibe +5 / -4

  return (
    <section className="game-fullscreen safe-top">
      <div className="hud-row hud-wrap">
        <div className="badge">Tentativas: <b>{moves}</b></div>
        <h2 className="question-title title-grad small-on-mobile center-on-mobile">
          Ache <b>2 cartas</b> que, somando (ex.: +5) ou usando números negativos (ex.: -4), resultem em <b>{target}</b>
        </h2>
        <div className="badge">Boa sorte! 🍀</div>
      </div>

      <div className="cards-wrap">
        <div className="cards-grid">
          {deck.map((c, idx) => {
            const flipped = flip.includes(idx);
            return (
              <button key={c.id} className="card3d" onClick={()=>click(idx)} disabled={lock && !flipped}>
                <div className={`card-inner ${flipped ? "flipped" : ""}`}>
                  <div className="card-face card-front">?</div>
                  <div className="card-face card-back">{format(c.value)}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="hint">
        Dica: para <b>{target}</b>, pense em pares do tipo <b>11</b> e <b>-4</b> (porque 11 + (-4) = {target}).
      </div>
    </section>
  );
}

/* ==================== MÉDIO — Balloon Ninja calibrado + power-ups ==================== */
function BalloonNinjaGame({ question, correta, onCorrect, onFail, requestPause }) {
  const snd=useAudio();
  const canRef=useRef(null);
  const objsRef=useRef([]);
  const frameRef=useRef(0);
  const trailsRef=useRef([]);
  const lastPointRef=useRef(null);
  const playingRef=useRef(true);

  const [lives,setLives]=useState(MAX_LIVES);
  const [score,setScore]=useState(0);
  const [timeLeft,setTimeLeft]=useState(BALLOON_TIME);
  const [paused,setPaused]=useState(false);
  const [askOpen,setAskOpen]=useState(false);
  const [ans,setAns]=useState("");
  const [rightOpen,setRightOpen]=useState(false);
  const [showRotate,setShowRotate]=useState(false);

  // power-ups
  const [slowMo,setSlowMo]=useState(0);   // ms restante
  const [frenzy,setFrenzy]=useState(0);   // ms restante
  const [bombBoost,setBombBoost]=useState(0); // ms restante (mais bombas)

  useEffect(()=>{ requestPause.current = ()=>setPaused(true); },[requestPause]);
  useEffect(()=>{ document.body.classList.add("no-scroll"); return ()=>document.body.classList.remove("no-scroll"); },[]);
  useEffect(()=>{ setTimeLeft(BALLOON_TIME); },[question,correta]);

  useEffect(()=>{
    const check=()=>setShowRotate(window.innerHeight > window.innerWidth);
    check(); window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
  },[]);

  useEffect(()=>{
    if(paused||askOpen||!playingRef.current) return;
    const t=setInterval(()=>setTimeLeft(s=>Math.max(0,s-1)),1000);
    return ()=>clearInterval(t);
  },[paused,askOpen]);

  useEffect(()=>{
    reset();
    const can=canRef.current; if(!can) return;
    const onDown=(e)=>{ const p=pt(e,can); lastPointRef.current=p; trailsRef.current.push(p); snd.swoosh(); };
    const onMove=(e)=>{ if(!lastPointRef.current) return; const p=pt(e,can); trailsRef.current.push(p); lastPointRef.current=p; };
    const onUp=()=>{ lastPointRef.current=null; };
    can.addEventListener("mousedown",onDown);
    can.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
    can.addEventListener("touchstart",onDown,{passive:true});
    can.addEventListener("touchmove",onMove,{passive:true});
    window.addEventListener("touchend",onUp);
    return ()=>{
      cancelAnimationFrame(frameRef.current);
      can.removeEventListener("mousedown",onDown);
      can.removeEventListener("mousemove",onMove);
      window.removeEventListener("mouseup",onUp);
      can.removeEventListener("touchstart",onDown);
      can.removeEventListener("touchmove",onMove);
      window.removeEventListener("touchend",onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[question,correta]);

  function reset(){
    cancelAnimationFrame(frameRef.current);
    objsRef.current=[]; trailsRef.current=[]; lastPointRef.current=null;
    playingRef.current=true; setScore(0); setLives(MAX_LIVES);
    setPaused(false); setAskOpen(false); setAns(""); setRightOpen(false);
    setSlowMo(0); setFrenzy(0); setBombBoost(0);
    startLoop();
  }

  function startLoop(){
    const can=canRef.current; const ctx=can.getContext("2d");
    let last=performance.now(); let lastSpawn=0; let combo=0; let comboTime=0;

    const tick=(now)=>{
      frameRef.current=requestAnimationFrame(tick);
      const ratio=window.devicePixelRatio||1;
      const wCSS=can.clientWidth, hCSS=can.clientHeight;
      if(can.width!==Math.floor(wCSS*ratio) || can.height!==Math.floor(hCSS*ratio)){
        can.width=Math.floor(wCSS*ratio); can.height=Math.floor(hCSS*ratio);
        ctx.setTransform(ratio,0,0,ratio,0,0);
      }
      const w=wCSS, h=hCSS;
      ctx.clearRect(0,0,w,h);
      drawWood(ctx,w,h);

      // timers de power-up (em ms)
      const dtReal = now - last; last = now;
      const dtSlow = slowMo>0 ? dtReal*0.45 : dtReal; // slow
      if(slowMo>0) setSlowMo(s=>Math.max(0,s-dtReal));
      if(frenzy>0) setFrenzy(s=>Math.max(0,s-dtReal));
      if(bombBoost>0) setBombBoost(s=>Math.max(0,s-dtReal));

      if(timeLeft<=0 && playingRef.current){
        playingRef.current=false; setTimeout(()=>onCorrect?.(),300);
      }

      if(paused||askOpen||rightOpen||!playingRef.current){
        drawObjs(ctx); drawTrail(ctx); drawHUD(ctx,w,h,score,timeLeft,lives);
        return;
      }

      // dificuldade base
      const tier = Math.min(3, Math.floor(score/40));
      let spawnMs   = [1400, 1250, 1100, 1000][tier];
      let bombProb  = [0.06, 0.08, 0.10, 0.12][tier];
      let speedMul  = [0.90, 1.00, 1.10, 1.15][tier];
      let maxAtOnce = [2, 3, 3, 4][tier];

      if (frenzy>0) { spawnMs *= 0.55; maxAtOnce += 1; }
      if (bombBoost>0) bombProb *= 1.7;
      if (slowMo>0) speedMul *= 0.7;

      if(now-lastSpawn>spawnMs && objsRef.current.length<maxAtOnce){
        spawnOne(w,h,bombProb,speedMul);
        if(Math.random()<0.25) spawnOne(w,h,bombProb*0.7,speedMul);
        lastSpawn=now;
      }

      const GRAV=0.16*speedMul;  // altura melhor (mais “pulo”)
      objsRef.current.forEach(o=>{
        o.x += o.vx*dtSlow/16; o.y += o.vy*dtSlow/16; o.vy += GRAV*dtSlow/16;
        if(o.type!=="bomb") o.x += Math.sin((now-o.born)/420)*0.35*speedMul;
        // fade ao cortar
        if(o.hit){ o.alpha -= 0.04; }
      });
      // manter no container
      objsRef.current = objsRef.current.filter(o=>o.y<h+60 && o.x>-80 && o.x<w+80 && o.alpha>0.05);

      // corte + combos
      if(lastPointRef.current && trailsRef.current.length){
        const a=trailsRef.current[trailsRef.current.length-1], b=lastPointRef.current;
        objsRef.current.forEach(o=>{
          if(o.hit) return;
          if(intersect(a,b,o)){
            o.hit=true; o.sliceA=a; o.sliceB=b; // p/ desenhar brilho/fatia
            if(o.type==="bomb"){ snd.bomb(); playingRef.current=false; setAskOpen(true); setAns(""); combo=0; }
            else {
              snd.pop();
              // pontuação por cor + combos
              const nowt = performance.now();
              if(nowt - comboTime < 600) combo++; else combo=1;
              comboTime = nowt;
              const gain = (o.points||1) * (1 + Math.floor((combo-1)/3));
              setScore(s=>s+gain);

              // power-ups dos especiais
              if(o.special==="frenzy"){ setFrenzy(10000); }
              if(o.special==="slow"){ setSlowMo(10000); }
              if(o.special==="combo"){ setFrenzy(10000); setSlowMo(10000); setBombBoost(10000); }
            }
          }
        });
      }

      drawObjs(ctx); drawTrail(ctx);
      drawHUD(ctx,w,h,score,timeLeft,lives);
    };

    frameRef.current=requestAnimationFrame(tick);
  }

  function spawnOne(w,h,bombProb,speedMul){
    const x = 40 + Math.random()*(w-80);
    const y = h + 30;
    const vx = (Math.random()-0.5)*2.2*speedMul;
    const vy = -(5.4 + Math.random()*3.2) * speedMul; // sobe mais
    const r  = 24 + Math.random()*12;

    // especiais (raros)
    const specialRoll = Math.random();
    let special=null; // "frenzy" | "slow" | "combo"
    if (specialRoll < 0.05) special="frenzy";
    else if (specialRoll < 0.09) special="slow";
    else if (specialRoll < 0.11) special="combo";

    const isBomb = Math.random() < (bombProb*(special==="combo"?1.5:1));
    const id = Math.random().toString(36).slice(2,9);
    if(isBomb) objsRef.current.push({ id,x,y,vx,vy,r,type:"bomb",hit:false,alpha:1,born:performance.now() });
    else{
      // cor e pontos
      const colorRoll = Math.random();
      let color="blue", points=5;
      if (colorRoll < 0.33) { color="yellow"; points=7; }
      else if (colorRoll < 0.66) { color="green"; points=10; }
      else { color="blue"; points=5; }

      if (special==="frenzy") { color="yellow"; points=20; }
      if (special==="slow")   { color="blue";   points=20; }
      if (special==="combo")  { color="green";  points=20; }

      objsRef.current.push({ id,x,y,vx,vy,r,type:"balloon",color,points,special,hit:false,alpha:1,born:performance.now() });
    }
  }

  // geometria
  function pt(e,can){
    const rect=can.getBoundingClientRect();
    const ex=(e.touches?e.touches[0].clientX:e.clientX)-rect.left;
    const ey=(e.touches?e.touches[0].clientY:e.clientY)-rect.top;
    return {x:ex,y:ey,time:performance.now()};
  }
  function intersect(a,b,o){
    const x1=a.x,y1=a.y,x2=b.x,y2=b.y,cx=o.x,cy=o.y,r=o.r;
    const dx=x2-x1, dy=y2-y1; const l2=dx*dx+dy*dy || 1;
    let t=((cx-x1)*dx+(cy-y1)*dy)/l2; t=Math.max(0,Math.min(1,t));
    const px=x1+dx*t, py=y1+dy*t; const d2=(px-cx)**2+(py-cy)**2;
    return d2<=r*r;
  }

  // desenho
  function drawWood(ctx,w,h){
    const grad=ctx.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,"#3a2a18"); grad.addColorStop(1,"#4b3420");
    ctx.fillStyle=grad; ctx.fillRect(0,0,w,h);
    ctx.globalAlpha=.08; ctx.strokeStyle="#000";
    for(let i=0;i<w;i+=120){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,h); ctx.stroke(); }
    ctx.globalAlpha=1;
  }
  function drawObjs(ctx){
    objsRef.current.forEach(o=>{
      ctx.save(); ctx.globalAlpha = o.alpha ?? 1;
      if(o.type==="bomb"){
        ctx.beginPath(); ctx.fillStyle="#ef4444";
        ctx.arc(o.x,o.y,o.r,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#fff"; ctx.font="bold 16px system-ui, Segoe UI, Roboto";
        ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("💣",o.x,o.y+1);
      }else{
        const colorMap = {
          blue:   ["#67e8f9","#22d3ee"],
          yellow: ["#fde68a","#f59e0b"],
          green:  ["#86efac","#22c55e"],
        };
        const base = colorMap[o.color] || colorMap.blue;
        const g=ctx.createRadialGradient(o.x-6,o.y-6,2,o.x,o.y,o.r);
        g.addColorStop(0,base[0]); g.addColorStop(1,base[1]);
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(o.x,o.y,o.r,0,Math.PI*2); ctx.fill();

        // brilho dos especiais
        if(o.special){
          const rg=ctx.createRadialGradient(o.x,o.y,2,o.x,o.y,o.r*1.2);
          rg.addColorStop(0,"rgba(255,255,255,.9)");
          rg.addColorStop(1,"rgba(255,255,255,0)");
          ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(o.x,o.y,o.r*1.2,0,Math.PI*2); ctx.fill();
        }

        // highlight
        ctx.beginPath(); ctx.fillStyle="rgba(255,255,255,.85)";
        ctx.arc(o.x-8,o.y-8,Math.max(3,o.r*.25),0,Math.PI*2); ctx.fill();

        // pontos
        ctx.fillStyle="#fff"; ctx.font="900 14px system-ui, Segoe UI, Roboto";
        ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(String(o.points||1),o.x,o.y);
      }

      // efeito “fatia”
      if(o.hit && o.sliceA && o.sliceB){
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = "rgba(255,255,255,.9)";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(o.sliceA.x,o.sliceA.y); ctx.lineTo(o.sliceB.x,o.sliceB.y); ctx.stroke();
      }
      ctx.restore();
    });
  }
  function drawTrail(ctx){
    const t=trailsRef.current; if(t.length<2) return;
    ctx.lineCap="round";
    for(let i=1;i<t.length;i++){
      const a=t[i-1], b=t[i];
      const alpha=Math.max(0,1-(performance.now()-b.time)/220);
      ctx.lineWidth=6; ctx.strokeStyle=`rgba(147,197,253,${alpha})`;
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    }
    trailsRef.current = t.filter(p=>performance.now()-p.time<200);
  }
  function drawHUD(ctx,w,h,score,timeLeft,lives){
    ctx.fillStyle="#facc15"; ctx.font="900 24px system-ui, Segoe UI, Roboto"; ctx.fillText(String(score), 16, 28);
    ctx.fillStyle="#4ade80"; ctx.font="900 22px system-ui, Segoe UI, Roboto"; ctx.fillText(`${timeLeft}s`, w-80, 26);
    ctx.font="900 18px system-ui, Segoe UI, Roboto";
    for(let i=0;i<MAX_LIVES;i++){
      ctx.globalAlpha = i<lives ? 1 : .25;
      ctx.fillStyle = "#ef4444";
      ctx.fillText("❤", w-26 - i*22, 50);
      ctx.globalAlpha = 1;
    }
  }

  function submitAnswer(){
    const ok = String(ans).trim() === String(correta).trim();
    setAskOpen(false);
    if(!ok){
      setLives(v=>{
        const nv=v-1;
        if(nv<=0){ playingRef.current=false; onFail?.(); }
        else { playingRef.current=true; }
        return Math.max(0,nv);
      });
      snd.wrong();
    } else {
      snd.ok();
      setRightOpen(true); // mensagem de acerto
      playingRef.current=true;
    }
  }

  return (
    <section className="game-fullscreen safe-top">
      <div className="game-appbar">
        <button className="icon-btn" onClick={()=>setPaused(p=>!p)}>{paused?"▶":"⏸"}</button>
        <div className="game-title">{question} = ?</div>
        <GameMenu onOpen={()=>setPaused(true)} onResume={()=>setPaused(false)} />
      </div>

      <div className="ninja-stage"><canvas ref={canRef} className="ninja-canvas"/></div>

      {askOpen && (
        <div className="overlay">
          <div className="overlay-card">
            <h3 className="overlay-title">Ops! Você cortou uma 💣</h3>
            <p className="overlay-text">Responda para continuar:</p>
            <p className="overlay-question">{question} = ?</p>
            <input className="overlay-input" value={ans} onChange={(e)=>setAns(e.target.value)} inputMode="numeric" />
            <div className="overlay-actions">
              <button className="btn-primary" onClick={submitAnswer}>Confirmar</button>
              <button className="btn-ghost" onClick={()=>{ setAskOpen(false); playingRef.current=true; }}>Cancelar</button>
            </div>
            <p className="overlay-hint">Se errar, perde 1 vida. Sem vidas: precisa rever e tentar de novo. 💪</p>
          </div>
        </div>
      )}

      {rightOpen && (
        <div className="overlay">
          <div className="overlay-card">
            <h3 className="overlay-title">Você acertou! 🎉</h3>
            <div className="overlay-actions center">
              <button className="btn-primary" onClick={()=>setRightOpen(false)}>Continuar</button>
            </div>
          </div>
        </div>
      )}

      {showRotate && (
        <div className="rotate-hint">
          📱 Para uma melhor experiência, gire seu celular para o <b>modo horizontal</b>.
        </div>
      )}
    </section>
  );
}

/* ==================== MENU (Drawer) ==================== */
function GameMenu({ onOpen, onResume }){
  const [open,setOpen]=useState(false);

  useEffect(()=>{
    if(open){ onOpen?.(); document.body.classList.add("drawer-open"); }
    else { document.body.classList.remove("drawer-open"); }
  },[open,onOpen]);

  return (
    <>
      <button className="icon-btn" onClick={()=>setOpen(true)}>☰</button>
      {open && (
        <div className="drawer drawer-top">
          <div className="drawer-panel">
            <div className="drawer-head">
              <div className="avatar">🧠</div>
              <div>
                <div className="brand">Menu</div>
                <div className="sub">Navegue pelo app</div>
              </div>
            </div>
            <nav className="drawer-nav">
              <a className="nav-item" onClick={()=>{ setOpen(false); onResume?.(); }}>Voltar ao jogo</a>
              <a className="nav-item" onClick={()=>alert("Dicas: corte os balões e evite as bombas. 😉")}>Dicas</a>
              <a className="nav-item" onClick={()=>alert("Temas na página inicial.")}>Tema</a>
            </nav>
            <button className="drawer-close" onClick={()=>{ setOpen(false); onResume?.(); }}>Fechar</button>
          </div>
          <div className="drawer-backdrop" onClick={()=>{ setOpen(false); onResume?.(); }} />
        </div>
      )}
    </>
  );
}

/* ==================== DIFÍCIL (placeholder) ==================== */
function KeypadGame({ correta, onCorrect }) {
  const snd=useAudio(); const [v,setV]=useState("");
  useEffect(()=>{ document.body.classList.add("no-scroll"); return ()=>document.body.classList.remove("no-scroll"); },[]);
  const press=(k)=>{
    if(k==="C") return setV("");
    if(k==="←") return setV(s=>s.slice(0,-1));
    if(k==="OK"){ if(v.trim()===String(correta)) { snd.ok(); onCorrect?.(); } else snd.wrong(); return; }
    if(v.length<6) setV(s=>s+k);
  };
  const keys=["7","8","9","4","5","6","1","2","3","C","0","OK"];
  return (
    <section className="game-fullscreen safe-top">
      <div className="hud-row"><div className="title-grad">Digite a resposta</div></div>
      <div className="keypad-wrap">
        <input className="keypad-input" readOnly value={v} placeholder="Sua resposta"/>
        <div className="keypad-grid">
          {keys.map(k=><button key={k} className={`key ${k==="OK"?"btn-primary":"btn-key"}`} onClick={()=>press(k)}>{k}</button>)}
        </div>
      </div>
    </section>
  );
}

/* ==================== CONTEÚDO ==================== */
const conteudo = {
  facil: {
    videos: [
      { title: "Somar e Subtrair (Fácil)", url: "https://www.youtube.com/watch?v=J_q2kLadcas" },
      { title: "Truques de cálculo mental", url: "https://www.youtube.com/watch?v=TS7T4_4eggQ" },
    ],
    exemplos: [
      { pergunta: "2 + 3 = ?", comoResolver: "Conte 3 passos a partir de 2 → 5.", resultado: "5" },
      { pergunta: "9 - 4 = ?", comoResolver: "Volte 4 passos a partir de 9 → 5.", resultado: "5" },
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
    videos: [ { title: "Multiplicação e divisão", url: "https://www.youtube.com/watch?v=5MgKxBA1P40" } ],
    exemplos: [
      { pergunta: "12 × 3 = ?", comoResolver: "10×3 + 2×3 = 36.", resultado: "36" },
      { pergunta: "144 ÷ 12 = ?", comoResolver: "12×12=144 → 144 ÷ 12 = 12.", resultado: "12" },
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
    videos: [{ title:"Expressões e raízes", url:"https://www.youtube.com/watch?v=H8jR9C6sXvE" }],
    exemplos: [
      { pergunta: "(3 + 2) × (6 - 1) = ?", comoResolver: "5 × 5 = 25.", resultado: "25" },
      { pergunta: "√121 = ?", comoResolver: "11×11=121 → 11.", resultado: "11" },
    ],
    quiz: [
      { question: "(4 + 6) × 2", answer: "20" },
      { question: "√169",       answer: "13" },
      { question: "3 × (5 + 7)", answer: "36" },
      { question: "(18 ÷ 3) × 4", answer: "24" },
      { question: "√81 + 5",     answer: "14" },
      { question: "√144",        answer: "12" },
      { question: "(10 - 3) × 4", answer: "28" },
      { question: "9 × (2 + 1)",  answer: "27" },
      { question: "100 ÷ (5 × 4)", answer: "5" },
      { question: "(6 + 6) × (3 - 1)", answer: "24" },
    ],
  },
};

/* ==================== TOAST + PARABÉNS ==================== */
function Toast({ open, message }){
  if(!open) return null;
  return <div className="toast">{message}</div>;
}
function CongratsModal({ open, onNext }) {
  if (!open) return null;
  return (
    <div className="overlay">
      <div className="overlay-card">
        <h3 className="overlay-title">Parabéns! 🎉</h3>
        <p className="overlay-text">Você acertou — vamos continuar?</p>
        <div className="overlay-actions center">
          <button className="btn-primary" onClick={onNext}>Próxima</button>
        </div>
      </div>
    </div>
  );
}

/* ==================== APP ==================== */
export default function App(){
  const [tema,setTema]=useState(()=>localStorage.getItem("mat_tema_v2")||"padrao");
  const [tempTema,setTempTema]=useState(tema);
  const [toast,setToast]=useState({open:false,msg:""});

  useEffect(()=>localStorage.setItem("mat_tema_v2",tema),[tema]);
  useEffect(()=>{ if(toast.open){ const t=setTimeout(()=>setToast({open:false,msg:""}),1700); return ()=>clearTimeout(t);} },[toast]);

  const [page,setPage]=useState("home");
  const [nivel,setNivel]=useState(null);
  const [idx,setIdx]=useState(0);
  const [acertos,setAcertos]=useState(0);
  const [showCongrats,setShowCongrats]=useState(0);
  const [canNextVideo,setCanNextVideo]=useState(false);
  const [drawer,setDrawer]=useState(false);

  const [unlock,setUnlock]=useState(()=>JSON.parse(localStorage.getItem("mat_unlock_v1")||'["facil"]'));
  useEffect(()=>localStorage.setItem("mat_unlock_v1",JSON.stringify(unlock)),[unlock]);

  const total = useMemo(()=>nivel?conteudo[nivel].quiz.length:0,[nivel]);
  const percent = useMemo(()=>total?Math.round((acertos/total)*100):0,[acertos,total]);

  const startLevel=(n)=>{ setNivel(n); setIdx(0); setAcertos(0); setPage("videos"); setCanNextVideo(false); };

  useEffect(()=>{
    if(page!=="resultado"||!nivel) return;
    const next = nivel==="facil"?"medio":nivel==="medio"?"dificil":null;
    if(next && percent>=70 && !unlock.includes(next)) setUnlock(u=>[...u,next]);
  },[page,nivel,percent,unlock]);

  const themeClass = tema==="oceano" ? "theme-oceano" : tema==="floresta" ? "theme-floresta" : tema==="espaco" ? "theme-espaco" : "";
  const requestPause = useRef(()=>{});

  useEffect(()=>{
    document.body.classList.toggle("drawer-open", drawer);
    if (drawer) requestPause.current?.();
  },[drawer]);

  return (
    <div className={`${themeClass} app-bg min-h-screen flex flex-col`}>
      <header className="appbar">
        <button className="icon-btn" onClick={()=>setDrawer(true)}>☰</button>
        <div className="brand-row"><span className="logo">🧠</span><h1 className="brand">Matemática Divertida</h1></div>
        <div className="level-badges">
          <span className={`chip ${unlock.includes("facil")?"ok":""}`}>Fácil {unlock.includes("facil")?"🔓":"🔒"}</span>
          <span className={`chip ${unlock.includes("medio")?"ok":""}`}>Médio {unlock.includes("medio")?"🔓":"🔒"}</span>
          <span className={`chip ${unlock.includes("dificil")?"ok":""}`}>Difícil {unlock.includes("dificil")?"🔓":"🔒"}</span>
        </div>
      </header>

      {drawer && (
        <div className="drawer drawer-top">
          <div className="drawer-panel">
            <div className="drawer-head">
              <div className="avatar">🧠</div>
              <div><div className="brand">Menu</div><div className="sub">Navegue pelo app</div></div>
            </div>
            <nav className="drawer-nav">
              <a className="nav-item" onClick={()=>{ setPage("home"); setDrawer(false); }}>🏠 Início</a>
              <a className="nav-item" onClick={()=>{ setPage("temas"); setTempTema(tema); setDrawer(false); }}>🎨 Tema</a>
              <a className="nav-item" onClick={()=>{ setPage("dicas"); setDrawer(false); }}>💡 Dicas</a>
              {nivel && <a className="nav-item" onClick={()=>{ setPage("teste"); setDrawer(false); }}>🔁 Voltar ao jogo</a>}
            </nav>
            <button className="drawer-close" onClick={()=>setDrawer(false)}>Fechar</button>
          </div>
          <div className="drawer-backdrop" onClick={()=>setDrawer(false)} />
        </div>
      )}

      <main className="main">
        {page==="home" && (
          <section className="card home-card">
            <h2 className="title-grad big">Escolha um nível</h2>
            <p className="muted lead">Assista aos vídeos, veja exemplos e depois jogue. Alcance <b>70%</b> para desbloquear o próximo nível.</p>
            <div className="grid3 comfy">
              <button className="btn-primary" onClick={()=>startLevel("facil")}>Fácil</button>
              <button className="btn-primary" disabled={!unlock.includes("medio")} onClick={()=>startLevel("medio")}>Médio</button>
              <button className="btn-primary" disabled={!unlock.includes("dificil")} onClick={()=>startLevel("dificil")}>Difícil</button>
            </div>
          </section>
        )}

        {page==="temas" && (
          <div className="card roomy">
            <h2 className="title-grad">Tema</h2>
            <div className="row gap themes-row">
              {["padrao","oceano","floresta","espaco"].map(t=>(
                <button key={t} className={`chip ${tempTema===t?"ok":""}`} onClick={()=>setTempTema(t)}>{t}</button>
              ))}
            </div>
            <div className="end mt">
              <button className="btn-primary" onClick={()=>{ setTema(tempTema); setToast({open:true, msg:"Uau!! agora seu tema mudou. Divirta-se 😀"}); }}>Salvar tema</button>
            </div>
            <p className="muted">As cores e o fundo mudam conforme o tema. 😉</p>
          </div>
        )}

        {page==="dicas" && (
          <div className="card roomy">
            <h2 className="title-grad">Dicas</h2>
            <ul className="list">
              <li><b>Fácil:</b> use números negativos para “subtrair” (ex.: 11 e -4).</li>
              <li><b>Médio:</b> deslize para cortar; evite bombas; especiais dão efeitos por 10s.</li>
              <li><b>Erro faz parte!</b> Respire, releia e tente de novo. 💪</li>
            </ul>
          </div>
        )}

        {page==="videos" && nivel && (
          <div className="card roomy">
            <div className="between">
              <h2 className="title-grad">Vídeos • {nivel.toUpperCase()}</h2>
              <span className="chip">{idx+1}/{conteudo[nivel].videos.length}</span>
            </div>
            <VideoPlayer url={conteudo[nivel].videos[idx].url} onEnded={()=>setCanNextVideo(true)} />
            <p className="mt">{conteudo[nivel].videos[idx].title}</p>
            {!canNextVideo && <p className="muted">Assista até o fim para liberar o próximo.</p>}
            <div className="end mt">
              <button className={`btn-primary ${!canNextVideo?"btn-disabled":""}`} disabled={!canNextVideo}
                onClick={()=>{
                  const n=idx+1;
                  if(n>=conteudo[nivel].videos.length){ setIdx(0); setPage("exemplos"); }
                  else { setIdx(n); setCanNextVideo(false); }
                }}>
                Concluir vídeo
              </button>
            </div>
          </div>
        )}

        {page==="exemplos" && nivel && (
          <div className="card roomy">
            <div className="between">
              <h2 className="title-grad">Exemplos • {nivel.toUpperCase()}</h2>
              <span className="chip ok">{idx+1}/{conteudo[nivel].exemplos.length}</span>
            </div>
            <div className="example">
              <p className="q"><b>Pergunta:</b> {conteudo[nivel].exemplos[idx].pergunta}</p>
              <p className="a"><b>Como resolver:</b> {conteudo[nivel].exemplos[idx].comoResolver}</p>
              <p className="r">Resposta: <b>{conteudo[nivel].exemplos[idx].resultado}</b></p>
            </div>
            <div className="end mt">
              <button className="btn-primary" onClick={()=>{
                const n=idx+1;
                if(n>=conteudo[nivel].exemplos.length){ setIdx(0); setPage("teste"); }
                else setIdx(n);
              }}>Entendi, próximo</button>
            </div>
          </div>
        )}

        {page==="teste" && nivel && (() => {
          const q = conteudo[nivel].quiz[idx];
          const alvo = Number(q.answer);
          const onAcertou = ()=>{ setAcertos(a=>a+1); setShowCongrats(true); };
          const next = ()=>{
            setShowCongrats(false);
            const n=idx+1;
            if(n>=conteudo[nivel].quiz.length){ setIdx(0); setPage("resultado"); }
            else setIdx(n);
          };

          return (
            <>
              {nivel==="facil" && <SumPairGame target={alvo} onSolved={onAcertou} />}
              {nivel==="medio" && (
                <BalloonNinjaGame
                  question={q.question}
                  correta={q.answer}
                  onCorrect={onAcertou}
                  onFail={()=>{ setIdx(0); setAcertos(0); setPage("videos"); }}
                  requestPause={requestPause}
                />
              )}
              {nivel==="dificil" && <KeypadGame correta={q.answer} onCorrect={onAcertou} />}
              <CongratsModal open={showCongrats} onNext={next}/>
            </>
          );
        })()}

        {page==="resultado" && nivel && (
          <div className="card roomy">
            <h2 className="title-grad">Resultado • {nivel.toUpperCase()}</h2>
            <div className="progress"><div className="progress-fill" style={{width:`${percent}%`}}/></div>
            <p className="mt">Você acertou <b>{acertos}</b> de <b>{conteudo[nivel].quiz.length}</b> • <b>{percent}%</b></p>
            {nivel!=="dificil" && (
              <div className={`notice ${percent>=70?"ok":"warn"}`}>
                {percent>=70 ? "Parabéns! Próximo nível desbloqueado. 🎉" : "Alcance pelo menos 70% para desbloquear o próximo nível."}
              </div>
            )}
            <div className="between mt">
              <button className="btn-ghost" onClick={()=>{ setNivel(null); setIdx(0); setAcertos(0); setPage("home"); }}>Voltar ao início</button>
              {nivel==="facil" && unlock.includes("medio") && <button className="btn-primary" onClick={()=>startLevel("medio")}>Ir para MÉDIO</button>}
              {nivel==="medio" && unlock.includes("dificil") && <button className="btn-primary" onClick={()=>startLevel("dificil")}>Ir para DIFÍCIL</button>}
            </div>
          </div>
        )}
      </main>

      <footer className="footer">Feito com ❤️ para crianças curiosas • © {new Date().getFullYear()}</footer>

      <Toast open={toast.open} message={toast.msg}/>
    </div>
  );
}
