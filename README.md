# Skyline

Isometric city builder for Android. React + Vite + canvas, packaged with Capacitor.

## Run in the browser

    npm install
    npm run dev

## Build the Android APK

    npm install
    npm run build
    npx cap add android      # first time only
    npm run android:sync     # build + copy web assets into the Android project
    npm run android:open     # opens Android Studio -> Build > Build APK(s)

`npm run android:sync` also locks the app to landscape (`scripts/landscape.mjs` patches `AndroidManifest.xml`)
and makes it fullscreen (`scripts/fullscreen.mjs` patches `MainActivity.java`: hides the status and navigation
bars, swipe from an edge to peek them, and draws behind the camera cutout). Both are safe to re-run.

## Controls

- Move tool: drag to pan. Two fingers (or mouse wheel) to zoom.
- Road: drag in a straight line. Homes/Shops/Industry/Park/Clear: drag a rectangle.
- Power line / Cable: drag a straight line. Selecting them switches to the power view
- Utilities and services: tap a tile to place (the preview shows the footprint); drag to reposition before lifting.
- With a build tool active, one finger paints and two fingers move the map.

## Stage 3 (this build)

- Economy rebalanced: small towns now turn a profit, a regional grant tapers off as the city grows
- Ordinances (City > Rules): neighborhood watch, recycling, energy saver, water conservation, smokestack scrubbers, tourism campaign, fireproofing. Each has a monthly cost
- Goals (City > Goals): 15 milestones with cash rewards, from 100 residents to a 10,000-resident metropolis
- Disasters (Menu > Disasters: Off / Rare / Normal / Chaos, plus Start buttons): fires spread between buildings, fire stations cut the damage and send trucks; tornadoes cut a path across the map; UFOs zap buildings. Destroyed buildings leave rubble
- Alert chips next to the top bar while a disaster is active

## Stage 2.7

- New buildings, upgrades and services only count (population, jobs, power, taxes, coverage) once their construction animation finishes. Upgrades keep counting at the old level until done; bulldozing a site cancels it
- Fullscreen on Android (immersive mode, camera-cutout aware) and a fullscreen toggle in the Menu for browsers

## Stage 2.6

- Citizens have homes, jobs and routines: they leave for work in the morning, work through the day, go shopping or to parks and plazas in the evening, and return home at night. Short trips are on foot along the sidewalks, long ones by car
- Every building has its own construction process: wooden frames with a cement mixer for houses, tower cranes and glass panels for shops and offices, welding and diggers for industry, mobile cranes for services, turbines assembled last, earthworks for parks and landfills. Upgrades build over the old building
- In-game clock in the top bar, and a one-tap Hide button to clear all interface (floating eye button brings it back)

## Landscape layout

- The game is landscape-first: tool rail on the left (category icons + 2-column tool grid), Views / Budget / Menu on the right, compact HUD across the top
- Portrait still works as a fallback in the browser
- The Android build is locked to sensor-landscape

## Stage 2.5

- Power now travels over wires you place: overhead lines (cheap, open ground and roads only) and underground cable (costs more, can run under buildings). Buildings within 2 tiles of a live line get power; generators must touch a line
- Bigger services: Police HQ, Fire HQ, Hospital, University (wider radius, stronger effect)
- Amenities: plaza, library, museum, stadium (happiness, land value, stadiums boost shops)
- Waste: landfill, recycling center, waste-to-energy (also generates power). Garbage trucks run from the facilities. Uncollected waste pollutes and blocks tier 3 growth
- New map views: waste, amenities; power view shows lines and cables

## Stage 2

- Power: coal plant (2x2) and wind turbines. Power travels along connected roads; buildings need it to grow
- Water: water towers serve a radius, up to their capacity
- Services: police, fire, clinic, school. Coverage lifts land value and happiness, crime drops with police
- Pollution from industry and coal, crime, land value maps
- Map views: land value, crime, pollution, power, water, and the four service coverages
- Red bolt / blue drop badges mark buildings without power or water
- Brownouts when demand exceeds supply, service upkeep in the monthly budget

## Stage 1

- 64x64 procedural terrain (water, sand, trees)
- Roads with auto-joining junctions and crosswalks
- Residential, commercial, industrial zoning with 3 building tiers each
- RCI demand, land value (parks help, industry hurts homes), taxes, monthly budget
- Parks, bulldoze, ambient traffic, day/dusk/night cycle with lit windows and bloom
- Autosave to local storage every 20 seconds

## Layout

    src/game/world.js    terrain + tile data
    src/game/buildings.js utility and service definitions
    src/game/sim.js      economy, demand, growth
    src/game/sprites.js  procedural sprite art (cached per lighting mode)
    src/game/renderer.js isometric draw loop, water, cars, bloom
    src/game/game.js     input, camera, loop, save/load
    src/App.jsx          HUD, toolbar, budget and menu panels
