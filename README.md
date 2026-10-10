# Crimson Crypt

Jeu web en 4 niveaux dans une crypte gothique, avec progression sauvegardée, classement et commentaires des joueurs.
Projet personnel réalisé pendant mon Bachelor Développement Web à MyDigitalSchool Lyon.

**Démo :** https://crimson-crypt.vercel.app

## Stack

SvelteKit · TypeScript · Supabase (PostgreSQL) · GSAP · Vercel

## Les niveaux

| Niveau | Épreuve | Règle |
| --- | --- | --- |
| 1 | Quiz du Sang | 10 questions en 60 secondes, 6 bonnes réponses pour passer |
| 2 | Mémoire des Ombres | 8 paires à retrouver en 120 secondes |
| 3 | Rune Puzzle | Trouver un code de 4 runes en 6 essais |
| 4 | Crimson Trial | Boss final : quiz, mémoire et épreuve de réflexe |

Chaque niveau réussi débloque le suivant. Le meilleur score de chaque joueur par niveau alimente le classement.

## Lancer le projet

```bash
git clone https://github.com/marylineb/Crimson-Crypt.git
cd Crimson-Crypt
npm install
cp .env.example .env   # puis remplir les clés Supabase
npm run dev
```

Tables Supabase utilisées : `users`, `best_scores`, `comments`.

## Choix techniques

- **La clé Supabase reste côté serveur.** Toutes les requêtes passent par des endpoints SvelteKit (`src/routes/api`) qui lisent la clé via `$env/static/private` ; le navigateur ne la voit jamais.
- **Les scores sont vérifiés par le serveur.** Un score supérieur au maximum atteignable du niveau, ou une partie de moins de 3 secondes, est refusé.
- **Connexion par pseudo, sans mot de passe.** Choix volontaire pour un jeu sans données sensibles : le pseudo est stocké dans un cookie `httpOnly`, `sameSite=lax` et `secure` en production. Une vraie authentification (Supabase Auth) serait la prochaine étape.
- **Animations GSAP** lancées dans `onMount` à l'intérieur d'un `gsap.context()`, puis annulées avec `ctx.revert()` quand on quitte la page.

## Structure

```text
src/
├── lib/
│   ├── server/        # accès Supabase, uniquement côté serveur
│   ├── game.ts        # appels aux API de score et de progression
│   ├── anim.ts        # animations GSAP partagées
│   └── sfx.ts         # effets sonores
└── routes/
    ├── api/           # endpoints : auth, progress, scores, comments
    ├── play/1 … 4/    # les quatre niveaux
    ├── dashboard/     # progression du joueur
    ├── leaderboard/   # classement
    └── comments/      # « Livre des Ombres » (commentaires)
```

## Auteure

Maryline Biloa · [Portfolio](https://marylinebiloa.com) · [LinkedIn](https://www.linkedin.com/in/maryline-biloa/)
