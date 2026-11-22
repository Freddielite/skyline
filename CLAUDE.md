# Skyline: project notes

Isometric city builder for Android. React + Vite + canvas, packaged with Capacitor.
Project folder on Freddie's machine: `/home/freddielite/Downloads/skyline`
App ID: `com.wyntek.skyline` · Current version: **0.6.1**

This file is the handover: what has been built, how to push it to the phone, and the rules for future changes.
Anyone (person or AI assistant) working on this project should read it first.

---

## Rules for every change

1. **Always end with the push command.** Every fix or feature, however small, ends with the full push command below, written out exactly, so it can be copied and run without looking anything up.
2. **Always bump the version** in `package.json` (0.6.1 → 0.6.2 and so on). The game shows "Updated to version X" on first launch and the version in Menu, which is how we confirm the phone really got the new build.
3. **Deliver the whole project as `skyline.zip`**, with the files at the top level of the zip (no `skyline/` folder inside), and without `node_modules/`, `dist/` or `android/`.
4. **Add a short entry to the change history** at the bottom of this file and to `README.md`.
5. **Check performance on a slow phone.** The test phone is an Infinix HOT. Do heavy work once and cache it in sprites. The main view is drawn on the GPU (see "Drawing engine" below): `ctx.filter` (blur) does nothing there, and additive glow (`'lighter'`) is free.
6. **Changing a cached picture after it has been drawn?** Call `touched(canvas)` (or `touched(canvas, x0, y0, x1, y1)` for a part) from `gl2d.js`, or the GPU keeps showing the old one.

---

## The push command

First delete the old `skyline.zip` from Downloads, so the browser doesn't save the new one as `skyline (1).zip`. Then download the new zip and run:

```bash
cd ~/Downloads/skyline
unzip -o ~/Downloads/skyline.zip -d ~/Downloads/skyline
npm run android:sync && (cd android && ./gradlew assembleDebug) && adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Then close the game fully on the phone (swipe it away from recent apps) and open it again. It should say **"Updated to version X"**.

### What each part does

- `unzip ... -d ~/Downloads/skyline` puts the new files into the project folder. The `-d` must point at the **skyline folder**, not at Downloads.
- `npm run android:sync` builds the web game and copies it into the Android project.
- `./gradlew assembleDebug` builds the APK. Look for **BUILD SUCCESSFUL**.
- `adb install -r` installs it on the phone over USB. Look for **Success**.

The `&&` means each step only runs if the one before succeeded. If one fails, the rest is skipped and the phone keeps the old version. That's easy to miss in a long build log.

---

## Troubleshooting

**Check which version is on the phone:** Menu → the line at the bottom says `Skyline 0.6.1 · built (date) UTC`.

**Check the project folder has the new code:**
```bash
cd ~/Downloads/skyline
grep '"version"' package.json
```

**Check the zip is the new one** (it should list `src/game/audio.js`, with no `skyline/` in front):
```bash
unzip -l ~/Downloads/skyline.zip | grep -E "audio.js|package.json"
```

**Is the phone connected?** It should be listed as `device`. If it says `unauthorized`, accept the "Allow USB debugging?" prompt on the phone.
```bash
adb devices
```

**`zsh: no such file or directory: /platform-tools/adb`**: `$ANDROID_HOME` is not set. Use plain `adb` (it lives at `/usr/bin/adb`), which the push command above already does. The SDK copy is at `~/Android/Sdk/platform-tools/adb`. Stick to one of them, since mixing the two causes "adb server version doesn't match" errors.

**`INSTALL_FAILED_UPDATE_INCOMPATIBLE`**: the app on the phone was signed differently. Uninstall it first (this deletes the saved city on the phone), then install again:
```bash
adb uninstall com.wyntek.skyline
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**Install says Success but nothing changed**: close the app fully and reopen it.

**Game is laggy**: Menu → Graphics → **Smooth**. Leave Lens focus off. To measure it, open the test tools (tap the version line 5 times): the Frames line shows fps, average and worst frame time over the last 2 seconds.

---

## How to test the features

**Hidden test tools:** in the game, Menu → tap the version line **5 times**. Buttons appear: +$50,000, Go into debt, Clear debt, Unlock all, End month.

