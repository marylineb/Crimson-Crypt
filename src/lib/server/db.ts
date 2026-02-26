import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve("data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SCORES_FILE = path.join(DATA_DIR, "scores.json");

type UserRecord = {
  pseudo: string;
  unlockedLevel: number; // 1..4
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

async function ensure() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  for (const f of [USERS_FILE, SCORES_FILE]) {
    try { await fs.access(f); }
    catch { await fs.writeFile(f, "[]", "utf-8"); }
  }
}

async function readJson<T>(file: string): Promise<T> {
  await ensure();
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as T;
}

async function writeJson<T>(file: string, data: T): Promise<void> {
  await ensure();
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

export async function getOrCreateUser(pseudo: string): Promise<UserRecord> {
  const users = await readJson<UserRecord[]>(USERS_FILE);
  const now = new Date().toISOString();

  let u = users.find((x) => x.pseudo.toLowerCase() === pseudo.toLowerCase());
  if (!u) {
    u = { pseudo, unlockedLevel: 1, completed: [], createdAt: now, updatedAt: now };
    users.push(u);
    await writeJson(USERS_FILE, users);
  }
  return u;
}

export async function getProgress(pseudo: string): Promise<UserRecord> {
  return await getOrCreateUser(pseudo);
}

export async function updateProgress(pseudo: string, levelCompleted: number): Promise<UserRecord> {
  const users = await readJson<UserRecord[]>(USERS_FILE);
  const now = new Date().toISOString();
  let u = users.find((x) => x.pseudo.toLowerCase() === pseudo.toLowerCase());

  if (!u) {
    u = { pseudo, unlockedLevel: 1, completed: [], createdAt: now, updatedAt: now };
    users.push(u);
  }

  if (!u.completed.includes(levelCompleted)) u.completed.push(levelCompleted);
  u.completed.sort((a,b)=>a-b);

  const nextUnlock = Math.min(4, Math.max(u.unlockedLevel, levelCompleted + 1));
  u.unlockedLevel = nextUnlock;
  u.updatedAt = now;

  await writeJson(USERS_FILE, users);
  return u;
}

export async function upsertBestScore(entry: { pseudo: string; level: number; score: number; timeMs: number }) {
  const scores = await readJson<BestScoreRecord[]>(SCORES_FILE);
  const now = new Date().toISOString();

  const idx = scores.findIndex(
    (s) => s.pseudo.toLowerCase() === entry.pseudo.toLowerCase() && s.level === entry.level
  );

  if (idx === -1) {
    scores.push({
      pseudo: entry.pseudo,
      level: entry.level,
      bestScore: entry.score,
      bestTimeMs: entry.timeMs,
      updatedAt: now
    });
  } else {
    const cur = scores[idx];
    const better =
      entry.score > cur.bestScore ||
      (entry.score === cur.bestScore && entry.timeMs < cur.bestTimeMs);

    if (better) {
      scores[idx] = {
        ...cur,
        bestScore: entry.score,
        bestTimeMs: entry.timeMs,
        updatedAt: now
      };
    }
  }

  await writeJson(SCORES_FILE, scores);
}

export async function getLeaderboard(): Promise<Array<{ pseudo: string; total: number; bestByLevel: Record<number, number> }>> {
  const scores = await readJson<BestScoreRecord[]>(SCORES_FILE);

  const map = new Map<string, { pseudo: string; bestByLevel: Record<number, number> }>();

  for (const s of scores) {
    const k = s.pseudo.toLowerCase();
    if (!map.has(k)) map.set(k, { pseudo: s.pseudo, bestByLevel: {} });
    const obj = map.get(k)!;
    obj.bestByLevel[s.level] = Math.max(obj.bestByLevel[s.level] ?? 0, s.bestScore);
  }

  const list = [...map.values()].map((x) => ({
    pseudo: x.pseudo,
    bestByLevel: x.bestByLevel,
    total: (x.bestByLevel[1] ?? 0) + (x.bestByLevel[2] ?? 0) + (x.bestByLevel[3] ?? 0) + (x.bestByLevel[4] ?? 0)
  }));

  list.sort((a,b)=> b.total - a.total);
  return list;
}

export async function getMyTotal(pseudo: string): Promise<number> {
  const lb = await getLeaderboard();
  const row = lb.find(r => r.pseudo.toLowerCase() === pseudo.toLowerCase());
  return row?.total ?? 0;
}