// Traffic signals and car-following shared by every kind of vehicle.
export const CYCLE = 14;                                  // seconds per signal cycle

export function arms(w, x, y) { const m = w.roadMask(x, y); return (m & 1 ? 1 : 0) + (m & 2 ? 1 : 0) + (m & 4 ? 1 : 0) + (m & 8 ? 1 : 0); }
export function isSignal(w, x, y) { return w.isRoad(x, y) && arms(w, x, y) >= 3; }

// 'g' green, 'y' yellow, 'r' red for traffic moving along the y axis (vertical) or x axis
export function light(t, x, y, vertical) {
  const o = ((x * 7 + y * 13) % 5) * 0.9, p = (((t + o) % CYCLE) + CYCLE) % CYCLE;
  if (p < 5.5) return vertical ? 'g' : 'r';
  if (p < 6.5) return vertical ? 'y' : 'r';
  if (p < 7) return 'r';
  if (p < 12.5) return vertical ? 'r' : 'g';
  if (p < 13.5) return vertical ? 'r' : 'y';
  return 'r';
}
export const mustStop = (w, x, y, dx, dy, t) => isSignal(w, x, y) && light(t, x, y, dy !== 0) !== 'g';

// A vehicle waits when another one is just ahead of it in the same lane.
export function followPass(list) {
  for (const v of list) v.hold = false;
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    for (let j = 0; j < list.length; j++) {
      if (i === j) continue;
      const u = list[j];
      if (u.dx !== v.dx || u.dy !== v.dy) continue;
      const rx = u.px - v.px, ry = u.py - v.py, ahead = rx * v.dx + ry * v.dy;
      if (ahead <= 0 || ahead > (u.bus || v.bus ? 0.5 : 0.34)) continue;
      if (Math.abs(rx * v.dy) + Math.abs(ry * v.dx) > 0.12) continue;
      v.hold = true; break;
    }
  }
}
