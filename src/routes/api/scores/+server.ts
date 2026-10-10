import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { upsertBestScore, getLeaderboard } from "$lib/server/db";

// Score maximum atteignable par niveau, d'après les barèmes des pages /play :
// 1 : 10 questions × 120 + bonus vitesse 800
// 2 : score de base 2000
// 3 : base 2000 + 6 essais × 220 + bonus vitesse 700
// 4 : 3 questions × 200 + 4 paires × 180 + réflexe 600
const MAX_SCORE: Record<number, number> = { 1: 2000, 2: 2000, 3: 4020, 4: 1920 };
const MIN_TIME_MS = 3000;

export const POST: RequestHandler = async ({ request, cookies }) => {
  const pseudo = cookies.get("cc_pseudo");
  if (!pseudo) return json({ ok:false }, { status: 401 });

  const body = await request.json().catch(()=> ({}));
  const level = Number(body?.level);
  const score = Math.max(0, Math.floor(Number(body?.score ?? 0)));
  const timeMs = Math.max(0, Math.floor(Number(body?.timeMs ?? 0)));

  if (![1,2,3,4].includes(level)) return json({ ok:false, message:"Level invalide." }, { status: 400 });

  if (!Number.isFinite(score) || score > MAX_SCORE[level] || timeMs < MIN_TIME_MS) {
    return json({ ok:false, message:"Score invalide." }, { status: 400 });
  }

  await upsertBestScore({ pseudo, level, score, timeMs });
  return json({ ok:true });
};

export const GET: RequestHandler = async () => {
  const lb = await getLeaderboard();
  return json({ ok:true, leaderboard: lb });
};