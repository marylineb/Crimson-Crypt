<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { gsap } from "gsap";
  import { nowMs, postScore, unlockLevel } from "$lib/game";
  import { vampEnter } from "$lib/anim";
  import { sfx } from "$lib/sfx";

  // ─── Constantes ──────────────────────────────────────────────────────────────
  const TOTAL_Q = 10;
  const PASS_SCORE = 6 * 120;        // 720 — 6 bonnes réponses minimum
  const PTS_PER_Q  = 120;
  const TIME_LIMIT = 60;             // secondes

  // ─── Types ───────────────────────────────────────────────────────────────────
  type Q = { q: string; a: string[]; ok: number };
  type Phase = "playing" | "win" | "lose";

  // ─── DOM Refs ────────────────────────────────────────────────────────────────
  let rootEl!: HTMLDivElement;
  let answerEls: (HTMLButtonElement | null)[] = [];
  let questionEl!: HTMLDivElement;
  let scoreEl!: HTMLSpanElement;

  // ─── Questions ───────────────────────────────────────────────────────────────
  const questions: Q[] = [
    { q: "Quel est le contraire de « aube » ?",          a: ["Midi","Crépuscule","Aurore","Zénith"],          ok: 1 },
    { q: "2⁵ = ?",                                       a: ["16","24","32","64"],                           ok: 2 },
    { q: "En HTML, la balise de lien hypertexte ?",      a: ["<img>","<a>","<p>","<link>"],                  ok: 1 },
    { q: "Quel mot est un palindrome ?",                 a: ["vampire","kayak","dragon","tomate"],           ok: 1 },
    { q: "CSS : propriété pour arrondir un bloc ?",      a: ["shadow","radius","border-radius","curve"],     ok: 2 },
    { q: "Somme des angles d'un triangle ?",             a: ["90°","180°","270°","360°"],                    ok: 1 },
    { q: "JS : méthode pour convertir en nombre ?",     a: ["Number()","String()","Bool()","ParseCSS()"],    ok: 0 },
    { q: "Quel langage est typé statiquement ?",         a: ["TypeScript","HTML","CSS","Markdown"],          ok: 0 },
    { q: "SvelteKit : dossier des routes ?",             a: ["src/pages","src/routes","src/app","routes/"],  ok: 1 },
    { q: "Qu'est-ce qui exécute le code côté client ?", a: ["Serveur","Navigateur","Base de données","CDN"],ok: 1 },
  ];

  // ─── État ────────────────────────────────────────────────────────────────────
  let i         = 0;
  let score     = 0;
  let correct   = 0;
  let picked: number | null = null;
  let phase: Phase = "playing";
  let finalTotal = 0;
  let finalBonus = 0;
  let elapsed   = 0;
  let startMs   = 0;
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  $: timeLeft   = Math.max(0, TIME_LIMIT - elapsed);
  $: timerPct   = timeLeft / TIME_LIMIT;
  $: timerColor = timerPct > 0.5 ? "#8b0000" : timerPct > 0.25 ? "#c0392b" : "#ff1744";
  $: progressPct = (i / TOTAL_Q) * 100;

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}:${(s % 60).toString().padStart(2, "0")}` : `${s}s`;
  }

  // ─── Timer ───────────────────────────────────────────────────────────────────
  function startTimer() {
    startMs = nowMs();
    timerInterval = setInterval(() => {
      elapsed = Math.floor((nowMs() - startMs) / 1000);
      if (elapsed >= TIME_LIMIT) void finish();
    }, 300);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  // ─── Animations GSAP ─────────────────────────────────────────────────────────

  /** Entrée de la nouvelle question */
  function animateQuestionIn() {
    if (!questionEl) return;
    gsap.fromTo(questionEl,
      { opacity: 0, x: 18 },
      { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" }
    );
    const btns = answerEls.filter(Boolean) as HTMLButtonElement[];
    gsap.fromTo(btns,
      { opacity: 0, y: 12, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: "back.out(1.4)", stagger: 0.06, delay: 0.1 }
    );
  }

  /** Pulse du score */
  function animateScore() {
    if (!scoreEl) return;
    gsap.fromTo(scoreEl,
      { scale: 1 },
      { scale: 1.22, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out" }
    );
  }

  /** Flash vert sur bonne réponse */
  function animateCorrect(btn: HTMLButtonElement) {
    gsap.timeline()
      .to(btn, { scale: 1.06, boxShadow: "0 0 22px 4px rgba(66,211,146,.55)", duration: 0.18, ease: "power2.out" })
      .to(btn, { scale: 1.0,  boxShadow: "0 0 0px rgba(0,0,0,0)",             duration: 0.22, ease: "power2.in" });
  }

  /** Shake + flash rouge sur mauvaise réponse */
  function animateWrong(btn: HTMLButtonElement) {
    gsap.timeline()
      .to(btn, { x: -10, boxShadow: "0 0 18px 3px rgba(255,23,68,.5)", duration: 0.07 })
      .to(btn, { x:  10, duration: 0.07 })
      .to(btn, { x:  -6, duration: 0.06 })
      .to(btn, { x:   6, duration: 0.06 })
      .to(btn, { x:   0, boxShadow: "0 0 0px rgba(0,0,0,0)", duration: 0.1 });
  }

  /** Highlight de la bonne réponse après un mauvais choix */
  function animateReveal(btn: HTMLButtonElement) {
    gsap.to(btn, {
      boxShadow: "0 0 16px 3px rgba(66,211,146,.4)",
      duration: 0.25,
      repeat: 2,
      yoyo: true,
      ease: "power1.inOut"
    });
  }

  /** Victoire : flash global + panel */
  function animateVictory() {
    gsap.fromTo(rootEl,
      { filter: "brightness(1)" },
      { filter: "brightness(1.18)", duration: 0.2, yoyo: true, repeat: 1 }
    );
    const panel = rootEl.querySelector<HTMLElement>("[data-result]");
    if (panel) {
      gsap.from(panel, { y: 50, opacity: 0, scale: 0.92, duration: 0.55, delay: 0.15, ease: "back.out(1.6)" });
    }
  }

  /** Défaite : tremblement global */
  function animateDefeat() {
    gsap.timeline()
      .to(rootEl, { x: -12, duration: 0.07 })
      .to(rootEl, { x:  12, duration: 0.07 })
      .to(rootEl, { x:  -8, duration: 0.06 })
      .to(rootEl, { x:   8, duration: 0.06 })
      .to(rootEl, { x:   0, duration: 0.1  });
    const panel = rootEl.querySelector<HTMLElement>("[data-result]");
    if (panel) {
      gsap.from(panel, { y: 30, opacity: 0, duration: 0.45, delay: 0.3, ease: "power2.out" });
    }
  }

  // ─── Logique de jeu ──────────────────────────────────────────────────────────
  function pick(idx: number, btn: HTMLButtonElement) {
    if (phase !== "playing" || picked !== null) return;

    sfx.click();
    picked = idx;

    const good = idx === questions[i].ok;

    if (good) {
      score  += PTS_PER_Q;
      correct++;
      animateCorrect(btn);
      animateScore();
      sfx.win?.();
    } else {
      animateWrong(btn);
      sfx.lose?.();
      // révéler la bonne réponse
      const goodBtn = answerEls[questions[i].ok];
      if (goodBtn) setTimeout(() => animateReveal(goodBtn), 120);
    }

    setTimeout(() => {
      picked = null;
      if (i < TOTAL_Q - 1) {
        i++;
        setTimeout(animateQuestionIn, 30);
      } else {
        void finish();
      }
    }, good ? 380 : 650);
  }

  async function finish() {
    stopTimer();
    if (phase !== "playing") return;

    const timeMs = nowMs() - startMs;
    const bonus  = Math.max(0, 800 - Math.floor(timeMs / 50));
    const total  = score + bonus;

    finalTotal = total;
    finalBonus = bonus;

    await postScore(1, total, timeMs);

    if (correct >= 6) {
      await unlockLevel(1);
      sfx.win?.();
      phase = "win";
      await tick();
      animateVictory();
    } else {
      sfx.lose?.();
      phase = "lose";
      await tick();
      animateDefeat();
    }
  }

  function reset() {
    stopTimer();
    i       = 0;
    score   = 0;
    correct = 0;
    picked  = null;
    phase   = "playing";
    elapsed = 0;
    finalTotal = 0;
    finalBonus = 0;
    answerEls  = [];

    setTimeout(() => {
      gsap.fromTo(rootEl, { opacity: 0.85, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" });
      startTimer();
      animateQuestionIn();
    }, 40);
  }

  function tick(): Promise<void> {
    return new Promise(r => setTimeout(r, 30));
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────
  onMount(() => {
    const ctx = gsap.context(() => vampEnter(rootEl), rootEl);
    startTimer();
    setTimeout(animateQuestionIn, 120);
    return () => ctx.revert();
  });

  onDestroy(stopTimer);
</script>

<!-- ═══════════════════════════════════════════════════════════════════ MARKUP -->

<div bind:this={rootEl} class="quiz-root" data-card>

  <!-- En-tête -->
  <div class="quiz-header">
    <div class="header-left">
      <h2 class="quiz-title">🧠 Quiz du Sang</h2>
      <p class="quiz-sub">10 questions — 6 bonnes réponses minimum pour réussir</p>
    </div>

    <div class="header-stats">

      <!-- Timer -->
      <div class="stat-block timer-block" class:urgent={timeLeft <= 15}>
        <span class="stat-label">Temps</span>
        <span class="stat-value" style="font-variant-numeric:tabular-nums;">{fmt(timeLeft)}</span>
        <div class="timer-bar-track">
          <div class="timer-bar-fill" style="width:{timerPct * 100}%; background:{timerColor};"></div>
        </div>
      </div>

      <!-- Score -->
      <div class="stat-block">
        <span class="stat-label">Score</span>
        <span bind:this={scoreEl} class="stat-value score-val">{score}</span>
        <span class="stat-sub">min. {PASS_SCORE}</span>
      </div>

      <!-- Bonnes réponses -->
      <div class="stat-block">
        <span class="stat-label">Correctes</span>
        <span class="stat-value">{correct}<span class="stat-denom">/{TOTAL_Q}</span></span>
        <div class="answer-dots">
          {#each Array(TOTAL_Q) as _, di}
            <span
              class="answer-dot"
              class:dot-pass={di < correct}
              class:dot-fail={di >= correct && di < i && phase === "playing"}
            ></span>
          {/each}
        </div>
      </div>

    </div>
  </div>

  <!-- Barre de progression -->
  {#if phase === "playing"}
    <div class="progress-track">
      <div class="progress-fill" style="width:{progressPct}%;"></div>
      <span class="progress-label">Question {i + 1} / {TOTAL_Q}</span>
    </div>
  {/if}

  <!-- Zone de jeu -->
  {#if phase === "playing"}
    <div class="quiz-card">

      <div bind:this={questionEl} class="question-block">
        <p class="question-text">{questions[i].q}</p>
      </div>

      <div class="answers-grid">
        {#each questions[i].a as ans, idx}
          <button
            bind:this={answerEls[idx]}
            class="answer-btn"
            class:ans-correct={picked !== null && idx === questions[i].ok}
            class:ans-wrong={picked !== null && picked === idx && idx !== questions[i].ok}
            class:ans-dim={picked !== null && idx !== questions[i].ok && idx !== picked}
            on:click={(e) => pick(idx, e.currentTarget as HTMLButtonElement)}
            disabled={picked !== null}
          >
            <span class="ans-letter">{["A","B","C","D"][idx]}</span>
            <span class="ans-text">{ans}</span>
          </button>
        {/each}
      </div>

    </div>
  {/if}

  <!-- Résultat -->
  {#if phase !== "playing"}
    <div data-result class="result-panel" class:result-win={phase === "win"} class:result-lose={phase === "lose"}>

      {#if phase === "win"}
        <div class="result-icon">🩸</div>
        <h3 class="result-title">La crypte s'incline…</h3>
        <p class="result-line">Niveau suivant débloqué !</p>
      {:else}
        <div class="result-icon">💀</div>
        <h3 class="result-title">Le sang ne ment pas</h3>
        <p class="result-line">
          {correct >= 6 ? "Trop lent — recommence !" : `Seulement ${correct}/6 bonnes réponses`}
        </p>
      {/if}

      <div class="result-scores">
        <div class="rscore">
          <span class="rscore-label">Score</span>
          <span class="rscore-val" class:rscore-pass={finalTotal >= PASS_SCORE + finalBonus - 10}>{finalTotal}</span>
        </div>
        <div class="rscore">
          <span class="rscore-label">Bonus vitesse</span>
          <span class="rscore-val">+{finalBonus}</span>
        </div>
        <div class="rscore">
          <span class="rscore-label">Correctes</span>
          <span class="rscore-val" class:rscore-pass={correct >= 6}>{correct}/{TOTAL_Q}</span>
        </div>
        <div class="rscore">
          <span class="rscore-label">Temps</span>
          <span class="rscore-val">{fmt(elapsed)}</span>
        </div>
      </div>

      <div class="result-actions">
        <a class="btn secondary" href="/dashboard">Dashboard</a>
        <button class="btn" on:click={reset}>Rejouer</button>
      </div>

    </div>
  {/if}

</div>

<!-- ═══════════════════════════════════════════════════════════════════ STYLES -->

<style>
  /* ── Racine ──────────────────────────────────────────── */
  .quiz-root {
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 680px;
    margin: 0 auto;
    padding: 28px 20px;
  }

  /* ── En-tête ─────────────────────────────────────────── */
  .quiz-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }

  .quiz-title {
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--text, #e8e8e8);
    margin: 0 0 4px;
  }

  .quiz-sub {
    font-size: 0.82rem;
    color: var(--muted, #888);
    margin: 0;
  }

  /* ── Stats ───────────────────────────────────────────── */
  .header-stats {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .stat-block {
    background: var(--panel2, rgba(255,255,255,.05));
    border: 1px solid rgba(139,0,0,.25);
    border-radius: 10px;
    padding: 10px 14px;
    min-width: 84px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .stat-label {
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: var(--muted, #888);
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--text, #e8e8e8);
    line-height: 1;
  }

  .stat-denom {
    font-size: .85rem;
    font-weight: 500;
    color: var(--muted, #888);
  }

  .stat-sub {
    font-size: 0.66rem;
    color: var(--muted, #888);
  }

  .score-val {
    color: #c0392b;
    text-shadow: 0 0 10px rgba(192,57,43,.4);
    transition: color .2s;
  }

  /* Timer */
  .timer-block {
    min-width: 100px;
  }

  .timer-block.urgent {
    border-color: rgba(255,23,68,.6);
    animation: pulse-border .55s ease-in-out infinite alternate;
  }

  @keyframes pulse-border {
    from { box-shadow: 0 0 0px rgba(255,23,68,0); }
    to   { box-shadow: 0 0 14px rgba(255,23,68,.45); }
  }

  .timer-bar-track {
    width: 100%;
    height: 4px;
    background: rgba(255,255,255,.1);
    border-radius: 2px;
    margin-top: 4px;
    overflow: hidden;
  }

  .timer-bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width .3s linear, background .4s;
  }

  /* Dots réponses */
  .answer-dots {
    display: flex;
    gap: 3px;
    margin-top: 4px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .answer-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(255,255,255,.12);
    transition: background .2s, box-shadow .2s;
  }

  .answer-dot.dot-pass {
    background: #42d392;
    box-shadow: 0 0 6px rgba(66,211,146,.6);
  }

  .answer-dot.dot-fail {
    background: #ff1744;
    box-shadow: 0 0 5px rgba(255,23,68,.5);
  }

  /* ── Barre de progression ────────────────────────────── */
  .progress-track {
    position: relative;
    width: 100%;
    height: 6px;
    background: rgba(255,255,255,.08);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #8b0000, #c0392b);
    border-radius: 3px;
    transition: width .35s ease;
    box-shadow: 0 0 8px rgba(139,0,0,.5);
  }

  .progress-label {
    position: absolute;
    right: 6px;
    top: -18px;
    font-size: 0.7rem;
    color: var(--muted, #888);
  }

  /* ── Carte question ──────────────────────────────────── */
  .quiz-card {
    background: var(--panel2, rgba(255,255,255,.04));
    border: 1px solid rgba(139,0,0,.25);
    border-radius: 14px;
    padding: 24px 22px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .question-block {
    min-height: 56px;
    display: flex;
    align-items: center;
  }

  .question-text {
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--text, #e8e8e8);
    margin: 0;
    line-height: 1.4;
  }

  /* ── Réponses ────────────────────────────────────────── */
  .answers-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .answer-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: var(--panel, rgba(255,255,255,.03));
    border: 1px solid rgba(139,0,0,.3);
    border-radius: 10px;
    color: var(--text, #e8e8e8);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: border-color .15s, background .15s, opacity .2s;
  }

  .answer-btn:not(:disabled):hover {
    border-color: rgba(139,0,0,.7);
    background: rgba(139,0,0,.1);
  }

  .answer-btn:disabled {
    cursor: default;
  }

  .ans-letter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: rgba(139,0,0,.25);
    font-size: 0.75rem;
    font-weight: 700;
    color: #c0392b;
    flex-shrink: 0;
  }

  .ans-text {
    flex: 1;
  }

  /* États après sélection */
  .answer-btn.ans-correct {
    border-color: rgba(66,211,146,.65);
    background: rgba(66,211,146,.08);
  }

  .answer-btn.ans-correct .ans-letter {
    background: rgba(66,211,146,.3);
    color: #42d392;
  }

  .answer-btn.ans-wrong {
    border-color: rgba(255,23,68,.65);
    background: rgba(255,23,68,.08);
  }

  .answer-btn.ans-wrong .ans-letter {
    background: rgba(255,23,68,.3);
    color: #ff1744;
  }

  .answer-btn.ans-dim {
    opacity: 0.45;
  }

  /* ── Résultat ────────────────────────────────────────── */
  .result-panel {
    border-radius: 14px;
    padding: 32px 26px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    border: 1px solid transparent;
  }

  .result-win  { background: rgba(139,0,0,.12); border-color: rgba(139,0,0,.45); }
  .result-lose { background: rgba(30,30,30,.4);  border-color: rgba(255,255,255,.1); }

  .result-icon {
    font-size: 3rem;
    line-height: 1;
    filter: drop-shadow(0 0 18px rgba(139,0,0,.7));
  }

  .result-title {
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--text, #e8e8e8);
    margin: 0;
    text-align: center;
  }

  .result-line {
    font-size: .88rem;
    color: var(--muted, #888);
    margin: 0;
    text-align: center;
  }

  .result-scores {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 4px;
  }

  .rscore {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .rscore-label {
    font-size: .66rem;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: var(--muted, #888);
  }

  .rscore-val {
    font-size: 1.55rem;
    font-weight: 800;
    color: var(--text, #e8e8e8);
    font-variant-numeric: tabular-nums;
  }

  .rscore-pass {
    color: #42d392;
    text-shadow: 0 0 12px rgba(66,211,146,.5);
  }

  .result-actions {
    display: flex;
    gap: 10px;
    margin-top: 6px;
  }

  /* ── Responsive ──────────────────────────────────────── */
  @media (max-width: 500px) {
    .answers-grid    { grid-template-columns: 1fr; }
    .header-stats    { gap: 8px; }
    .stat-block      { min-width: 72px; padding: 8px 10px; }
    .stat-value      { font-size: 1.2rem; }
    .question-text   { font-size: 1rem; }
  }
</style>