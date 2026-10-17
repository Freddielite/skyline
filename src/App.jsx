import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Game } from './game/game.js';

const I = {
  hand: 'M8 13V5.5a1.5 1.5 0 013 0V11m0-6.5a1.5 1.5 0 013 0V11m0-5a1.5 1.5 0 013 0V13m0-4a1.5 1.5 0 013 0v6.5A6.5 6.5 0 0113 22h-1.6a6 6 0 01-4.7-2.3L3.5 15.5a1.5 1.5 0 012.3-1.9L8 16',
  road: 'M9 3L5 21M15 3l4 18M12 4v3m0 4v3m0 4v3',
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
  recycle: 'M20 12a8 8 0 01-13.5 5.8M4 12a8 8 0 0113.5-5.8M17.5 3v3.5H14M6.5 21v-3.5H10',
  ball: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8l3.5 2.5-1.3 4h-4.4l-1.3-4L12 8zM12 3v5M20.5 9.5L15.5 10.5M3.5 9.5l5 1M7 19l2.8-4.5M17 19l-2.8-4.5',
  bank: 'M3 10l9-6 9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18',
  smile: 'M12 3a9 9 0 100 18 9 9 0 000-18zM8.5 14a4.2 4.2 0 007 0M9 9.5h.01M15 9.5h.01',
  people: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 11a2.5 2.5 0 100-5M17 14.2c2.2.5 4 2.4 4 5.8',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3.5 2',
  eyeoff: 'M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.2 3.7M6.5 6.7C3.7 8.6 2 12 2 12s4 7 10 7a9.6 9.6 0 004.2-1M9.9 9.9a3 3 0 004.2 4.2',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10-3a3 3 0 100 6 3 3 0 000-6z',
};
const Icon = ({ n, size = 22, fill }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={I[n]} /></svg>
);

const T = {
  move: { id: null, label: 'Move', icon: 'hand' },
  road: { id: 'road', label: 'Road', icon: 'road', cost: 10 },
  res: { id: 'res', label: 'Homes', icon: 'home', cost: 5, zone: 'r' },
  com: { id: 'com', label: 'Shops', icon: 'shop', cost: 5, zone: 'c' },
  ind: { id: 'ind', label: 'Industry', icon: 'gear', cost: 5, zone: 'i' },
  park: { id: 'park', label: 'Park', icon: 'tree', cost: 25 },
  clear: { id: 'bulldoze', label: 'Clear', icon: 'dozer', cost: 2 },
  coal: { id: 'coal', label: 'Coal plant', icon: 'plant', cost: 3000 },
  wind: { id: 'wind', label: 'Wind', icon: 'wind', cost: 500 },
  water: { id: 'water', label: 'Water', icon: 'drop', cost: 800 },
  police: { id: 'police', label: 'Police', icon: 'shield', cost: 600 },
  fire: { id: 'fire', label: 'Fire', icon: 'flame', cost: 600 },
  clinic: { id: 'clinic', label: 'Clinic', icon: 'cross', cost: 800 },
  school: { id: 'school', label: 'School', icon: 'book', cost: 700 },
  wire: { id: 'wire', label: 'Power line', icon: 'wire', cost: 4 },
  cable: { id: 'cable', label: 'Cable', icon: 'cable', cost: 12 },
  dump: { id: 'dump', label: 'Landfill', icon: 'trash', cost: 1200 },
  recycle: { id: 'recycle', label: 'Recycling', icon: 'recycle', cost: 3200 },
  wte: { id: 'wte', label: 'Waste power', icon: 'bolt', cost: 5200 },
  police2: { id: 'police2', label: 'Police HQ', icon: 'shield', cost: 2400 },
  fire2: { id: 'fire2', label: 'Fire HQ', icon: 'flame', cost: 2400 },
  hospital: { id: 'hospital', label: 'Hospital', icon: 'cross', cost: 3400 },
  university: { id: 'university', label: 'University', icon: 'book', cost: 6500 },
  plaza: { id: 'plaza', label: 'Plaza', icon: 'tree', cost: 900 },
  library: { id: 'library', label: 'Library', icon: 'book', cost: 700 },
  museum: { id: 'museum', label: 'Museum', icon: 'bank', cost: 2200 },
  stadium: { id: 'stadium', label: 'Stadium', icon: 'ball', cost: 7000 },
};
const CATS = [
  { id: 'build', label: 'Build', icon: 'road', tools: ['move', 'road', 'res', 'com', 'ind', 'park', 'clear'] },
  { id: 'util', label: 'Power & water', icon: 'bolt', tools: ['move', 'coal', 'wind', 'water', 'wire', 'cable', 'clear'] },
  { id: 'waste', label: 'Waste', icon: 'trash', tools: ['move', 'dump', 'recycle', 'wte', 'clear'] },
  { id: 'svc', label: 'Services', icon: 'shield', tools: ['move', 'police', 'police2', 'fire', 'fire2', 'clinic', 'hospital', 'school', 'university', 'clear'] },
  { id: 'fun', label: 'Amenities', icon: 'ball', tools: ['move', 'plaza', 'library', 'museum', 'stadium', 'clear'] },
];
const VIEWS = [
  { id: 'value', label: 'Land value' }, { id: 'crime', label: 'Crime' }, { id: 'pollution', label: 'Pollution' },
  { id: 'power', label: 'Power' }, { id: 'water', label: 'Water' },
  { id: 'waste', label: 'Waste' }, { id: 'fun', label: 'Amenities' },
  { id: 'police', label: 'Police' }, { id: 'fire', label: 'Fire' }, { id: 'health', label: 'Health' }, { id: 'edu', label: 'Education' },
];
const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US');
const supplyClass = (sup, dem) => (dem <= 0 ? 'ok' : sup >= dem ? 'ok' : sup >= dem * 0.75 ? 'mid' : 'bad');

