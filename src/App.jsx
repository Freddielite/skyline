import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Game } from './game/game.js';

const I = {
  hand: 'M8 13V5.5a1.5 1.5 0 013 0V11m0-6.5a1.5 1.5 0 013 0V11m0-5a1.5 1.5 0 013 0V13m0-4a1.5 1.5 0 013 0v6.5A6.5 6.5 0 0113 22h-1.6a6 6 0 01-4.7-2.3L3.5 15.5a1.5 1.5 0 012.3-1.9L8 16',
  road: 'M9 3L5 21M15 3l4 18M12 4v3m0 4v3m0 4v3',
  avenue: 'M7 3L3 21M17 3l4 18M12 4v4m0 4v4m0 4v4M9.5 5l-1 15M14.5 5l1 15',
  battery: 'M7 6h10v15H7V6zM10 3h4v3M10 12l3-3v3h2l-3 4v-3h-2',
  sewage: 'M4 15c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2M4 19c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2M12 3v8M9 8l3 3 3-3',
  tunnel: 'M3 20v-7a9 9 0 0118 0v7M7 20v-6a5 5 0 0110 0v6M3 20h18',
  metro: 'M12 3a9 9 0 110 18 9 9 0 010-18zM7.5 16V8l4.5 6 4.5-6v8',
  pier: 'M3 19c2 0 2-1.5 4.5-1.5S10 19 12 19s2-1.5 4.5-1.5S19 19 21 19M3 12h18M6 12v5M12 12v5M18 12v5M17 12V6',
  umbrella: 'M12 4a8 8 0 018 8H4a8 8 0 018-8zm0 8l-2 7M3 20c2 0 2-1 4.5-1s2.5 1 4.5 1 2-1 4.5-1 2.5 1 4.5 1',
  boat: 'M12 3v11m0-10l6 9h-6M4 15h16l-2.5 4h-11L4 15z',
  ferry: 'M3 15h18l-2.5 4h-13L3 15zM6 15v-4h12v4M9 11V8h6v3M9 13h1m3 0h1',
  home: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6',
  shop: 'M4 8h16l-1-4H5L4 8zm1 0v12h14V8M9 20v-6h6v6',
  gear: 'M4 20V10l5 3V8l5 3V5h6v15H4zM8 17h2m3 0h2m3 0h1',
  tree: 'M12 3l5 7h-3l4 6H6l4-6H7l5-7zM12 16v5',
  dozer: 'M5 9h9l2 4h3v5H5V9zM3 18h18M8 18v2m8-2v2M10 9V6h3',
  coin: 'M12 3a9 9 0 100 18 9 9 0 000-18zm0 4v10m-2.5-7.5c0-1 1-1.5 2.5-1.5s2.5.5 2.5 1.5-1 1.5-2.5 1.5-2.5.5-2.5 1.5 1 1.5 2.5 1.5 2.5-.5 2.5-1.5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  pause: 'M8 5v14M16 5v14',
  play: 'M7 5l12 7-12 7V5z',
  ff: 'M4 5l8 7-8 7V5zm9 0l8 7-8 7V5z',
  fff: 'M2 5l6 7-6 7V5zm7 0l6 7-6 7V5zm7 0l6 7-6 7V5z',
  close: 'M6 6l12 12M18 6L6 18',
  bolt: 'M13 2L5 14h6l-1 8 8-12h-6l1-8z',
  drop: 'M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z',
  shield: 'M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6l7-3z',
  flame: 'M12 3c1 4 5 6 5 11a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-10z',
  cross: 'M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4z',
  book: 'M4 5c3-1 6-1 8 1 2-2 5-2 8-1v13c-3-1-6-1-8 1-2-2-5-2-8-1V5zM12 6v13',
  wind: 'M12 12v9M12 12L11 3M12 12l8 4M12 12l-8 4',
  plant: 'M4 21V10l5 3V8l5 3V3h3v18H4z',
  wire: 'M4 5h16M8 5v15M16 5v15M4 9c4 3.5 12 3.5 16 0',
  cable: 'M3 12h5l2-5 4 10 2-5h5',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v6M14 11v6',
  truck: 'M3 7h11v9H3V7zm11 3h4l3 3v3h-7v-6zM7 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm10 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  recycle: 'M20 12a8 8 0 01-13.5 5.8M4 12a8 8 0 0113.5-5.8M17.5 3v3.5H14M6.5 21v-3.5H10',
  ball: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8l3.5 2.5-1.3 4h-4.4l-1.3-4L12 8zM12 3v5M20.5 9.5L15.5 10.5M3.5 9.5l5 1M7 19l2.8-4.5M17 19l-2.8-4.5',
  bank: 'M3 10l9-6 9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18',
  smile: 'M12 3a9 9 0 100 18 9 9 0 000-18zM8.5 14a4.2 4.2 0 007 0M9 9.5h.01M15 9.5h.01',
  people: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 11a2.5 2.5 0 100-5M17 14.2c2.2.5 4 2.4 4 5.8',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3.5 2',
  eyeoff: 'M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.2 3.7M6.5 6.7C3.7 8.6 2 12 2 12s4 7 10 7a9.6 9.6 0 004.2-1M9.9 9.9a3 3 0 004.2 4.2',
  pipe: 'M3 8h9a3 3 0 013 3v10M3 14h5M15 21h6',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-4',
  bus: 'M5 4h14a1 1 0 011 1v11H4V5a1 1 0 011-1zM4 11h16M7 16v3m10-3v3M7.5 13.5h.01M16.5 13.5h.01',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10-3a3 3 0 100 6 3 3 0 000-6z',
  lock: 'M6 11h12v9H6v-9zm2 0V8a4 4 0 018 0v3',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  news: 'M4 5h13v14H6a2 2 0 01-2-2V5zm13 4h3v8a2 2 0 01-2 2M7 9h7M7 12h7M7 15h4',
  volume: 'M4 9v6h4l5 4V5L8 9H4zm12.5-.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12',
  work: 'M4 8h16v11H4V8zm5 0V5h6v3M4 13h16',
};
const Icon = ({ n, size = 22, fill }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={I[n]} /></svg>
);

