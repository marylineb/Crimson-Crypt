import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { getProgress, updateProgress } from "$lib/server/db";

export const GET: RequestHandler = async ({ cookies }) => {
  const pseudo = cookies.get("cc_pseudo");
  if (!pseudo) return json({ ok: false, message: "Not logged in" }, { status: 401 });

  const progress = await getProgress(pseudo);
  return json({ ok: true, progress });
};

export const POST: RequestHandler = async ({ cookies, request }) => {
  const pseudo = cookies.get("cc_pseudo");
  if (!pseudo) return json({ ok: false, message: "Not logged in" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const completeLevel = Number(body?.completeLevel);

  if (![1, 2, 3, 4].includes(completeLevel)) {
    return json({ ok: false, message: "Invalid level" }, { status: 400 });
  }

  const next = await updateProgress(pseudo, completeLevel);
  return json({ ok: true, progress: next });
};