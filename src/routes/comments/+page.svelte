<script lang="ts">
  import { onMount } from "svelte";

  type Comment = { id: string; pseudo: string; message: string; created_at: string };

  let comments: Comment[] = [];
  let message = "";
  let loading = true;
  let sending = false;
  let error = "";

  async function load() {
    loading = true;
    error = "";
    try {
      const res = await fetch("/api/comments?limit=80");
      const data = await res.json();
      if (!data.ok) throw new Error(data.message ?? "Erreur");
      comments = data.comments ?? [];
    } catch (e: any) {
      error = e?.message ?? "Impossible de charger.";
    } finally {
      loading = false;
    }
  }

  async function send() {
    error = "";
    const clean = message.trim();
    if (clean.length < 2) { error = "Écris au moins 2 caractères."; return; }

    sending = true;
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message ?? "Erreur d’envoi");

      message = "";
      await load();
    } catch (e: any) {
      error = e?.message ?? "Erreur réseau.";
    } finally {
      sending = false;
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString();

  onMount(load);
</script>

<div class="card" data-card>
  <div class="card-inner">
    <div class="row" style="justify-content:space-between;">
      <h2 class="h2">💬 Livre des Ombres</h2>
      <span class="badge">Max 240 caractères</span>
    </div>

    <div class="card" style="background: var(--panel2);">
      <div class="card-inner">
        <label for="msg" class="p" style="display:block; margin-bottom:6px;">Ton commentaire</label>
        <textarea
          id="msg"
          class="input"
          rows="3"
          bind:value={message}
          maxlength="240"
          placeholder="Laisse un message dans la crypte…"
          style="resize: vertical;"
        ></textarea>

        <div class="row" style="justify-content:space-between; margin-top:10px;">
          <span class="badge">{message.trim().length}/240</span>
          <div class="row">
            <button class="btn secondary" on:click={load} disabled={loading || sending}>Rafraîchir</button>
            <button class="btn" on:click={send} disabled={sending || message.trim().length < 2}>
              {sending ? "Envoi…" : "Publier"}
            </button>
          </div>
        </div>

        {#if error}
          <div class="toast" style="margin-top:10px;">{error}</div>
        {/if}
      </div>
    </div>

    <div class="hr"></div>

    {#if loading}
      <div class="toast">Chargement…</div>
    {:else if comments.length === 0}
      <div class="toast">Aucun commentaire pour l’instant 😈</div>
    {:else}
      <div class="grid" style="gap:10px;">
        {#each comments as c (c.id)}
          <div class="card" style="background: var(--panel2);">
            <div class="card-inner">
              <div class="row" style="justify-content:space-between;">
                <span class="badge">👤 <b>{c.pseudo}</b></span>
                <span class="badge" style="opacity:.7;">{fmt(c.created_at)}</span>
              </div>
              <div class="p" style="margin-top:8px;">{c.message}</div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>