const T = {
  move: { id: null, label: 'Move', icon: 'hand' },
  road: { id: 'road', label: 'Road', icon: 'road', cost: 10 },
  avenue: { id: 'avenue', label: 'Avenue', icon: 'avenue', cost: 25 },
  metro: { id: 'metro', label: 'Metro', icon: 'metro', cost: 5000 },
  tunnel: { id: 'tunnel', label: 'Tunnel', icon: 'tunnel', cost: 40 },
  res: { id: 'res', label: 'Homes', icon: 'home', cost: 5, zone: 'r' },
  com: { id: 'com', label: 'Shops', icon: 'shop', cost: 5, zone: 'c' },
  ind: { id: 'ind', label: 'Industry', icon: 'gear', cost: 5, zone: 'i' },
  park: { id: 'park', label: 'Park', icon: 'tree', cost: 25 },
  clear: { id: 'bulldoze', label: 'Clear', icon: 'dozer', cost: 2 },
  coal: { id: 'coal', label: 'Coal plant', icon: 'plant', cost: 3000 },
  gas: { id: 'gas', label: 'Gas plant', icon: 'plant', cost: 9000 },
  solar: { id: 'solar', label: 'Solar farm', icon: 'bolt', cost: 7000 },
  nuclear: { id: 'nuclear', label: 'Nuclear', icon: 'plant', cost: 32000 },
  wind: { id: 'wind', label: 'Wind', icon: 'wind', cost: 500 },
  water: { id: 'water', label: 'Water tower', icon: 'drop', cost: 800 },
  pump: { id: 'pump', label: 'Pump station', icon: 'drop', cost: 2600 },
  treat: { id: 'treat', label: 'Treatment', icon: 'drop', cost: 7500 },
  battery: { id: 'battery', label: 'Battery', icon: 'battery', cost: 2500 },
  sewage: { id: 'sewage', label: 'Sewage works', icon: 'sewage', cost: 4500 },
  pipe: { id: 'pipe', label: 'Pipe', icon: 'pipe', cost: 6 },
  police: { id: 'police', label: 'Police', icon: 'shield', cost: 600 },
  fire: { id: 'fire', label: 'Fire', icon: 'flame', cost: 600 },
  clinic: { id: 'clinic', label: 'Clinic', icon: 'cross', cost: 800 },
  school: { id: 'school', label: 'School', icon: 'book', cost: 700 },
  wire: { id: 'wire', label: 'Power line', icon: 'wire', cost: 4 },
  cable: { id: 'cable', label: 'Cable', icon: 'cable', cost: 12 },
  dump: { id: 'dump', label: 'Landfill', icon: 'trash', cost: 1200 },
  recycle: { id: 'recycle', label: 'Recycling', icon: 'recycle', cost: 3200 },
  wte: { id: 'wte', label: 'Waste power', icon: 'bolt', cost: 5200 },
  xfer: { id: 'xfer', label: 'Transfer', icon: 'truck', cost: 900 },
  rcomplex: { id: 'rcomplex', label: 'Big recycling', icon: 'recycle', cost: 14000 },
  police2: { id: 'police2', label: 'Police HQ', icon: 'shield', cost: 2400 },
  fire2: { id: 'fire2', label: 'Fire HQ', icon: 'flame', cost: 2400 },
  hospital: { id: 'hospital', label: 'Hospital', icon: 'cross', cost: 3400 },
  university: { id: 'university', label: 'University', icon: 'book', cost: 6500 },
  busstop: { id: 'busstop', label: 'Bus stop', icon: 'bus', cost: 150 },
  busterm: { id: 'busterm', label: 'Terminal', icon: 'bus', cost: 2200 },
  plaza: { id: 'plaza', label: 'Plaza', icon: 'tree', cost: 900 },
  library: { id: 'library', label: 'Library', icon: 'book', cost: 700 },
  museum: { id: 'museum', label: 'Museum', icon: 'bank', cost: 2200 },
  stadium: { id: 'stadium', label: 'Stadium', icon: 'ball', cost: 7000 },
  pier: { id: 'pier', label: 'Pier', icon: 'pier', cost: 400 },
  beach: { id: 'beach', label: 'Beach', icon: 'umbrella', cost: 600 },
  marina: { id: 'marina', label: 'Marina', icon: 'boat', cost: 3000 },
  ferry: { id: 'ferry', label: 'Ferry pier', icon: 'ferry', cost: 1500 },
};
const CATS = [
  { id: 'build', label: 'Build', short: 'Build', icon: 'road', tools: ['move', 'road', 'avenue', 'res', 'com', 'ind', 'park', 'clear'] },
  { id: 'util', label: 'Power & water', short: 'Utilities', icon: 'bolt', tools: ['move', 'coal', 'gas', 'solar', 'nuclear', 'wind', 'battery', 'wire', 'cable', 'water', 'pump', 'treat', 'sewage', 'pipe', 'clear'] },
  { id: 'waste', label: 'Waste', short: 'Waste', icon: 'trash', tools: ['move', 'dump', 'recycle', 'xfer', 'wte', 'rcomplex', 'clear'] },
  { id: 'svc', label: 'Services', short: 'Services', icon: 'shield', tools: ['move', 'police', 'police2', 'fire', 'fire2', 'clinic', 'hospital', 'school', 'university', 'clear'] },
  { id: 'transit', label: 'Transit', short: 'Transit', icon: 'bus', tools: ['move', 'busstop', 'busterm', 'ferry', 'metro', 'tunnel', 'clear'] },
  { id: 'fun', label: 'Amenities', short: 'Fun', icon: 'ball', tools: ['move', 'pier', 'beach', 'plaza', 'library', 'marina', 'museum', 'stadium', 'clear'] },
];
// Buildings from content packs (src/game/content.js) join the build menu under their category.
export function registerTools(list) {
  for (const t of list) {
    T[t.id] = { id: t.id, label: t.label, icon: I[t.icon] ? t.icon : 'ball', cost: t.cost };
    const cat = CATS.find((c) => c.id === t.cat) || CATS[CATS.length - 1], at = cat.tools.lastIndexOf('clear');
    cat.tools.splice(at < 0 ? cat.tools.length : at, 0, t.id);
  }
}
const VIEWS = [   // 0.8.13: every view has a one-line legend under its tag
  { id: 'commute', label: 'Commutes', hint: 'Green: linked to the highway with jobs (or workers) in reach. Red: none in reach. Grey: not linked to the highway. Blue roads reach the highway' },
  { id: 'traffic', label: 'Traffic', hint: 'Roads as busy as they are at this hour: green free, yellow busy, red jammed. Worn roads are slower: tap one to repair it' },
  { id: 'transit', label: 'Transit', hint: 'Teal: within reach of a bus stop or terminal. Stronger colour, better service' },
  { id: 'metro', label: 'Metro', hint: 'Homes: red no jobs in reach, orange a long trip, blue go by metro. Jobs in red have no workers. Arrows: where a line would help most' },
  { id: 'value', label: 'Land value', hint: 'Green high, yellow middling, red low. Buildings need high land value to grow' },
  { id: 'crime', label: 'Crime', hint: 'Green safe, red high crime. Police stations bring it down' },
  { id: 'pollution', label: 'Pollution', hint: 'Coloured where there is pollution: green a little, yellow more, red a lot. Parks and distance help' },
  { id: 'power', label: 'Power', hint: 'Green: has power. Red: no power. Yellow: live lines. Grey: lines with no power. Tap a plant to see what it really makes and why' },
  { id: 'water', label: 'Water', hint: 'Green: has water. Red: no water. Blue: pipes with water. Grey: dry pipes. Brown water on the map: untreated sewage (build a Sewage works on the pipes)' },
  { id: 'waste', label: 'Waste', hint: 'Green: garbage collected. Red: not collected. Brown: within reach of a waste building' },
  { id: 'fun', label: 'Amenities', hint: 'Purple: near parks, plazas and fun places. Stronger colour, more to do' },
  { id: 'police', label: 'Police', hint: 'Blue: covered by a police station. Stronger colour, better cover' },
  { id: 'fire', label: 'Fire', hint: 'Orange: covered by a fire station. Stronger colour, quicker help' },
  { id: 'health', label: 'Health', hint: 'Pink: covered by a clinic or hospital. Stronger colour, better care' },
  { id: 'edu', label: 'Education', hint: 'Yellow: covered by a school or university. Stronger colour, better schooling' },
];
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
const BUILT = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';
const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US');
const supplyClass = (sup, dem) => (dem <= 0 ? 'ok' : sup >= dem ? 'ok' : sup >= dem * 0.75 ? 'mid' : 'bad');

function Demand({ s, onOpen }) {
  const bar = (v, c, l) => (
    <div className="dm" title={l}>
      <div className="dm-track"><div className="dm-fill" style={{ background: c, height: Math.abs(v) * 50 + '%', [v >= 0 ? 'bottom' : 'top']: '50%' }} /></div>
      <span>{l}</span>
    </div>
  );
  return <button className="demand" aria-label="Zone demand: tap to see why" onClick={onOpen}>{bar(s.rd, '#4caf50', 'R')}{bar(s.cd, '#3d8bd9', 'C')}{bar(s.id, '#e0b526', 'I')}</button>;
}

// A small line chart for the monthly history. Each series gets its own color and the latest value is labeled.
function Chart({ title, data, series, fmt }) {
  const W = 300, H = 92, pad = 4;
  if (data.length < 2) return null;
  const vals = series.flatMap((sr) => data.map((d) => d[sr.k]));
  let lo = Math.min(...vals), hi = Math.max(...vals); if (hi === lo) { hi += 1; lo -= 1; }
  const X = (i) => pad + (i / (data.length - 1)) * (W - 2 * pad), Y = (v) => pad + (1 - (v - lo) / (hi - lo)) * (H - 2 * pad);
  const zero = lo < 0 && hi > 0 ? Y(0) : null, last = data[data.length - 1];
  return (
    <figure className="chart">
      <figcaption><b>{title}</b>{series.map((sr) => <span key={sr.k} style={{ color: sr.c }}>{sr.label ? sr.label + ' ' : ''}{fmt(last[sr.k])}</span>)}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={title}>
        {zero !== null && <line x1="0" x2={W} y1={zero} y2={zero} className="zero" />}
        {series.map((sr) => <polyline key={sr.k} fill="none" stroke={sr.c} strokeWidth="2" vectorEffect="non-scaling-stroke" points={data.map((d, i) => `${X(i)},${Y(d[sr.k])}`).join(' ')} />)}
      </svg>
      <div className="range"><span>{fmt(hi)}</span><span>{fmt(lo)}</span></div>
    </figure>
  );
}

