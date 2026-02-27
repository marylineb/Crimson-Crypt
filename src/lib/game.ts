export function nowMs() {
  return Date.now();
}

export async function postScore(level: number, score: number, timeMs: number) {
  const r = await fetch("/api/scores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ level, score, timeMs })
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message ?? "postScore failed");

  return data;
}

export async function unlockLevel(level: number) {
  console.log("✅ unlockLevel NEW VERSION", level);

  const r = await fetch("/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completeLevel: level })
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message ?? "unlockLevel failed");

  return data.progress;
}