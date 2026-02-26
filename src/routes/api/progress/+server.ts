import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { getProgress, updateProgress } from "$lib/server/db";

export const GET: RequestHandler = async ({ cookies }) => {
  const pseudo = cookies.get("cc_pseudo");
  if (!pseudo) return json({ ok:false }, { status: 401 });

  const u = await getProgress(pseudo);
  return json({ ok: true, progress: { unlockedLevel: u.unlockedLevel, completed: u.completed } });
};

export const POST: RequestHandler = async ({ request, cookies }) => {
  const pseudo = cookies.get("cc_pseudo");
  if (!pseudo) return json({ ok:false }, { status: 401 });

  const body = await request.json().catch(()=> ({}));
  const level = Number(body?.level);

  if (![1,2,3,4].includes(level)) {
    return json({ ok:false, message:"Level invalide." }, { status: 400 });
  }

  const u = await updateProgress(pseudo, level);
  return json({ ok:true, progress: { unlockedLevel: u.unlockedLevel, completed: u.completed } });
};