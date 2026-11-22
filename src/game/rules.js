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
  tgt('connect', 'On the map', 'Connect a road network to the highway', 500, 1, (s) => (s.hwRoads >= 4 ? 1 : 0)),
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
  tgt('campus', 'Campus town', 'Build a university', 8000, 1, (s) => s.countBuilt('university')),
  tgt('pop10k', 'Metropolis', 'Reach 10,000 residents', 150000, 10000, (s) => s.pop),
  tgt('sky', 'Reach for the sky', 'Grow a level 4 skyscraper', 20000, 1, (s) => s.bld.top),
  tgt('books', 'Clean books', 'No loans and $50,000 in the bank (2,000+ residents)', 15000, 1, (s) => (s.pop >= 2000 && !s.loans.length && s.money >= 50000 ? 1 : 0)),
  tgt('pop25k', 'Skyline', 'Reach 25,000 residents', 300000, 25000, (s) => s.pop),
];

// Buildings unlock as the city grows (by the highest population it has reached, so a bad year never locks them again)
export const UNLOCK = {
  plaza: 300, library: 300, busterm: 300, beach: 300,
  ferry: 600,
  marina: 1000,
  pump: 600, police2: 600, fire2: 600, recycle: 600,
  hospital: 1000, museum: 1000,
  university: 1500, wte: 1500, treat: 1500,
  stadium: 2500, sky: 2500,
};
export const UNLOCK_NAME = { sky: 'Skyscrapers (level 4 buildings)' };

// Loans from the regional bank: money now, repaid in fixed monthly installments
export const LOANS = [
  { amount: 10000, months: 12, rate: 0.12 },
  { amount: 25000, months: 24, rate: 0.18 },
  { amount: 60000, months: 36, rate: 0.25 },
];
export const OVERDRAFT_RATE = 0.02;                  // a negative balance is owed to the bank and grows 2% a month

// First-time guide. Each step finishes itself when the condition is met.
export const TUTORIAL = [
  { id: 'road', title: 'Connect to the highway', text: 'People and goods arrive by the highway at the edge of the map. Drag a road out from it.', cat: 'build', tool: 'road', done: (s) => s.hwRoads >= 4 },
  { id: 'homes', title: 'Zone some homes', text: 'Drag a rectangle of homes along your road. Zones must be within 2 tiles of a road.', cat: 'build', tool: 'res', done: (s) => s.zoned.r >= 6 },
  { id: 'jobs', title: 'Add shops and industry', text: 'Residents need jobs within reach of home. Zone a few shops and some industry nearby.', cat: 'build', tool: 'ind', done: (s) => s.zoned.c >= 2 && s.zoned.i >= 2 },
  { id: 'plant', title: 'Build a power plant', text: 'Wind turbines are cheap and clean. A coal plant is stronger but pollutes.', cat: 'util', tool: 'wind', done: (s) => s.plants > 0 },
  { id: 'lines', title: 'Run power lines', text: 'Drag a power line from the plant toward your zones. Buildings within 2 tiles of a live line get power.', cat: 'util', tool: 'wire', done: (s) => s.countServed('pw') >= 3 },
  { id: 'water', title: 'Bring in water', text: 'Place a water tower, then drag pipes from it to your buildings.', cat: 'util', tool: 'water', done: (s) => s.countServed('wt') >= 3 },
  { id: 'waste', title: 'Collect the garbage', text: 'A landfill keeps the streets clean. Buildings can\u2019t grow past level 1 without collection.', cat: 'waste', tool: 'dump', done: (s) => s.facilities.length > 0 },
  { id: 'inspect', title: 'Ask a building what it needs', text: 'Pick Move and tap any building. The card shows what is holding it back.', cat: 'build', tool: null, done: (s) => s.inspected },
];