// City → Budget (0.8.13): how residents get to work, with the change since the start of the month
const MODES = [['car', 'Car', '#e0a43a'], ['bus', 'Bus', '#3fbfb0'], ['metro', 'Metro', '#5a9bff'], ['walk', 'Walk', '#a5d86b'], ['none', 'No job in reach', '#ef6f5e']];
function Modes({ now, prev }) {
  return (
    <div className="modes">
      <h3>How people get to work</h3>
      <div className="modebar">{MODES.map(([k, , c]) => now[k] > 0 && <i key={k} style={{ width: now[k] + '%', background: c }} />)}</div>
      <div className="modekey">{MODES.map(([k, l, c]) => { const d = prev ? now[k] - prev[k] : 0; return (now[k] > 0 || d) ? <span key={k}><i style={{ background: c }} />{l} {now[k]}%{d ? <em className={(k === 'none' || k === 'car' ? d < 0 : d > 0) ? 'pos' : 'neg'}>{d > 0 ? ' +' : ' '}{d}</em> : null}</span> : null; })}</div>
      <p className="hint">Changes since the start of the month. A metro line or buses take people out of cars; red are residents with no job they can reach.</p>
    </div>
  );
}
function Inspector({ info, onClose, low, onAction, active }) {
  return (
    <section className={"inspect" + (low ? " low" : "")} aria-label={info.title}>
      <div className="ih"><div><h2>{info.title}</h2>{info.sub && <p>{info.sub}</p>}</div><button className="x" onClick={onClose} aria-label="Close"><Icon n="close" size={16} /></button></div>
      {info.why && <div className={'why ' + (info.good ? 'ok' : 'bad')}>{info.why}</div>}
      {info.rows.length > 0 && <dl>{info.rows.map((r) => (
        <div key={r.label} className={r.ok === false ? 'bad' : ''}><dt>{r.label}</dt><dd>{r.ok === true && <Icon n="check" size={13} />}{r.ok === false && <Icon n="close" size={12} />}{r.value}</dd></div>
      ))}</dl>}
      {info.actions && <div className="iseg">{info.actions.map((a) => <button key={a.id} className={a.on ? 'on' : ''} onClick={() => onAction(a.id)}>{a.label}</button>)}</div>}
      {info.action && <div className="iact">
        <button onClick={() => onAction(info.action.id)}>{active ? 'Hide trips' : info.action.label}</button>
        {active && info.action.hint && <small>{info.action.hint}</small>}
      </div>}
    </section>
  );
}


// ---------- start screen ----------
// The city (or a fresh map) drifts behind it; see Game.enterMenu / previewMap.
const MAPS = [
  { id: 'coast', name: 'Coastline', desc: 'The sea along one edge. Beaches and harbors.' },
  { id: 'lake', name: 'Lakeland', desc: 'Two or three big lakes. Cabins and boathouses.' },
  { id: 'country', name: 'Countryside', desc: 'Green fields and ponds. Cottages and mills.' },
];
function MiniMap({ id }) {
  return (
    <svg viewBox="0 0 64 40" className="minimap" aria-hidden="true">
      <rect width="64" height="40" rx="7" fill="#7cbf68" />
      {id === 'coast' && <><path d="M0 0h22c-4 8 4 14-2 22s3 12 0 18H0z" fill="#3a92c7" /><path d="M22 0c-4 8 4 14-2 22s3 12 0 18h-3c3-6-6-10 0-18s-2-14 2-22z" fill="#ecd9a6" /><circle cx="48" cy="12" r="2.4" fill="#4fa6d6" /></>}
      {id === 'lake' && <><path d="M14 9c8-3 16 1 15 8s-9 9-15 7-8-12 0-15z" fill="#3f9ccf" /><path d="M38 21c7-4 17-1 16 6s-10 8-16 6-6-9 0-12z" fill="#3f9ccf" /><circle cx="50" cy="9" r="2.2" fill="#4fa6d6" /></>}
      {id === 'country' && <>{[[12, 10], [30, 8], [50, 14], [20, 28], [40, 30], [54, 31]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 3 ? 4.6 : 2.6} fill="#4fa6d6" />)}<path d="M0 20h64" stroke="#9ed08a" strokeWidth="1.5" /><path d="M32 0v40" stroke="#9ed08a" strokeWidth="1.5" /></>}
    </svg>
  );
}
// Save slots, rolling backups, import and export. Used on the start screen and in the in-game Menu.
function SavesPanel({ g, inGame, onLoaded, refresh }) {
  const [, setTick] = useState(0), [msg, setMsg] = useState(''), [sure, setSure] = useState(''), fileRef = useRef(null), target = useRef('slot1');
  const redo = () => { setTick((t) => t + 1); refresh && refresh(); };
  const note = (m) => { setMsg(m); setSure(''); };
  const when = (ts) => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const load = (k) => { if (g.loadFrom(k)) { note(''); onLoaded(k); } else note('Could not open that save'); };
  const save = (k) => { const hasIt = !!g.listSaves().find((r) => r.key === k && r.info); if (hasIt && !g.listSaves().find((r) => r.key === k).current && sure !== 'save' + k) { setSure('save' + k); return; } g.saveTo(k); note(g.slotLabel(k) + ' saved'); redo(); };
  const del = (k) => { if (sure !== 'del' + k) { setSure('del' + k); return; } g.deleteSave(k); note(g.slotLabel(k) + ' deleted'); redo(); };
  const exp = async (k) => { const ok = await g.exportSave(k); note(ok ? 'Save exported' : 'Could not export on this device'); };
  const pickFile = (k) => { target.current = k; if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click(); } };
  const gotFile = async (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = await g.importSave(await f.text(), target.current); note(r.ok ? 'Imported into ' + g.slotLabel(target.current) : r.why); redo(); };
  return (
    <div className="saves">
      {g.listSaves().map((r) => (
        <div key={r.key} className={'saverow' + (r.current ? ' cur' : '') + (r.backup ? ' bk' : '')}>
          <div className="saveinfo">
            <b>{r.label}{r.current && ' \u00b7 current'}</b>
            <small>{r.info ? `${r.info.pop.toLocaleString('en-US')} residents \u00b7 ${r.info.date || when(r.info.ts)} \u00b7 ${money(r.info.money)}${r.info.sandbox ? ' \u00b7 sandbox' : ''}` : 'Empty'}</small>
            {r.info && <small>Saved {when(r.info.ts)}</small>}
          </div>
          <div className="savebtns">
            {r.info && <button onClick={() => load(r.key)}>{r.backup ? 'Restore' : 'Load'}</button>}
            {inGame && !r.backup && <button className={sure === 'save' + r.key ? 'warn' : ''} onClick={() => save(r.key)}>{sure === 'save' + r.key ? 'Replace?' : 'Save here'}</button>}
            {r.info && <button onClick={() => exp(r.key)}>Export</button>}
            {!r.backup && <button onClick={() => pickFile(r.key)}>Import</button>}
            {r.info && !r.current && <button className={sure === 'del' + r.key ? 'warn' : ''} onClick={() => del(r.key)}>{sure === 'del' + r.key ? 'Sure?' : 'Delete'}</button>}
          </div>
        </div>
      ))}
      <input ref={fileRef} type="file" accept=".json,application/json,text/plain" style={{ display: 'none' }} onChange={gotFile} />
      {msg && <p className="hint">{msg}</p>}
      <p className="hint">Saves live on this phone. Export a save to keep a copy in Drive or send it to another phone. Backups are made every 10 minutes while you play.</p>
    </div>
  );
}

