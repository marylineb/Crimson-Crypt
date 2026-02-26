import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { upsertBestScore, getLeaderboard } from "$lib/server/db";

export const POST: RequestHandler = async ({ request, cookies }) => {
  const pseudo = cookies.get("cc_pseudo");
  if (!pseudo) return json({ ok:false }, { status: 401 });

  const body = await request.json().catch(()=> ({}));
  const level = Number(body?.level);
  const score = Math.max(0, Math.floor(Number(body?.score ?? 0)));
  const timeMs = Math.max(0, Math.floor(Number(body?.timeMs ?? 0)));

  if (![1,2,3,4].includes(level)) return json({ ok:false, message:"Level invalide." }, { status: 400 });

  await upsertBestScore({ pseudo, level, score, timeMs });
  return json({ ok:true });
};

export const GET: RequestHandler = async () => {
  const lb = await getLeaderboard();
  return json({ ok:true, leaderboard: lb });
};