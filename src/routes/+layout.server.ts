import type { LayoutServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";

const PROTECTED_PREFIXES = ["/dashboard", "/play", "/leaderboard"];

export const load: LayoutServerLoad = async ({ cookies, url }) => {
  const pseudo = cookies.get("cc_pseudo") ?? null;

  const isProtected = PROTECTED_PREFIXES.some((p) => url.pathname.startsWith(p));
  if (isProtected && !pseudo) throw redirect(303, "/");

  return { user: pseudo ? { pseudo } : null };
};