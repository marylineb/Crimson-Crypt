import { createClient } from "@supabase/supabase-js";
import { env } from "$env/dynamic/private";

const url = env.SUPABASE_URL;
const key = env.SUPABASE_ANON_KEY;

if (!url || !key) throw new Error("Missing env");

export const supabaseServer = createClient(url, key);