function Demand({ s }) {
  const bar = (v, c, l) => (
    <div className="dm" title={l}>
      <div className="dm-track"><div className="dm-fill" style={{ background: c, height: Math.abs(v) * 50 + '%', [v >= 0 ? 'bottom' : 'top']: '50%' }} /></div>
      <span>{l}</span>
    </div>
  );
  return <div className="demand" aria-label="Zone demand">{bar(s.rd, '#4caf50', 'R')}{bar(s.cd, '#3d8bd9', 'C')}{bar(s.id, '#e0b526', 'I')}</div>;
}

export default function App() {
  const cvRef = useRef(null), gameRef = useRef(null);
  const [st, setSt] = useState(null);
  const [tool, setTool] = useState(null);
  const [cat, setCat] = useState('build');
  const [toast, setToast] = useState('');
  const [cost, setCost] = useState(null);
  const [panel, setPanel] = useState(null);
  const [timeSet, setTimeSet] = useState('auto');
  const [ui, setUi] = useState(() => { try { return localStorage.getItem('skyline.hideui') !== '1'; } catch (e) { return true; } });
  const toastT = useRef(0);

  const say = useCallback((m) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(''), 2400); }, []);

  useEffect(() => {
    const g = new Game(cvRef.current, {
      toast: say,
      cost: (c, n, name) => setCost(n ? { c, n, name } : null),
      month: (e) => say(`Month closed: ${e.income - e.expense >= 0 ? '+' : ''}${money(e.income - e.expense)}`),
    });
    gameRef.current = g; window.__game = g;
    g.start();
    const iv = setInterval(() => setSt(g.stats()), 250);
    setSt(g.stats());
    return () => { clearInterval(iv); g.stop(); };
  }, [say]);

  const g = gameRef.current;
  const pick = (id) => { setTool(id); g && g.setTool(id); if (id) { setPanel(null); g.setOverlay(id === 'wire' || id === 'cable' ? 'power' : null); } };
  const speed = (s) => { g.setSpeed(s); setSt(g.stats()); };
  const setTax = (k, v) => { g.setTax(k, v); setSt(g.stats()); };
  const pickTime = (v) => { setTimeSet(v); g.setTime(v); };
  const newCity = () => { g.newCity(Math.floor(Math.random() * 100000)); setPanel(null); setSt(g.stats()); };
  const setView = (v) => { g.setOverlay(v); if (v) { setTool(null); g.setTool(null); } setPanel(null); setSt(g.stats()); };
  const toggle = (p) => setPanel(panel === p ? null : p);
  const flipUi = () => { const next = !ui; setUi(next); try { localStorage.setItem('skyline.hideui', next ? '0' : '1'); } catch (e) { /* ignore */ } if (!next) { setPanel(null); setTool(null); g && g.setTool(null); } };
  const catTools = CATS.find((c) => c.id === cat).tools;
  const view = st && VIEWS.find((v) => v.id === st.overlay);

  return (
    <div className="app">
      <canvas ref={cvRef} className="map" />
      {st && (
        <>
          {!ui && <button className="showui" onClick={flipUi} aria-label="Show interface"><Icon n="eye" size={22} /></button>}
          {ui && <header className="top">
            <div className="cash"><Icon n="coin" size={18} /><b>{money(st.money)}</b></div>
            <div className="util pop" title="Residents"><Icon n="people" size={15} /><b>{st.pop.toLocaleString('en-US')}</b></div>
            <div className={'util ' + supplyClass(st.pSup, st.pDem)} title="Power supply / demand"><Icon n="bolt" size={15} fill /><b>{st.pSup}/{st.pDem}</b></div>
            <div className={'util ' + supplyClass(st.wSup, st.wDem)} title="Water supply / demand"><Icon n="drop" size={15} fill /><b>{st.wSup}/{st.wDem}</b></div>
            <div className={'util ' + supplyClass(st.tSup, st.tDem)} title="Waste capacity / output"><Icon n="trash" size={15} /><b>{st.tSup}/{st.tDem}</b></div>
            <div className={'util ' + (st.happy >= 60 ? 'ok' : st.happy >= 40 ? 'mid' : 'bad')} title="Happiness"><Icon n="smile" size={15} /><b>{st.happy}%</b></div>
            <div className="util time" title="Time of day"><Icon n="clock" size={15} /><b>{st.time}</b></div>
            <div className="date">{st.date}</div>
            <div className="speed" role="group" aria-label="Game speed">
              {[[0, 'pause'], [1, 'play'], [2, 'ff'], [4, 'fff']].map(([v, ic]) => (
                <button key={v} className={st.speed === v ? 'on' : ''} onClick={() => speed(v)} aria-label={v ? `Speed ${v}` : 'Pause'}><Icon n={ic} size={16} fill={ic !== 'pause'} /></button>
              ))}
            </div>
            <Demand s={st} />
          </header>}

          {ui && cost && tool && <div className="costtag">{cost.name ? cost.name + ' · ' : cost.n + ' tiles · '}{money(cost.c)}</div>}
          {ui && view && <button className="viewtag" onClick={() => setView(null)}>{view.label} view <Icon n="close" size={14} /></button>}
          {toast && <div className="toast" role="status">{toast}</div>}

          {ui && <nav className="dock" aria-label="Build tools">
            <div className="stack">
              <div className="tabs" role="tablist">
                {CATS.map((c) => <button key={c.id} role="tab" aria-label={c.label} aria-selected={cat === c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}><Icon n={c.icon} size={18} /><span>{c.label}</span></button>)}
              </div>
              <div className="tabcap">{CATS.find((c) => c.id === cat).label}</div>
              <div className="tools">
                {catTools.map((k) => { const t = T[k]; return (
                  <button key={k} className={'tool' + (tool === t.id ? ' on' : '') + (t.zone ? ' z-' + t.zone : '')} onClick={() => pick(t.id)}>
                    <Icon n={t.icon} /><span>{t.label}</span>{t.cost ? <em>{money(t.cost)}</em> : <em>&nbsp;</em>}
                  </button>); })}
              </div>
            </div>
            <div className="sys">
              <button className={'tool' + (st.overlay ? ' on' : '')} onClick={() => toggle('views')}><Icon n="eye" /><span>Views</span><em>&nbsp;</em></button>
              <button className="tool" onClick={() => toggle('budget')}><Icon n="coin" /><span>Budget</span><em>&nbsp;</em></button>
              <button className="tool" onClick={() => toggle('menu')}><Icon n="menu" /><span>Menu</span><em>&nbsp;</em></button>
              <button className="tool" onClick={flipUi} aria-label="Hide interface"><Icon n="eyeoff" /><span>Hide</span><em>&nbsp;</em></button>
            </div>
          </nav>}

          {ui && panel === 'views' && (
            <section className="sheet" aria-label="Map views">
              <div className="sheet-h"><h2>Map views</h2><button className="x" onClick={() => setPanel(null)} aria-label="Close"><Icon n="close" size={18} /></button></div>
              <div className="viewgrid">
                {VIEWS.map((v) => <button key={v.id} className={'wide' + (st.overlay === v.id ? ' sel' : '')} onClick={() => setView(v.id)}>{v.label}</button>)}
              </div>
              <button className="wide" style={{ marginTop: 8, width: '100%' }} onClick={() => setView(null)}>Hide view</button>
              <p className="hint">Green is good, red is trouble. Power and water views show which buildings are connected.</p>
            </section>
          )}
          {ui && panel === 'budget' && (
            <section className="sheet" aria-label="Budget">
              <div className="sheet-h"><h2>Budget</h2><button className="x" onClick={() => setPanel(null)} aria-label="Close"><Icon n="close" size={18} /></button></div>
              <div className="ledger">
                <div><span>Last month income</span><b className="pos">{money(st.income)}</b></div>
                <div><span>Last month upkeep</span><b className="neg">{money(-st.expense)}</b></div>
                <div><span>Service &amp; utility upkeep</span><b>{money(st.upkeep)}</b></div>
                <div><span>Power supply / demand</span><b className={supplyClass(st.pSup, st.pDem) === 'ok' ? 'pos' : 'neg'}>{st.pSup} / {st.pDem}</b></div>
                <div><span>Water supply / demand</span><b className={supplyClass(st.wSup, st.wDem) === 'ok' ? 'pos' : 'neg'}>{st.wSup} / {st.wDem}</b></div>
                <div><span>Waste capacity / output</span><b className={supplyClass(st.tSup, st.tDem) === 'ok' ? 'pos' : 'neg'}>{st.tSup} / {st.tDem}</b></div>
                <div><span>Uncollected waste</span><b className={st.wasteUn > 0.2 ? 'neg' : ''}>{Math.round(st.wasteUn * 100)}% of buildings</b></div>
                <div><span>Crime / pollution</span><b>{st.crime} / {st.poll}</b></div>
                <div><span>Police · Fire · Health · School · Fun</span><b>{['police', 'fire', 'health', 'edu', 'fun'].map((k) => Math.round(st.cov[k] * 100) + '%').join(' · ')}</b></div>
                <div><span>Citizens · with a job</span><b>{st.citizens} · {st.employed}</b></div>
                <div><span>Buildings (R / C / I)</span><b>{st.bld.r} / {st.bld.c} / {st.bld.i}</b></div>
              </div>
              <h3>Tax rates</h3>
              {[['r', 'Residential', '#4caf50'], ['c', 'Commercial', '#3d8bd9'], ['i', 'Industrial', '#e0b526']].map(([k, l, c]) => (
                <label className="tax" key={k}>
                  <span><i style={{ background: c }} />{l}</span>
                  <input type="range" min="0" max="20" value={st.tax[k]} onChange={(e) => setTax(k, +e.target.value)} />
                  <b>{st.tax[k]}%</b>
                </label>
              ))}
              <p className="hint">Higher taxes raise income but slow growth and lower happiness. Buildings without power or water pay less, and uncollected garbage hurts happiness.</p>
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
              <div className="rows">
                <button className="wide" onClick={() => { g.save(); say('City saved'); setPanel(null); }}>Save city</button>
                <button className="wide warn" onClick={() => { if (window.confirm('Start a new city? The current one will be replaced.')) newCity(); }}>New city</button>
              </div>
              <p className="hint">The city autosaves every 20 seconds.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
