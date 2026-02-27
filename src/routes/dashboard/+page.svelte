<script lang="ts">
  import { onMount } from "svelte";
  import { getRank, rankBadge } from "$lib/rank";

  export let data: { pseudo: string };

  type Progress = { unlockedLevel: number; completed: number[] };
  type Row = { pseudo: string; total: number; bestByLevel: Record<number, number> };

  let progress: Progress = { unlockedLevel: 1, completed: [] };
  let myTotal = 0;
  let loading = true;
  let error = "";

  const levels = [
    { id: 1, title: "🧠 Quiz du Sang", desc: "10 questions. Réponds vite." },
    { id: 2, title: "🃏 Memory des Ombres", desc: "Paires. Moins de coups = mieux." },
    { id: 3, title: "🧩 Rune Puzzle", desc: "Déduis le code en 6 essais." },
    { id: 4, title: "🎮 Boss: Crimson Trial", desc: "Mix rapide: 3 micro-épreuves." }
  ];

  const isUnlocked = (id: number) => id <= (progress?.unlockedLevel ?? 1);
  const isDone = (id: number) => (progress?.completed ?? []).includes(id);

  onMount(async () => {
    loading = true;
    error = "";

    try {
      // on stocke le pseudo proprement (plus besoin d'hack DOM/localStorage)
      localStorage.setItem("cc_last_pseudo", data.pseudo);

      const [pRes, sRes] = await Promise.all([fetch("/api/progress"), fetch("/api/scores")]);

      const pData = await pRes.json().catch(() => ({}));
      const sData = await sRes.json().catch(() => ({}));

      progress = pData?.progress ?? { unlockedLevel: 1, completed: [] };

      const rows: Row[] = sData?.leaderboard ?? [];
      const mine = rows.find((r) => r.pseudo.toLowerCase() === data.pseudo.toLowerCase());
      myTotal = mine?.total ?? 0;
    } catch (e) {
      error = "Impossible de charger ta progression. Réessaie.";
    } finally {
      loading = false;
    }
  });
</script>

<div class="card">
  <div class="card-inner">
    <h2 class="h2">Dashboard</h2>
    <p class="p">Chaque niveau terminé débloque le suivant. Termine les 4 pour dominer le leaderboard.</p>

    {#if loading}
      <div class="toast">Chargement de ta progression…</div>
    {:else if error}
      <div class="toast">{error}</div>
    {:else}
      <div class="row" style="margin-bottom:10px;">
        <span class="badge">👤 <b>{data.pseudo}</b></span>
        <span class="badge">🔓 Débloqué jusqu’au niveau <b>{progress.unlockedLevel}</b></span>
        <span class="badge">✅ Terminés: <b>{progress.completed.length}</b>/4</span>
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
                    {#if isDone(lv.id)}
                      <span class="badge" style="margin-left:8px;">✔ terminé</span>
                    {/if}
                    {#if !isUnlocked(lv.id)}
                      <span class="badge" style="margin-left:8px;">🔒 verrouillé</span>
                    {/if}
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