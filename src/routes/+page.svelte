<script lang="ts">
  import { onMount } from "svelte";
  import { gsap } from "gsap";
  import { vampEnter, vampButtonHover, vampShake } from "$lib/anim";

  let pseudo = "";
  let error = "";
  let loading = false;

  let rootEl: HTMLDivElement;
  let btnEl: HTMLButtonElement;

  async function submit(){
    error = "";
    loading = true;
    try{
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ pseudo })
      });
      const data = await res.json();
      if (!data.ok) {
        error = data.message ?? "Erreur.";
        // shake quand erreur
        vampShake(rootEl.querySelector("[data-card]") as HTMLElement);
      } else {
        // mini transition sortie
        await gsap.to(rootEl.querySelector("[data-card]"), { opacity: 0, y: -10, duration: 0.25 });
        location.href = "/dashboard";
      }
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    const ctx = gsap.context(() => {
      vampEnter(rootEl);

      // titre glitch-ish + glow
      const h1 = rootEl.querySelector("[data-title]");
      if (h1) {
        gsap.fromTo(h1,
          { letterSpacing: "1.2px", filter: "drop-shadow(0 0 0 rgba(255,46,70,0))" },
          { letterSpacing: "0.6px", filter: "drop-shadow(0 0 18px rgba(255,46,70,.25))", duration: 0.8, ease: "power3.out" }
        );
      }
    }, rootEl);

    const off = btnEl ? vampButtonHover(btnEl) : () => {};
    return () => { off(); ctx.revert(); };
  });
</script>

<div bind:this={rootEl} class="card" data-card>
  <div class="card-inner">
    <h1 class="h1" data-title data-anim>🩸 Crimson Crypt</h1>
    <p class="p" data-anim>Entre ton pseudo… et descends dans la crypte. 4 niveaux. Progression verrouillée. Classement global.</p>

    <div class="grid grid-2" style="align-items:end;" data-anim>
      <div>
        <label for="pseudo" class="p" style="display:block; margin-bottom:6px;">Pseudo</label>
        <input id="pseudo" class="input" bind:value={pseudo} placeholder="ex: NylineVamp" maxlength="18" />
      </div>

      <button
        bind:this={btnEl}
        class="btn"
        disabled={loading || pseudo.trim().length < 2}
        on:click={submit}
      >
        {loading ? "Connexion…" : "Entrer 🦇"}
      </button>
    </div>

    {#if error}
      <div class="toast" style="margin-top:12px;" data-anim>{error}</div>
    {/if}

    <div class="hr" data-anim></div>
    <div class="row" style="justify-content:space-between;" data-anim>
      <span class="badge">🎯 Tips: <span class="kbd">Dashboard</span> → choisis un niveau</span>
      <span class="badge">🩶 Style: rouge / gris</span>
    </div>
  </div>
</div>