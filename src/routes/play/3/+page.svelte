<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { gsap } from "gsap";
  import { nowMs, postScore, unlockLevel } from "$lib/game";
  import { vampEnter } from "$lib/anim";
  import { sfx } from "$lib/sfx";

  // ─── Constantes ──────────────────────────────────────────────────────────────
  const MAX_TRIES  = 6;
  const CODE_LEN   = 4;
  const TIME_LIMIT = 180; // secondes

  // ─── Types ───────────────────────────────────────────────────────────────────
  type LogEntry = { guess: number[]; bulls: number; cows: number };
  type Phase    = "playing" | "win" | "lose";

  // ─── DOM Refs ────────────────────────────────────────────────────────────────
  let rootEl!: HTMLDivElement;
  let slotEls: (HTMLDivElement | null)[] = [];
  let logListEl!: HTMLDivElement;
  let triesEl!: HTMLSpanElement;

  // ─── État ────────────────────────────────────────────────────────────────────
  let code      = randCode();
  let pick: number[] = [];
  let log: LogEntry[] = [];
  let phase: Phase    = "playing";
  let finalScore = 0;
  let elapsed    = 0;
  let startMs    = 0;
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  $: triesLeft = MAX_TRIES - log.length;
  $: timeLeft  = Math.max(0, TIME_LIMIT - elapsed);
  $: timerPct  = timeLeft / TIME_LIMIT;
  $: timerColor = timerPct > 0.5 ? "#8b0000" : timerPct > 0.25 ? "#c0392b" : "#ff1744";

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}:${(s % 60).toString().padStart(2, "0")}` : `${s}s`;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function randCode(): number[] {
    const pool = [0,1,2,3,4,5,6,7,8,9];
    const res: number[] = [];
    while (res.length < CODE_LEN) {
      const i = Math.floor(Math.random() * pool.length);
      res.push(pool.splice(i, 1)[0]);
    }
    return res;
  }

  function scoreGuess(guess: number[]): { bulls: number; cows: number } {
    let bulls = 0, cows = 0;
    for (let i = 0; i < CODE_LEN; i++) {
      if      (guess[i] === code[i])       bulls++;
      else if (code.includes(guess[i]))    cows++;
    }
    return { bulls, cows };
  }

  // ─── Timer ───────────────────────────────────────────────────────────────────
  function startTimer() {
    startMs = nowMs();
    timerInterval = setInterval(() => {
      elapsed = Math.floor((nowMs() - startMs) / 1000);
      if (elapsed >= TIME_LIMIT) void finish(false);
    }, 300);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  // ─── Animations GSAP ─────────────────────────────────────────────────────────

  /** Bounce d'un slot quand un chiffre est ajouté */
  function animateSlotAdd(idx: number) {
    const el = slotEls[idx];
    if (!el) return;
    gsap.fromTo(el,
      { scale: 0.75, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.25, ease: "back.out(2.2)" }
    );
  }

  /** Shake des slots quand on efface */
  function animateSlotRemove(idx: number) {
    const el = slotEls[idx];
    if (!el) return;
    gsap.fromTo(el,
      { x: 4 },
      { x: 0, duration: 0.18, ease: "power2.out" }
    );
  }

  /** Feedback sur les boutons chiffres — bounce */
  function animateDigitBtn(btn: HTMLElement) {
    gsap.fromTo(btn,
      { scale: 0.88 },
      { scale: 1, duration: 0.22, ease: "back.out(2.4)" }
    );
  }

  /** Feedback submit correct — flash vert sur les slots */
  function animateSlotsBull() {
    const els = slotEls.filter(Boolean) as HTMLDivElement[];
    gsap.timeline()
      .to(els, {
        boxShadow: "0 0 20px 4px rgba(66,211,146,.55)",
        borderColor: "rgba(66,211,146,.8)",
        duration: 0.22,
        stagger: 0.06,
        ease: "power2.out"
      })
      .to(els, {
        boxShadow: "0 0 0px rgba(0,0,0,0)",
        borderColor: "rgba(139,0,0,.5)",
        duration: 0.3,
        stagger: 0.04
      });
  }

  /** Feedback submit mauvais guess — shake des slots */
  function animateSlotsShake() {
    const els = slotEls.filter(Boolean) as HTMLDivElement[];
    gsap.timeline()
      .to(els, { x: -8, boxShadow: "0 0 14px rgba(255,23,68,.4)", duration: 0.07 })
      .to(els, { x:  8, duration: 0.07 })
      .to(els, { x: -5, duration: 0.06 })
      .to(els, { x:  5, duration: 0.06 })
      .to(els, { x:  0, boxShadow: "0 0 0px rgba(0,0,0,0)", duration: 0.1 });
  }

  /** Entrée d'une ligne dans le log */
  function animateLogEntry() {
    if (!logListEl) return;
    const firstRow = logListEl.querySelector<HTMLElement>("[data-log-row='0']");
    if (!firstRow) return;
    gsap.fromTo(firstRow,
      { x: 20, opacity: 0 },
      { x: 0,  opacity: 1, duration: 0.32, ease: "power3.out" }
    );
  }

  /** Pulse du compteur d'essais */
  function animateTries() {
    if (!triesEl) return;
    gsap.fromTo(triesEl,
      { scale: 1 },
      { scale: 1.25, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out" }
    );
  }

  /** Victoire */
  function animateVictory() {
    const slots = slotEls.filter(Boolean) as HTMLDivElement[];
    gsap.timeline()
      .to(slots, {
        scale: 1.1,
        boxShadow: "0 0 26px 6px rgba(139,0,0,.65)",
        stagger: { each: 0.08, from: "start" },
        duration: 0.25,
        ease: "power2.out"
      })
      .to(slots, {
        scale: 1,
        boxShadow: "0 0 0px rgba(0,0,0,0)",
        stagger: { each: 0.06 },
        duration: 0.3,
        ease: "power2.in"
      });

    const panel = rootEl.querySelector<HTMLElement>("[data-result]");
    if (panel) {
      gsap.from(panel, { y: 50, opacity: 0, scale: 0.92, duration: 0.55, delay: 0.4, ease: "back.out(1.6)" });
    }
  }

  /** Défaite */
  function animateDefeat() {
    gsap.timeline()
      .to(rootEl, { x: -14, duration: 0.07 })
      .to(rootEl, { x:  14, duration: 0.07 })
      .to(rootEl, { x: -10, duration: 0.06 })
      .to(rootEl, { x:  10, duration: 0.06 })
      .to(rootEl, { x:   0, duration: 0.1  });

    const panel = rootEl.querySelector<HTMLElement>("[data-result]");
    if (panel) {
      gsap.from(panel, { y: 30, opacity: 0, duration: 0.45, delay: 0.25, ease: "power2.out" });
    }
  }

  // ─── Logique de jeu ──────────────────────────────────────────────────────────
  function addDigit(d: number, btn: HTMLElement) {
    if (phase !== "playing" || pick.includes(d) || pick.length >= CODE_LEN) return;
    sfx.click();
    pick = [...pick, d];
    animateDigitBtn(btn);
    animateSlotAdd(pick.length - 1);
  }

  function backspace() {
    if (phase !== "playing" || pick.length === 0) return;
    sfx.click?.();
    const idx = pick.length - 1;
    pick = pick.slice(0, -1);
    animateSlotRemove(idx);
  }

  async function submit() {
    if (phase !== "playing" || pick.length !== CODE_LEN) return;

    sfx.click();
    const { bulls, cows } = scoreGuess(pick);
    const isWin = bulls === CODE_LEN;

    log = [{ guess: pick, bulls, cows }, ...log];
    pick = [];

    await tick();
    animateLogEntry();
    animateTries();

    if (isWin) {
      await finish(true);
    } else if (log.length >= MAX_TRIES) {
      await finish(false);
    } else {
      if (bulls > 0 || cows > 0) {
        animateSlotsBull();
      } else {
        animateSlotsShake();
      }
    }
  }

  async function finish(won: boolean) {
    stopTimer();
    if (phase !== "playing") return;

    const timeMs = nowMs() - startMs;
    const triesBonus = won ? (triesLeft) * 220 : 0;
    const timeBonus  = won ? Math.max(0, 700 - Math.floor(timeMs / 60)) : 0;
    const base       = won ? 2000 : 400;
    const total      = Math.max(0, base + triesBonus + timeBonus);

    finalScore = total;
    await postScore(3, total, timeMs);

    if (won) {
      await unlockLevel(3);
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
    code      = randCode();
    pick      = [];
    log       = [];
    phase     = "playing";
    elapsed   = 0;
    finalScore = 0;
    slotEls   = [];

    setTimeout(() => {
      gsap.fromTo(rootEl, { opacity: 0.85, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" });
      startTimer();
    }, 40);
  }

  function tick(): Promise<void> {
    return new Promise(r => setTimeout(r, 30));
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────
  onMount(() => {
    const ctx = gsap.context(() => vampEnter(rootEl), rootEl);
    startTimer();
    return () => ctx.revert();
  });

  onDestroy(stopTimer);
</script>

<!-- ═══════════════════════════════════════════════════════════════════ MARKUP -->

<div bind:this={rootEl} class="puzzle-root" data-card>

  <!-- En-tête -->
  <div class="puzzle-header">
    <div class="header-left">
      <h2 class="puzzle-title">🧩 Rune Puzzle</h2>
      <p class="puzzle-sub">Code à {CODE_LEN} chiffres uniques — {MAX_TRIES} essais maximum</p>
    </div>

    <div class="header-stats">

      <!-- Timer -->
      <div class="stat-block timer-block" class:urgent={timeLeft <= 30}>
        <span class="stat-label">Temps</span>
        <span class="stat-value" style="font-variant-numeric:tabular-nums;">{fmt(timeLeft)}</span>
        <div class="timer-bar-track">
          <div class="timer-bar-fill" style="width:{timerPct * 100}%; background:{timerColor};"></div>
        </div>
      </div>

      <!-- Essais -->
      <div class="stat-block">
        <span class="stat-label">Essais</span>
        <span bind:this={triesEl} class="stat-value tries-val" class:tries-danger={triesLeft <= 2}>
          {triesLeft}<span class="stat-denom">/{MAX_TRIES}</span>
        </span>
        <div class="tries-dots">
          {#each Array(MAX_TRIES) as _, di}
            <span
              class="try-dot"
              class:dot-used={di >= triesLeft}
              class:dot-last={triesLeft === 1 && di === 0}
            ></span>
          {/each}
        </div>
      </div>

      <!-- Tentative en cours -->
      <div class="stat-block">
        <span class="stat-label">Tentative</span>
        <span class="stat-value">{log.length + 1}</span>
        <span class="stat-sub">en cours</span>
      </div>

    </div>
  </div>

  <!-- Zone de jeu -->
  {#if phase === "playing"}
    <div class="puzzle-body">

      <!-- Panneau gauche : saisie -->
      <div class="input-panel">
        <p class="panel-label">Ta combinaison</p>

        <!-- Slots chiffres -->
        <div class="slots-row">
          {#each Array(CODE_LEN) as _, idx}
            <div
              bind:this={slotEls[idx]}
              class="digit-slot"
              class:slot-filled={pick[idx] !== undefined}
              class:slot-cursor={pick.length === idx}
            >
              {#if pick[idx] !== undefined}
                <span class="slot-digit">{pick[idx]}</span>
              {:else}
                <span class="slot-placeholder">·</span>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Actions -->
        <div class="input-actions">
          <button
            class="action-btn secondary"
            on:click={backspace}
            disabled={pick.length === 0}
          >⌫ Effacer</button>
          <button
            class="action-btn primary"
            on:click={submit}
            disabled={pick.length !== CODE_LEN}
          >Valider ↵</button>
        </div>

        <!-- Clavier numérique -->
        <div class="numpad">
          {#each [0,1,2,3,4,5,6,7,8,9] as d}
            <button
              class="num-btn"
              class:num-used={pick.includes(d)}
              on:click={(e) => addDigit(d, e.currentTarget as HTMLElement)}
              disabled={pick.includes(d) || pick.length >= CODE_LEN}
            >
              {d}
            </button>
          {/each}
        </div>

        <!-- Légende -->
        <div class="legend">
          <span class="legend-item">🐂 <b>Bull</b> = bon chiffre, bonne position</span>
          <span class="legend-item">🐄 <b>Cow</b> = bon chiffre, mauvaise position</span>
        </div>
      </div>

      <!-- Panneau droit : journal -->
      <div class="log-panel">
        <p class="panel-label">Journal des essais</p>

        {#if log.length === 0}
          <div class="log-empty">
            <span class="log-empty-icon">🩸</span>
            <p>Aucune tentative.<br>Fais couler l'encre…</p>
          </div>
        {:else}
          <div bind:this={logListEl} class="log-list">
            {#each log as entry, idx}
              <div class="log-row" data-log-row={idx === 0 ? 0 : undefined}>
                <div class="log-guess">
                  {#each entry.guess as d, gi}
                    <span
                      class="log-digit"
                      class:lg-bull={entry.bulls > 0 && code[gi] === d}
                      class:lg-cow={entry.cows > 0 && code[gi] !== d && code.includes(d)}
                    >{d}</span>
                  {/each}
                </div>
                <div class="log-feedback">
                  <span class="fb-chip fb-bull">🐂 {entry.bulls}</span>
                  <span class="fb-chip fb-cow">🐄 {entry.cows}</span>
                </div>
                <span class="log-attempt">#{log.length - idx}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>

    </div>
  {/if}

  <!-- Résultat -->
  {#if phase !== "playing"}
    <div data-result class="result-panel" class:result-win={phase === "win"} class:result-lose={phase === "lose"}>

      {#if phase === "win"}
        <div class="result-icon">🩸</div>
        <h3 class="result-title">Le code t'appartient</h3>
        <p class="result-line">Niveau suivant débloqué !</p>
        <div class="code-reveal">
          {#each code as d}
            <span class="code-digit-reveal">{d}</span>
          {/each}
        </div>
      {:else}
        <div class="result-icon">💀</div>
        <h3 class="result-title">La crypte garde ses secrets</h3>
        <p class="result-line">Le code était :</p>
        <div class="code-reveal">
          {#each code as d}
            <span class="code-digit-reveal">{d}</span>
          {/each}
        </div>
      {/if}

      <div class="result-scores">
        <div class="rscore">
          <span class="rscore-label">Score</span>
          <span class="rscore-val" class:rscore-pass={phase === "win"}>{finalScore}</span>
        </div>
        <div class="rscore">
          <span class="rscore-label">Essais</span>
          <span class="rscore-val">{log.length}/{MAX_TRIES}</span>
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
  .puzzle-root {
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 760px;
    margin: 0 auto;
    padding: 28px 20px;
  }

  /* ── En-tête ─────────────────────────────────────────── */
  .puzzle-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }

  .puzzle-title {
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--text, #e8e8e8);
    margin: 0 0 4px;
  }

  .puzzle-sub {
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

  .stat-label { font-size:.66rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted,#888); }
  .stat-value { font-size:1.5rem; font-weight:800; color:var(--text,#e8e8e8); line-height:1; }
  .stat-denom { font-size:.85rem; font-weight:500; color:var(--muted,#888); }
  .stat-sub   { font-size:.66rem; color:var(--muted,#888); }

  .tries-val { color: #c0392b; }
  .tries-danger { color: #ff1744 !important; text-shadow: 0 0 10px rgba(255,23,68,.5); }

  .tries-dots {
    display: flex;
    gap: 3px;
    margin-top: 4px;
    justify-content: center;
  }

  .try-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: rgba(139,0,0,.5);
    box-shadow: 0 0 4px rgba(139,0,0,.4);
    transition: background .2s, box-shadow .2s;
  }

  .try-dot.dot-used {
    background: rgba(255,255,255,.12);
    box-shadow: none;
  }

  .try-dot.dot-last {
    background: #ff1744;
    box-shadow: 0 0 8px rgba(255,23,68,.7);
    animation: last-pulse .5s ease-in-out infinite alternate;
  }

  @keyframes last-pulse {
    from { box-shadow: 0 0 4px rgba(255,23,68,.5); }
    to   { box-shadow: 0 0 14px rgba(255,23,68,.9); }
  }

  /* Timer */
  .timer-block { min-width: 100px; }

  .timer-block.urgent {
    border-color: rgba(255,23,68,.6);
    animation: pulse-border .55s ease-in-out infinite alternate;
  }

  @keyframes pulse-border {
    from { box-shadow: 0 0 0px rgba(255,23,68,0); }
    to   { box-shadow: 0 0 14px rgba(255,23,68,.45); }
  }

  .timer-bar-track {
    width: 100%; height: 4px;
    background: rgba(255,255,255,.1);
    border-radius: 2px;
    margin-top: 4px;
    overflow: hidden;
  }

  .timer-bar-fill {
    height: 100%; border-radius: 2px;
    transition: width .3s linear, background .4s;
  }

  /* ── Body : layout 2 colonnes ────────────────────────── */
  .puzzle-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    align-items: start;
  }

  .input-panel,
  .log-panel {
    background: var(--panel2, rgba(255,255,255,.04));
    border: 1px solid rgba(139,0,0,.25);
    border-radius: 14px;
    padding: 20px 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .panel-label {
    font-size: .72rem;
    text-transform: uppercase;
    letter-spacing: .1em;
    color: var(--muted, #888);
    margin: 0;
  }

  /* ── Slots ───────────────────────────────────────────── */
  .slots-row {
    display: flex;
    gap: 10px;
    justify-content: center;
  }

  .digit-slot {
    width: 56px; height: 60px;
    border: 2px solid rgba(139,0,0,.35);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--panel, rgba(255,255,255,.03));
    transition: border-color .15s;
  }

  .digit-slot.slot-filled {
    border-color: rgba(139,0,0,.7);
    background: rgba(139,0,0,.1);
  }

  .digit-slot.slot-cursor {
    border-color: rgba(192,57,43,.9);
    box-shadow: 0 0 10px rgba(139,0,0,.3);
    animation: blink-cursor .8s ease-in-out infinite alternate;
  }

  @keyframes blink-cursor {
    from { box-shadow: 0 0 6px rgba(139,0,0,.2); }
    to   { box-shadow: 0 0 14px rgba(139,0,0,.5); }
  }

  .slot-digit {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--text, #e8e8e8);
    font-family: var(--mono, monospace);
  }

  .slot-placeholder {
    font-size: 1.4rem;
    color: rgba(255,255,255,.2);
  }

  /* ── Actions ─────────────────────────────────────────── */
  .input-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    flex: 1;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: .9rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: opacity .15s, transform .1s;
  }

  .action-btn:disabled { opacity: .35; cursor: default; }
  .action-btn:not(:disabled):hover { transform: translateY(-1px); }

  .action-btn.secondary {
    background: rgba(255,255,255,.06);
    border-color: rgba(255,255,255,.15);
    color: var(--text, #e8e8e8);
  }

  .action-btn.primary {
    background: linear-gradient(135deg, #8b0000, #c0392b);
    color: #fff;
    box-shadow: 0 0 14px rgba(139,0,0,.4);
  }

  .action-btn.primary:not(:disabled):hover {
    box-shadow: 0 0 20px rgba(139,0,0,.6);
  }

  /* ── Clavier numérique ───────────────────────────────── */
  .numpad {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 7px;
  }

  .num-btn {
    aspect-ratio: 1;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 700;
    font-family: var(--mono, monospace);
    border: 1px solid rgba(139,0,0,.35);
    background: var(--panel, rgba(255,255,255,.04));
    color: var(--text, #e8e8e8);
    cursor: pointer;
    transition: border-color .12s, background .12s, opacity .2s;
  }

  .num-btn:not(:disabled):hover {
    border-color: rgba(139,0,0,.75);
    background: rgba(139,0,0,.12);
  }

  .num-btn.num-used,
  .num-btn:disabled {
    opacity: .3;
    cursor: default;
  }

  /* ── Légende ─────────────────────────────────────────── */
  .legend {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .legend-item {
    font-size: .74rem;
    color: var(--muted, #888);
  }

  /* ── Journal ─────────────────────────────────────────── */
  .log-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 24px 0;
    color: var(--muted, #888);
    font-size: .88rem;
    text-align: center;
  }

  .log-empty-icon { font-size: 2rem; opacity: .5; }

  .log-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .log-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: rgba(255,255,255,.03);
    border: 1px solid rgba(139,0,0,.2);
    border-radius: 8px;
  }

  .log-guess {
    display: flex;
    gap: 5px;
  }

  .log-digit {
    width: 28px; height: 30px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: .95rem;
    font-weight: 700;
    font-family: var(--mono, monospace);
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.1);
    transition: background .2s, border-color .2s;
  }

  .log-digit.lg-bull {
    background: rgba(66,211,146,.18);
    border-color: rgba(66,211,146,.5);
    color: #42d392;
  }

  .log-digit.lg-cow {
    background: rgba(192,57,43,.15);
    border-color: rgba(192,57,43,.45);
    color: #c0392b;
  }

  .log-feedback {
    display: flex;
    gap: 5px;
    margin-left: auto;
  }

  .fb-chip {
    font-size: .74rem;
    padding: 2px 7px;
    border-radius: 20px;
    font-weight: 600;
  }

  .fb-bull { background: rgba(66,211,146,.15); color: #42d392; border: 1px solid rgba(66,211,146,.3); }
  .fb-cow  { background: rgba(192,57,43,.15);  color: #c0392b; border: 1px solid rgba(192,57,43,.3); }

  .log-attempt {
    font-size: .68rem;
    color: rgba(255,255,255,.25);
    min-width: 20px;
    text-align: right;
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

  .result-icon  { font-size: 3rem; line-height: 1; filter: drop-shadow(0 0 18px rgba(139,0,0,.7)); }
  .result-title { font-size: 1.4rem; font-weight: 800; color: var(--text, #e8e8e8); margin: 0; text-align: center; }
  .result-line  { font-size: .88rem; color: var(--muted, #888); margin: 0; }

  .code-reveal {
    display: flex;
    gap: 8px;
    margin: 4px 0;
  }

  .code-digit-reveal {
    width: 46px; height: 50px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 800;
    font-family: var(--mono, monospace);
    background: rgba(139,0,0,.25);
    border: 1px solid rgba(139,0,0,.6);
    color: var(--text, #e8e8e8);
    box-shadow: 0 0 14px rgba(139,0,0,.3);
  }

  .result-scores {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 4px;
  }

  .rscore { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .rscore-label { font-size:.66rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted,#888); }
  .rscore-val   { font-size:1.55rem; font-weight:800; color:var(--text,#e8e8e8); font-variant-numeric:tabular-nums; }
  .rscore-pass  { color:#42d392; text-shadow:0 0 12px rgba(66,211,146,.5); }

  .result-actions { display: flex; gap: 10px; margin-top: 6px; }

  /* ── Responsive ──────────────────────────────────────── */
  @media (max-width: 580px) {
    .puzzle-body { grid-template-columns: 1fr; }
    .header-stats { gap: 8px; }
    .stat-block { min-width: 72px; padding: 8px 10px; }
    .stat-value { font-size: 1.2rem; }
    .digit-slot { width: 48px; height: 52px; }
  }
</style>