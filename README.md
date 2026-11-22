# Skyline

**Start with [CLAUDE.md](CLAUDE.md)**: the push command, troubleshooting, how to test features, and the full change history.

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

## 0.6.0: gameplay update

- Seasons matter: winter heating raises power demand and slows growth, spring speeds it up, summer brings tourists, autumn is harvest time for farms
- Tourism: beaches, marinas, piers, museums and stadiums draw visitors who need hotel beds (big shops) and bring income (City → Budget)
- Requests: residents and businesses ask for things with a deadline and a reward, or ask you to decide (City → Advisors)
- Avenues: widen busy roads to carry twice the traffic (Build → Avenue)
- Metro: two or more stations link distant neighbourhoods and stretch commutes (Transit → Metro, 2,000 residents)
- Industry types: farms in the countryside, sawmills by woods, tech parks in an educated university town

## 0.5.18: graphics polish

- Buildings stay sharp when you zoom right in
- Walls have brick, siding, panels or concrete; windows have frames and sills; houses have shingled roofs, flowerbeds and stepping stones
- Shadows follow the sun through the day and fall across streets and open ground
- Streets have trees along the pavement, cars parked outside shops and benches by parks
- Roads go dark and shiny in the rain and dry slowly afterwards
- After dark, windows light up one by one; people's legs move as they walk; grass and sand blend softly

## 0.5.17: drawing order fix

- Big buildings (landfill, hospital, stadium and other 2×2 and 3×3 buildings) no longer paint over a building standing in front of them
- Gulls now circle over landfills instead of being painted onto them

## 0.5.16: more detail, seasons and small life

- New buildings pick from 8 looks: solar panels, roof gardens, water tanks and air-conditioning units on flat roofs, balconies with washing, hedges, picket fences and cars in the drive, rooftop shop signs
- Seasons follow the calendar: autumn colours from September, bare trees and frost from December (Menu → Seasons → Always summer turns it off)
- Flags wave on the Police HQ, Fire HQ and University; gulls circle over harbors, piers and beaches

## 0.5.15: piers, beaches, marinas and ferries

- Fun → Pier: a wooden fishing pier with a bait shack, on any shore. Cheap, and raises land value a little nearby
- Fun → Beach (300 residents): umbrellas, towels, a lifeguard chair and swimmers, placed on sand by the water. Counts as an amenity
- Fun → Marina (1,000 residents): a clubhouse and pontoons full of moored boats on a lake or the sea; yachts sail out and back. A bigger amenity boost
- Transit → Ferry pier (600 residents, next to a road): build two on the same water and a ferry runs between them, stretching commute reach like buses
- Each one turns to face the water by itself, and says why when a spot doesn't work

## 0.5.14: cleaner interface, new landfill

- The top bar is now two small pills: money, residents, happiness and utilities on the left; clock, speed and demand on the right
- Power, water and garbage share one chip that only shows numbers when something runs short. Tap it (or the money) for the budget
- Build tools: a slim category rail on the left; tap a category to open its tools, pick one and the pop-out closes, leaving a chip like "Road $10 ✕". ✕ goes back to moving the map
- Views, City, Menu and Hide are compact buttons on the right; panels open beside them
- The landfill is redrawn: a fenced lot with terraced cells (grassed, capped, active with a compactor and gulls) and a gravel yard with an office

## 0.5.13: harbor ships

- Every harbor on a lake or the sea has ships coming and going, more as it grows (1 ship at levels 1–2, 2 at level 3, 3 at level 4)
- On water that reaches the map edge, container ships sail in from the sea, tie up at the quay and sail back out
- On inland lakes, a tug pushes a barge of sand, gravel or coal between the harbors, or across the lake and back
- Ships can't pass under bridges. A harbor cut off from the sea by a bridge gets barges instead; the Inspector ("Ships to the sea") and Advisors say so
- A harbor that reaches the sea ships goods out like the highway: its industry can grow without a highway link and pays full tax. A working sea port also raises industry demand a little
- Running lights on ships at dusk and night
- Next: pier, beach, marina and ferry pier (Water part 2, second half), then Graphics step 3 (see CLAUDE.md)

## 0.5.12: cooler phone

- Auto frame rate: 60 while you touch, drag or zoom, 30 when the view is still, 20 when paused, never above 60 on 90/120 Hz screens
- Menu → Graphics → Frame rate: Auto, 30 or 60 (also in Settings on the start screen)
- Pretty draws at 1.25x resolution on phones instead of 1.5x
- Next: Water part 2, then Graphics step 3 (see CLAUDE.md)

## 0.5.11: light and water

