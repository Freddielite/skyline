# Skyline: project notes

Isometric city builder for Android. React + Vite + canvas, packaged with Capacitor.
Project folder on Freddie's machine: `/home/freddielite/Downloads/skyline`
App ID: `com.wyntek.skyline` · Current version: **0.5.13**

This file is the handover: what has been built, how to push it to the phone, and the rules for future changes.
Anyone (person or AI assistant) working on this project should read it first.

---

## Rules for every change

1. **Always end with the push command.** Every fix or feature, however small, ends with the full push command below, written out exactly, so it can be copied and run without looking anything up.
2. **Always bump the version** in `package.json` (0.5.13 → 0.5.14 and so on). The game shows "Updated to version X" on first launch and the version in Menu, which is how we confirm the phone really got the new build.
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

**Check which version is on the phone:** Menu → the line at the bottom says `Skyline 0.5.13 · built (date) UTC`.

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
| Inspector | Pick Move, tap any building. Tap again to close. |
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
| Bridges | Pick Road and drag from a road on the shore across water. The preview counts $60 per water tile. Try a junction on the water, a side road onto the bridge, or more than 12 tiles: each is refused with a message. Move → tap a bridge: "Bridge, upkeep $2/month". Bulldoze removes it, with any lines or pipes on it. |
| Boats | Every lake and pond has something on it: ducks and rowboats on ponds, pedal boats on small lakes, sailboats and fishing boats on lakes, motorboats on big water. More appear as the population grows (checked every 3 seconds). Boats pass under bridges. Running lights at night. |
| Light and water | Graphics → Pretty. Find buildings by a lake or the sea: by day they reflect in the water, which waves and glints. Menu → Time of day → Dusk: orange glints, warm sky on far water, warm light from the upper right. Night: lamps light pools on the roads, lit buildings spill light, cars have headlight beams and red tail lights. Smooth: no reflections or beams, water still moves. |
| Frame rate | Menu → Graphics → Frame rate. With Auto, test tools say "Aiming for 30 fps" while you look, 60 while you drag, 20 when paused. The phone should stay cooler than before. 30 is coolest, 60 smoothest. |
| Stutters | Test tools: drag the map around for 30 seconds, then read the Stutters line and its "Last one" details. Send these to whoever works on performance. |
| GPU drawing | Menu → tap the version line 5 times: it says "Drawing with: GPU (WebGL2)". Look at the Frames line, then tap "Switch to old 2D canvas" and compare in the same place. Switch back afterwards. |
| Leaving the app | Tap the map so sound plays, then press Home or switch apps. The sound stops at once. Come back: the clock and the city carried on from where they were, nothing happened while you were away. |
| Harbor ships | Test tools → +$50,000 and Unlock all. Zone industry along the sea (Coastline map) and along an inland lake (Lakeland), connect them to the highway and let them grow. Sea harbors: container ships sail in from the map edge, tie up at the quay, then sail out (each round trip takes a few minutes). Lake harbors: a tug pushes a barge between harbors, or across the lake and back. Move → tap a harbor: "Ships to the sea" says Yes, or "inland water". Build a bridge that cuts a harbor off from the sea: the row says a bridge blocks the way, City → Advisors warns, and its ships switch to barges. Night: running lights. |
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
- **Inspector:** tap any tile with Move to see what the building needs and the exact reason it isn't growing.
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

## What's next (agreed order)

1. **Water, part 2, second half** (below): pier, beach, marina, ferry pier. Barges on a lake with one harbor should go to the marina once it exists (`Ships.destination`).
2. **Graphics step 3** (below): richer building art and small signs of life.

## Water, part 2 (planned, not built yet)

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

## Graphics step 3 (planned, not built yet)

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
src/App.jsx              all interface panels, including the start screen (StartScreen)
```

---

## Change history

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