function StartScreen({ g, st, saved, view, setView, onPlay, onNew, refresh }) {
  const [map, setMap] = useState('coast');
  const [sandbox, setSandbox] = useState(false);
  const [sure, setSure] = useState(false);
  const preview = (id) => { setMap(id); setSure(false); g.previewMap(id); };
  const openNew = () => { setView('new'); preview(map); };
  const back = () => { g.cancelPreview(); setSure(false); setView('home'); };
  const build = () => { if (g.willReplace() && !sure) { setSure(true); return; } onNew(sandbox); };
  return (
    <div className="start" onPointerDown={() => g.audio.unlock()}>
      <div className="start-scrim" aria-hidden="true" />
      <main className="start-col">
        <h1 className="logo">Skyline<span>Build a city by the water</span></h1>
        {view === 'home' && (
          <nav className="start-menu" aria-label="Start">
            {saved && (
              <button className="big primary" onClick={onPlay}>
                <b>Continue</b>
                <small>{saved.pop.toLocaleString('en-US')} residents &middot; {saved.date} &middot; <span className={saved.money < 0 ? 'neg' : ''}>{money(saved.money)}</span></small>
              </button>
            )}
            <button className={'big' + (saved ? '' : ' primary')} onClick={openNew}><b>New city</b><small>Choose a coastline, lakes or countryside</small></button>
            <button className="big" onClick={() => setView('saves')}><b>Saves</b><small>Three slots, backups, import and export</small></button>
            <button className="big" onClick={() => setView('settings')}><b>Settings</b><small>Sound, music and graphics</small></button>
          </nav>
        )}
        {view === 'new' && (
          <section className="start-new" aria-label="New city">
            <h2>Choose your land</h2>
            <div className="maps">
              {MAPS.map((m) => (
                <button key={m.id} className={'mapcard' + (map === m.id ? ' on' : '')} onClick={() => preview(m.id)} aria-pressed={map === m.id}>
                  <MiniMap id={m.id} /><b>{m.name}</b><small>{m.desc}</small>
                </button>
              ))}
            </div>
            <div className="seg two" style={{ marginTop: 8 }}>
              <button className={!sandbox ? 'on' : ''} onClick={() => setSandbox(false)}>Normal</button>
              <button className={sandbox ? 'on' : ''} onClick={() => setSandbox(true)}>Sandbox</button>
            </div>
            <p className="hint">{sandbox ? 'Sandbox: unlimited money and every building unlocked from the start.' : g.willReplace() ? 'All three save slots are full: a new city replaces the current one.' : 'A new city is saved in a free slot, so your other cities stay safe.'}</p>
            {sure && <p className="start-warn">This replaces your current city{saved ? ` of ${saved.pop.toLocaleString('en-US')} residents` : ''}. Tap again to replace it.</p>}
            <div className="start-row">
              <button className="big slim" onClick={back}>Back</button>
              <button className="big slim" onClick={() => preview(map)}>Another map</button>
              <button className={'big slim primary' + (sure ? ' danger' : '')} onClick={build}>{sure ? 'Replace city' : 'Start building'}</button>
            </div>
          </section>
        )}
        {view === 'saves' && (
          <section className="start-new" aria-label="Saves">
            <h2>Saves</h2>
            <SavesPanel g={g} inGame={false} onLoaded={() => onPlay()} refresh={refresh} />
            <div className="start-row"><button className="big slim" onClick={() => setView('home')}>Back</button></div>
          </section>
        )}
        {view === 'settings' && st && (
          <section className="start-new" aria-label="Settings">
            <h2>Settings</h2>
            <div className="seg two">
              <button className={st.audio.sound ? 'on' : ''} onClick={() => { g.setAudio('sound', !st.audio.sound); refresh(); }}>Effects {st.audio.sound ? 'on' : 'off'}</button>
              <button className={st.audio.music ? 'on' : ''} onClick={() => { g.setAudio('music', !st.audio.music); refresh(); }}>Music {st.audio.music ? 'on' : 'off'}</button>
            </div>
            <label className="tax vol"><span><Icon n="volume" size={16} />Volume</span><input type="range" min="0" max="100" value={Math.round(st.audio.volume * 100)} onChange={(e) => { g.setAudio('volume', +e.target.value / 100); refresh(); }} /><b>{Math.round(st.audio.volume * 100)}%</b></label>
            <div className="seg three">
              {[['auto', 'Auto'], ['high', 'Pretty'], ['fast', 'Smooth']].map(([q, l]) => (
                <button key={q} className={st.quality === q ? 'on' : ''} onClick={() => { g.setQuality(q); refresh(); }}>{l}</button>
              ))}
            </div>
            <p className="hint">Graphics: Auto starts pretty and switches to smooth if the game slows down.</p>
            <div className="seg three">
              {[['auto', 'Auto frame rate'], [30, '30 fps'], [60, '60 fps']].map(([v, l]) => (
                <button key={l} className={st.fpsSetting === v ? 'on' : ''} onClick={() => { g.setFps(v); refresh(); }}>{l}</button>
              ))}
            </div>
            <p className="hint">Auto frame rate keeps the phone cooler: 60 while you drag, 30 when the view is still.</p>
            <div className="start-row"><button className="big slim" onClick={() => setView('home')}>Back</button></div>
          </section>
        )}
      </main>
      <div className="start-ver">Skyline {VERSION}</div>
    </div>
  );
}

