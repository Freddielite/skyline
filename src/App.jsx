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
};
const Icon = ({ n, size = 22, fill }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={I[n]} /></svg>
);

const TOOLS = [
  { id: null, label: 'Move', icon: 'hand' },
  { id: 'road', label: 'Road', icon: 'road', cost: 10 },
  { id: 'res', label: 'Homes', icon: 'home', cost: 5, zone: 'r' },
  { id: 'com', label: 'Shops', icon: 'shop', cost: 5, zone: 'c' },
  { id: 'ind', label: 'Industry', icon: 'gear', cost: 5, zone: 'i' },
  { id: 'park', label: 'Park', icon: 'tree', cost: 25 },
  { id: 'bulldoze', label: 'Clear', icon: 'dozer', cost: 2 },
];
const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US');

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
  const [toast, setToast] = useState('');
  const [cost, setCost] = useState(null);
  const [panel, setPanel] = useState(null);
  const [timeSet, setTimeSet] = useState('auto');
  const toastT = useRef(0);

  const say = useCallback((m) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(''), 2400); }, []);

  useEffect(() => {
    const g = new Game(cvRef.current, {
      toast: say,
      cost: (c, n) => setCost(n ? { c, n } : null),
      month: (e) => say(`Month closed: ${e.income - e.expense >= 0 ? '+' : ''}${money(e.income - e.expense)}`),
    });
    gameRef.current = g; window.__game = g;
    g.start();
    const iv = setInterval(() => setSt(g.stats()), 250);
    setSt(g.stats());
    return () => { clearInterval(iv); g.stop(); };
  }, [say]);

  const g = gameRef.current;
  const pick = (id) => { setTool(id); g && g.setTool(id); setPanel(null); };
  const speed = (s) => { g.setSpeed(s); setSt(g.stats()); };
  const setTax = (k, v) => { g.setTax(k, v); setSt(g.stats()); };
  const pickTime = (v) => { setTimeSet(v); g.setTime(v); };
  const newCity = () => { g.newCity(Math.floor(Math.random() * 100000)); setPanel(null); setSt(g.stats()); };

  return (
    <div className="app">
      <canvas ref={cvRef} className="map" />
      {st && (
        <>
          <header className="top">
            <div className="cash"><Icon n="coin" size={18} /><b>{money(st.money)}</b></div>
            <div className="meta"><b>{st.pop.toLocaleString('en-US')}</b><span>residents</span></div>
            <div className="meta hide-s"><b>{st.happy}%</b><span>happy</span></div>
            <div className="date">{st.date}</div>
            <div className="speed" role="group" aria-label="Game speed">
              {[[0, 'pause'], [1, 'play'], [2, 'ff'], [4, 'fff']].map(([v, ic]) => (
                <button key={v} className={st.speed === v ? 'on' : ''} onClick={() => speed(v)} aria-label={v ? `Speed ${v}` : 'Pause'}><Icon n={ic} size={16} fill={ic !== 'pause'} /></button>
              ))}
            </div>
            <Demand s={st} />
          </header>

          {cost && tool && <div className="costtag">{cost.n} tiles · {money(cost.c)}</div>}
          {toast && <div className="toast" role="status">{toast}</div>}

          <nav className="dock" aria-label="Build tools">
            <div className="tools">
              {TOOLS.map((t) => (
                <button key={t.label} className={'tool' + (tool === t.id ? ' on' : '') + (t.zone ? ' z-' + t.zone : '')} onClick={() => pick(t.id)}>
                  <Icon n={t.icon} /><span>{t.label}</span>{t.cost ? <em>{money(t.cost)}</em> : <em>&nbsp;</em>}
                </button>
              ))}
            </div>
            <div className="sys">
              <button className="tool" onClick={() => setPanel(panel === 'budget' ? null : 'budget')}><Icon n="coin" /><span>Budget</span><em>&nbsp;</em></button>
              <button className="tool" onClick={() => setPanel(panel === 'menu' ? null : 'menu')}><Icon n="menu" /><span>Menu</span><em>&nbsp;</em></button>
            </div>
          </nav>

          {panel === 'budget' && (
            <section className="sheet" aria-label="Budget">
              <div className="sheet-h"><h2>Budget</h2><button className="x" onClick={() => setPanel(null)} aria-label="Close"><Icon n="close" size={18} /></button></div>
              <div className="ledger">
                <div><span>Last month income</span><b className="pos">{money(st.income)}</b></div>
                <div><span>Last month upkeep</span><b className="neg">{money(-st.expense)}</b></div>
                <div><span>Roads / parks</span><b>{st.roads} / {st.parks}</b></div>
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
              <p className="hint">Higher taxes raise income but slow growth and lower happiness.</p>
            </section>
          )}
          {panel === 'menu' && (
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
