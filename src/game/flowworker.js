// Runs a whole traffic pass (flow.js) off the main thread (0.8.1), so the map never stutters while trips are worked
// out. The main thread sends a snapshot of the roads and lots; this sends back the trips per road tile and the
// districts it used (kept for tracing a road's trips in the Inspector).
import { Flow } from './flow.js';

self.onmessage = (e) => {
  const m = e.data, w = { kind: m.kind, level: m.level, hw: m.hw, terrain: m.terrain };
  const f = new Flow(w); f.cost.set(m.cost);
  const sim = { lvl: (i) => m.lvl[i], cov: { transit: m.transit, metro: m.metro }, day: m.day };
  f.begin(sim); const job = f.job;
  if (job) for (const o of job.origins) f.origin(job, o);
  const out = { id: m.id, next: f.next, job: job ? { H: job.H, J: job.J, S: job.S, F: job.F, tr: job.tr, rep: job.rep, origins: job.origins, hwEnds: job.hwEnds } : null };
  self.postMessage(out, [f.next.buffer]);
};
