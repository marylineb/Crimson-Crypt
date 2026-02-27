import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ cookies }) => {
  const pseudo = cookies.get("cc_pseudo") ?? null;

  // Pas connecté → retour accueil
  if (!pseudo) {
    throw redirect(302, "/");
  }

  return { pseudo };
};