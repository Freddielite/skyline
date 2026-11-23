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

## 0.6.1: real traffic, faster

- Traffic now comes from real trips: people to work and shops, lorries to the highway. Jams appear where your roads are too weak, and an avenue, a second route, buses or the metro actually relieve them
- Drivers take the quickest route and avoid jams; the cars you see gather on the busy roads
- Tap a road to see its trips against what it can carry
- Smoother on slow phones: about 40% less drawing work per frame in a big city

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

## 0.8.9: every building on its own lot

- The stadium is redrawn to fit its lot: it no longer spreads over the roads around it
- Palms, trees, treatment basins and a factory tank no longer hang over the next lot or the road
- Every building picture in the game was checked: none reaches outside its lot now

## 0.8.8: trees, lights and blinking fixes

- Street trees stand on the pavement instead of in the road
- Street trees, parked cars, benches, give-way signs and power lines no longer disappear around passing traffic
- Traffic lights stay put: a junction gets lights when both roads stay busy, and keeps them until it has been quiet for a while
- Traffic lights are kept when you save
- Want lights at a quiet junction? Tap it (no tool picked) and choose Lights in the Inspector

## 0.8.7: no more lag in busy views

- Pretty graphics stay smooth when a lot is happening: pictures no longer carry empty margins, so a busy city fits in the graphics chip's memory instead of being reloaded every frame
- Cars and people passing behind buildings no longer split a frame into hundreds of separate draws
- A busy, growing city redraws its still picture at most twice a second; moving the map and your own building still update at once
- Everything looks the same as before
- Fixed: cars, people and building sites could show through the buildings in front of them
- Fixed: tall buildings standing just below the bottom of the screen were missing

## 0.8.6: people, goods and the region

- Buildings in trouble now stand empty, boarded up and dark, before they shrink. Fix the problem and people move back in
- Tap a home to meet a family: where they work and what they wish the city had
- Rich and poor neighbourhoods: high land value brings well-off residents who pay more tax
- Factories make goods for shops. Shops that import their goods earn less
- New jobs chip in the top bar, and tapping the R C I bars explains why each zone is or isn't growing
- Children, adults and seniors: kids need schools, seniors need health care
- Mayor approval and an election every January. Lose it and taxes are capped at 9% for a year
- Service budgets: spend 50% to 150% on police, fire, health, schools, transit and parks
- Deals with neighbouring towns: sell spare power and water, or pay to send garbage away
- Factories can upgrade again (their own smoke used to hold them back)

## 0.8.5: cities keep growing

- Empty lots fill up and buildings upgrade again: people now move in before every job is ready, which brings customers and workers, which brings shops and factories
- Growth is about four times faster, so lots fill and buildings upgrade in months instead of years

## 0.8.4: still view fix

- Buildings no longer get painted on top of the buildings in front of them while cars drive past (the glitch from 0.8.3)
- Water changes with the light at the same moment as the land, instead of a moment later

## 0.8.3: cooler phone, same graphics

- When you're not moving the map, the city is drawn once and reused, and only the moving things (cars, people, ships, traffic lights, flags, building sites, smoke) are drawn each frame. About five times less drawing work in a big city, with every graphics setting still on
- Trees sway while you move the map and hold still when the view is still

