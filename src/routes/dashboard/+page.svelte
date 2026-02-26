<script lang="ts">
  import { onMount } from "svelte";
  import { getRank, rankBadge } from "$lib/rank";

  type Progress = { unlockedLevel: number; completed: number[] };
  type Row = { pseudo: string; total: number; bestByLevel: Record<number, number> };

  let progress: Progress | null = null;
  let myTotal = 0;
  let loading = true;

  const levels = [
    { id: 1, title: "🧠 Quiz du Sang", desc: "10 questions. Réponds vite." },
    { id: 2, title: "🃏 Memory des Ombres", desc: "Paires. Moins de coups = mieux." },
    { id: 3, title: "🧩 Rune Puzzle", desc: "Déduis le code en 6 essais." },
    { id: 4, title: "🎮 Boss: Crimson Trial", desc: "Mix rapide: 3 micro-épreuves." }
  ];

  onMount(async () => {
    const [pRes, sRes] = await Promise.all([fetch("/api/progress"), fetch("/api/scores")]);
    const pData = await pRes.json();
    const sData = await sRes.json();

    progress = pData?.progress ?? { unlockedLevel: 1, completed: [] };

    // retrouve mon total via cookie côté serveur => pseudo affiché dans navbar
    // côté client: on prend le meilleur: si absent, total=0
    const me = (window?.document?.cookie ?? "");
    // pas de parsing cookie ici; on prend "ta ligne" en supposant pseudo présent côté serveur et reflété dans leaderboard
    // => on prend la 1ère ligne correspondant à ton pseudo via localStorage fallback
    const lastPseudo = localStorage.getItem("cc_last_pseudo") ?? "";

    const rows: Row[] = sData?.leaderboard ?? [];
    const mine = rows.find(r => r.pseudo.toLowerCase() === lastPseudo.toLowerCase());
    myTotal = mine?.total ?? 0;

    loading = false;
  });

  // on stocke le pseudo depuis la navbar via une astuce: on le récupère sur le DOM
  // plus simple: au premier accès dashboard, on lit le badge "👤 pseudo"
  // et on le met en localStorage.
  $: {
    const el = document?.querySelector?.("header .badge:nth-child(2)");
    const txt = el?.textContent ?? "";
    if (txt.includes("👤")) {
      const pseudo = txt.replace("👤","").trim();
      if (pseudo) localStorage.setItem("cc_last_pseudo", pseudo);
    }
  }

  function isUnlocked(level: number){
    return (progress?.unlockedLevel ?? 1) >= level;
  }
  function isDone(level: number){
    return (progress?.completed ?? []).includes(level);
  }
</script>

<div class="card">
  <div class="card-inner">
    <h2 class="h2">Dashboard</h2>
    <p class="p">Chaque niveau terminé débloque le suivant. Termine les 4 pour dominer le leaderboard.</p>

    {#if loading}
      <div class="toast">Chargement de ta progression…</div>
    {:else}
      <div class="row" style="margin-bottom:10px;">
        <span class="badge">🔓 Débloqué jusqu’au niveau <b>{progress?.unlockedLevel}</b></span>
        <span class="badge">✅ Terminés: <b>{progress?.completed?.length ?? 0}</b>/4</span>
        <span class="badge">🏅 Rang: <b>{rankBadge(getRank(myTotal))}</b></span>
        <span class="badge">🧮 Total: <b>{myTotal}</b></span>
      </div>

      <div class="grid">
        {#each levels as lv}
          <div class="card" style="background: var(--panel2);">
            <div class="card-inner">
              <div class="row" style="justify-content:space-between;">
                <div>
                  <div class="h2" style="margin-bottom:6px;">
                    {lv.title}
                    {#if isDone(lv.id)} <span class="badge" style="margin-left:8px;">✔ terminé</span>{/if}
                    {#if !isUnlocked(lv.id)} <span class="badge" style="margin-left:8px;">🔒 verrouillé</span>{/if}
                  </div>
                  <p class="p">{lv.desc}</p>
                </div>

                {#if isUnlocked(lv.id)}
                  <a class="btn" href={"/play/" + lv.id}>Jouer</a>
                {:else}
                  <button class="btn" disabled>Jouer</button>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>