| Feature | How to test |
|---|---|
| Start screen | Open the game: the start screen shows with your city drifting behind it. Continue shows population, date and money. New city → pick Coastline, Lakeland or Countryside: the map behind changes to show it; Another map rolls a new one. With a saved city, Start building asks once more (Replace city). Back returns to your saved city unchanged. In the game, Menu → Main menu goes back to the start screen. |
| Guide | Start screen (or Menu) → New city → Start building. An 8-step card appears and the camera starts at the highway. |
| Highway | Zone homes on a road that doesn't reach the highway, then tap a lot: "Its roads don't reach the highway". Connect it and building starts. |
| Inspector | With no tool picked (tap ✕ on the tool chip), tap any building. Tap again to close. |
| Debt | Test tools → Go into debt. The money turns red with "owed", lock badges appear on closed buildings, City → Bank explains it. Clear debt reopens everything. |
| Loans | City → Bank → borrow. End month, then check payments in Budget. |
| Unlocks, level 4 | Locked tools show a padlock. Test tools → Unlock all. Level 4 needs a university, schools, health care and land value 78+. |
| Commutes | Put homes far from shops and industry. Views → Commutes: red means no jobs in reach. Bus stops stretch the reach. |
| Traffic | A big city on one road. Views → Traffic goes red and Advisors warns. |
| Happiness | City → Charts shows what raises and lowers it. Set taxes to 20% and watch it fall. |
| Advisors, news | City → Advisors. A red dot on the City button means something is urgent. Headlines appear at the bottom each month. |
| Charts | Test tools → End month a few times, then City → Charts. |
| Sound | Tap the map once (phones need a tap before audio plays). Menu → Sound. |
| Graphics | Menu → Graphics: Auto / Pretty / Smooth, Lens focus. Menu → Time of day to see dusk and night. |
| Map edges | Drag to every edge and corner; each can be brought to the middle of the screen. |
| Bridges | Pick Road and drag from a road on the shore across water. The preview counts $60 per water tile. Try a junction on the water, a side road onto the bridge, or more than 12 tiles: each is refused with a message. With no tool picked, tap a bridge: "Bridge, upkeep $2/month". Bulldoze removes it, with any lines or pipes on it. |
| Boats | Every lake and pond has something on it: ducks and rowboats on ponds, pedal boats on small lakes, sailboats and fishing boats on lakes, motorboats on big water. More appear as the population grows (checked every 3 seconds). Boats pass under bridges. Running lights at night. |
| Light and water | Graphics → Pretty. Find buildings by a lake or the sea: by day they reflect in the water, which waves and glints. Menu → Time of day → Dusk: orange glints, warm sky on far water, warm light from the upper right. Night: lamps light pools on the roads, lit buildings spill light, cars have headlight beams and red tail lights. Smooth: no reflections or beams, water still moves. |
| Frame rate | Menu → Graphics → Frame rate. With Auto, test tools say "Aiming for 30 fps" while you look, 60 while you drag, 20 when paused. The phone should stay cooler than before. 30 is coolest, 60 smoothest. |
| Stutters | Test tools: drag the map around for 30 seconds, then read the Stutters line and its "Last one" details. Send these to whoever works on performance. |
| GPU drawing | Menu → tap the version line 5 times: it says "Drawing with: GPU (WebGL2)". Look at the Frames line, then tap "Switch to old 2D canvas" and compare in the same place. Switch back afterwards. |
| Leaving the app | Tap the map so sound plays, then press Home or switch apps. The sound stops at once. Come back: the clock and the city carried on from where they were, nothing happened while you were away. |
| Harbor ships | Test tools → +$50,000 and Unlock all. Zone industry along the sea (Coastline map) and along an inland lake (Lakeland), connect them to the highway and let them grow. Sea harbors: container ships sail in from the map edge, tie up at the quay, then sail out (each round trip takes a few minutes). Lake harbors: a tug pushes a barge between harbors, or across the lake and back. With no tool picked, tap a harbor: "Ships to the sea" says Yes, or "inland water". Build a bridge that cuts a harbor off from the sea: the row says a bridge blocks the way, City → Advisors warns, and its ships switch to barges. Night: running lights. |
| Interface | Top left: money, residents, happiness and a utilities chip (mint icons when power, water and garbage are fine; a shortage shows its numbers in amber or red). Tap money or the chip for City → Budget. Top right: clock and date, speed, R/C/I demand. Left rail: tap a category to open its tools, tap it again or ✕ or the map to close. Picking a tool closes the pop-out and shows a chip ("Road $10 ✕"); tap the chip to change tool, ✕ to stop building. Undo appears under the chip. Right column: Views, City, Menu, Hide. Panels and the Inspector open next to the right column. |
| Landfill | Waste → Landfill. It fills its 2×2 lot: grassed cell, soil-capped cell, active cell with a compactor and gulls, gravel yard with office and skips, fence along the front. |
| Shore buildings | Test tools → +$50,000 and Unlock all. Fun → Pier on any shore with 2 rows of open water in front; Fun → Beach (2×2) on sand by the water; Fun → Marina (2×2) by a lake or the sea with 3 rows of open water; Transit → Ferry pier next to a road, by a lake or the sea. Each faces the water by itself and reaches out over it. A bad spot gives a message saying why. Build a second ferry pier on the same water: a ferry runs between them, the Inspector says "Ferry route: Yes", and Views → Transit shows coverage around both (a lone ferry pier serves nothing, and Advisors say so). Yachts sail out from the marina and back. Bridges can't be built over a pier, beach or marina's water, and ships steer around them. |
| Building detail | Zone a neighbourhood and let it grow (new buildings pick from 8 looks). Zoom in: some flat roofs have solar panels, a roof garden, a water tank with air-conditioning units, or a plant room with vents; some apartments have balconies with washing; some houses have a hedge, picket fence and a car in the drive; some shops have a rooftop sign and bins. Older cities keep their buildings until they grow again. |
| Seasons | Menu → Seasons → Follow the calendar. Test tools → End month until September: trees turn orange, red and yellow, grass goes golden. December: bare trees with snow on the branches, frosted grass, snow on pine branches, chimney smoke all day. March: green again. Always summer turns it off. |
| Small life | Police HQ, Fire HQ and University flags wave (still on Smooth). Gulls circle over harbors, piers and beaches (not on Smooth). |
| Graphics 0.5.18 | Zoom all the way in on Pretty: buildings stay sharp (close-zoom copies). Walls show siding, brick, panels or concrete; windows have frames and sills; house roofs have shingles, lots have flowerbeds and stepping stones. Through the day (Menu → Time of day, or watch Auto) shadows swing from down-right in the morning, short at noon, to long down-left at sunset, across roads and open ground. Streets: trees along the pavement by homes, cars parked by shops and industry, benches and bins by parks. Rain: roads go dark and shiny and dry slowly. After dark windows light up one by one, and some go out late at night. People's legs swing as they walk. Where grass meets sand the edge is soft. |
| Seasons (gameplay) | Menu → Seasons → Follow the calendar. City → Budget shows the season. Test tools → End month into December: power demand jumps about a quarter (heating), City → Charts shows a Winter line in happiness, growth slows. Spring speeds growth up, summer brings more tourists and a small happiness boost. Autumn: farms pay half as much tax again (harvest). Always summer turns all of it off. |
| Tourism | Build a beach, marina, pier, museum or stadium (Test tools → Unlock all). City → Budget: Tourists last month · hotel beds, and Tourism income. Grow shops to level 3 (or waterfront shops to level 2) for more beds; Advisors say when visitors can't find rooms. Summer ×1.6, winter ×0.5. |
| Requests | With 60+ residents a request arrives every few months: a toast, a chip on the left and a card at the top of City → Advisors with the deadline, progress and reward. Goals (health care, parks, buses, clean air, jobs, lower taxes, tourists) pay money and happiness when met, cost happiness when missed. Choices (factory expansion, summer festival, snow) have two buttons; the City button shows a dot while one waits. |
| Avenues | Build → Avenue: drag over an existing road to widen it ($15 a tile) or build new ($25). A planted median and two lanes each way; it carries twice the traffic before jamming. Upkeep $1/month. Not on bridges. |
| Metro | Transit → Metro (2,000 residents, next to a road, needs power). One station does nothing; with two or more, every station covers 14 tiles: commutes reach 22 tiles further, fewer cars on the road, happier residents. Views → Metro. |
| Industry types | Zone industry out in the countryside, away from homes and shops: farms. Next to woods: sawmills. In a town with a university and good schools nearby: tech parks. The Inspector shows the type. Farms: 60% of the jobs, a quarter of the pollution. Forestry: 80% jobs, 60% pollution. Tech: 125% jobs, 20% pollution, 1.4× tax, but needs an educated city. |
| Traffic from real trips | Build a town on one long street with homes at one end and jobs at the other: Views → Traffic goes red on the street, Advisors warn, and Move → tap the road says e.g. "Jammed: 249 of 55 trips". Widen it to an avenue or add a parallel road: within a few seconds the load drops and cars move over. Cars on screen gather on the busy roads. |
| Moving vans | Set taxes to 20% so people leave: cars with boxes on the roof drive from the homes to the highway and fade out at the map edge. When homes grow, vans drive in from the highway. Homes not linked to the highway send no vans. |