- **0.8.9:** every building now stays on its own lot. The stadium is redrawn to fit its 3×3 lot (it spread over the roads around it), and palms, trees, treatment basins and a factory tank that hung over the edge of their lots are moved in. All 546 building pictures checked. New rule 6 for future art. Details in "Buildings on their lots" above.
- **0.8.8:** street trees stand on the pavement instead of in the road; street trees, parked cars, benches, give-way signs and power lines no longer blink out around traffic when the view is still; traffic lights no longer come and go when a junction's traffic hovers around the limit, and they're kept in the save. Details in "Street trees, lights and blinking objects" above.
- **0.8.7:** Pretty no longer lags when a lot is happening. Every picture is trimmed to what is actually drawn (about 70% of a building's picture was empty), so a busy view fits in the graphics chip's memory again instead of reloading about 60 MB of pictures every frame; the "redraw what stands in front of a car" step is clipped on the CPU so the whole frame stays a handful of draw calls instead of up to 200; and a busy city redraws its still layer at most twice a second. Looks the same. Also fixed: cars, people and building sites could show through buildings in front of them with the still view, and tall buildings just below the bottom edge of the screen were missing. Details in "Busy views on Pretty" above.
- **0.8.6:** people, goods and the region. Buildings in trouble stand empty (dark, boarded-up badge) before they shrink, and fill again once the problem is fixed. Families in the Inspector, rich and poor neighbourhoods, goods from factories to shops, an unemployment chip and plain reasons behind the R C I bars, ages (kids, adults, seniors), mayor approval with a January election, service budgets (50 to 150%), and deals with neighbouring towns (sell power and water, send garbage away). Factories no longer block their own upgrades with their smoke. Details in "People, goods and the region" above.
- **0.8.5:** growth no longer stalls. Homes wanted 0.85 jobs per resident while shops and industry only offered about 0.7 jobs per resident (0.3 + 0.4), so each zone waited on the others and the city froze with empty lots and no upgrades. Homes now want 0.6 jobs per resident (`rd` in `sim.recount`). The growth pass in `sim.tick` checks 600 random tiles a day instead of 150 (each tile about every 15 days instead of every 61), so lots fill and upgrade in months rather than years.
- **0.8.4:** fix for the still view (0.8.3). When a car, person or ship passed behind buildings, the buildings in front of it were redrawn whole, so they landed on top of buildings standing further forward (a house painted over the block in front of it, changing as traffic moved). The redraw is now limited to the moving thing's box (`gl2d.scissor` / `noScissor`), and the box takes in headlight beams at dusk and night. The water for the coming light is made in the 20 s before the light changes, so water and land switch together.
- **0.8.3:** much less work per frame with every graphics setting kept. When the view is still, the ground and everything that doesn't move are drawn once into a screen-sized picture on the graphics chip and reused every frame; only moving things are drawn live, each followed by whatever stands in front of it. In a dense test city the drawing work went from about 34 ms to 6 ms per frame, with the same picture. Waterfront reflections no longer scan the whole map every frame. Trees sway while the map moves and hold still when the view is still.

## 0.8.2: smooth change of light

- Buildings no longer disappear and pop back when day turns to dusk or night: the pictures for the coming light are made ahead of time, and any not ready yet keep their old look for a moment
- The change of light no longer switches the game to Smooth graphics by mistake

- **0.8.2:** buildings no longer vanish when the light changes (day, dusk, night). Each new-light picture is made a few per frame, and until a building's is ready the picture from the light before is shown (`otherLight` in `sprites.js`, for buildings, service buildings, parks and trees). About 24 game seconds before the light changes, the pictures in view for the coming light are made ahead (`game.nextLight`, `renderer.warm(..., ahead)`), so the change is usually instant. Auto graphics no longer judges the phone's speed for 10 s after a change of light, so the burst of new pictures can't switch it to Smooth.

## 0.8.1: looks and speed

- Spring: pink and white blossom and fresh green from March to May
- Farm fields change through the year: young green rows, ripe crops, stubble with hay bales, bare fields in winter
- Snow falls in winter instead of rain
- Morning mist over the water and fields at first light
- The light changes colour through the day: pink at dawn, golden in the late afternoon, blue at night
- Zebra crossings at junctions near shops, parks and public buildings
- Small waves roll onto the beaches
- No more cloud shadows
- Much faster when zoomed all the way out in a big city
- Traffic is worked out in the background, so the map never stutters for it
- On first launch the game tests the phone and picks Smooth on a slow one
- Saves battery when the game is paused and you're not touching it

- **0.8.1:** looks and speed. Spring (March to May) with pink and white blossom and fresh green; farms change through the year (young rows, ripe crops, stubble with bales, bare); snow falls in winter instead of rain (no thunder); morning mist over water and fields at first light; a colour wash for the time of day (pink dawn, golden late afternoon, blue night); zebra crossings at junctions near shops, parks and public buildings; waves rolling onto beaches; cloud shadows removed. Faster: far out, the whole city is one cached picture (draw work in a test city from about 48 ms to 1 to 2 ms per frame); traffic passes run in a background worker; a speed test on first launch picks Smooth on slow phones; paused and untouched for 10 s the game draws 10 times a second.

## 0.8.0: life and looks

- People hang out at parks, plazas, libraries, museums, the stadium, piers, beaches (some swimming), marinas and the cafe: more by day and in summer, fewer at night, in rain and in winter
- People walk the dirt tracks behind the houses, and now and then a car drives along one
- Tap a junction to choose it yourself: Automatic, Lights, or which road goes first
- Snow on roofs and frosted yards in winter
- Tall towers and office buildings now have many different tops: helipads, pyramid roofs, domes, slanted glass, twin masts, lantern crowns and water tanks
- All the moving people are off on Smooth graphics

- **0.8.0:** life and looks. People hang out at parks, plazas, libraries, museums, the stadium, piers, beaches (some swimming), marinas and pack places like the cafe, more by day and in summer, fewer at night and in rain; people and the odd car use the dirt tracks. Tap a junction to set it by hand: Automatic, Lights, or which road goes first (no roundabouts, by request). Snow on roofs and frosted yards in winter (winter pictures replace the others, so memory stays the same). Level 3 and 4 towers get eight different tops (helipad, pyramid roof, dome, slanted glass, twin masts, lantern crown, water tank), slimmer megatowers, a second stack on heavy plants and more solar on campuses.

## 0.7.4: dirt tracks

- Buildings that don't touch a road get a free dirt lane to the nearest street, along the edges of the lots; neighbours share one lane
- The lanes change with the seasons and turn muddy in the rain
- A building reached only by a dirt track grows to level 2. A road next to it lets it grow taller
- Tap a building: the Access line says whether it is on a road or a dirt track
- The Planning advisor shows where a new street would let the most buildings grow
- Buildings that were already taller keep their height

- **0.7.4:** dirt tracks. Houses, shops and factories that don't touch a road get a free dirt lane to the nearest street, along the lot edges (shared by neighbours, seasonal, muddy in rain). A building reached only by a track grows to level 2; a road next to it lets it grow taller. Track-only lots have a slightly longer commute, the Inspector shows Access, and the Planning advisor points at the biggest group of held-back buildings. Older buildings above level 2 keep their height.

## 0.7.3: garbage count and saves fixes

- The garbage "out" count on the top bar only counts buildings that really need collection (apartments, offices, factories and up, the ones with a bin badge). Houses don't need it yet
- Tap an amber "out" on the top bar to see those buildings in red on the map
- The Saves list on the start screen scrolls properly

- **0.7.3:** the garbage "out" count and the Waste view now only count buildings that need collection (level 2 and up, the ones that get a bin badge); level 1 houses take only leftover landfill room and no longer make garbage pollution. Tapping an amber "out" chip opens that view (power, water or waste) with the buildings in red. The start screen's Saves list scrolls (it was centred with `justify-content: center`, which cut off the top of a list taller than the screen).

## 0.7.2: junctions, road trips, utilities fix

- No shadows: buildings, trees, cars, people, boats and gulls no longer cast them
- Traffic lights only where two busy roads meet; elsewhere the side road gives way (white triangles and a sign) and waits for a gap
- The busier road gets the longer green
- Tap a road: what its trips are for, where most start and where most go; Show trips on map colours them blue and orange
- Advisors name the worst bottlenecks, with Show on map
- Cars and buses wait properly at red lights; jams no longer flicker on and off
- Fixed: buildings without power, water or garbage collection while the city had plenty. A building near two lines or pipes now uses the one that has power or water, and garbage goes to the nearest landfill with room. When supply still doesn't reach some buildings, the top chip shows how many and the advisors say why

- **0.7.2:** no shadows anywhere; smarter junctions (lights only where busy roads meet, give-way lines elsewhere, longer green for the busier road); tap a road to see where its trips come from and go to, with a map view; advisors name the worst bottlenecks with Show on map; cars and buses really wait at red lights; jams no longer flicker on and off. Fixed buildings going without power, water or garbage collection while the city had plenty: they now use the best line, pipe or landfill in reach, and the advisors and top chip say why when supply still doesn't reach them.

## 0.7.1

- **0.7.1:** saves, sandbox and bigger power. (1) Saves moved from localStorage (about 5 MB cap) to IndexedDB: three slots, three rolling auto-backups every 10 minutes, export to a file (share sheet) and import. The old single save moves into Slot 1 on first launch. A new city goes into a free slot instead of replacing your city. Start screen has Saves; in-game Menu has Saves, backups and export. (2) Sandbox mode (Menu, or chosen when starting a city): unlimited money, every building unlocked; turning it off restores your own budget. (3) Three bigger power stations for a growing city: Solar farm (3x3, 200, clean, unlocks 1,200 residents), Gas plant (3x3, 520, unlocks 1,500) and Nuclear plant (4x4, 2,400, unlocks 6,000), next to the coal plant's 150. New plugins @capacitor/filesystem and @capacitor/share (export), so run `npm install` before the push command.

## Adding content (0.7.0)

0.7.0 in short: 16 looks per zoned building, a five-track recorded soundtrack chosen by time of day, and content packs (below).

New buildings and pictures are files, not code. Everything lives in `public/content/` and is listed in `pack.json`.

**A new building** (ids 100 to 250 are free):

```json
{ "id": 101, "key": "bakery", "name": "Bakery", "label": "Bakery", "icon": "book", "cat": "fun",
  "w": 1, "d": 1, "cost": 500, "upkeep": 10, "radius": 6, "use": 1, "cov": [["fun", 0.5]],
  "height": 36, "unlock": 300, "sprite": { "file": "bakery.png", "scale": 2 } }
```

- `cat`: where it shows in the build menu: `util`, `svc`, `waste`, `transit` or `fun`.
- Effects are the same fields the built-in buildings use: `cov` (`police`, `fire`, `health`, `edu`, `fun`, `transit`, `metro`), `power`, `water`, `waste`, `radius`, `use`, `pollute`.
- `unlock`: residents needed. `height`: used for the construction animation.
- One day-lit PNG is enough: dusk and night are painted over it by the game.

**Picture anchor.** `scale` is picture pixels per game pixel (2 is normal). `ox`, `oy` (picture pixels) mark the back corner of the building's footprint diamond. Leave them out and the footprint is centred on the bottom edge. A 1x1 building fits a 320x220 picture at scale 2 (see `cafe.png`).

**More looks for houses, shops and factories**: `"looks": { "res.2": [ { "file": "house_a.png" }, ... ] }` (`res`, `com` or `ind`, then level 1 to 4). They appear as the second half of the 16 looks.

**Replace a drawn building**: `"replace": { "4": { "file": "police.png" } }` (the number is the building id in `buildings.js`).

**Templates.** `npm run bake` writes every drawn picture to `bake/` (PNG plus `index.json` with size and anchor). Draw over one, keep its size, and point the pack at it. A broken entry is skipped and logged; the game still starts.

**Music.** `npm run music` re-renders `public/audio/*.mp3` from `tools/make-music.py` (edit keys, tempos and chords there). Needs Python with numpy and scipy, and ffmpeg. You can also drop in your own tracks with the same five names.

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
