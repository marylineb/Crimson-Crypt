import { supabaseAdmin } from "$lib/server/supabase";

type UserRecord = {
  pseudo: string;
  unlockedLevel: number;
  completed: number[];
  createdAt: string;
  updatedAt: string;
};

type BestScoreRecord = {
  pseudo: string;
  level: number;
  bestScore: number;
  bestTimeMs: number;
  updatedAt: string;
};

function mapUser(row: any): UserRecord {
  return {
    pseudo: row.pseudo,
    unlockedLevel: row.unlocked_level,
    completed: Array.isArray(row.completed) ? row.completed : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getOrCreateUser(pseudo: string): Promise<UserRecord> {
  const p = pseudo.trim();
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("pseudo", p)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing) return mapUser(existing);

  const { data: created, error: insErr } = await supabaseAdmin
    .from("users")
    .insert({ pseudo: p, unlocked_level: 1, completed: [] })
    .select("*")
    .single();

  if (insErr) throw insErr;
  return mapUser(created);
}

export async function getProgress(pseudo: string): Promise<UserRecord> {
  return await getOrCreateUser(pseudo);
}

export async function updateProgress(pseudo: string, levelCompleted: number): Promise<UserRecord> {
  const level = Number(levelCompleted);
  if (!Number.isInteger(level) || level < 1 || level > 4) throw new Error("Invalid level");

  const user = await getOrCreateUser(pseudo);

  const completedSet = new Set<number>(user.completed ?? []);
  completedSet.add(level);

  const completed = Array.from(completedSet).sort((a, b) => a - b);
  const unlockedLevel = Math.min(4, Math.max(user.unlockedLevel ?? 1, level + 1));
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("users")
    .update({ completed, unlocked_level: unlockedLevel, updated_at: now })
    .eq("pseudo", user.pseudo)
    .select("*")
    .single();

  if (error) throw error;
  return mapUser(data);
}

export async function upsertBestScore(entry: { pseudo: string; level: number; score: number; timeMs: number }) {
  const pseudo = entry.pseudo.trim();
  const level = Number(entry.level);
  const score = Number(entry.score);
  const timeMs = Number(entry.timeMs);

  await getOrCreateUser(pseudo); // FK safety

  const { data: cur, error: selErr } = await supabaseAdmin
    .from("best_scores")
    .select("*")
    .eq("pseudo", pseudo)
    .eq("level", level)
    .maybeSingle();

  if (selErr) throw selErr;

  const now = new Date().toISOString();

  if (!cur) {
    const { error: insErr } = await supabaseAdmin.from("best_scores").insert({
      pseudo,
      level,
      best_score: score,
      best_time_ms: timeMs,
      updated_at: now
    });
    if (insErr) throw insErr;
    return;
  }

  const better =
    score > cur.best_score ||
    (score === cur.best_score && timeMs < cur.best_time_ms);

  if (!better) return;

  const { error: updErr } = await supabaseAdmin
    .from("best_scores")
    .update({ best_score: score, best_time_ms: timeMs, updated_at: now })
    .eq("pseudo", pseudo)
    .eq("level", level);

  if (updErr) throw updErr;
}