---

## What was built (version 0.5 series)

### Systems that now actually affect the game
- **Happiness** drives growth. Above 60%, homes grow faster and taxes come in more reliably. Below 35%, residents move away. Happy residents pay more tax (0.8× to 1.2×).
- **Traffic** jams lower land value, add pollution, make commutes longer and lower happiness. Good bus coverage takes cars off the road.
- **Commutes:** homes need jobs within reach by road (18 road tiles, plus up to 12 more with bus coverage), and workplaces need workers nearby. Jammed roads count as longer trips. New Commutes map view.
- **Education:** level 3 offices and industry need schools; level 4 needs a university. **Health:** healthy workers pay more tax.
- **Highway:** enters from the map edge. Nothing grows until your roads connect to it. Industry needs it to sell goods (half tax without it). Older saves get a highway routed to their existing roads automatically.

### Debt instead of game over
- A negative balance is money owed to the regional bank, at 2% interest a month. There is no game over.
- Services close in stages as the debt deepens. Below $0: ordinances paused and amenities closed. Deeper: schools and buses close. Deepest: police, fire and health care close. The stage limit scales with city income (at least $4,000).
- Closed buildings cost only 20% upkeep and show a lock badge. Closed fire stations send no trucks, and closed terminals run no buses.
- Nothing new can be built while in debt, but bulldozing still works, so you can cut costs.
- Bank tab: loans of $10k (12 months), $25k (24 months) and $60k (36 months), up to 3 at a time. Paying early saves 10%.

### Understanding the city
- **Inspector:** with no tool picked, tap any tile to see what the building needs and the exact reason it isn't growing.
- **Advisors** tab with plain-language problems and a "Show on map" button. A **news ticker** shows monthly headlines.
- **Charts:** population, treasury, income vs costs, happiness, plus a happiness breakdown.
- **8-step guide** for new cities.

### Progression
- **Unlocks by population:** 300 (plaza, library, bus terminal), 600 (pumping station, police and fire HQ, recycling), 1,000 (hospital, museum), 1,500 (university, waste-to-energy, water treatment), 2,500 (stadium, skyscrapers).
- **Level 4 buildings:** skyscraper (160 residents), office megatower (95 jobs), hi-tech campus (70 jobs, low pollution).
- **New goals:** connect to the highway, Campus town, Reach for the sky, Clean books, Skyline (25,000 residents).

### Graphics and sound
- Natural grass variation, water that deepens away from the shore, textured asphalt with tire wear and curbs, soft shadows, reflective windows with blinds and curtains (and varied lighting at night), shaded trees, a highway sign at the map edge, aerial haze.
- Graphics quality: Auto / Pretty / Smooth, plus optional Lens focus (tilt-shift).
- Fully synthesized sound, with no audio files: city hum, birds by day, crickets at night, rain, effects for every action, and generative music. Menu → Sound.

### Fixes
- Camera can now reach every edge and corner of the 96×96 map (the old limit was left over from the 64×64 map).
- Version line in Menu and an "Updated to version X" message on first launch.
- Hidden test tools in Menu.

---

## Drawing engine (built in 0.5.9)

The main view is drawn with **WebGL2 on the graphics chip** (`src/game/gl2d.js`). It offers the renderer the same calls as the 2D canvas it was written for (paths, fill, stroke, drawImage, gradients, patterns, one clip, text, save/restore, transforms, `'lighter'`), so `renderer.js`, `construction.js` and `smoke.js` draw exactly as before.
- Every cached picture is packed into up to 5 texture pages of 2048×2048 the first time it's drawn; the least recently used page is wiped and refilled when they're full. Big or changing pictures (ground cache, sea, ripple pattern) get their own texture, with mipmaps for smooth zoom-out.
- A frame goes to the GPU in a handful of draw calls. Additive glow is done in the same batch (zero-alpha trick in the shader).
- If WebGL2 isn't available, it falls back to the old 2D canvas automatically.
- Test tools show "Drawing with: GPU (WebGL2)" or "Canvas 2D", with a button to switch engines (it reloads the game) to compare speed on the phone.
- Pictures drawn *into* cached canvases (sprites, ground cache) still use the normal 2D canvas; that work is done once.
- `scripts/game.mjs` (run by `npm run android:sync`) marks the Android app as a game (`appCategory="game"`, `isGame`), switches hardware acceleration on explicitly, keeps the screen awake while playing, and the WebGL context asks for the high-performance GPU mode.
- The game loop schedules the next frame before drawing, so an error in one frame can no longer freeze the game.
- **Smooth panning (0.5.10):** making a building, tree, park or service picture for the first time costs a few ms on the Infinix. `spriteBudget` in `sprites.js` limits that to 3 ms per frame while the map moves (14 ms when still); a picture that doesn't fit appears a frame or two later instead of stalling the frame. While the map is still, `renderer.warm()` makes and uploads the pictures around the view in advance. Hot drawing calls in `gl2d.js` make no garbage, so the garbage collector pauses less.
- **Sound under load (0.5.10):** the AudioContext asks for `latencyHint: 'playback'` (bigger buffer), the reverb is shorter, and music is scheduled 1.2 s ahead, so busy frames don't break up the sound.
- **Stutter readout:** test tools show how many frames took over 50 ms in the last 30 seconds, and for the last one: update and drawing time, new pictures, GPU uploads, page refills.

