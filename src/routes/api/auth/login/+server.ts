import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { getOrCreateUser } from "$lib/server/db";

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json().catch(() => ({}));
  const pseudo = String(body?.pseudo ?? "").trim();

  if (!pseudo || pseudo.length < 2) {
    return json({ ok: false, message: "Pseudo trop court." }, { status: 400 });
  }
  if (pseudo.length > 18) {
    return json({ ok: false, message: "Pseudo trop long (max 18)." }, { status: 400 });
  }

  await getOrCreateUser(pseudo);

  cookies.set("cc_pseudo", pseudo, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: false, // true en prod https
    maxAge: 60 * 60 * 24 * 14
  });

  return json({ ok: true });
};