export function nowMs(){ return Date.now(); }

export async function postScore(level: number, score: number, timeMs: number){
  await fetch("/api/scores", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ level, score, timeMs })
  });
}

export async function unlockLevel(level: number){
  await fetch("/api/progress", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ level })
  });
}