## Heat and battery (built in 0.5.12)

Freddie noticed the phone getting hot. Causes found: the game drew a full frame 60 times a second all the time (and as fast as the screen allows on 90/120 Hz phones), even on the start screen and with nothing moving; Pretty drew at 1.5x resolution on a phone screen; and the per-frame processor work (cars, people, simulation, live music).
- **Frame pacing** (`Game.targetFps`, in the loop): Menu → Graphics → Frame rate: **Auto** (default) draws 60 times a second while you touch, drag or zoom and for 1.5 s after, 30 when the view is still, 20 when the game is paused, 30 on the start screen; tornado/UFO keep 60. **30** and **60** fix the rate. Never more than 60, even on 90/120 Hz screens. Skipped frames cost nothing. Auto quality judges speed as if aiming for 60, so a capped 30 isn't mistaken for a slow phone.
- **Resolution:** Pretty draws at 1.25x on phones (shorter screen side under 500 px), 1.5x on tablets; Smooth 1x.
- Test tools show "Aiming for N fps" next to the measured frame rate.
- Tip for testing: charging over USB while playing adds its own heat.

## Light and water (built in 0.5.11, graphics step 2)

All of this needs the GPU engine; the 2D fallback looks as before. Smooth graphics keeps the water shader but drops reflections, light spill and headlight beams.
- **Water shader** (`FS` in `gl2d.js`, flag +16): slow swells and small waves, glints that twinkle on the crests (white by day, orange at sunset, faint blue by moonlight), and the far water (top of the screen) mirrors the sky colour. Colours per time of day are `SUN` and `SKY` in `renderer.js`; the old ripple pattern is only used by the 2D fallback.
- **Reflections** (`renderer.reflections`, `ctx.drawMirror`, flag +32): buildings, trees and parks within 2 tiles of water are drawn upside down onto the water, tinted, fading out, and rippled by the shader. They are drawn after the water and before the land, so land tiles hide whatever doesn't fall on water. Lit windows reflect at night.
- **Night**: warm pools of light under street lamps (`poolSprite`), light spilling from lit buildings onto the ground, and headlight beams with tail lights on cars, buses and trucks (`headlights`, `beamSprite`). Headlights also come on at dusk, dimmer.
- **Sunset**: warm light raking across the city from the upper right (in `grade`), plus the orange glints and sky on the water.

## Start screen (built in 0.5.8)

Agreed with Freddie on 22 Nov 2026. The game opens on a start screen instead of straight into the city.
- Behind it the saved city drifts by (or, with no save, the shore nearest the middle of the map). The city clock and simulation stand still; cars, people and boats keep moving (`Game.menu`, `menuCamera`).
- **Continue** (only with a save) shows population, date and money. **New city** offers three map kinds: Coastline (`coast`: sea along one edge, a few ponds), Lakeland (`lake`: two or three lakes kept under 251 tiles so they stay lakes, a few ponds) and Countryside (`country`: ponds and a small lake or two). The chosen map is previewed live, zoomed out, behind the menu; nothing is saved until Start building (`previewMap`, `cancelPreview`, `startNewCity`). With a save, Start building asks once more before replacing it.
- **Settings**: effects, music, volume and graphics. The version is in the corner.
- In the game, Menu → **Main menu** returns to the start screen and Menu → **New city** opens the map choice.
- Old saves and the first map of a fresh install use the original island map (`classic`). The map kind is saved as `world.map`.
- Tapping anything on the start screen turns on the sound; in the Android app it usually starts without a tap.

## Waterfront buildings (built in 0.5.6)

Agreed with Freddie on 22 Nov 2026: buildings near water should look different depending on **how big the water is**, not one seaside look for everything. Three styles, using the same size groups as the boats:

| Style | Water body | Homes L1–L4 | Shops L1–L4 | Industry L1–L4 | Land value |
|---|---|---|---|---|---|
| Pond | 4 to 15 water tiles | pond cottage, pondside houses, garden terraces, garden tower | tea house, garden café, country inn, boutique hotel | watermill, craft brewery, spring water plant, greenhouse campus | +4 |
| Lake | 16 to 250 tiles | log cabin, lake chalets, lakeside apartments, lake-view tower | boathouse café, lakeside restaurant, lake lodge hotel, spa hotel | boatyard, barge wharf, lake freight terminal, electric boat works | +6 |
| Sea | 251+ tiles, or touching the map edge | beach cottage on stilts, holiday apartments, glass-balcony condos, luxury tower with rooftop pool | seafood shack or ice-cream kiosk, boardwalk cafés, beach hotel, resort tower | fishing wharf, cargo dock, container harbor, port terminal | +8 |

- A lot counts as waterfront when it is within 2 tiles of water (sand included). If it is near two bodies of water, the bigger one decides. Puddles under 4 tiles don't count.
- `world.shore` (derived in `world.deriveShore()`, not saved) holds 0 inland, 1 pond, 2 lake, 3 sea. The renderer passes it to `buildingSprite(..., shore)`; art and names are in `waterfront.js`.
- Only harbors on lake and sea look like ports. A pond never gets a harbor; its industry is a mill, brewery, bottling plant or greenhouses.
- The Inspector shows "Waterfront (lake)" etc. under the title and a Waterfront row with the bonus.
- Pollution is unchanged: industry on the water still pollutes nearby homes.
- **How to test:** zone homes, shops and industry along a pond, a lake and the sea and let them grow (Test tools → +$50,000 and Unlock all help). Each shore should grow its own style. Move → tap one: the title is the waterfront name.

## Harbor ships (built in 0.5.13, Water part 2, first half)

