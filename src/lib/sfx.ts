function play(path: string, volume = 0.6){
  const a = new Audio(path);
  a.volume = volume;
  a.play().catch(()=>{});
}

export const sfx = {
  click: () => play("/sfx/click.mp3", 0.35),
  win: () => play("/sfx/win.mp3", 0.6),
  lose: () => play("/sfx/lose.mp3", 0.6)
};