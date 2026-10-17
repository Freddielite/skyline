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

Optional: lock to landscape by adding `android:screenOrientation="sensorLandscape"`
to the `<activity>` tag in `android/app/src/main/AndroidManifest.xml`.

## Controls

- Move tool: drag to pan. Two fingers (or mouse wheel) to zoom.
- Road: drag in a straight line. Homes/Shops/Industry/Park/Clear: drag a rectangle.
- Power line / Cable: drag a straight line. Selecting them switches to the power view
- Utilities and services: tap a tile to place (the preview shows the footprint); drag to reposition before lifting.
- With a build tool active, one finger paints and two fingers move the map.

## Stage 2.5 (this build)

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
