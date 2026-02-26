<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { gsap } from "gsap";
  import type { Action } from "svelte/action";

  import { nowMs, postScore, unlockLevel } from "$lib/game";
  import { vampEnter } from "$lib/anim";
  import { sfx } from "$lib/sfx";

  // ─── Constantes ──────────────────────────────────────────────────────────────
  const SYMBOLS = ["🦇","🩸","🕯️","🗝️","🕷️","🌑","🪦","🧛"];
  const PAIRS = 8;
  const PASS_SCORE = 900;
  const BASE_SCORE = 2000;
  const MOVE_PENALTY = 50;
  const TIME_LIMIT = 120; // secondes

  // ─── Types ───────────────────────────────────────────────────────────────────
  type Card = { id: number; sym: string; flipped: boolean; matched: boolean };
  type Phase = "playing" | "win" | "lose";

  // ─── DOM Refs ────────────────────────────────────────────────────────────────
  let rootEl!: HTMLDivElement;
  let gridEl!: HTMLDivElement;
  let timerBarEl!: HTMLDivElement;
  let cardEls: (HTMLButtonElement | null)[] = [];

  const bindCard: Action<HTMLButtonElement, number> = (node, idx) => {
    cardEls[idx] = node;
    return {
      update(newIdx) {
        if (cardEls[idx] === node) cardEls[idx] = null;
        idx = newIdx;
        cardEls[idx] = node;
      },
      destroy() {
        if (cardEls[idx] === node) cardEls[idx] = null;
      }
    };
  };

  // ─── État ────────────────────────────────────────────────────────────────────
  let cards: Card[] = [];
  let first: number | null = null;
  let lock = false;
  let moves = 0;
  let matchedCount = 0;
  let phase: Phase = "playing";
  let finalScore = 0;
  let elapsed = 0; // secondes
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let startMs = 0;

  $: timeLeft = Math.max(0, TIME_LIMIT - elapsed);
  $: timerPct = timeLeft / TIME_LIMIT;
  $: timerColor = timerPct > 0.5 ? "#8b0000" : timerPct > 0.25 ? "#c0392b" : "#ff1744";

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  // ─── Setup ───────────────────────────────────────────────────────────────────
  function setup() {
    stopTimer();

    cards = shuffle(
      SYMBOLS.flatMap((sym, i) => [
        { id: i * 2,     sym, flipped: false, matched: false },
        { id: i * 2 + 1, sym, flipped: false, matched: false }
      ])
    );

    cardEls = [];
    first = null;
    lock = false;
    moves = 0;
    matchedCount = 0;
    phase = "playing";
    finalScore = 0;
    elapsed = 0;
    startMs = nowMs();

    // Légère pause pour laisser le DOM se construire
    setTimeout(() => {
      animateGridIn();
      startTimer();
    }, 60);
  }

  // ─── Timer ───────────────────────────────────────────────────────────────────
  function startTimer() {
    timerInterval = setInterval(() => {
      elapsed = Math.floor((nowMs() - startMs) / 1000);
      if (elapsed >= TIME_LIMIT) finish(false);
    }, 500);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // ─── Animations GSAP ─────────────────────────────────────────────────────────

  /** Entrée en cascade des cartes */
  function animateGridIn() {
    const els = cardEls.filter(Boolean) as HTMLButtonElement[];
    if (!els.length) return;

    gsap.set(els, { opacity: 0, scale: 0.7, rotateY: 0 });
    gsap.to(els, {
      opacity: 1,
      scale: 1,
      duration: 0.35,
      ease: "back.out(1.4)",
      stagger: { each: 0.04, from: "start" }
    });
  }

  /** Flip vers face avant */
  function flipOpen(i: number) {
    const el = cardEls[i];
    if (!el) return;
    gsap.to(el, { rotateY: 180, duration: 0.3, ease: "power2.out" });
  }

  /** Flip vers face arrière */
  function flipClose(i: number) {
    const el = cardEls[i];
    if (!el) return;
    gsap.to(el, { rotateY: 0, duration: 0.3, ease: "power2.in" });
  }

  /** Pulsation verte sur match */
  function animateMatch(aIdx: number, bIdx: number) {
    const tl = gsap.timeline();
    const targets = [cardEls[aIdx], cardEls[bIdx]].filter(Boolean);

    tl.to(targets, {
      scale: 1.12,
      boxShadow: "0 0 28px 6px rgba(66,211,146,0.55)",
      duration: 0.22,
      ease: "power2.out"
    })
    .to(targets, {
      scale: 1.0,
      boxShadow: "0 0 0px rgba(0,0,0,0)",
      duration: 0.28,
      ease: "power2.in"
    });
  }

  /** Shake rouge sur fail */
  function animateFail(aIdx: number, bIdx: number) {
    const targets = [cardEls[aIdx], cardEls[bIdx]].filter(Boolean);

    gsap.timeline()
      .to(targets, {
        x: -10,
        boxShadow: "0 0 18px 4px rgba(255,23,68,0.5)",
        duration: 0.08,
        ease: "power1.out"
      })
      .to(targets, { x: 10, duration: 0.08 })
      .to(targets, { x: -6, duration: 0.07 })
      .to(targets, { x: 6, duration: 0.07 })
      .to(targets, { x: 0, boxShadow: "0 0 0px rgba(0,0,0,0)", duration: 0.1 });
  }

  /** Victoire : explosion de particules + zoom cartes */
  function animateVictory() {
    const els = cardEls.filter(Boolean) as HTMLButtonElement[];

    // Cascade de zoom sur chaque carte
    gsap.timeline()
      .to(els, {
        scale: 1.08,
        boxShadow: "0 0 24px 6px rgba(139,0,0,.6)",
        stagger: { each: 0.05, from: "random" },
        duration: 0.25,
        ease: "power2.out"
      })
      .to(els, {
        scale: 1,
        boxShadow: "0 0 0px rgba(0,0,0,0)",
        stagger: { each: 0.04, from: "random" },
        duration: 0.3,
        ease: "power2.in"
      });

    // Panel résultat glisse depuis le bas
    const resultEl = rootEl.querySelector<HTMLElement>("[data-result]");
    if (resultEl) {
      gsap.from(resultEl, {
        y: 50,
        opacity: 0,
        scale: 0.92,
        duration: 0.6,
        delay: 0.45,
        ease: "back.out(1.6)"
      });
    }
  }

  /** Défaite : fondu rouge */
  function animateDefeat() {
    const resultEl = rootEl.querySelector<HTMLElement>("[data-result]");
    if (resultEl) {
      gsap.from(resultEl, {
        y: 30,
        opacity: 0,
        duration: 0.5,
        delay: 0.2,
        ease: "power2.out"
      });
    }
  }

  // ─── Logique de jeu ──────────────────────────────────────────────────────────
  async function flip(i: number) {
    if (phase !== "playing" || lock) return;
    const c = cards[i];
    if (!c || c.matched || c.flipped) return;

    sfx.click();
    cards[i] = { ...c, flipped: true };
    flipOpen(i);

    if (first === null) {
      first = i;
      return;
    }

    // Deuxième carte
    lock = true;
    moves++;
    const aIdx = first;
    const bIdx = i;
    first = null;

    const isMatch = cards[aIdx].sym === cards[bIdx].sym;
    const delay = isMatch ? 260 : 600;

    setTimeout(async () => {
      if (isMatch) {
        sfx.win?.();
        cards[aIdx] = { ...cards[aIdx], matched: true };
        cards[bIdx] = { ...cards[bIdx], matched: true };
        matchedCount += 2;
        animateMatch(aIdx, bIdx);

        if (matchedCount === PAIRS * 2) {
          await finish(true);
          lock = false;
          return;
        }
      } else {
        sfx.lose?.();
        animateFail(aIdx, bIdx);
        // Attendre la fin du shake avant de retourner
        setTimeout(() => {
          cards[aIdx] = { ...cards[aIdx], flipped: false };
          cards[bIdx] = { ...cards[bIdx], flipped: false };
          flipClose(aIdx);
          flipClose(bIdx);
        }, 320);
      }

      lock = false;
    }, delay);
  }

  async function finish(won: boolean) {
    stopTimer();

    const timeMs = nowMs() - startMs;
    const timeSec = Math.floor(timeMs / 1000);
    const movePenalty = Math.max(0, (moves - PAIRS) * MOVE_PENALTY);
    const timePenalty = Math.floor(timeSec * 8);
    const total = won
      ? Math.max(0, BASE_SCORE - movePenalty - timePenalty)
      : 0;

    finalScore = total;

    await postScore(2, total, timeMs);

    if (won && total >= PASS_SCORE) {
      await unlockLevel(2);
      sfx.win?.();
      phase = "win";
      await tick();
      animateVictory();
    } else if (won) {
      sfx.lose?.();
      phase = "lose";
      await tick();
      animateDefeat();
    } else {
      sfx.lose?.();
      phase = "lose";
      await tick();
      animateDefeat();
    }
  }

  // tick() — attend que Svelte mette à jour le DOM
  function tick(): Promise<void> {
    return new Promise(r => setTimeout(r, 30));
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────
  onMount(() => {
    const ctx = gsap.context(() => {
      vampEnter(rootEl);
    }, rootEl);

    setup();
    return () => ctx.revert();
  });

  onDestroy(stopTimer);
</script>

<!-- ═══════════════════════════════════════════════════════════════════ MARKUP -->

<div bind:this={rootEl} class="memory-root" data-card>

  <!-- En-tête -->
  <div class="memory-header">
    <div class="header-left">
      <h2 class="memory-title">🃏 Mémoire des Ombres</h2>
      <p class="memory-sub">Retrouve les {PAIRS} paires — Score requis : {PASS_SCORE}</p>
    </div>

    <div class="header-stats">
      <!-- Timer -->
      <div class="stat-block timer-block" class:urgent={timeLeft <= 20}>
        <span class="stat-label">Temps</span>
        <span class="stat-value timer-value">{fmt(timeLeft)}</span>
        <div class="timer-bar-track">
          <div
            bind:this={timerBarEl}
            class="timer-bar-fill"
            style="width:{timerPct * 100}%; background:{timerColor};"
          ></div>
        </div>
      </div>

      <!-- Coups -->
      <div class="stat-block">
        <span class="stat-label">Coups</span>
        <span class="stat-value">{moves}</span>
        <span class="stat-ideal">idéal : {PAIRS}</span>
      </div>

      <!-- Paires -->
      <div class="stat-block">
        <span class="stat-label">Paires</span>
        <span class="stat-value">{matchedCount / 2}<span class="stat-denom">/{PAIRS}</span></span>
        <div class="pairs-dots">
          {#each Array(PAIRS) as _, i}
            <span class="pair-dot" class:lit={i < matchedCount / 2}></span>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <!-- Grille (masquée en fin de partie) -->
  {#if phase === "playing"}
    <div bind:this={gridEl} class="memory-grid">
      {#each cards as c, idx}
        <button
          use:bindCard={idx}
          class="mcard"
          class:flipped={c.flipped || c.matched}
          class:matched={c.matched}
          data-mcard
          on:click={() => flip(idx)}
          disabled={lock || phase !== "playing"}
          aria-label="Carte {idx + 1}"
        >
          <!-- Face arrière -->
          <div class="mcard-face mcard-back">
            <span class="mcard-back-glyph">🩶</span>
          </div>
          <!-- Face avant -->
          <div class="mcard-face mcard-front">
            <span class="mcard-sym">{c.sym}</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}

  <!-- Résultat -->
  {#if phase !== "playing"}
    <div data-result class="result-panel" class:result-win={phase === "win"} class:result-lose={phase === "lose"}>

      {#if phase === "win"}
        <div class="result-icon">🩸</div>
        <h3 class="result-title">La crypte s'ouvre…</h3>
        <p class="result-line">Niveau suivant débloqué !</p>
      {:else}
        <div class="result-icon">💀</div>
        <h3 class="result-title">Les ombres t'engloutissent</h3>
        <p class="result-line">
          {finalScore > 0 ? `Score insuffisant (${finalScore} < ${PASS_SCORE})` : "Temps écoulé."}
        </p>
      {/if}

      <div class="result-scores">
        <div class="rscore">
          <span class="rscore-label">Score</span>
          <span class="rscore-val" class:rscore-pass={finalScore >= PASS_SCORE}>{finalScore}</span>
        </div>
        <div class="rscore">
          <span class="rscore-label">Coups</span>
          <span class="rscore-val">{moves}</span>
        </div>
        <div class="rscore">
          <span class="rscore-label">Temps</span>
          <span class="rscore-val">{fmt(elapsed)}</span>
        </div>
      </div>

      <div class="result-actions">
        <a class="btn secondary" href="/dashboard">Dashboard</a>
        <button class="btn" on:click={setup}>Rejouer</button>
      </div>

    </div>
  {/if}

</div>

<!-- ═══════════════════════════════════════════════════════════════════ STYLES -->

<style>
  /* ── Racine ──────────────────────────────────────────── */
  .memory-root {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 700px;
    margin: 0 auto;
    padding: 28px 20px;
  }

  /* ── En-tête ─────────────────────────────────────────── */
  .memory-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .memory-title {
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--text, #e8e8e8);
    margin: 0 0 4px;
  }

  .memory-sub {
    font-size: 0.82rem;
    color: var(--muted, #888);
    margin: 0;
  }

  /* ── Stats bar ───────────────────────────────────────── */
  .header-stats {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
  }

  .stat-block {
    background: var(--panel2, rgba(255,255,255,.05));
    border: 1px solid rgba(139,0,0,.25);
    border-radius: 10px;
    padding: 10px 16px;
    min-width: 90px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    transition: border-color .3s;
  }

  .stat-label {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: var(--muted, #888);
  }

  .stat-value {
    font-size: 1.55rem;
    font-weight: 800;
    color: var(--text, #e8e8e8);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .stat-denom {
    font-size: .9rem;
    font-weight: 500;
    color: var(--muted, #888);
  }

  .stat-ideal {
    font-size: 0.68rem;
    color: var(--muted, #888);
  }

  /* Timer */
  .timer-block {
    min-width: 110px;
  }

  .timer-value {
    font-variant-numeric: tabular-nums;
  }

  .timer-block.urgent {
    border-color: rgba(255,23,68,.55);
    animation: pulse-border .6s ease-in-out infinite alternate;
  }

  @keyframes pulse-border {
    from { box-shadow: 0 0 0px rgba(255,23,68,0); }
    to   { box-shadow: 0 0 12px rgba(255,23,68,.4); }
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
    transition: width .5s linear, background .5s;
  }

  /* Paires dots */
  .pairs-dots {
    display: flex;
    gap: 3px;
    margin-top: 4px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .pair-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(255,255,255,.15);
    transition: background .25s, box-shadow .25s;
  }

  .pair-dot.lit {
    background: #8b0000;
    box-shadow: 0 0 6px rgba(139,0,0,.7);
  }

  /* ── Grille ──────────────────────────────────────────── */
  .memory-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }

  /* ── Carte ───────────────────────────────────────────── */
  .mcard {
    position: relative;
    aspect-ratio: 1;
    border: none;
    background: transparent;
    cursor: pointer;
    transform-style: preserve-3d;
    perspective: 900px;
    border-radius: 10px;
    outline: none;
    transition: filter .2s;
  }

  .mcard:disabled {
    cursor: default;
  }

  .mcard:not(.flipped):not(:disabled):hover {
    filter: brightness(1.15);
  }

  .mcard-face {
    position: absolute;
    inset: 0;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  /* Face arrière */
  .mcard-back {
    background: var(--panel2, #1a0a0a);
    border: 1px solid rgba(139,0,0,.35);
    transform: rotateY(0deg);
  }

  .mcard-back-glyph {
    font-size: 1.5rem;
    opacity: .4;
  }

  /* Face avant */
  .mcard-front {
    background: var(--panel, #1f0d0d);
    border: 1px solid rgba(139,0,0,.6);
    transform: rotateY(180deg);
  }

  .mcard-sym {
    font-size: 1.75rem;
    filter: drop-shadow(0 0 6px rgba(139,0,0,.4));
  }

  /* Carte retournée : flip CSS via GSAP (la classe sert de référence visuelle) */
  .mcard.matched .mcard-back {
    border-color: rgba(66,211,146,.3);
  }

  .mcard.matched .mcard-front {
    border-color: rgba(66,211,146,.5);
    background: rgba(66,211,146,.07);
  }

  .mcard.matched .mcard-sym {
    filter: drop-shadow(0 0 10px rgba(66,211,146,.5));
  }

  /* ── Résultat ────────────────────────────────────────── */
  .result-panel {
    border-radius: 14px;
    padding: 32px 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    border: 1px solid transparent;
  }

  .result-win {
    background: rgba(139,0,0,.12);
    border-color: rgba(139,0,0,.45);
  }

  .result-lose {
    background: rgba(30,30,30,.4);
    border-color: rgba(255,255,255,.1);
  }

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
    font-size: .9rem;
    color: var(--muted, #888);
    margin: 0;
    text-align: center;
  }

  .result-scores {
    display: flex;
    gap: 20px;
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
    font-size: .68rem;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: var(--muted, #888);
  }

  .rscore-val {
    font-size: 1.6rem;
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
  @media (max-width: 480px) {
    .memory-grid {
      grid-template-columns: repeat(4, 1fr);
      gap: 7px;
    }

    .mcard-sym { font-size: 1.35rem; }
    .mcard-back-glyph { font-size: 1.1rem; }
    .stat-value { font-size: 1.25rem; }
    .header-stats { gap: 8px; }
    .stat-block { min-width: 75px; padding: 8px 10px; }
  }
</style>