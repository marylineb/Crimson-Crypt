<script lang="ts">
  import "../app.css";
  export let data: any;

  async function logout(){
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/";
  }
</script>

<div class="fog"></div>

<div class="container" style="position:relative; z-index:1;">
  <header class="row" style="justify-content:space-between; margin: 10px 0 18px;">
    <div class="row" style="gap:10px;">
      <div class="badge">🦇 <b>Crimson Crypt</b> <span style="opacity:.6">—</span> <span style="opacity:.75">4 niveaux</span></div>
      {#if data?.user?.pseudo}
        <div class="badge">👤 {data.user.pseudo}</div>
      {/if}
    </div>

    <nav class="row" style="gap:8px;">
      <a class="btn secondary" href="/dashboard">Dashboard</a>
      <a class="btn secondary" href="/leaderboard">Leaderboard</a>
      {#if data?.user?.pseudo}
        <button class="btn" on:click={logout}>Logout</button>
      {/if}
    </nav>
  </header>

  <slot />
</div>
