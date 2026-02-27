import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ request, cookies, url }) => {
  const body = await request.json().catch(() => ({}));
  const pseudoRaw = String(body?.pseudo ?? "");
  const pseudo = pseudoRaw.trim().replace(/\s+/g, " ").slice(0, 24);

  if (pseudo.length < 2) {
    return json({ ok: false, message: "Pseudo trop court." }, { status: 400 });
  }

  // HTTPS en prod (vercel), HTTP en local
  const secure = url.protocol === "https:";

  cookies.set("cc_pseudo", pseudo, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 60 * 60 * 24 * 30
  });

  return json({ ok: true, pseudo });
};