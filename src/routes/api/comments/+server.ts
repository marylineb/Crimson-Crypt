import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { supabaseAdmin } from "$lib/server/supabase";


export const GET: RequestHandler = async ({ url }) => {
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 80)));

  const { data, error } = await supabaseAdmin
    .from("comments")
    .select("id,pseudo,message,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[comments:GET]", error);
    return json({ ok: false, message: "Impossible de charger les commentaires." }, { status: 500 });
  }

  return json({ ok: true, comments: data ?? [] });
};

export const POST: RequestHandler = async ({ request, cookies }) => {
  const pseudo = cookies.get("cc_pseudo");
  if (!pseudo) return json({ ok: false, message: "Non connecté." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const messageRaw = String(body?.message ?? "");
  const message = messageRaw.trim().replace(/\s+/g, " ");

  if (message.length < 2) return json({ ok: false, message: "Message trop court." }, { status: 400 });
  if (message.length > 240) return json({ ok: false, message: "Max 240 caractères." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("comments")
    .insert([{ pseudo, message }])
    .select("id,pseudo,message,created_at")
    .single();

  if (error) {
    console.error("[comments:POST]", error);
    return json({ ok: false, message: "Impossible d'enregistrer le commentaire." }, { status: 500 });
  }

  return json({ ok: true, comment: data });
};