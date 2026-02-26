// place files you want to import through the `$lib` alias in this folder.
export type Rank = "Ghoul" | "Vampire" | "Lord";

export function getRank(total: number): Rank {
  if (total >= 4500) return "Lord";
  if (total >= 2500) return "Vampire";
  return "Ghoul";
}

export function rankBadge(rank: Rank){
  if (rank === "Lord") return "👑 Lord";
  if (rank === "Vampire") return "🧛 Vampire";
  return "🧟 Ghoul";
}