- `src/game/ships.js` (`Ships`, made in `game.initWorldLife`, updated every frame with the sim). Every 3 s `scan()` finds harbors: industry lots by a lake or the sea (`shore >= 2`) with a level. Each gets a berth: the nearest open-water tile within 2 tiles, on water of 16+ tiles or reaching the edge.
- **Open water** is water without a bridge on it (`nav`), split into connected parts; a part touching the map edge is the sea. Ships never pass bridges.
- **Sea harbors** get `cargo` ships (1/1/2/3 by level): they spawn off the nearer third of the sea's edge, sail to the berth, lie along the quay 25–50 s, sail back to the edge and fade. **Inland harbors** (and sea harbors cut off by a bridge) get `barge`s (1/1/1/2) that shuttle to the other harbors on that water in turn, or to the farthest open water when there is only one. At most 14 ships on the map.
- **Routes** are distance fields (Dijkstra over open water, tiles next to land cost 2.5×, no corner cutting), cached per destination and cleared when a bridge changes (`bridgeSig`). At most one new field per frame (about 1 ms on a PC); ships waiting for one sit still a frame. Ships steer two tiles ahead and never move onto land (`wet`); if they bump a corner they go back to the middle of the tile first.
- **Drawing:** `renderer.ship()`, drawn live (few ships, simple shapes) in painter order with the buildings, so harbor buildings correctly hide ships tied up behind them. Hull colours etc. are `HULL`, `BOX`, `CARGO` at the top of `renderer.js`.
- **Rules (sim.js):** `analyzeSea()` (run with the road analysis) sets `seaLink` per land tile: 1 = within 2 tiles of open sea, 2 = only reaches the sea past a bridge. `linkedOut(i)` replaces the plain highway check for growth and decay: industry with `seaLink 1` ships its goods by sea. `ports` / `portsBlocked` counted in `recount()`. With a port, industry never pays half tax and gets +0.08 demand (Freddie: this demand bonus was not in the plan; drop it if unwanted). Inspector row "Ships to the sea"; Advisors warn about blocked harbors.

## Interface and landfill (built in 0.5.14)

Freddie found the interface covered too much of the map (about 40% in landscape) and the landfill looked out of place (a round brown mound with confetti specks, spilling over its lot).
- **HUD** (`App.jsx`, styles at the end of `styles.css` under "HUD (0.5.14)"): two pills on top instead of one full-width bar (`.hud-l`: money, residents, happiness, utilities chip `.utils`; `.hud-r`: clock with short date, speed, demand). The date's year is in the tooltip and in City.
- **Build tools:** a slim category rail (`.rail`, 56 px) with short labels; tools open in a pop-out (`.fly`, state `fly`) only when a category is tapped. Move is no longer a tool: no tool picked means move/inspect, and the active tool shows as a chip (`.chip`) in `.leftcol` with ✕ to stop. Tapping the map closes the pop-out. Undo moved to a chip under it.
- **Right column** (`.side`): Views, City, Menu, Hide as compact buttons under the top-right pill; sheets, the Inspector and alerts open beside it (`--below`, `--side-w`). On narrow portrait screens the right pill drops below the left one.
- **Landfill** (`dump()` in `sprites.js`): four terraced cells inside the 2×2 diamond (grassed with a gas vent, soil-capped, active cell with muted waste, bin bags, a compactor and gulls, gravel yard with office, skips and weighbridge) and a chain-link fence with a gate.

## Shore buildings (built in 0.5.15, Water part 2, second half)

- **Definitions** (`buildings.js`, ids 23–26): `pier` (1×1, $400, fun 0.45, any shore), `beach` (2×2 on sand, $600, fun 0.8, unlocks at 300), `marina` (2×2, $3,000, fun 1.1, lake or sea, unlocks at 1,000), `ferry` (1×1, $1,500, transit 1.0, lake or sea, next to a road, unlocks at 600). `shore` says what water it needs, `reach` how many rows of water the structure covers, `dock` adds a berth row of open water for boats.
- **Facing:** the footprint is on land; `sim.shoreFace()` picks the first side (0 +x, 1 +y, 2 −x, 3 −y) with enough open water in front (no bridges, not used by another shore building) and stores it in `world.variant` of the footprint tiles. Local coordinates (u out from the water edge, v along the shore) come from `shoreXY()`; `frontTiles()` and `berthTile()` give the water tiles.
- **Water in use:** `sim.decks()` marks water under a structure (1) and berths (2). Bridges can't be built there; ships don't sail under structures (`Ships.rebuild`, re-run when a bridge or shore building changes).
- **Pictures** (`sprites.js`, `shoreKit`, `pier`, `beach`, `marina`, `ferryPier`): cached per face. Shore sprites get a canvas padded by the reach (`SVC_SPR_SHORE`, last number), and draw the water part first when the water is behind (faces 2, 3).
- **Ferries:** `sim.labelWater()` numbers each open stretch of water; `linkFerries()` links ferry piers on the same stretch. A ferry pier gives transit coverage (longer commute reach, like bus coverage) only when linked. In `ships.js` the first pier on each stretch (and the third, with four or more) runs a ferry that calls at every pier in turn.
- **Marina boats:** two yachts sail out up to about 14 tiles and back. A lake harbor with no other harbor sends its barge to the marina if the lake has one.

## Graphics step 3 (built in 0.5.16)

