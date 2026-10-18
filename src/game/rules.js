// Ordinances (monthly policies) and goals (milestones with cash rewards)
export const ORD = {
  watch: { name: 'Neighborhood watch', desc: 'Crime -15%', cost: 40 },
  recycle: { name: 'Recycling program', desc: 'Garbage output -25%', cost: 55 },
  energy: { name: 'Energy saver', desc: 'Power demand -15%', cost: 50 },
  water: { name: 'Water conservation', desc: 'Water demand -20%', cost: 40 },
  scrub: { name: 'Smokestack scrubbers', desc: 'Industrial pollution -30%', cost: 80 },
  tourism: { name: 'Tourism campaign', desc: 'More shop demand', cost: 90 },
  fireproof: { name: 'Fireproofing', desc: 'Fires start and spread less', cost: 60 },
};

const tgt = (id, title, desc, reward, t, v, fmt) => ({ id, title, desc, reward, t, v, fmt });
export const GOALS = [
  tgt('pop100', 'Founding day', 'Reach 100 residents', 2000, 100, (s) => s.pop),
  tgt('power10', 'Lights on', 'Get 10 buildings powered', 1500, 10, (s) => s.countServed('pw')),
  tgt('water10', 'Running water', 'Get 10 buildings on the water supply', 1500, 10, (s) => s.countServed('wt')),
  tgt('pop500', 'Small town', 'Reach 500 residents', 5000, 500, (s) => s.pop),
  tgt('police', 'Safe streets', 'Police cover 50% of residents (300+ residents)', 3000, 50, (s) => (s.pop >= 300 ? Math.round(s.net.police * 100) : 0), (v) => v + '%'),
  tgt('health', 'Healthy city', 'Health care covers 50% of residents (300+ residents)', 3000, 50, (s) => (s.pop >= 300 ? Math.round(s.net.health * 100) : 0), (v) => v + '%'),
  tgt('tidy', 'Tidy town', 'Collect 90% of garbage (30+ buildings)', 3000, 90, (s) => (s.bld.r + s.bld.c + s.bld.i >= 30 ? Math.round((1 - s.net.wasteUn) * 100) : 0), (v) => v + '%'),
  tgt('pop1k', 'Real town', 'Reach 1,000 residents', 10000, 1000, (s) => s.pop),
  tgt('black', 'In the black', 'End 3 months in a row with a profit', 3000, 3, (s) => s.streak),
  tgt('culture', 'Culture vultures', 'Build a museum', 4000, 1, (s) => s.countBuilt('museum')),
  tgt('happy', 'Happy place', 'Reach 70% happiness (500+ residents)', 6000, 70, (s) => (s.pop >= 500 ? s.happiness : 0), (v) => v + '%'),
  tgt('stadium', 'Game day', 'Build a stadium', 8000, 1, (s) => s.countBuilt('stadium')),
  tgt('pop2500', 'Big town', 'Reach 2,500 residents', 25000, 2500, (s) => s.pop),
  tgt('pop5k', 'City', 'Reach 5,000 residents', 60000, 5000, (s) => s.pop),
  tgt('pop10k', 'Metropolis', 'Reach 10,000 residents', 150000, 10000, (s) => s.pop),
];