- Water moves with swells and small waves, glints twinkle on the crests, and the far water mirrors the sky (orange at sunset)
- Buildings and trees by the water are reflected in it, rippling
- At night: pools of light under street lamps, light spilling from lit buildings, headlight beams and tail lights
- At sunset: warm light raking across the city
- Smooth graphics keeps the moving water but skips reflections and beams

## 0.5.10: smoother panning, steadier sound

- Dragging the map no longer waits for new building pictures: they're made a little at a time, and ahead of time while the map is still
- Sound uses a bigger buffer and a lighter reverb, so it doesn't break up when the game is busy
- Test tools show how many stutters there were in the last 30 seconds and what caused the last one

## 0.5.9: drawing on the GPU

- The city is drawn with WebGL2 on the phone's graphics chip, in a few big batches, instead of the 2D canvas. Falls back to the 2D canvas if WebGL2 is missing
- Android treats Skyline as a game: game category (for the phone's game mode), hardware acceleration on, screen stays awake while playing
- Fixed a freeze at night when level 4 shops were lit

## 0.5.8: start screen

- The game opens on a start screen with your city drifting behind it: Continue (with population, date and money), New city and Settings
- New city: choose Coastline (sea along one edge), Lakeland (two or three lakes) or Countryside (fields and ponds). The map shows live behind the menu; Another map rolls a new one. Replacing a saved city asks first
- In the game, Menu → Main menu goes back to the start screen

## 0.5.7: pause in the background

- Leaving the app (home button, switching apps, screen off) now stops the music and sound and pauses the city. It saves on the way out and carries on when you come back

## 0.5.6: waterfront buildings

- Homes, shops and industry within 2 tiles of water grow waterfront designs instead of the inland ones, and the style depends on how big the water is:
  - Pond (4 to 15 water tiles): pond cottage, pondside houses, garden terraces, garden tower · tea house, garden café, country inn, boutique hotel · watermill, craft brewery, spring water plant, greenhouse campus
  - Lake (16 to 250 tiles): log cabin, lake chalets, lakeside apartments, lake-view tower · boathouse café, lakeside restaurant, lake lodge hotel, spa hotel · boatyard, barge wharf, lake freight terminal, electric boat works
  - Sea (251+ tiles, or water reaching the map edge): beach cottage, holiday apartments, glass-balcony condos, luxury tower · seafood shack, boardwalk cafés, beach hotel, resort tower · fishing wharf, cargo dock, container harbor, port terminal
- Waterfront land is worth more: +4 by a pond, +6 by a lake, +8 by the sea
- The Inspector shows "Waterfront (pond / lake / sea)" and the bonus
- Harbor ships, pier, beach, marina and ferry are planned next (see CLAUDE.md)

## 0.5.5: bridges, boats and moving vans

- Bridges: drag a road from the shore across water. $60 a tile, $2/month upkeep, straight with no junctions on the water, at most 12 tiles. Power lines and pipes can run along them
- Boats on every lake and pond, sized to it: ducks and rowboats on ponds, pedal boats, sailboats, fishing boats and motorboats on bigger water. More as the city grows. Wakes behind moving boats, running lights at night, and boats pass under bridges
- When residents leave, they drive to the highway in cars loaded with boxes and fade out at the map edge. New residents drive in the same way
- The plan for 0.5.6 (waterfront buildings, harbors, pier, beach, marina, ferry) is in CLAUDE.md

## 0.5.4: water and zoom-out

- Water is drawn as one continuous surface: the colour shades from turquoise at the shore to deep blue, with soft variation and ripples that drift across it, so it no longer looks like a grid of tiles
- Softer shoreline foam, and sand is one colour instead of a checkerboard
- Zoomed out, the ground (grass, sand, roads, empty lots) is drawn from one cached image; only tiles that change are redrawn into it
- Zoomed out, buildings, trees and cars are drawn from smaller copies of their pictures, which is faster and shimmers less
- Cars are drawn from cached pictures instead of six shapes each per frame
- After a change of day, dusk or night, the cached ground and water are rebuilt over several frames instead of all at once
- Smooth graphics draw one ripple layer instead of two

## 0.5.3: performance, part 2

- The batched city recalculation (power, water, coverage, commutes, land value) runs in four stages over four frames, so it no longer causes a visible stutter, and it is about 3x faster
- Night bloom removed: it was a live full-screen blur every frame at dusk and night
- Water ripples and shoreline foam are drawn from cached sprites instead of thousands of line strokes per frame; ripples are skipped when zoomed far out
- Trees only sway when zoomed in
- Pretty renders at up to 1.5x resolution (was 2x)
- Auto switches to Smooth when the game stays under about 33 fps (was 25)
- The interface refreshes twice a second (was four times)
- Test tools show fps, average and worst frame time

## 0.5.2: performance

- Menu > Graphics > Auto / Pretty / Smooth. Auto starts with full detail and switches to Smooth once if the frame rate stays low. Smooth renders at 1x resolution with no glow or haze
- Lens focus is now off by default (it is a live blur and costly on phone GPUs)
- The simulation batches its recalculations and only reroutes commutes when roads change or every 6 days

## Stage 5

Systems that now matter
- Happiness drives growth: above 60% homes grow faster and pay more tax, below 35% residents move away. City > Charts breaks down what drives it
- Traffic jams lower land value, add pollution, lengthen commutes and hurt happiness. Good bus coverage takes cars off the road
- Commutes: homes need jobs within reach by road, workplaces need workers nearby. Jammed roads count as longer trips, buses stretch the reach. New Commutes view
- Education: level 3 offices and industry need schools; level 4 needs a university. Healthy workers earn more tax
- Highway: a highway enters from the map edge. Nothing grows until your roads reach it, and industry sells its goods through it. Older saves get a highway routed to their roads

Debt instead of game over
- A negative balance is owed to the regional bank (2% interest a month). Services close in stages: amenities and ordinances first, then schools and buses, then police, fire and health care. Closed buildings cost basic maintenance only and reopen when the balance is positive
- Bank tab: loans of $10k, $25k and $60k repaid monthly, early repayment saves 10%

Understanding the city
- With no tool picked, tap any tile: the card shows what the building needs and what is holding it back
- Advisors tab with "Show on map", a news ticker, monthly charts, and an 8-step guide for new cities
- Buildings unlock as the city grows. Level 4 buildings: skyscrapers, office megatowers and hi-tech campuses. New goals up to 25,000 residents

Graphics and sound
- Natural grass variation, water that deepens away from the shore, textured asphalt with tire wear, soft blurred shadows and contact shadows, reflective windows with blinds and curtains, shaded trees, aerial haze and color grading, optional lens-focus (tilt-shift) in Menu > Graphics
- Synthesized ambience (city hum, birds, crickets, rain), sound effects and generative music. Menu > Sound

## Stage 4

- Bigger map: 96x96 (was 64x64). Saves from older versions are placed in the middle of the new map
- Traffic lights at every junction (3+ roads). Cars, buses, trucks and commuters stop at the stop line on red and queue behind each other
- Bus stops and a bus terminal (Transit tab; stops and terminals must sit next to a road). Each powered terminal runs buses in a loop through every stop it can reach. Citizens without a car wait at a stop, ride, and walk on. Stops and terminals raise land value and happiness
- Congestion follows the day: rush hours, lunchtime shopping, evening outings and stadium or museum crowds. New Traffic and Transit map views
- Animated smoke and steam (factories, plants, waste-to-energy, landfill) drifting with the wind, plus evening chimney smoke from houses
- Graphics pass: trees sway in the wind, animated waves and sparkles on water, cloud shadows, bird flocks, boats on lakes, neon glow on shops at night, vignette, rain with lightning (Menu > Weather: Auto / Clear / Rain), waiting passengers and flashing emergency lights
- Level-of-detail: tiny details (people, poles, manholes, signals) are skipped when zoomed far out

## Stage 3.2

- Undo button (right-hand column, Ctrl+Z on desktop): appears for 20 seconds after you build and reverts that action (stacking up to 40 recent steps), refunding the cost. It disappears once the window passes. It restores whole buildings (even multi-tile ones), cancels construction sites, and brings back what you bulldozed

## Stage 3.1

- Water now flows through underground pipes (Power & water tab > Pipe, drag a line, $6/tile). Pipes can run under roads, parks and buildings. Selecting Pipe switches to the water view
- Water sources must touch a pipe, and buildings get water from pipes within 2 tiles, like power lines. A disconnected source supplies nothing
- Three water sources: Water tower (small, 140), Pumping station (2x2, 520, needs power), Water treatment plant (3x3, 1,500, needs power). Underpowered plants run at 30%
- Manhole covers hint at buried pipes in the normal view; the water view shows live pipes in blue and dead ones in gray
- Older saves have no pipes: connect your towers to the buildings with pipes (you get 90 days before buildings without water start losing upgrades)

## Stage 3

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
    src/game/waterfront.js waterfront building art: pond, lake and sea styles
    src/game/gl2d.js     WebGL2 drawing engine used by the renderer
    src/game/renderer.js isometric draw loop, water, cars
    src/game/game.js     input, camera, loop, save/load
    src/game/rules.js    ordinances, goals, unlocks, loans, guide steps
    src/game/audio.js    synthesized ambience, effects and music
    src/App.jsx          HUD, toolbar, budget and menu panels
