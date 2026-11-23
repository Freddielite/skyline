// The city's daily rhythm (0.8.11): rush hours, quiet nights, weekends. Read from the game clock (a day lasts 180 s at
// 1x; the clock starts at 06:00 on a Monday). Everything here is looks: how many cars are out, which car parks are full,
// which windows are lit, when the school run happens. The economy still uses the busiest hour (flow.js PEAK).
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// one value per hour, 00:00 to 23:00, read with straight lines between the hours
const TRAFFIC_WD = [0.18, 0.12, 0.1, 0.1, 0.15, 0.3, 0.62, 1.05, 1.3, 0.95, 0.72, 0.7, 0.8, 0.76, 0.72, 0.82, 1.05, 1.3, 1.1, 0.8, 0.62, 0.5, 0.4, 0.28];
const TRAFFIC_WE = [0.26, 0.18, 0.12, 0.1, 0.1, 0.14, 0.24, 0.34, 0.5, 0.66, 0.8, 0.86, 0.9, 0.9, 0.86, 0.85, 0.85, 0.8, 0.76, 0.7, 0.6, 0.5, 0.42, 0.32];
// share of the staff at an office or factory
const WORK_WD = [0.02, 0.02, 0.02, 0.02, 0.02, 0.04, 0.1, 0.35, 0.75, 0.95, 0.97, 0.97, 0.9, 0.95, 0.97, 0.95, 0.85, 0.55, 0.25, 0.12, 0.06, 0.04, 0.03, 0.02];
// share of shop customers and staff (shops open 08:00 to 21:00, Sunday shorter)
const SHOP_WD = [0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.05, 0.2, 0.5, 0.65, 0.75, 0.85, 0.95, 0.9, 0.8, 0.8, 0.85, 0.95, 1, 0.85, 0.6, 0.3, 0.06, 0.03];
const SHOP_WE = [0.03, 0.02, 0.02, 0.02, 0.02, 0.02, 0.03, 0.1, 0.35, 0.65, 0.85, 1, 1, 1, 0.95, 0.9, 0.85, 0.8, 0.6, 0.35, 0.15, 0.06, 0.03, 0.03];
// share of homes with someone in and a light on, through the night (only seen after dark)
const HOME_LIT = [0.52, 0.38, 0.28, 0.22, 0.24, 0.4, 0.65, 0.75, 0.45, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.45, 0.65, 0.85, 0.95, 0.97, 0.93, 0.85, 0.7];
const lerp = (tab, h) => { const a = Math.floor(h) % 24, f = h - Math.floor(h); return tab[a] + (tab[(a + 1) % 24] - tab[a]) * f; };

// Where the clock is: hour (0..24), day number, day of the week, weekend.
export function clockOf(g) {
  const abs = g.abs, day = Math.floor(abs / 24), dow = ((day % 7) + 7) % 7;
  return { hour: abs - day * 24, day, dow, weekend: dow >= 5, name: DAYS[dow] };
}
// Fixed light (Menu → Time of day not on Auto) keeps the city looking busy whatever the clock says.
const fixed = (g) => g.timeSetting && g.timeSetting !== 'auto';

export function rhythm(g) {
  const c = clockOf(g), h = c.hour, we = c.weekend;
  if (fixed(g)) return { ...c, traffic: 0.9, jam: 0.75, work: we ? 0.15 : 0.9, shop: 0.9, home: 0.6, homeLit: 0.85, officeLit: 0.3, shopLit: 0.7, indLit: 0.6, school: 0 };
  const traffic = lerp(we ? TRAFFIC_WE : TRAFFIC_WD, h);
  const work = we ? 0.08 + 0.1 * Math.max(0, Math.min(1, (h - 9) / 3)) * Math.max(0, Math.min(1, (17 - h) / 3)) : lerp(WORK_WD, h);
  const shop = lerp(we ? SHOP_WE : SHOP_WD, h) * (c.dow === 6 ? 0.8 : 1);
  return {
    ...c, traffic,
    jam: Math.min(1, traffic / 1.3),                        // how busy the roads are against the busiest hour
    work, shop,
    home: Math.max(0.2, 1 - work * 0.75),                   // cars parked at home
    homeLit: lerp(HOME_LIT, h) * (we ? 1.1 : 1),
    officeLit: Math.max(0.14, work * 0.9 + (h >= 18 && h < 23 && !we ? 0.22 : 0)),   // a few work late; lobbies, stairs and cleaners after
    shopLit: Math.max(0.15, shop),                          // closed shops keep their window displays lit
    indLit: 0.5 + 0.1 * work,                               // factories run a night shift
    school: we ? 0 : h >= 7 && h < 8.75 ? 1 : h >= 14.75 && h < 16.25 ? 2 : 0,   // 1 the morning run, 2 home time
  };
}