export default function App() {
  const cvRef = useRef(null), gameRef = useRef(null);
  const [st, setSt] = useState(null);
  const [tool, setTool] = useState(null);
  const [cat, setCat] = useState('build');
  const [fly, setFly] = useState(false);          // the tool pop-out next to the category rail
  const [toast, setToast] = useState('');
  const [cost, setCost] = useState(null);
  const [panel, setPanel] = useState(null);
  const [tab, setTab] = useState('budget');
  const [timeSet, setTimeSet] = useState('auto');
  const [news, setNews] = useState(null);
  const [taps, setTaps] = useState(0);
  const [tilt, setTilt] = useState(() => { try { return localStorage.getItem('skyline.tilt') === '1'; } catch (e) { return true; } });
  const flipTilt = () => { const v = !tilt; setTilt(v); try { localStorage.setItem('skyline.tilt', v ? '1' : '0'); } catch (e) { /* ignore */ } };
  const newsT = useRef(0);
  const [screen, setScreen] = useState('start');
  const [startView, setStartView] = useState('home');
  const [saved, setSaved] = useState(null);
  const [ui, setUi] = useState(() => { try { return localStorage.getItem('skyline.hideui') !== '1'; } catch (e) { return true; } });
  const toastT = useRef(0);

  const say = useCallback((m) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(''), 2400); }, []);

  useEffect(() => {
    const g = new Game(cvRef.current, {
      toast: say,
      cost: (c, n, name) => setCost(n ? { c, n, name } : null),
      goal: (e) => say(`Goal complete: ${e.title}  +${money(e.reward)}`),
      month: (e) => say(`Month closed: ${e.income - e.expense >= 0 ? '+' : ''}${money(e.income - e.expense)}`),
      unlock: (e) => say(`Unlocked: ${e.name}`),
      cut: () => say('The city is in debt. Services are closing'),
      news: (e) => { setNews(e.text); clearTimeout(newsT.current); newsT.current = setTimeout(() => setNews(null), 7000); },
      request: (e) => say(e.fresh ? `New request: ${e.title}. See City → Advisors` : e.ok ? `Request done: ${e.title}` : `Request missed: ${e.title}`),
      inspect: () => setPanel(null),
      quality: () => { setTilt(false); say('Switched to smooth graphics to keep the game fast'); },
    });
    gameRef.current = g; window.__game = g;
    try { const seen = localStorage.getItem('skyline.version'); if (seen !== VERSION) { localStorage.setItem('skyline.version', VERSION); setTimeout(() => say(`Updated to version ${VERSION}`), 900); } } catch (e) { /* ignore */ }
    g.start();
    if (g.hadSave) { const s0 = g.stats(); setSaved({ pop: s0.pop, date: s0.date, money: s0.money }); }
    g.audio.unlock();                                   // works where autoplay is allowed (the Android app); otherwise the first tap starts it
    const iv = setInterval(() => { if (!g.away) setSt(g.stats()); }, 500);   // twice a second is enough for the HUD and keeps re-renders cheap
    setSt(g.stats());
    return () => { clearInterval(iv); g.stop(); };
  }, [say]);

  const g = gameRef.current;
  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && gameRef.current) { e.preventDefault(); gameRef.current.undo(); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  const pick = (id) => { setTool(id); setFly(false); g && g.setTool(id); if (id) { setPanel(null); g.setOverlay(id === 'wire' || id === 'cable' ? 'power' : id === 'pipe' ? 'water' : id === 'metro' || id === 'tunnel' ? 'metro' : null); } };
  const speed = (s) => { g.setSpeed(s); setSt(g.stats()); };
  const setTax = (k, v) => { g.setTax(k, v); setSt(g.stats()); };
  const pickTime = (v) => { setTimeSet(v); g.setTime(v); };
  const toStart = (v) => { setPanel(null); setTool(null); g.setTool(null); const s0 = g.stats(); setSaved({ pop: s0.pop, date: s0.date, money: s0.money }); g.enterMenu(); setStartView(v || 'home'); setScreen('start'); if (v === 'new') g.previewMap('coast'); };
  const play = () => { g.leaveMenu(); setScreen('game'); setSt(g.stats()); };
  const startNew = (sb) => { g.startNewCity(!!sb); setScreen('game'); setStartView('home'); setSt(g.stats()); };
  const setView = (v) => { g.setOverlay(v); if (v) { setTool(null); g.setTool(null); } setPanel(null); setSt(g.stats()); };
  const toggle = (p) => { setFly(false); setPanel(panel === p ? null : p); if (g && panel !== p) g.clearSel(); };
  const openCity = (t) => { setTab(t); setFly(false); setPanel('budget'); g.clearSel(); };
  const openCat = (id) => { if (fly && cat === id) { setFly(false); return; } setCat(id); setFly(true); setPanel(null); g && g.clearSel(); };
  const showMe = (t) => { setCat(t.cat); if (t.tool) pick(t.tool); else { pick(null); } if (t.id === 'road') g.focusHighway(); };
  const flipUi = () => { const next = !ui; setUi(next); try { localStorage.setItem('skyline.hideui', next ? '0' : '1'); } catch (e) { /* ignore */ } if (!next) { setPanel(null); setFly(false); setTool(null); g && g.setTool(null); } };
  const catTools = CATS.find((c) => c.id === cat).tools.filter((k) => k !== 'move');   // Move is simply no tool: the chip's close button
  const curTool = tool ? Object.values(T).find((t) => t.id === tool) : null;
  const ud = (st && st.uDiag) || {};
  const utils = st ? [['bolt', st.pSup, st.pDem, 'Power', ud.unpowered || 0], ['drop', st.wSup, st.wDem, 'Water', ud.unwatered || 0], ['trash', st.tSup, st.tDem, 'Garbage', (ud.wOut || 0) + (ud.wFull || 0)]] : [];
  const view = st && (VIEWS.find((v) => v.id === st.overlay) || (st.overlay === 'trips' ? { id: 'trips', label: 'Road trips' } : null));

  return (
    <div className="app">
      <canvas ref={cvRef} className="map" onPointerDown={() => fly && setFly(false)} />
      {tilt && screen === 'game' && !(st && st.fast) && <><div className="tilt top" aria-hidden="true" /><div className="tilt bot" aria-hidden="true" /></>}
      {toast && <div className="toast" role="status">{toast}</div>}
      {screen === 'start' && g && <StartScreen refresh={() => setSt(g.stats())} g={g} st={st} saved={saved} view={startView} setView={setStartView} onPlay={play} onNew={startNew} />}
      {st && screen === 'game' && (
        <>
          {!ui && <button className="showui" onClick={flipUi} aria-label="Show interface"><Icon n="eye" size={22} /></button>}
          {ui && <header className="hud hud-l">
            <button className={'cash' + (st.money < 0 ? ' debt' : '')} onClick={() => openCity(st.money < 0 || st.loans.length ? 'bank' : 'budget')} title={st.money < 0 ? 'Owed to the bank' : 'Treasury'}><Icon n="coin" size={17} /><b>{money(st.money)}</b>{st.money < 0 && <small>owed</small>}</button>
            <div className="util pop" title="Residents"><Icon n="people" size={14} /><b>{st.pop.toLocaleString('en-US')}</b></div>
            <div className={'util ' + (st.happy >= 60 ? 'ok' : st.happy >= 40 ? 'mid' : 'bad')} title="Happiness"><Icon n="smile" size={14} /><b>{st.happy}%</b></div>
            {st.people && st.pop > 0 && <button className={'util jobs ' + (st.people.unemp <= 0.05 ? 'ok' : st.people.unemp <= 0.12 ? 'mid' : 'bad')} onClick={() => openCity('people')} title="Workers without a job" aria-label={`${Math.round(st.people.unemp * 100)}% unemployed`}><Icon n="work" size={14} /><b>{Math.round(st.people.unemp * 100)}%</b></button>}
            <button className="utils" onClick={() => { const o = utils.find((u) => supplyClass(u[1], u[2]) === 'ok' && u[4] > 2); if (o) setView({ bolt: 'power', drop: 'water', trash: 'waste' }[o[0]]); else openCity('budget'); }} title={utils.map((u) => `${u[3]} ${u[1]}/${u[2]}`).join(' · ')} aria-label="Power, water and garbage">
              {utils.map(([ic, sup, dem, label, miss]) => { const c = supplyClass(sup, dem); return c === 'ok' && miss <= 2
                ? <i key={ic} className="uok" aria-label={label + ' OK'}><Icon n={ic} size={13} fill={ic !== 'trash'} /></i>
                : c === 'ok' ? <span key={ic} className="ushort mid" title={`${label}: enough in total, but ${miss} buildings don\u2019t get it. Tap to see them in red`}><Icon n={ic} size={13} fill={ic !== 'trash'} /><b>{miss} out</b></span>
                : <span key={ic} className={'ushort ' + c}><Icon n={ic} size={13} fill={ic !== 'trash'} /><b>{sup}/{dem}</b></span>; })}
            </button>
          </header>}
          {ui && <div className="hud hud-r">
            <div className="clock" title={st.date}><Icon n="clock" size={14} /><b>{st.day ? st.day + ' ' : ''}{st.time}</b><span>{st.date.replace(/\s\d{4}$/, '')}</span></div>
            <div className="speed" role="group" aria-label="Game speed">
              {[[0, 'pause'], [1, 'play'], [2, 'ff'], [4, 'fff']].map(([v, ic]) => (
                <button key={v} className={st.speed === v ? 'on' : ''} onClick={() => speed(v)} aria-label={v ? `Speed ${v}` : 'Pause'}><Icon n={ic} size={15} fill={ic !== 'pause'} /></button>
              ))}
            </div>
            <Demand s={st} onOpen={() => openCity('people')} />
          </div>}

          {ui && cost && tool && <div className="costtag">{cost.name ? cost.name + ' · ' : cost.n + ' tiles · '}{money(cost.c)}</div>}

          {ui && <nav className="rail" aria-label="Build categories">
            {CATS.map((c) => <button key={c.id} aria-label={c.label} aria-expanded={fly && cat === c.id} className={(fly && cat === c.id ? 'on' : '') + (tool && cat === c.id ? ' has' : '')} onClick={() => openCat(c.id)}><Icon n={c.icon} size={19} /><span>{c.short}</span></button>)}
          </nav>}
          {ui && fly && <section className="fly" aria-label={CATS.find((c) => c.id === cat).label}>
            <div className="fly-h"><b>{CATS.find((c) => c.id === cat).label}</b><button className="x" onClick={() => setFly(false)} aria-label="Close"><Icon n="close" size={15} /></button></div>
            <div className={'fly-grid' + (catTools.length > 6 ? ' three' : '')}>
              {catTools.map((k) => { const t = T[k], need = t.id && st.locked[t.id]; return need ? (
                <button key={k} className="tool locked" onClick={() => say(`${t.label} unlocks at ${need.toLocaleString('en-US')} residents`)} aria-disabled="true">
                  <Icon n="lock" /><span>{t.label}</span><em>{need.toLocaleString('en-US')} pop</em>
                </button>) : (
                <button key={k} className={'tool' + (tool === t.id ? ' on' : '') + (t.zone ? ' z-' + t.zone : '')} onClick={() => pick(t.id)}>
                  <Icon n={t.icon} /><span>{t.label}</span><em>{money(t.cost)}</em>
                </button>); })}
            </div>
          </section>}
          {ui && (view || st.tut || tool || st.canUndo > 0 || st.request) && <div className="leftcol">
            {tool && curTool && <div className="chip">
              <button className="chip-main" onClick={() => openCat(cat)} title="Pick another tool"><Icon n={curTool.icon} size={16} /><b>{curTool.label}</b><em>{money(curTool.cost)}</em></button>
              <button className="chip-x" onClick={() => pick(null)} aria-label="Stop building and move the map"><Icon n="close" size={14} /></button>
            </div>}
            {st.canUndo > 0 && <button className="chip undo" onClick={() => { g.undo(); setSt(g.stats()); }} title={'Undo ' + st.undoLabel}><Icon n="undo" size={15} /><b>Undo</b><em>{st.undoLeft}s</em></button>}
            {st.request && !tool && <button className="chip reqchip" onClick={() => openCity('advice')}><Icon n="news" size={14} /><b>{st.request.choice ? 'Decide' : 'Request'}</b><em>{st.request.title}</em></button>}
            {view && <button className="viewtag" onClick={() => setView(null)}>{view.label} view <Icon n="close" size={14} /></button>}
            {view && view.hint && !panel && <div className="viewhint">{view.hint}</div>}
            {st.tut && !panel && !fly && <section className="guide" aria-label="Getting started">
              <div className="gstep">Step {st.tut.i + 1} of {st.tut.n}</div>
              <h2>{st.tut.title}</h2>
              <p>{st.tut.text}</p>
              <div className="gbtn">{st.tut.cat && <button onClick={() => showMe(st.tut)}>{st.tut.tool ? 'Pick the tool' : 'Pick Move'}</button>}<button className="ghost" onClick={() => { g.skipTutorial(); setSt(g.stats()); }}>Skip guide</button></div>
            </section>}
          </div>}
          {ui && st.inspect && !panel && <Inspector low={st.alerts.length > 0} info={st.inspect} active={st.overlay === 'trips'} onAction={(id) => { if (id.startsWith('jn:')) { g.setJunction(st.inspect.x, st.inspect.y, id.slice(3)); } else if (id.startsWith('mx:')) { g.metroAction(id.slice(3)); } else if (id === 'rd:now') { g.repairRoad(st.inspect.x, st.inspect.y); } else g.setOverlay(st.overlay === id ? null : id); setSt(g.stats()); }} onClose={() => { g.clearSel(); setSt(g.stats()); }} />}
          {ui && news && !(cost && tool) && <div className="ticker" role="status"><Icon n="news" size={15} /><span>{news}</span></div>}
          {ui && st.alerts.length > 0 && <div className="alerts" role="alert">{st.alerts.map((a) => <span key={a}>{a}</span>)}</div>}

          {ui && <nav className="side" aria-label="City and settings">
            <button className={'sbtn' + (panel === 'views' || st.overlay ? ' on' : '')} onClick={() => toggle('views')}><Icon n="eye" size={18} /><span>Views</span></button>
            <button className={'sbtn' + (panel === 'budget' ? ' on' : '')} onClick={() => toggle('budget')}><Icon n="coin" size={18} /><span>City</span>{(st.advice.some((a) => a.sev === 'bad') || (st.request && st.request.choice)) && <i className="dot" aria-label="Advisors have urgent news" />}</button>
            <button className={'sbtn' + (panel === 'menu' ? ' on' : '')} onClick={() => toggle('menu')}><Icon n="menu" size={18} /><span>Menu</span></button>
            <button className="sbtn" onClick={flipUi} aria-label="Hide interface"><Icon n="eyeoff" size={18} /><span>Hide</span></button>
          </nav>}

          {ui && panel === 'views' && (
            <section className="sheet" aria-label="Map views">
              <div className="sheet-h"><h2>Map views</h2><button className="x" onClick={() => setPanel(null)} aria-label="Close"><Icon n="close" size={18} /></button></div>
              <div className="viewgrid">
                {VIEWS.map((v) => <button key={v.id} className={'wide' + (st.overlay === v.id ? ' sel' : '')} onClick={() => setView(v.id)}>{v.label}</button>)}
              </div>
              <button className="wide" style={{ marginTop: 8, width: '100%' }} onClick={() => setView(null)}>Hide view</button>
              <p className="hint">Green is good, red is trouble. Commutes shows which buildings can reach jobs or workers, and which roads link to the highway (blue).</p>
            </section>
          )}
          {ui && panel === 'budget' && (
            <section className="sheet" aria-label="City">
              <div className="sheet-h"><h2>City</h2><button className="x" onClick={() => setPanel(null)} aria-label="Close"><Icon n="close" size={18} /></button></div>
              <div className="seg tabs8">
                {[['budget', 'Budget'], ['people', 'People'], ['services', 'Services'], ['bank', 'Bank'], ['stats', 'Charts'], ['advice', 'Advisors'], ['rules', 'Rules'], ['goals', 'Goals']].map(([k, l]) => (
                  <button key={k} className={(tab === k ? 'on' : '') + (k === 'bank' && st.cut ? ' alert' : '') + (k === 'advice' && st.advice.some((a) => a.sev === 'bad') ? ' alert' : '')} onClick={() => setTab(k)}>{l}{k === 'goals' ? ` ${st.goals.filter((x) => x.done).length}/${st.goals.length}` : ''}</button>
                ))}
              </div>
              {tab === 'budget' && (<>
                <div className="ledger">
                  <div><span>Last month income</span><b className="pos">{money(st.income)}</b></div>
                  <div><span>Last month costs (all)</span><b className="neg">{money(-st.expense)}</b></div>
                  {st.loanPay > 0 && <div><span>Loan payments</span><b className="neg">{money(-st.loanPay)}</b></div>}
                  {st.interest > 0 && <div><span>Bank interest on debt</span><b className="neg">{money(-st.interest)}</b></div>}
                  <div><span>Season</span><b>{st.seasonName}</b></div>
                  <div><span>Tourists last month · hotel beds</span><b>{st.tourists} · {st.beds}</b></div>
                  <div><span>Tourism income</span><b className="pos">{money(st.tourIncome || 0)}</b></div>
                  <div><span>Regional grant (fades as you grow)</span><b>{money(st.grant)}</b></div>
                  <div><span>Service &amp; utility upkeep</span><b>{money(st.upkeep)}</b></div>
                  {st.roads && <div><span>Road repairs last month · worn roads</span><b className={st.roads.worn > st.roads.n * 0.08 ? 'neg' : ''}>{money(st.roads.spend)} · {st.roads.worn} of {st.roads.n}</b></div>}
                  <div><span>Ordinances</span><b>{money(st.ordCost)}</b></div>
                  {st.trade && (st.trade.income > 0 || st.trade.cost > 0) && <div><span>Trade with neighbours (sold · paid)</span><b>{money(st.trade.income)} · {money(-st.trade.cost)}</b></div>}
                  <div><span>Power supply / demand</span><b className={supplyClass(st.pSup, st.pDem) === 'ok' ? 'pos' : 'neg'}>{st.pSup} / {st.pDem}</b></div>
                  <div><span>Water supply / demand</span><b className={supplyClass(st.wSup, st.wDem) === 'ok' ? 'pos' : 'neg'}>{st.wSup} / {st.wDem}</b></div>
                  {st.sewage && st.sewage.total > 0 && <div><span>Sewage treated</span><b className={st.sewage.treated < st.sewage.total * 0.85 ? 'neg' : 'pos'}>{st.sewage.treated} / {st.sewage.total}</b></div>}
                  <div><span>Waste capacity / output</span><b className={supplyClass(st.tSup, st.tDem) === 'ok' ? 'pos' : 'neg'}>{st.tSup} / {st.tDem}</b></div>
                  {st.uDiag && (st.uDiag.unpowered > 0 || st.uDiag.unwatered > 0) && <div><span>Buildings without power · water</span><b className="neg">{st.uDiag.unpowered} · {st.uDiag.unwatered}</b></div>}
                  <div><span>Uncollected waste</span><b className={st.wasteUn > 0.2 ? 'neg' : ''}>{Math.round(st.wasteUn * 100)}% of buildings</b></div>
                  <div><span>Crime / pollution</span><b>{st.crime} / {st.poll}</b></div>
                  <div><span>Police · Fire · Health · School · Fun</span><b>{['police', 'fire', 'health', 'edu', 'fun'].map((k) => Math.round(st.cov[k] * 100) + '%').join(' · ')}</b></div>
                  <div><span>Citizens · with a job</span><b>{st.citizens} · {st.employed}</b></div>
                  <div><span>Buildings (R / C / I)</span><b>{st.bld.r} / {st.bld.c} / {st.bld.i}</b></div>
                </div>
                {st.modes && <Modes now={st.modes} prev={st.modesPrev} />}
                <h3>Tax rates</h3>
                {[['r', 'Residential', '#4caf50'], ['c', 'Commercial', '#3d8bd9'], ['i', 'Industrial', '#e0b526']].map(([k, l, c]) => (
                  <label className="tax" key={k}>
                    <span><i style={{ background: c }} />{l}</span>
                    <input type="range" min="0" max={st.people && st.people.taxCap ? st.people.taxCap.cap : 20} value={st.tax[k]} onChange={(e) => setTax(k, +e.target.value)} />
                    <b>{st.tax[k]}%</b>
                  </label>
                ))}
                {st.people && st.people.taxCap && <p className="hint warnline">The council caps taxes at {st.people.taxCap.cap}% for {st.people.taxCap.left} more month{st.people.taxCap.left === 1 ? '' : 's'}, after the lost election.</p>}
                <p className="hint">Higher taxes raise income but slow growth and lower happiness. Happy residents pay more willingly, healthy workers earn more, and industry needs the highway to sell its goods.</p>
              </>)}
              {tab === 'people' && st.people && (() => { const p = st.people, gi = st.goodsInfo, pct = (v) => Math.round(v * 100) + '%'; return (<>
                <h3>Jobs</h3>
                <div className="ledger">
                  <div><span>Workers (residents of working age)</span><b>{p.workforce.toLocaleString('en-US')}</b></div>
                  <div><span>Jobs in shops and industry</span><b>{p.jobs.toLocaleString('en-US')}</b></div>
                  {p.unemployed > 0 ? <div><span>Without a job</span><b className={p.unemp > 0.12 ? 'neg' : ''}>{p.unemployed.toLocaleString('en-US')} ({pct(p.unemp)})</b></div>
                    : <div><span>Jobs waiting for workers</span><b className="pos">{p.open.toLocaleString('en-US')}</b></div>}
                  {p.empty > 0 && <div><span>Buildings standing empty</span><b className="neg">{p.empty}</b></div>}
                </div>
                <h3>What each zone wants</h3>
                <div className="why3">
                  {[['r', 'Homes', '#4caf50', st.rd], ['c', 'Shops', '#3d8bd9', st.cd], ['i', 'Industry', '#e0b526', st.id]].map(([k, l, c, d]) => (
                    <div key={k}><i style={{ background: c }} /><span><b>{l} · {d > 0.04 ? 'growing' : d > -0.05 ? 'steady' : 'shrinking'}</b><em>{p.why[k]}</em></span></div>
                  ))}
                </div>
                <h3>Goods</h3>
                <div className="ledger">
                  <div><span>Made by local industry</span><b>{gi.made}</b></div>
                  <div><span>Needed by shops</span><b>{gi.need}</b></div>
                  <div><span>Bought from the region</span><b className={gi.importShare > 0.5 ? 'neg' : ''}>{gi.imported} ({pct(gi.importShare)})</b></div>
                  <div><span>Sold to the region</span><b className="pos">{gi.exported}</b></div>
                </div>
                <p className="hint">Shops earn more selling goods made in town. Imported goods cost them more, and without the highway they can&rsquo;t get them at all.</p>
                <h3>Mayor approval</h3>
                <div className="approval"><div className="bar"><i className={p.approval >= 50 ? 'ok' : 'bad'} style={{ width: p.approval + '%' }} /><em /></div><b className={p.approval >= 50 ? 'pos' : 'neg'}>{p.approval}%</b></div>
                <p className="hint">Next election: {p.nextVote}. At 50% or more you&rsquo;re re-elected and the region adds a grant. Below 50%, the council caps taxes at 9% for a year.{p.lastVote ? ` Last vote (${p.lastVote.year}): ${p.lastVote.won ? 'won' : 'lost'} with ${p.lastVote.approval}%.` : ''}</p>
                <h3>Who lives here</h3>
                <div className="hap">
                  {[['Children', p.ages.kids, 'need schools'], ['Adults', p.ages.adults, 'need jobs'], ['Seniors', p.ages.seniors, 'need health care']].map(([l, v, n]) => (
                    <div key={l}><span>{l} <small>{n}</small></span><i className="up" style={{ width: Math.round(v * 100) + '%' }} /><b>{pct(v)}</b></div>
                  ))}
                  {p.wealth.map((w) => (
                    <div key={w.name}><span>{w.name}</span><i className="up" style={{ width: (st.pop ? Math.round((w.n / st.pop) * 100) : 0) + '%' }} /><b>{st.pop ? pct(w.n / st.pop) : '0%'}</b></div>
                  ))}
                </div>
                <p className="hint">Land value decides who moves in: well-off residents pay the most tax, so parks, services and clean air pay off. Tap a home to meet the family living there.</p>
              </>); })()}
              {tab === 'services' && st.fund && (<>
                <h3>Service budgets</h3>
                {st.fund.map((f) => (
                  <label className="tax" key={f.k}>
                    <span>{f.name}</span>
                    <input type="range" min="50" max="150" step="10" value={f.v} onChange={(e) => { g.setFund(f.k, +e.target.value); setSt(g.stats()); }} />
                    <b>{f.v}%</b>
                  </label>
                ))}
                <p className="hint">A bigger budget makes a service reach further and work better, and costs more upkeep. Cutting it saves money but weakens coverage.</p>
                <h3>Deals with neighbouring towns</h3>
                {!st.trade.linked && <p className="hint warnline">Connect your roads to the highway to trade with the region.</p>}
                <div className="ords">
                  {[['power', 'Sell spare power', `${money(Math.round(st.trade.pSpare * st.trade.rates.power))}/mo for ${st.trade.pSpare} spare`], ['water', 'Sell spare water', `${money(Math.round(st.trade.wSpare * st.trade.rates.water))}/mo for ${st.trade.wSpare} spare`], ['waste', 'Send garbage away', `$${st.trade.rates.waste} a month per building your landfills can\u2019t take${st.trade.waste ? ` (${st.trade.wasteOut} now)` : ''}`]].map(([k, l, d]) => (
                    <button key={k} className={'ord' + (st.trade[k] ? ' on' : '')} disabled={!st.trade.linked} onClick={() => { g.setTrade(k, !st.trade[k]); setSt(g.stats()); }} aria-pressed={st.trade[k]}>
                      <span><b>{l}</b><em>{d}</em></span>
                      <span className="sw"><i /></span>
                    </button>
                  ))}
                </div>
                <p className="hint">Selling only uses what your own city doesn&rsquo;t need. Last month: {money(st.trade.income)} earned, {money(st.trade.cost)} paid.</p>
              </>)}
              {tab === 'bank' && (<>
                {st.cut > 0 ? (
                  <div className="debtbox">
                    <b>The city owes the bank {money(-st.money)}</b>
                    <p>To save money, the city has closed: {st.closed.join(', ')}. Closed buildings cost only basic maintenance. Nothing new can be built until the balance is positive.</p>
                    <ol className="stages">
                      {[[1, 'Below $0', 'Ordinances paused, amenities closed'], [2, `Below ${money(-st.cutLimit)}`, 'Schools and buses close'], [3, `Below ${money(-st.cutLimit * 3)}`, 'Police, fire and health care close']].map(([n, when, what]) => (
                        <li key={n} className={st.cut >= n ? 'hit' : ''}><span>{when}</span>{what}</li>
                      ))}
                    </ol>
                    <p>The bank adds 2% interest on the debt every month. Raise taxes, cut costs, or bulldoze what you can&rsquo;t afford.</p>
                  </div>
                ) : <p className="hint" style={{ marginTop: 10 }}>If the balance drops below zero, the city owes the bank. It won&rsquo;t end the game, but services start closing, starting with amenities. Police, fire and health care close last.</p>}
                <h3>Loans</h3>
                {st.loans.length === 0 && <p className="hint" style={{ marginTop: 0 }}>No loans right now.</p>}
                {st.loans.map((l, k) => (
                  <div className="loan" key={k}>
                    <span><b>{money(l.amount)}</b><em>{money(l.pay)}/month, {l.left} months left</em></span>
                    <button className="wide" onClick={() => { g.repayLoan(k); setSt(g.stats()); }}>Repay {money(Math.round(l.pay * l.left * 0.9))}</button>
                  </div>
                ))}
                <h3>Borrow</h3>
                <div className="offers">
                  {st.offers.map((o) => (
                    <button key={o.k} className="wide offer" disabled={!o.ok} onClick={() => { g.takeLoan(o.k); setSt(g.stats()); }}>
                      <b>{money(o.amount)}</b><em>{money(o.pay)}/month for {o.months} months</em>
                    </button>
                  ))}
                </div>
                <p className="hint">The bank lends up to {money(st.credit)} more, based on your population and income. Paying a loan off early saves 10% of what&rsquo;s left.</p>
              </>)}
              {tab === 'stats' && (<>
                {st.history.length < 2 ? <p className="hint">Charts fill in as months pass. Check back after a couple of months.</p> : (<>
                  <Chart title="Population" data={st.history} series={[{ k: 'pop', c: '#6fd072' }]} fmt={(v) => Math.round(v).toLocaleString('en-US')} />
                  <Chart title="Treasury" data={st.history} series={[{ k: 'money', c: '#f2b84b' }]} fmt={(v) => money(Math.round(v))} />
                  <Chart title="Income and costs" data={st.history} series={[{ k: 'inc', c: '#5fd3a6', label: 'In' }, { k: 'exp', c: '#ef6f5e', label: 'Out' }]} fmt={(v) => money(Math.round(v))} />
                  <Chart title="Happiness" data={st.history} series={[{ k: 'happy', c: '#5aa3ea' }]} fmt={(v) => Math.round(v) + '%'} />
                </>)}
                <h3>What drives happiness ({st.happy}%)</h3>
                <div className="hap">
                  {st.hapParts.slice(0, 10).map(([l, v]) => (
                    <div key={l}><span>{l}</span><i className={v > 0 ? 'up' : 'down'} style={{ width: Math.min(100, Math.abs(v) * 4) + '%' }} /><b className={v > 0 ? 'pos' : 'neg'}>{v > 0 ? '+' : ''}{v}</b></div>
                  ))}
                </div>
                <p className="hint">Below 35%, residents start moving away. Above 60%, homes grow faster and taxes come in more reliably.</p>
              </>)}
              {tab === 'advice' && (<>
                {st.request && <div className="req">
                  <small>{st.request.choice ? 'Your decision' : `Request · ${st.request.left} month${st.request.left === 1 ? '' : 's'} left`}</small>
                  <b>{st.request.title}</b>
                  <p>{st.request.text}{st.request.prog ? ` Progress: ${st.request.prog}.` : ''}{st.request.win ? ` Reward: ${[st.request.win.money ? money(st.request.win.money) : '', st.request.win.happy ? `+${st.request.win.happy} happiness` : ''].filter(Boolean).join(', ')}.` : ''}</p>
                  {st.request.choice && <div className="req-c">{st.request.choices.map((c, n) => <button key={n} onClick={() => { g.answerRequest(n); setSt(g.stats()); }}>{c}</button>)}</div>}
                </div>}
                {st.advice.length === 0 && <p className="hint">Nothing urgent. The city is running smoothly.</p>}
                <div className="advice">
                  {st.advice.map((a, k) => (
                    <div key={k} className={'adv ' + a.sev}>
                      <small>{a.who}</small>
                      <p>{a.text}</p>
                      {(a.view || a.tile) && <button onClick={() => { setView(a.view || null); if (a.tile) { g.showAt(a.tile.x, a.tile.y, a.view || null); setSt(g.stats()); } }}>Show on map</button>}
                    </div>
                  ))}
                </div>
                {st.news.length > 0 && <><h3>City news</h3><ul className="newslist">{st.news.slice(0, 12).map((n, k) => <li key={k}><time>{n.date}</time>{n.text}</li>)}</ul></>}
              </>)}
              {tab === 'rules' && (<>
                <p className="hint">Ordinances cost money every month. Pick the ones that fix your city&rsquo;s biggest problem.{st.cut > 0 && ' They are paused while the city is in debt.'}</p>
                <div className="ords">
                  {st.ords.map((o) => (
                    <button key={o.key} className={'ord' + (o.on ? ' on' : '')} onClick={() => { g.setOrd(o.key, !o.on); setSt(g.stats()); }} aria-pressed={o.on}>
                      <span><b>{o.name}</b><em>{o.desc}</em></span>
                      <span className="sw"><i /></span><small>{money(o.cost)}/mo</small>
                    </button>
                  ))}
                </div>
              </>)}
              {tab === 'goals' && (
                <div className="goals">
                  {st.goals.map((x) => (
                    <div key={x.id} className={'goal' + (x.done ? ' done' : '')}>
                      <div className="gh"><b>{x.title}</b><span>{x.done ? 'Done' : '+' + money(x.reward)}</span></div>
                      <p>{x.desc}</p>
                      <div className="bar"><i style={{ width: Math.round(x.progress * 100) + '%' }} /></div>
                      {!x.done && <small>{x.label}</small>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
          {ui && panel === 'saves' && (
            <section className="sheet" aria-label="Saves">
              <div className="sheet-h"><h2>Saves</h2><button className="x" onClick={() => setPanel(null)} aria-label="Close"><Icon n="close" size={18} /></button></div>
              <SavesPanel g={g} inGame onLoaded={() => { setPanel(null); setSt(g.stats()); say('City loaded'); }} refresh={() => setSt(g.stats())} />
            </section>
          )}
          {ui && panel === 'menu' && (
            <section className="sheet" aria-label="Menu">
              <div className="sheet-h"><h2>Menu</h2><button className="x" onClick={() => setPanel(null)} aria-label="Close"><Icon n="close" size={18} /></button></div>
              <h3>Time of day</h3>
              <div className="seg">
                {[['auto', 'Auto'], [0, 'Day'], [1, 'Dusk'], [2, 'Night']].map(([v, l]) => (
                  <button key={l} className={timeSet === v ? 'on' : ''} onClick={() => pickTime(v)}>{l}</button>
                ))}
              </div>
              <h3>Weather</h3>
              <div className="seg three">
                {[['auto', 'Auto'], ['clear', 'Clear'], ['rain', 'Rain']].map(([v, l]) => (
                  <button key={v} className={st.weather === v ? 'on' : ''} onClick={() => { g.setWeather(v); setSt(g.stats()); }}>{l}</button>
                ))}
              </div>
              <h3>Graphics</h3>
              <div className="seg three">
                {[['auto', 'Auto'], ['high', 'Pretty'], ['fast', 'Smooth']].map(([q, l]) => (
                  <button key={q} className={st.quality === q ? 'on' : ''} onClick={() => { g.setQuality(q); if (q === 'fast') setTilt(false); setSt(g.stats()); }}>{l}</button>
                ))}
              </div>
              <p className="hint" style={{ marginTop: 6 }}>{st.quality === 'auto' ? (st.fast ? 'Auto switched to smooth graphics for this phone.' : 'Auto starts pretty and switches to smooth if the game slows down.') : st.quality === 'fast' ? 'Lower resolution, no glow or haze. Best on slower phones.' : 'Full detail, glow and haze.'}</p>
              <h3>Frame rate</h3>
              <div className="seg three">
                {[['auto', 'Auto'], [30, '30'], [60, '60']].map(([v, l]) => (
                  <button key={l} className={st.fpsSetting === v ? 'on' : ''} onClick={() => { g.setFps(v); setSt(g.stats()); }}>{l}</button>
                ))}
              </div>
              <p className="hint" style={{ marginTop: 6 }}>{st.fpsSetting === 'auto' ? 'Smooth (60) while you drag and zoom, 30 when the view is still: cooler phone, longer battery.' : st.fpsSetting === 30 ? 'Always 30: coolest, uses the least battery.' : 'Always 60: smoothest, makes the phone warmer.'}</p>
              <h3>Seasons</h3>
              <div className="seg two">
                {[['auto', 'Follow the calendar'], ['off', 'Always summer']].map(([v, l]) => (
                  <button key={v} className={st.seasons === v ? 'on' : ''} onClick={() => { g.setSeasons(v); setSt(g.stats()); }}>{l}</button>
                ))}
              </div>
              <p className="hint" style={{ marginTop: 6 }}>Autumn colours from September, frost and bare trees from December.</p>
              <div className="seg two" style={{ marginTop: 8 }}>
                <button className={tilt ? 'on' : ''} disabled={st.fast} onClick={flipTilt}>Lens focus {tilt && !st.fast ? 'on' : 'off'}</button>
                <button onClick={() => { const el = document.documentElement; if (document.fullscreenElement) document.exitFullscreen && document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(() => {}); }}>Fullscreen</button>
              </div>
              <h3>Sound</h3>
              <div className="seg two">
                <button className={st.audio.sound ? 'on' : ''} onClick={() => { g.setAudio('sound', !st.audio.sound); setSt(g.stats()); }}>Effects {st.audio.sound ? 'on' : 'off'}</button>
                <button className={st.audio.music ? 'on' : ''} onClick={() => { g.setAudio('music', !st.audio.music); setSt(g.stats()); }}>Music {st.audio.music ? 'on' : 'off'}</button>
              </div>
              <label className="tax vol"><span><Icon n="volume" size={16} />Volume</span><input type="range" min="0" max="100" value={Math.round(st.audio.volume * 100)} onChange={(e) => { g.setAudio('volume', +e.target.value / 100); setSt(g.stats()); }} /><b>{Math.round(st.audio.volume * 100)}%</b></label>
              <h3>Disasters</h3>
              <div className="seg">
                {[[0, 'Off'], [1, 'Rare'], [2, 'Normal'], [3, 'Chaos']].map(([v, l]) => (
                  <button key={l} className={st.disastersLevel === v ? 'on' : ''} onClick={() => { g.setDisasters(v); setSt(g.stats()); }}>{l}</button>
                ))}
              </div>
              <div className="seg three" style={{ marginTop: 6 }}>
                {[['fire', 'Fire'], ['tornado', 'Tornado'], ['ufo', 'UFO']].map(([k, l]) => (
                  <button key={k} onClick={() => { g.trigger(k); setPanel(null); }}>Start {l}</button>
                ))}
              </div>
              <div className="rows">
                <button className="wide" onClick={() => { g.save(); say('City saved'); setPanel(null); }}>Save city</button>
                <button className="wide" onClick={() => setPanel('saves')}>Saves, backups and export</button>
                <button className={'wide' + (st.sandbox ? ' warn' : '')} onClick={() => { g.setSandbox(!st.sandbox); setSt(g.stats()); }}>{st.sandbox ? 'Sandbox on: tap to turn off' : 'Sandbox mode (unlimited money)'}</button>
                <button className="wide" onClick={() => toStart('home')}>Main menu</button>
                <button className="wide warn" onClick={() => toStart('new')}>New city</button>
              </div>
              <p className="hint">The city autosaves every 20 seconds.</p>
              <button className="version" onClick={() => setTaps(taps + 1)}>Skyline {VERSION}{BUILT && ` \u00b7 built ${BUILT} UTC`}</button>
              {taps >= 5 && (<>
                <h3>Test tools</h3>
                <div className="seg three">
                  {[['cash', '+$50,000'], ['debt', 'Go into debt'], ['clear', 'Clear debt'], ['unlock', 'Unlock all'], ['month', 'End month']].map(([k, l]) => (
                    <button key={k} onClick={() => { g.testTool(k); setSt(g.stats()); }}>{l}</button>
                  ))}
                </div>
                {st.perf && <p className="hint">Aiming for {st.fpsNow} fps · Frames: {st.perf.fps} fps · average {st.perf.avg} ms · worst {st.perf.worst} ms (last 2 seconds)</p>}
                <p className="hint">Drawing with: {st.engine}{st.pages ? ` · ${st.pages} texture pages` : ''}</p>
                <p className="hint">Stutters (frames over 50 ms) in the last 30 seconds: {st.hitches.n}{st.hitches.last && <><br />Last one: {st.hitches.last}</>}</p>
                <div className="seg two"><button onClick={() => { try { localStorage.setItem('skyline.engine', st.engine === 'Canvas 2D' ? 'gpu' : '2d'); } catch (e) { /* ignore */ } g.save(); window.location.reload(); }}>{st.engine === 'Canvas 2D' ? 'Switch to GPU' : 'Switch to old 2D canvas'}</button></div>
                <p className="hint">For testing only. Tap the version line 5 times to show these.</p>
              </>)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