- **8 looks per building** (`sim.js` grow: `variant` 0..7; renderer uses `% 8`). Variants 0..3 are the old pictures, so existing cities look the same until buildings grow. Variants 4..7 add detail in `sprites.js`: `roofDress()` (solar panels, roof garden, water tank and AC units, plant room with vents and antenna) on apartments, shops and offices; `balconies()` with washing on apartments; `yard()` (hedge, picket fence, mailbox, car in the drive) on houses; a rooftop sign and bins on shops. Level 3 towers, level 4 and waterfront buildings are unchanged.
- **Seasons** (`SEASON` in `sprites.js`, set each frame by `game.js` from the month via `SEASON_OF`; setting `game.seasons`, Menu → Seasons): 0 spring/summer, 1 autumn (Sep–Nov), 2 winter (Dec–Feb). Only trees (`kit.tree`, when the sprite is made with a season), grass and sand tiles (`terrainSprite`, `gtint`), parks and the ground cache change, so a change of season redraws a few dozen small pictures, not the city (a season lasts 72 s at normal speed). `seasonal()` keeps showing the previous season's tree or park until the new one is made. Building lawns and trees inside building pictures stay as they are. In winter house chimneys smoke all day.
- **Flags** wave live: `SVC_FLAGS` in `sprites.js` lists flag positions per service building (Police HQ, Fire HQ, University); the pictures have only the poles and `renderer.flag()` draws the cloth (still on Smooth).
- **Gulls** (`renderer.gulls()`): three per harbor berth, pier and beach, circling and mostly gliding, with shadows. Positions looked up every 5 s. Skipped on Smooth.

## Drawing order for big buildings (fixed in 0.5.17)

