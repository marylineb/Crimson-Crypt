<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { gsap } from "gsap";
  import { nowMs, postScore, unlockLevel } from "$lib/game";
  import { vampEnter } from "$lib/anim";
  import { sfx } from "$lib/sfx";

  // ─── Constantes ──────────────────────────────────────────────────────────────
  const PASS_SCORE = 850;
  const REFLEX_TARGET = 0.72; // position cible 0..1
  const REFLEX_ZONE   = 0.10; // largeur de la zone
  const REFLEX_SPEED  = 0.014;

  // ─── Types ───────────────────────────────────────────────────────────────────
  type Phase   = 1 | 2 | 3 | 4; // 4 = résultats
  type Card    = { sym: string; flipped: boolean; matched: boolean };

  // ─── DOM Refs ────────────────────────────────────────────────────────────────
  let rootEl!: HTMLDivElement;
  let phaseEl!: HTMLDivElement;
  let scoreEl!: HTMLSpanElement;
  let needleEl!: HTMLDivElement;
  let stopBtnEl!: HTMLButtonElement;

  // ─── État global ─────────────────────────────────────────────────────────────
  let phase: Phase = 1;
  let total  = 0;
  let startMs = nowMs();
  let elapsed = 0;
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  // ─── Phase 1 : micro-quiz ────────────────────────────────────────────────────
  const questions = [
    { q: "CSS pour arrondir un bloc ?",      a: ["round()", "border-radius", "curve"],   ok: 1 },
    { q: "Dossier des routes SvelteKit ?",   a: ["src/routes", "src/pages", "pages/src"],ok: 0 },
    { q: "2⁶ = ?",                           a: ["32", "48", "64"],                       ok: 2 },
  ];
  let qi = 0;
  let quizPicked: number | null = null;
  let quizCorrect = 0;
  let quizAnswerEls: (HTMLButtonElement | null)[] = [];

  // ─── Phase 2 : micro-memory ──────────────────────────────────────────────────
  const SYMBOLS = ["🦇", "🩸", "🕯️", "🗝️"];
  let deck: Card[] = [];
  let memFirst: number | null = null;
  let memLock = false;
  let memMatched = 0;
  let memCardEls: (HTMLButtonElement | null)[] = [];

  // ─── Phase 3 : réflexe ───────────────────────────────────────────────────────
  let reflexT    = 0;
  let reflexRunning = false;
  let reflexRaf  = 0;
  let reflexDone = false;
  let reflexScore = 0;
  let reflexPos  = 0; // 0..1 courant

  $: reflexPos = (Math.sin(reflexT) + 1) / 2;

  // ─── Timer global ────────────────────────────────────────────────────────────
  function startTimer() {
    startMs = nowMs();
    timerInterval = setInterval(() => {
      elapsed = Math.floor((nowMs() - startMs) / 1000);
    }, 300);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}:${(s % 60).toString().padStart(2,"0")}` : `${s}s`;
  }

  // ─── Animations GSAP ─────────────────────────────────────────────────────────

  /** Transition entre phases */
  function animatePhaseIn() {
    if (!phaseEl) return;
    gsap.fromTo(phaseEl,
      { y: 18, opacity: 0, scale: 0.97 },
      { y: 0,  opacity: 1, scale: 1, duration: 0.38, ease: "power3.out" }
    );
  }

  /** Pulse du score */
  function animateScore(gain: number) {
    if (!scoreEl) return;
    const color = gain > 0 ? "#42d392" : "#ff1744";
    gsap.timeline()
      .to(scoreEl, { scale: 1.3, color, duration: 0.15, ease: "power2.out" })
      .to(scoreEl, { scale: 1, color: "#e8e8e8", duration: 0.3, ease: "power2.in" });
  }

  /** Flash vert bonne réponse quiz */
  function animateCorrect(btn: HTMLButtonElement) {
    gsap.timeline()
      .to(btn, { scale: 1.06, boxShadow: "0 0 22px 4px rgba(66,211,146,.55)", duration: 0.18, ease: "power2.out" })
      .to(btn, { scale: 1,    boxShadow: "0 0 0px rgba(0,0,0,0)",             duration: 0.22 });
  }

  /** Shake rouge mauvaise réponse quiz */
  function animateWrong(btn: HTMLButtonElement) {
    gsap.timeline()
      .to(btn, { x: -9, boxShadow: "0 0 16px rgba(255,23,68,.5)", duration: 0.07 })
      .to(btn, { x:  9, duration: 0.07 })
      .to(btn, { x: -6, duration: 0.06 })
      .to(btn, { x:  6, duration: 0.06 })
      .to(btn, { x:  0, boxShadow: "0 0 0px rgba(0,0,0,0)", duration: 0.1  });
  }

  /** Match memory */
  function animateMemMatch(aIdx: number, bIdx: number) {
    const tl = gsap.timeline();
    const targets = [memCardEls[aIdx], memCardEls[bIdx]].filter(Boolean);
    tl.to(targets, { scale: 1.1, boxShadow: "0 0 24px 4px rgba(66,211,146,.55)", duration: 0.2 })
      .to(targets, { scale: 1,   boxShadow: "0 0 0px rgba(0,0,0,0)",             duration: 0.25 });
  }

  /** Fail memory */
  function animateMemFail(aIdx: number, bIdx: number) {
    const targets = [memCardEls[aIdx], memCardEls[bIdx]].filter(Boolean);
    gsap.timeline()
      .to(targets, { x: -7, boxShadow: "0 0 14px rgba(255,23,68,.45)", duration: 0.07 })
      .to(targets, { x:  7, duration: 0.07 })
      .to(targets, { x: -5, duration: 0.06 })
      .to(targets, { x:  5, duration: 0.06 })
      .to(targets, { x:  0, boxShadow: "0 0 0px rgba(0,0,0,0)", duration: 0.1 });
  }

  /** Aiguille réflexe dans la zone — flash */
  function animateReflexHit() {
    if (!needleEl) return;
    gsap.timeline()
      .to(needleEl, { scaleY: 1.5, background: "#42d392", boxShadow: "0 0 18px rgba(66,211,146,.7)", duration: 0.15 })
      .to(needleEl, { scaleY: 1,   background: "#ff1744", boxShadow: "0 0 0px rgba(0,0,0,0)",        duration: 0.3 });
  }

  function animateReflexMiss() {
    if (!needleEl) return;
    gsap.timeline()
      .to(needleEl, { x: -6, duration: 0.07 })
      .to(needleEl, { x:  6, duration: 0.07 })
      .to(needleEl, { x:  0, duration: 0.1 });
  }

  /** Victoire finale */
  function animateVictory() {
    gsap.fromTo(rootEl,
      { filter: "brightness(1)" },
      { filter: "brightness(1.2)", duration: 0.2, yoyo: true, repeat: 1 }
    );
    const panel = rootEl.querySelector<HTMLElement>("[data-result]");
    if (panel) gsap.from(panel, { y: 60, opacity: 0, scale: 0.9, duration: 0.6, delay: 0.2, ease: "back.out(1.6)" });
  }

  function animateDefeat() {
    gsap.timeline()
      .to(rootEl, { x: -14, duration: 0.07 })
      .to(rootEl, { x:  14, duration: 0.07 })
      .to(rootEl, { x: -10, duration: 0.06 })
      .to(rootEl, { x:  10, duration: 0.06 })
      .to(rootEl, { x:   0, duration: 0.1  });
    const panel = rootEl.querySelector<HTMLElement>("[data-result]");
    if (panel) gsap.from(panel, { y: 30, opacity: 0, duration: 0.45, delay: 0.3, ease: "power2.out" });
  }

  // ─── Logique phase 1 : quiz ───────────────────────────────────────────────────
  function pickQuiz(idx: number, btn: HTMLButtonElement) {
    if (quizPicked !== null) return;
    sfx.click();
    quizPicked = idx;

    const good = idx === questions[qi].ok;
    if (good) {
      total += 200;
      quizCorrect++;
      animateCorrect(btn);
      animateScore(200);
      sfx.win?.();
    } else {
      animateWrong(btn);
      sfx.lose?.();
      const goodBtn = quizAnswerEls[questions[qi].ok];
      if (goodBtn) setTimeout(() => {
        gsap.to(goodBtn, { boxShadow: "0 0 14px rgba(66,211,146,.4)", duration: 0.25, yoyo: true, repeat: 2 });
      }, 120);
    }

    setTimeout(() => {
      quizPicked = null;
      qi++;
      if (qi >= questions.length) {
        goToPhase(2);
      } else {
        setTimeout(animatePhaseIn, 30);
      }
    }, good ? 380 : 650);
  }

  // ─── Logique phase 2 : memory ─────────────────────────────────────────────────
  function setupMemory() {
    const base = SYMBOLS.flatMap(s => [s, s]);
    deck = base
      .sort(() => Math.random() - 0.5)
      .map(sym => ({ sym, flipped: false, matched: false }));
    memFirst = null;
    memLock  = false;
    memMatched = 0;
    memCardEls = [];
  }

  function memFlip(i: number) {
    if (memLock || phase !== 2) return;
    const c = deck[i];
    if (c.matched || c.flipped) return;

    sfx.click();
    deck[i] = { ...c, flipped: true };

    if (memFirst === null) { memFirst = i; return; }

    memLock = true;
    const aIdx = memFirst;
    const bIdx = i;
    memFirst = null;

    const ok = deck[aIdx].sym === deck[bIdx].sym;
    const delay = ok ? 260 : 580;

    setTimeout(() => {
      if (ok) {
        deck[aIdx] = { ...deck[aIdx], matched: true };
        deck[bIdx] = { ...deck[bIdx], matched: true };
        memMatched += 2;
        total += 180;
        animateMemMatch(aIdx, bIdx);
        animateScore(180);
        sfx.click?.();
        if (deck.every(x => x.matched)) {
          setTimeout(() => goToPhase(3), 400);
        }
      } else {
        animateMemFail(aIdx, bIdx);
        sfx.lose?.();
        setTimeout(() => {
          deck[aIdx] = { ...deck[aIdx], flipped: false };
          deck[bIdx] = { ...deck[bIdx], flipped: false };
        }, 280);
      }
      memLock = false;
    }, delay);
  }

  // ─── Logique phase 3 : réflexe ───────────────────────────────────────────────
  function startReflex() {
    reflexT = 0;
    reflexDone = false;
    reflexRunning = true;

    function loop() {
      if (!reflexRunning) return;
      reflexT += REFLEX_SPEED;
      reflexRaf = requestAnimationFrame(loop);
    }
    loop();
  }

  function stopReflex() {
    if (!reflexRunning || reflexDone) return;
    reflexRunning = false;
    reflexDone = true;
    cancelAnimationFrame(reflexRaf);
    sfx.click();

    const pos = (Math.sin(reflexT) + 1) / 2;
    const dist = Math.abs(pos - REFLEX_TARGET);
    const inZone = dist <= REFLEX_ZONE / 2;
    const gain = Math.max(0, Math.floor(600 - dist * 1200));
    total += gain;
    reflexScore = gain;

    if (inZone) {
      animateReflexHit();
      sfx.win?.();
    } else {
      animateReflexMiss();
    }

    animateScore(gain);
    setTimeout(() => finish(), 800);
  }

  // ─── Navigation entre phases ─────────────────────────────────────────────────
  function goToPhase(p: Phase) {
    phase = p;
    if (p === 3) setTimeout(() => { startReflex(); animatePhaseIn(); }, 60);
    else setTimeout(animatePhaseIn, 30);
  }

  // ─── Finish ──────────────────────────────────────────────────────────────────
  async function finish() {
    stopTimer();
    const timeMs = nowMs() - startMs;
    const success = total >= PASS_SCORE;

    await postScore(4, total, timeMs);
    if (success) await unlockLevel(4);

    if (success) { sfx.win?.(); }
    else         { sfx.lose?.(); }

    phase = 4;
    await tick();
    if (success) animateVictory();
    else         animateDefeat();
  }

  function reset() {
    stopTimer();
    phase = 1;
    total = 0;
    elapsed = 0;
    qi = 0;
    quizPicked = null;
    quizCorrect = 0;
    quizAnswerEls = [];
    memCardEls = [];
    reflexRunning = false;
    reflexDone = false;
    reflexScore = 0;
    cancelAnimationFrame(reflexRaf);
    setupMemory();

    setTimeout(() => {
      gsap.fromTo(rootEl, { opacity: 0.85, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" });
      startTimer();
      animatePhaseIn();
    }, 40);
  }

  function tick(): Promise<void> {
    return new Promise(r => setTimeout(r, 30));
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────
  onMount(() => {
    const ctx = gsap.context(() => vampEnter(rootEl), rootEl);
    setupMemory();
    startTimer();
    setTimeout(animatePhaseIn, 120);
    return () => ctx.revert();
  });

  onDestroy(() => {
    stopTimer();
    reflexRunning = false;
    cancelAnimationFrame(reflexRaf);
  });
</script>

<!-- ═══════════════════════════════════════════════════════════════════ MARKUP -->

<div bind:this={rootEl} class="boss-root" data-card>

  <!-- En-tête -->
  <div class="boss-header">
    <div class="header-left">
      <h2 class="boss-title">🎮 Crimson Trial <span class="boss-sub-tag">BOSS</span></h2>
      <p class="boss-sub">3 épreuves consécutives — Score requis : {PASS_SCORE}</p>
    </div>

    <div class="header-stats">

      <!-- Timer -->
      <div class="stat-block">
        <span class="stat-label">Temps</span>
        <span class="stat-value" style="font-variant-numeric:tabular-nums;">{fmt(elapsed)}</span>
        <div class="timer-bar-track">
          <div class="timer-bar-fill" style="width:{Math.min(elapsed / 120 * 100, 100)}%;"></div>
        </div>
      </div>

      <!-- Score -->
      <div class="stat-block">
        <span class="stat-label">Score</span>
        <span bind:this={scoreEl} class="stat-value score-val">{total}</span>
        <span class="stat-sub">min. {PASS_SCORE}</span>
      </div>

      <!-- Phase -->
      <div class="stat-block">
        <span class="stat-label">Phase</span>
        <span class="stat-value">{Math.min(phase, 3)}<span class="stat-denom">/3</span></span>
        <div class="phase-dots">
          {#each [1,2,3] as p}
            <span class="phase-dot" class:dot-done={phase > p} class:dot-active={phase === p}></span>
          {/each}
        </div>
      </div>

    </div>
  </div>

  <!-- ── Phase 1 : Micro-Quiz ───────────────────────────────────────────── -->
  {#if phase === 1}
    <div bind:this={phaseEl} class="phase-card">
      <div class="phase-badge">⚡ Phase 1/3 — Micro-Quiz</div>
      <p class="phase-desc">3 questions rapides. Chaque bonne réponse = +200 pts.</p>

      <div class="progress-track">
        <div class="progress-fill" style="width:{(qi / questions.length) * 100}%;"></div>
        <span class="progress-label">Question {qi + 1}/{questions.length}</span>
      </div>

      <p class="question-text">{questions[qi].q}</p>

      <div class="answers-col">
        {#each questions[qi].a as ans, idx}
          <button
            bind:this={quizAnswerEls[idx]}
            class="answer-btn"
            class:ans-correct={quizPicked !== null && idx === questions[qi].ok}
            class:ans-wrong={quizPicked !== null && quizPicked === idx && idx !== questions[qi].ok}
            class:ans-dim={quizPicked !== null && idx !== questions[qi].ok && idx !== quizPicked}
            on:click={(e) => pickQuiz(idx, e.currentTarget as HTMLButtonElement)}
            disabled={quizPicked !== null}
          >
            <span class="ans-letter">{["A","B","C"][idx]}</span>
            <span>{ans}</span>
          </button>
        {/each}
      </div>
    </div>

  <!-- ── Phase 2 : Micro-Memory ────────────────────────────────────────── -->
  {:else if phase === 2}
    <div bind:this={phaseEl} class="phase-card">
      <div class="phase-badge">🃏 Phase 2/3 — Micro-Memory</div>
      <p class="phase-desc">Trouve les 4 paires. Chaque paire = +180 pts.</p>

      <div class="mem-grid">
        {#each deck as c, idx}
          <button
            bind:this={memCardEls[idx]}
            class="mem-card"
            class:mem-matched={c.matched}
            on:click={() => memFlip(idx)}
            disabled={memLock || c.matched}
          >
            {#if c.flipped || c.matched}
              <span class="mem-sym">{c.sym}</span>
            {:else}
              <span class="mem-back">🩶</span>
            {/if}
          </button>
        {/each}
      </div>

      <div class="mem-status">
        {memMatched / 2} / {SYMBOLS.length} paires trouvées
      </div>
    </div>

  <!-- ── Phase 3 : Réflexe ─────────────────────────────────────────────── -->
  {:else if phase === 3}
    <div bind:this={phaseEl} class="phase-card">
      <div class="phase-badge">⚡ Phase 3/3 — Réflexe</div>
      <p class="phase-desc">
        Stoppe l'aiguille dans la <strong>zone rouge</strong> pour le max de points.
        Plus tu es précis, plus tu gagnes.
      </p>

      <!-- Piste -->
      <div class="reflex-track">
        <!-- Zone cible -->
        <div
          class="reflex-zone"
          style="left:{(REFLEX_TARGET - REFLEX_ZONE / 2) * 100}%; width:{REFLEX_ZONE * 100}%;"
        ></div>
        <!-- Aiguille -->
        <div
          bind:this={needleEl}
          class="reflex-needle"
          style="left:{reflexPos * 100}%;"
        ></div>
        <!-- Marqueur cible -->
        <div class="reflex-target-mark" style="left:{REFLEX_TARGET * 100}%;"></div>
      </div>

      <div class="reflex-labels">
        <span>0</span>
        <span style="position:absolute;left:{REFLEX_TARGET * 100}%;transform:translateX(-50%);color:#c0392b;">
          Cible
        </span>
        <span>Max</span>
      </div>

      {#if !reflexDone}
        <button
          bind:this={stopBtnEl}
          class="stop-btn"
          on:click={stopReflex}
        >
          STOP 🩸
        </button>
      {:else}
        <div class="reflex-result">
          {#if reflexScore > 400}
            <span class="reflex-hit">🎯 Excellent ! +{reflexScore}</span>
          {:else if reflexScore > 150}
            <span class="reflex-ok">👍 Bien joué ! +{reflexScore}</span>
          {:else}
            <span class="reflex-miss">❌ Raté… +{reflexScore}</span>
          {/if}
        </div>
      {/if}
    </div>

  <!-- ── Phase 4 : Résultats ────────────────────────────────────────────── -->
  {:else if phase === 4}
    <div data-result class="result-panel" class:result-win={total >= PASS_SCORE} class:result-lose={total < PASS_SCORE}>

      {#if total >= PASS_SCORE}
        <div class="result-icon">🩸</div>
        <h3 class="result-title">La crypte est vaincue.</h3>
        <p class="result-line">Tu as survécu au Crimson Trial !</p>
      {:else}
        <div class="result-icon">💀</div>
        <h3 class="result-title">Le Boss t'a eu.</h3>
        <p class="result-line">Score insuffisant ({total} / {PASS_SCORE})</p>
      {/if}

      <div class="result-scores">
        <div class="rscore">
          <span class="rscore-label">Score total</span>
          <span class="rscore-val" class:rscore-pass={total >= PASS_SCORE}>{total}</span>
        </div>
        <div class="rscore">
          <span class="rscore-label">Quiz</span>
          <span class="rscore-val">{quizCorrect}/{questions.length}</span>
        </div>
        <div class="rscore">
          <span class="rscore-label">Réflexe</span>
          <span class="rscore-val">+{reflexScore}</span>
        </div>
        <div class="rscore">
          <span class="rscore-label">Temps</span>
          <span class="rscore-val">{fmt(elapsed)}</span>
        </div>
      </div>

      <div class="result-actions">
        <a class="btn secondary" href="/dashboard">Dashboard</a>
        <a class="btn secondary" href="/leaderboard">Leaderboard</a>
        <button class="btn" on:click={reset}>Rejouer</button>
      </div>

    </div>
  {/if}

</div>

<!-- ═══════════════════════════════════════════════════════════════════ STYLES -->

<style>
  /* ── Racine ──────────────────────────────────────────── */
  .boss-root {
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 680px;
    margin: 0 auto;
    padding: 28px 20px;
  }

  /* ── En-tête ─────────────────────────────────────────── */
  .boss-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }

  .boss-title {
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--text, #e8e8e8);
    margin: 0 0 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .boss-sub-tag {
    font-size: .65rem;
    padding: 2px 8px;
    border-radius: 20px;
    background: linear-gradient(135deg, #8b0000, #c0392b);
    color: #fff;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    box-shadow: 0 0 10px rgba(139,0,0,.5);
  }

  .boss-sub {
    font-size: .82rem;
    color: var(--muted, #888);
    margin: 0;
  }

  /* ── Stats ───────────────────────────────────────────── */
  .header-stats { display: flex; gap: 12px; flex-wrap: wrap; }

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

  .stat-label  { font-size:.66rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted,#888); }
  .stat-value  { font-size:1.5rem; font-weight:800; color:var(--text,#e8e8e8); line-height:1; }
  .stat-denom  { font-size:.85rem; font-weight:500; color:var(--muted,#888); }
  .stat-sub    { font-size:.66rem; color:var(--muted,#888); }
  .score-val   { color:#c0392b; text-shadow:0 0 10px rgba(192,57,43,.4); }

  .timer-bar-track {
    width:100%; height:4px;
    background:rgba(255,255,255,.1);
    border-radius:2px; margin-top:4px; overflow:hidden;
  }
  .timer-bar-fill {
    height:100%; border-radius:2px;
    background: linear-gradient(90deg, #8b0000, #c0392b);
    transition: width .3s linear;
  }

  .phase-dots { display:flex; gap:4px; margin-top:4px; }
  .phase-dot {
    width:8px; height:8px; border-radius:50%;
    background:rgba(255,255,255,.12);
    transition:background .3s, box-shadow .3s;
  }
  .phase-dot.dot-done   { background: rgba(66,211,146,.6); }
  .phase-dot.dot-active {
    background: #c0392b;
    box-shadow: 0 0 8px rgba(192,57,43,.7);
    animation: dot-pulse .7s ease-in-out infinite alternate;
  }
  @keyframes dot-pulse {
    from { box-shadow: 0 0 4px rgba(192,57,43,.5); }
    to   { box-shadow: 0 0 12px rgba(192,57,43,.9); }
  }

  /* ── Phase card ──────────────────────────────────────── */
  .phase-card {
    background: var(--panel2, rgba(255,255,255,.04));
    border: 1px solid rgba(139,0,0,.3);
    border-radius: 14px;
    padding: 24px 22px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .phase-badge {
    display: inline-flex;
    align-self: flex-start;
    font-size: .72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .08em;
    padding: 3px 10px;
    border-radius: 20px;
    background: rgba(139,0,0,.25);
    border: 1px solid rgba(139,0,0,.45);
    color: #c0392b;
  }

  .phase-desc {
    font-size: .86rem;
    color: var(--muted, #888);
    margin: 0;
  }

  /* ── Barre de progression quiz ───────────────────────── */
  .progress-track {
    position: relative;
    width: 100%; height: 5px;
    background: rgba(255,255,255,.08);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%; border-radius: 3px;
    background: linear-gradient(90deg, #8b0000, #c0392b);
    transition: width .35s ease;
    box-shadow: 0 0 8px rgba(139,0,0,.5);
  }

  .progress-label {
    position: absolute;
    right: 0; top: -18px;
    font-size: .68rem;
    color: var(--muted, #888);
  }

  /* ── Quiz ────────────────────────────────────────────── */
  .question-text {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text, #e8e8e8);
    margin: 0;
  }

  .answers-col { display: flex; flex-direction: column; gap: 8px; }

  .answer-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 14px;
    background: rgba(255,255,255,.03);
    border: 1px solid rgba(139,0,0,.3);
    border-radius: 9px;
    color: var(--text, #e8e8e8);
    font-size: .9rem;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: border-color .15s, background .15s, opacity .2s;
  }
  .answer-btn:not(:disabled):hover { border-color:rgba(139,0,0,.75); background:rgba(139,0,0,.1); }
  .answer-btn:disabled { cursor: default; }
  .ans-letter {
    width:24px; height:24px; border-radius:6px;
    display:flex; align-items:center; justify-content:center;
    background:rgba(139,0,0,.25); font-size:.72rem; font-weight:700;
    color:#c0392b; flex-shrink:0;
  }
  .answer-btn.ans-correct { border-color:rgba(66,211,146,.65); background:rgba(66,211,146,.08); }
  .answer-btn.ans-wrong   { border-color:rgba(255,23,68,.65);  background:rgba(255,23,68,.08); }
  .answer-btn.ans-dim     { opacity:.4; }

  /* ── Memory ──────────────────────────────────────────── */
  .mem-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 9px;
  }

  .mem-card {
    aspect-ratio: 1;
    border: 1px solid rgba(139,0,0,.3);
    border-radius: 10px;
    background: var(--panel, rgba(255,255,255,.03));
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    font-size: 1.5rem;
    transition: border-color .15s, background .15s, opacity .2s;
  }
  .mem-card:not(:disabled):hover { border-color:rgba(139,0,0,.7); background:rgba(139,0,0,.1); }
  .mem-card:disabled:not(.mem-matched) { cursor:default; }
  .mem-card.mem-matched {
    border-color: rgba(66,211,146,.5);
    background: rgba(66,211,146,.07);
  }
  .mem-sym  { filter: drop-shadow(0 0 6px rgba(66,211,146,.4)); }
  .mem-back { opacity: .4; }

  .mem-status {
    font-size: .8rem;
    color: var(--muted, #888);
    text-align: center;
  }

  /* ── Réflexe ─────────────────────────────────────────── */
  .reflex-track {
    position: relative;
    height: 28px;
    background: rgba(0,0,0,.3);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 999px;
    overflow: visible;
    margin: 8px 0;
  }

  .reflex-zone {
    position: absolute;
    top: 0; bottom: 0;
    border-radius: 999px;
    background: rgba(139,0,0,.35);
    border: 1px solid rgba(192,57,43,.6);
  }

  .reflex-needle {
    position: absolute;
    top: -5px; bottom: -5px;
    width: 4px;
    border-radius: 2px;
    background: #ff1744;
    box-shadow: 0 0 10px rgba(255,23,68,.7);
    transform: translateX(-50%);
    transition: left 0s;
  }

  .reflex-target-mark {
    position: absolute;
    top: -10px;
    width: 2px; height: 8px;
    background: #c0392b;
    transform: translateX(-50%);
    border-radius: 1px;
  }

  .reflex-labels {
    position: relative;
    display: flex;
    justify-content: space-between;
    font-size: .68rem;
    color: var(--muted, #888);
    padding: 0 2px;
    margin-top: -4px;
  }

  .stop-btn {
    align-self: center;
    padding: 14px 40px;
    background: linear-gradient(135deg, #8b0000, #c0392b);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 1.1rem;
    font-weight: 800;
    letter-spacing: .05em;
    cursor: pointer;
    box-shadow: 0 0 20px rgba(139,0,0,.5);
    transition: transform .1s, box-shadow .15s;
  }
  .stop-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 30px rgba(139,0,0,.75);
  }
  .stop-btn:active { transform: scale(.96); }

  .reflex-result {
    text-align: center;
    font-size: 1.1rem;
    font-weight: 700;
    padding: 10px 0;
  }
  .reflex-hit  { color: #42d392; text-shadow: 0 0 12px rgba(66,211,146,.5); }
  .reflex-ok   { color: #e8e8e8; }
  .reflex-miss { color: #ff1744; }

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
  .result-win  { background:rgba(139,0,0,.12); border-color:rgba(139,0,0,.45); }
  .result-lose { background:rgba(30,30,30,.4);  border-color:rgba(255,255,255,.1); }

  .result-icon  { font-size:3rem; line-height:1; filter:drop-shadow(0 0 18px rgba(139,0,0,.7)); }
  .result-title { font-size:1.4rem; font-weight:800; color:var(--text,#e8e8e8); margin:0; text-align:center; }
  .result-line  { font-size:.88rem; color:var(--muted,#888); margin:0; text-align:center; }

  .result-scores { display:flex; gap:18px; flex-wrap:wrap; justify-content:center; margin-top:4px; }
  .rscore        { display:flex; flex-direction:column; align-items:center; gap:2px; }
  .rscore-label  { font-size:.66rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted,#888); }
  .rscore-val    { font-size:1.55rem; font-weight:800; color:var(--text,#e8e8e8); font-variant-numeric:tabular-nums; }
  .rscore-pass   { color:#42d392; text-shadow:0 0 12px rgba(66,211,146,.5); }

  .result-actions { display:flex; gap:10px; margin-top:6px; flex-wrap:wrap; justify-content:center; }

  /* ── Responsive ──────────────────────────────────────── */
  @media (max-width: 520px) {
    .mem-grid    { grid-template-columns: repeat(4, 1fr); gap: 7px; }
    .header-stats{ gap: 8px; }
    .stat-block  { min-width: 72px; padding: 8px 10px; }
    .stat-value  { font-size: 1.2rem; }
  }
</style>