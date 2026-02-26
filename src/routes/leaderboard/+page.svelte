<script lang="ts">
  import { onMount } from "svelte";
  import { getRank, rankBadge } from "$lib/rank";

  type Row = { pseudo: string; total: number; bestByLevel: Record<number, number> };

  let rows: Row[] = [];
  let loading = true;

  onMount(async () => {
    const res = await fetch("/api/scores");
    const data = await res.json();
    rows = data?.leaderboard ?? [];
    loading = false;
  });
</script>

<div class="card">
  <div class="card-inner">
    <h2 class="h2">Leaderboard</h2>
    <p class="p">Total = somme des meilleurs scores par niveau (1..4). Rang = Ghoul / Vampire / Lord.</p>

    {#if loading}
      <div class="toast">Chargement…</div>
    {:else}
      <div class="card" style="background: var(--panel2); overflow:auto;">
        <div class="card-inner">
          <table style="width:100%; border-collapse:collapse; min-width: 740px;">
            <thead>
              <tr style="text-align:left; color: var(--muted);">
                <th style="padding:10px; border-bottom:1px solid var(--line);">#</th>
                <th style="padding:10px; border-bottom:1px solid var(--line);">Pseudo</th>
                <th style="padding:10px; border-bottom:1px solid var(--line);">Rang</th>
                <th style="padding:10px; border-bottom:1px solid var(--line);">N1</th>
                <th style="padding:10px; border-bottom:1px solid var(--line);">N2</th>
                <th style="padding:10px; border-bottom:1px solid var(--line);">N3</th>
                <th style="padding:10px; border-bottom:1px solid var(--line);">N4</th>
                <th style="padding:10px; border-bottom:1px solid var(--line);">Total</th>
              </tr>
            </thead>
            <tbody>
              {#each rows as r, i}
                <tr>
                  <td style="padding:10px; border-bottom:1px solid var(--line);">{i+1}</td>
                  <td style="padding:10px; border-bottom:1px solid var(--line);"><b>{r.pseudo}</b></td>
                  <td style="padding:10px; border-bottom:1px solid var(--line);">{rankBadge(getRank(r.total))}</td>
                  <td style="padding:10px; border-bottom:1px solid var(--line);">{r.bestByLevel[1] ?? 0}</td>
                  <td style="padding:10px; border-bottom:1px solid var(--line);">{r.bestByLevel[2] ?? 0}</td>
                  <td style="padding:10px; border-bottom:1px solid var(--line);">{r.bestByLevel[3] ?? 0}</td>
                  <td style="padding:10px; border-bottom:1px solid var(--line);">{r.bestByLevel[4] ?? 0}</td>
                  <td style="padding:10px; border-bottom:1px solid var(--line);">
                    <span class="badge" style="color:var(--text); border-color: rgba(255,46,70,.35);">{r.total}</span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>

          {#if rows.length === 0}
            <div class="toast">Aucun score pour l’instant. Va jouer 😈</div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>