Freddie saw the landfill painted over the warehouse standing in front of it. A building bigger than one tile used to be drawn whole when the loop reached its front tile, so anything on a neighbouring tile that is further forward but earlier in the drawing order (same or lower x + y) got painted over. Now `renderer.slices()` draws each multi-tile service building in vertical half-tile strips, each strip with the frontmost footprint tile it crosses (`sliceOf(w, d)`, cached per size; the picture's side margins go with the outermost columns). Construction sites are still drawn whole at the front tile. The landfill's painted gulls are gone (they looked stuck on the building behind); live gulls circle over landfills instead.
- **How to test:** put industry or homes on the tiles left-front and right-front of a landfill, hospital or other 2×2/3×3 building: they cover it where they stand in front, and it covers what is behind it.

## Graphics polish (built in 0.5.18)

- **Close-zoom pictures:** when `zoom × resolution > 2.2` (and not Smooth), buildings and service buildings use copies drawn at 3.2× instead of 2× (`hiRes()` in `sprites.js`; the biggest 3×3 ones at 2.6×). Only the 28–36 most recently used are kept, so memory stays bounded; check the Infinix with the test tools while zoomed in.
- **Materials:** `kit.mat()` draws siding, brick (staggered joints, a few lighter and darker bricks), panels or concrete (seams, speckle, plinth) over a box's two visible faces, plus a soft darkening near the ground. Used by houses, apartments, towers, shops, offices, warehouses and factories. Windows (`kit.win`) get a dark outer frame and a stone sill with a shadow. House roofs get shingles; every house lot has a flowerbed and stepping stones.
- **Live shadows:** baked cast shadows are off (`CAST` in `sprites.js`; the contact shadow at the foot of each building stays). `renderer.shadowLayer()` draws every building as a box swept away from the sun (a hexagon, no allocations) into a canvas at a quarter of the screen size, then lays it over the ground once at one opacity, so overlaps don't darken and edges come out soft. The sun (`renderer.sun()`) follows the day: shadows to +x at sunrise, short at noon, long to +y at sunset, none at night. Heights come from `REAL_H` / `SVC_H` in `construction.js`. Lots draw their own lawn over it, so shadows show on roads, water and open land.
- **Street life** (`renderer.street()`, per road tile in the object pass, placed by hash): street trees (seasonal tree pictures at 62%) on the pavement by homes, parked cars (`parkedSprite`, 6 colours × 2 directions) by shops and industry, a bench and bin (`benchSprite`) by parks. Skipped when zoomed far out.
- **Wet roads:** `renderer.wet` rises with rain and dries over about a minute; road tiles get `wetSprite` (darker, with streaks of reflected sky; warm at night). Not drawn into the zoomed-out ground cache.
- **Lights after dark:** `renderer.litFrac` (from the clock) decides per building, by hash, whether its night picture has lit windows: they come on one by one over the first part of the night and some go out late.
- **Walking:** people's legs swing (`renderer.person`).
- **Soft ground edges:** `renderer.edgeSprite()` feathers sand into grass and grass into sand along tile edges (cached per side, lighting and season), also inside the ground cache.

## Gameplay update (built in 0.6.0)

All in `sim.js` unless noted.
- **Seasons:** `SIM_SEASON` by month (0 spring, 1 summer, 2 autumn, 3 winter), `sim.SEASON_NOW` (summer when `seasonsOn` is false; set from Menu → Seasons by `game.js`). Winter: homes use 25% more power (`anNetworks`), homes and shops demand −0.06, happiness −2 (softened by health care). Spring: demand +0.03. Summer: happiness +1 to +3 with amenities, tourists ×1.6. Autumn: farm tax ×1.5 (`recount`, `iTax`).
- **Tourism** (`sim.tourism()`, run in `anLand`): attraction from parks, piers, beaches, marinas, museums, stadiums, plazas, libraries and waterfront shops, times the season (and a festival boost), capped by hotel beds (30 + 12 per shop at level 3+, 8 per waterfront shop at level 2+). Income `tourists × 3 × (0.6 + shop tax / 22)` a month; visitors raise shop demand.
- **Requests** (`REQUESTS`, `monthlyRequests`, `answerRequest`, `requestView`): saved in `req`, `reqNext`, `reqDone`; happiness effects in `moods` (shown as a Requests line in happiness). A choice not answered in two months takes its last option.
- **Avenues:** road tiles with `world.level = 1` (bridges never). Twice the capacity in the jam and commute-cost calculations; upkeep +$0.60. `roadSprite(mask, mode, avenue)` draws the median on straight pieces; the ground cache key includes it.
- **Metro:** building 27 (`metro: true`), coverage key `metro` (in `COVS`), only when two or more stations are open (`metroLinked`). Commute reach `18 + 12 × buses + 22 × metro`. Cars on the road drop with metro coverage like with buses (`game.js`).
- **Industry types:** `pickSpec()` when an industry lot first grows; stored in bits 4–5 of `world.variant` (`specOf()`), kept as it grows. Jobs, pollution and tax multipliers `SPEC_JOBS`, `SPEC_POLL`, `SPEC_TAX`; tech lots need city education 40%. Pictures `farm`, `sawmill`, `techPark` in `sprites.js` (`industryArt`; level 4 keeps the hi-tech campus). The renderer passes `variant & 55` so the type reaches the picture.

## Traffic and speed (built in 0.6.1)

- **Trips, not wandering cars** (`flow.js`, `sim.flowM`): districts of 6×6 tiles send workers to jobs (attraction × e^(−time/28)), residents to shops (35%, e^(−time/14)) and industry's lorries to the highway, minus the share that takes buses or the metro. One quickest-route search per district, trips pushed back along the route tree in one sweep. `PEAK` = 0.08 turns daily trips into the busiest hour. Capacity per tile: street 55, avenue 120, highway 170. Travel time `base × (1 + 0.5 × load⁴)` (base: avenue 0.7, highway 0.6), capped at 5×, so later passes route around jams. Passes run 2.5 ms per frame (1.5 on Smooth), every 6 game days or when roads change, blended 50/50 with the last result; the first three passes run back to back.
- **Uses:** `sim.analyzeRoads` takes jams (load above 0.85) and commute times from it and reruns when a new pass finishes; Views → Traffic shows load; the road Inspector shows trips against capacity. The old per-frame car-count map is gone.
- **Cars follow it:** `Traffic` spawns cars on road tiles in proportion to trips (`flow.pick`), turns them toward busier roads, and replaces each after 10–24 tiles. Citizen drivers take the quickest route by travel time (`agents.bfs`, now a Dijkstra over `flow.cost`; route cache cleared when the traffic picture changes).
- **Speed:** vehicles queue by checking only their own and the next tile (`followPass`, no longer every vehicle against every other); the renderer sorts vehicles into tiles with reusable arrays instead of a new map every frame; off-screen rows of the map are skipped before any tile work; status badges and traffic lights are cached pictures (lamp glow added live); building shadows are only redrawn when the view, the sun or the city changed; the sprite warm-up gets 1.5 ms instead of 3. In a test city of 47,000 residents the drawing work per frame went from 46 ms to 27 ms on a PC.

## What's next

1. **Traffic, part 2 (agreed):** smarter junctions (lights only where busy roads meet, priority roads elsewhere, longer green for the busier direction, maybe roundabouts) and diagnosis tools (where a road's trips come from and go to; Advisors naming the worst bottlenecks with Show on map).

Nothing agreed yet. Ideas to discuss with Freddie: snow on roofs in winter (would mean a winter copy of every building picture, so check memory on the Infinix first), more variety for level 3 towers and level 4 buildings, people walking on piers and beaches.

## Water, part 2 (built in 0.5.13 and 0.5.15; the original plan)

The rest of the water plan, carried over from 0.5.6. Keep the three water styles in mind: big ships only on lake and sea harbors.

### Harbor ships (built in 0.5.13, see above)
Each harbor (lake or sea industry lot) has ships coming and going, more as it grows. Use the boats in `boats.js` as the base.
- Water that reaches the **map edge** counts as open sea: ships sail in from the edge, dock at the harbor for a while and sail back out.
- On an **inland lake**, barges and small cargo boats shuttle between the harbors on that lake, or between a harbor and a marina if there is only one harbor.
- **Gameplay:** a harbor on water that reaches the map edge also counts as a way to ship goods out, like the highway (industry pays half tax without one). Ships can't pass a bridge across a harbor's only route to the sea; say so in the Inspector instead of making it a hidden rule.

### Things to build on the water
Each unlocks at a population level, like other buildings, and sits on the shoreline, partly over the water.
- **Pier:** cheap, early. People stroll and fish. Small land value boost nearby.
- **Beach:** placed on sand. Umbrellas and swimmers by day. Counts as an amenity, like a park.
- **Marina:** moored boats that sail out on its lake. Bigger land value and amenity boost.
- **Ferry pier:** works like a bus terminal across water. Two ferry piers on the same lake get a ferry between them, which stretches commute reach the way bus coverage does.

### Notes for whoever builds it
- Keep all new art cached as sprites (see `sprites.js`, `mip()` for zoomed-out copies). Nothing drawn live per tile per frame.
- New buildings on water must work with the ground cache in `renderer.js` (`updateGround`, redraws changed tiles and their neighbors) and with `shoreMask` / `waterRegions`.
- Boats already hide under bridges (`renderer.boats`); harbor ships should do the same.

## Graphics step 3 (the original plan, built in 0.5.16)

The last step of the graphics plan agreed on 22 Nov 2026 (step 1 = GPU drawing, 0.5.9; step 2 = light and water, 0.5.11). Same "living miniature" look, more detail and life. All art stays cached sprites drawn by code; check heat and the stutter readout on the Infinix after each part.
- **Richer buildings:** more detail on roofs (vents, water tanks, solar panels, roof gardens), walls (balconies, signs, awnings, window frames) and ground (paths, hedges, parked cars, bins), and more variants per building so streets don't repeat (today: 4 variants per kind and level).
- **Small life:** flags and banners moving in the wind, laundry on balconies, birds over the water and parks, steam from vents in cold weather, people on beaches and piers.
- **Seasons (optional):** autumn trees, a light snow cover in winter, cached per season like day/dusk/night.
- **Smooth** keeps the base art and skips the moving extras.

## Where things live

```
src/game/sim.js          economy, growth, happiness, debt, loans, commutes, advisors, inspector, bridge rules
src/game/rules.js        ordinances, goals, unlocks, loans, guide steps
src/game/buildings.js    service buildings, per-level utility needs, which services close in debt
src/game/world.js        terrain and map kinds (classic, coast, lake, country), highway, grass tone, water depth and waterfront style (shore)
src/game/sprites.js      all building, terrain, road and tree art (cached per lighting mode)
src/game/waterfront.js   waterfront building art and names: pond, lake and sea styles
src/game/gl2d.js         GPU drawing engine (WebGL2) behind the renderer, with fallback to the 2D canvas
src/game/renderer.js     draw loop, water surface, cached ground for zoomed-out views, overlays, inspector outline, haze, quality settings
src/game/game.js         input, tapping, camera, loop, save/load, start screen backdrop, pause in background, test tools, auto quality
src/game/audio.js        synthesized sound and music
src/game/boats.js        boats on every body of water, sized to it
src/game/ships.js        harbor ships: container ships from the sea, barges on lakes, routes over open water
src/game/movers.js       moving vans: residents leaving and arriving by the highway
src/App.jsx              all interface panels: top pills, category rail and tool pop-out, right column, sheets, start screen (StartScreen)
```

---

## Change history

- **0.6.1:** traffic from real trips: jams appear where homes, jobs, shops and industry actually send people, drivers take the quickest route and avoid jams, avenues and new roads draw traffic away, and the cars on screen follow the busy roads. Faster drawing: about 40% less work per frame in a big city.
- **0.6.0:** gameplay update. Seasons change power demand, growth, happiness and tourism; tourists bring income and need hotel beds; residents and businesses make requests with deadlines and choices; avenues carry twice the traffic; a metro links distant stations; industry grows as farms, sawmills or tech parks depending on where it is.
- **0.5.18:** graphics polish. Sharp pictures when zoomed in, brick, siding and panel walls with framed windows and sills, shadows that follow the sun across the streets, street trees, parked cars and benches, wet roads after rain, windows lighting up one by one, walking people and soft grass and sand edges.
- **0.5.17:** big buildings (2×2 and 3×3) no longer paint over neighbours standing in front of them; they are drawn in slices with the tiles in front. Gulls over landfills are live instead of painted on.
- **0.5.16:** graphics step 3. Buildings pick from 8 looks, with solar panels, roof gardens, water tanks, balconies with washing, garden fences, cars in drives and shop signs. Seasons: autumn colours and winter frost with bare trees (Menu → Seasons). Waving flags and gulls over the water.
- **0.5.15:** shore buildings. Fishing pier, beach, marina (with yachts) and ferry pier, each facing the water and reaching out over it. Two ferry piers on the same water run a ferry and extend commute reach like buses. Bridges and ships keep clear of them.
- **0.5.14:** cleaner interface and a new landfill. Two small pills on top instead of a full-width bar, power/water/garbage folded into one chip that only shows numbers when short, a slim category rail with tools in a pop-out, an active-tool chip with ✕, and a compact right column. The map shows about twice as much at once. The landfill is redrawn as a fenced, terraced lot that fits its footprint.
- **0.5.13:** harbor ships. Container ships sail in from the sea to sea harbors and back out; barges shuttle on inland lakes. Ships can't pass bridges; the Inspector and Advisors say when a bridge cuts a harbor off. A harbor that reaches the sea ships goods out like the highway, and a sea port raises industry demand a little.
- **0.5.12:** cooler phone, longer battery. Auto frame rate (60 while touching, 30 when still, 20 when paused, never above 60 on fast screens), a Frame rate setting (Auto / 30 / 60), and Pretty at 1.25x resolution on phones. Plan for Water part 2 and Graphics step 3 written down above.
- **0.5.11:** graphics step 2, light and water: animated water with twinkling glints and sky reflection, buildings and trees reflected in the water, street-lamp light pools, light spilling from lit buildings, headlight beams, and warm sunset light.
- **0.5.10:** smoother panning and steadier sound. New pictures are made a little per frame while the map moves (and ahead of time while it's still), the GPU engine makes less garbage, and the sound uses a bigger buffer with a lighter reverb. Test tools show a stutter readout.
- **0.5.9:** the game draws on the graphics chip (WebGL2) instead of the browser's 2D canvas, with automatic fallback. Android now treats the app as a game (game category, hardware acceleration, screen stays awake). Fixed a crash at night with level 4 shops that could freeze the game; the loop now survives any bad frame.
- **0.5.8:** start screen. The game opens on a title screen over the drifting city, with Continue, New city and Settings. New city lets you pick Coastline, Lakeland or Countryside and shows the map live before you start. Menu in the game gets Main menu.
- **0.5.7:** the game pauses when you leave the app. Going to the home screen, switching apps or turning the screen off stops the music and sound, the draw loop and the city clock, and saves the city. Coming back picks up where you left off (`game.background()`, `audio.sleep()` / `wake()`).
- **0.5.6:** waterfront buildings in three styles, chosen by the size of the water: pond (garden village), lake (timber lake country) and sea (beach and harbor). 36 new building pictures, waterfront land value bonus (+4 / +6 / +8), Waterfront line in the Inspector. Harbor ships, pier, beach, marina and ferry moved to the "Water, part 2" plan.
- **0.5.5:** bridges, boats and moving vans. Roads can cross water as bridges ($60 a tile, $2/month upkeep, straight, no junctions on the water, at most 12 tiles, can carry power lines and pipes). Every lake and pond gets boats that suit its size, more as the city grows: ducks, rowboats, pedal boats, sailboats, fishing boats and motorboats, with wakes and night lights. Residents who leave drive away to the highway in cars loaded with boxes; new residents drive in. Plan for 0.5.6 added above.
- **0.5.4:** water and zoom-out. Water is one continuous surface (colour shades from the shore to deep water) with drifting ripples, instead of separate tiles; softer shoreline foam; sand no longer forms a checkerboard. Zoomed out, the ground is drawn from one cached image that only redraws changed tiles, and buildings, trees and cars use smaller copies of their pictures; cars are cached pictures. Cache and water rebuilds after a change of day/dusk/night are spread over several frames. Smooth draws one ripple layer instead of two. Uses about 30 MB more memory for the cached images.
- **0.5.3:** performance fix, part 2. The city recalculation is spread over four frames instead of freezing one, and runs about 3× faster (precomputed falloff tables). Removed the night bloom (a live full-screen blur). Water ripples and shoreline foam are cached sprites. Trees only sway when zoomed in. Pretty renders at up to 1.5× resolution instead of 2×. Auto switches to Smooth below about 33 fps instead of 25. The interface refreshes twice a second instead of four times. Frame-time readout in the test tools.
- **0.5.2:** performance fix. Auto / Pretty / Smooth graphics with automatic fallback; Lens focus off by default; removed a costly full-screen effect; simulation recalculates less often. Added this file.
- **0.5.1:** camera reaches every map edge; version line, update message and hidden test tools.
- **0.5.0:** everything in "What was built" above.
