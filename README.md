# Moto Tour POC

Proof of concept for the UK motorcycle tour experience: a hologram-style 3D terrain with the
ride draped on it, a solid "detail bubble" that follows the bike, pins linked by place or by
time, and a timeline scrubber. It exists to prove out the technical risks before the
production app, and to serve as a reference for it.

Stack: SvelteKit (Svelte 5) · Threlte 8 / Three.js · d3 · Vercel adapter.

## Run it

```sh
npm install
npm run dev            # http://localhost:5173
```

The built data in `static/data/` is committed, so the app runs without the pipeline.
`/` is the whole tour over Great Britain; `/day/2026-09-16` etc. are the days. Built so far:
**16 Sep, Lakes figure of eight** and **17 Sep, Lakes to Thorntonloch**.

## Multi-day architecture: phased resolution, one page per day

| Level | What | Loaded |
| --- | --- | --- |
| **L0 UK** | Great Britain at 1 km (`static/data/uk/`), every day's simplified route (`tour.json`) | Always: home page and backdrop |
| **L1 Day** | A day bundle (`static/data/days/<date>/`): terrain grid, corridor, track, OSM, water, weather, pins. Grid spacing adapts to the day's size (25 m for the Lakes loop, 75 m for the 225 km run to Dunbar) | One day at a time; the next day is prefetched |
| **L2 Near bike** | Full-resolution Terrarium tiles streamed in the browser around the bike (`nearTerrain.ts`), feeding a fixed 25 m detail mesh | Continuously, around the rider |

- **One world:** everything is in British National Grid metres. Each day's data is stored relative to its own origin (whole km), and the world origin is the *active* day's origin, so the day renders untransformed with full float precision. The UK layer and the other days' routes are offset against it.
- **Day transitions** (`app.svelte.ts`): climb to a point above both days, shift the world origin and the camera by the same amount (invisible), swap the day, fly back down. Driven by the URL: the trip bar, day markers, **Shift + ←/→** and auto-advance at the end of a day all just navigate.
- **Settings persist across days** (`settings.svelte.ts`); `Tour` is per-day playback and forwards them.
- **Grid north ≠ true north:** BNG is rotated from Mercator by up to ~3°, so imagery UVs near the bike use a full affine map, and far UVs come from a 2 km lookup table rather than per-vertex projection.

## Data pipeline

```sh
npm run data                         # every day in data/beeline/, then the tour index
node scripts/build-days.mjs 2026-09-18 2026-09-19   # just these days
npm run data:uk                      # L0 UK grid (once)
npm run data:tour                    # rebuild tour.json from the built days
```

The Beeline export lives in `data/beeline/` (git-ignored); files are grouped into days by their
date prefix, so a day with several rides (e.g. a breakfast run plus the main ride) becomes one
day with breaks between rides. Day titles come from the file names unless overridden in
`data/day-titles.json`. Pins are authored once in `data/pins.json` and assigned to days by time
or position.

| Script | Out |
| --- | --- |
| `build-uk.mjs` | `uk/terrain.*`: GB at 1 km from Terrarium z8 (Ireland masked out) |
| `build-terrain.mjs <day>` | `days/<day>/terrain.*`: adaptive-spacing grid around the day's rides |
| `build-track.mjs <day>` | `track.json` (draped on full-res tiles, stops, riding time, lean, ride breaks), `corridor.bin`, `pins.json` |
| `build-osm.mjs <day>` | `osm.json` + `water.bin`: Overpass queried in ~32 km chunks along the route (minor roads/hamlets within 1.5 km, main roads/towns/peaks/water within 8 km), each chunk cached |
| `build-weather.mjs <day>` | `weather.json` from Open-Meteo, every 10 min along the ride |
| `build-tour.mjs` | `tour.json`: days, origins, extents, stats, simplified lines |
| `build-days.mjs [days…]` | Runs the above per day; OSM/weather failures don't stop the day building |

## What this proves

| Challenge | Approach | Where |
| --- | --- | --- |
| Terrain too big to render at full resolution | Tiered point density driven by a distance-to-route raster: 25 m near the road, 50 m out to 1.2 km, 100 m backdrop | `HoloPoints.svelte`, corridor in `build-track.mjs` |
| Contour rings at true XY and Z | `d3-contour` on a 100 m grid, drawn as line segments at their elevations, with the coastline at 1 m | `Contours.svelte` |
| Solid "laser-cut" terraces | A height mesh snapped to the contour interval in the vertex shader. Extruding contour polygons was dropped: triangulating coastlines with hundreds of lochs as holes took minutes and crashed | `Terraces.svelte` |
| Real detail around the bike | A 6.4 km grid mesh re-sampled around the bike, with a shader fading it into the hologram (glowing rim, 20 m / 100 m contour lines) | `DetailBubble.svelte` |
| GPS altitude vs terrain | The track is **draped on the DEM**; raw GPS altitude is an optional overlay (the "Raw GPS altitude" layer) to show the drift | `Route.svelte` |
| Speed as a colour gradient | Per-vertex colours with d3 Turbo; also lean and gradient modes. d3 gives sRGB, so colours go through `THREE.Color` to reach linear space | `Route.svelte`, `colors.ts` |
| Live vertical exaggeration | All terrain-anchored layers sit in one group with `scale.y`; the bike and pins scale their own Y | `DayScene.svelte` |
| Time-series playback | A riding-time axis with stops collapsed to a few seconds; binary search plus interpolation; a lean angle from yaw rate × speed | `data.ts`, `build-track.mjs` |
| Scrubber | Elevation profile filled with the active colour scale, stop and pin markers, drag to seek, clock-time ticks | `Scrubber.svelte` |
| Items without GPS (receipts, untagged photos) | Pins can carry `lat/lon` **or** just a `time`; time-only pins are snapped to the track position at that moment | `data/pins.json`, `build-track.mjs` |
| Real road detail | OSM roads via Overpass at build time, draped as fat lines styled by class; place and peak labels that appear by camera distance (and fell height); the HUD shows the current road, speed limit and single-track status | `build-osm.mjs`, `Roads.svelte`, `PlaceLabels.svelte`, `Scrubber.svelte` |
| Water | OSM lakes/reservoirs (multipolygons included) rasterised at build time into an anti-aliased coverage mask on the height grid; used by all three terrain layers (shimmering sheets in the point cloud, a glassy surface with a glowing shoreline in the detail area, flat blue sheets in the terraces); rivers as draped lines; named lakes labelled | `build-osm.mjs` (`water.bin`), `HoloPoints`, `DetailBubble`, `Terraces`, `Rivers.svelte` |
| Map styles | Hologram / Satellite (Esri) / Sentinel-2 (EOX) / Topo (OpenTopoMap), fetched as XYZ tiles in the browser and stitched into canvas textures: a regional one (z12, exact per-vertex UVs) colours the point cloud and terraces; a sharp one (z14–15) follows the bike and drapes the detail area, falling back to the regional one while tiles load | `imagery.ts`, `HoloPoints`, `Terraces`, `DetailBubble` |
| Point cloud visibility | Size and glow sliders; alpha is scaled by sampling density so the dense route corridor glows without saturating under additive blending | `HoloPoints.svelte` |
| Historical weather | HUD (conditions, °C, wind arrow, rain), rain bars and a temperature trace on the scrubber, and rain streaks in 3D whose density follows precipitation (drizzle codes get a floor) and whose slant follows the recorded wind | `build-weather.mjs`, `Rain.svelte`, `Scrubber.svelte` |
| Camera | Follow (keeps your orbit offset), Chase (behind the bike, never under the terrain), Overview, Free, with fly-to transitions | `CameraRig.svelte` |

**Feature flags** live in `src/lib/config.ts` (hard-coded; flip and rebuild). `showSpeed` is **off**
by default: no speed readout, no speed colouring, no mph legend. This is a travelogue, and showing
speeds could read as encouraging people to race these roads. Note that the flag only hides speed in
the UI: playback timing and `track.json` still imply it, so strip or resample the data before
publishing if that matters.

Controls: Space to play/pause, ←/→ to skip 30 s, drag to orbit.

## Findings / notes for production

- **Projection:** the POC uses a local equirectangular projection. For the whole UK, switch to
  British National Grid (EPSG:27700), which lets OS Terrain 50 (free, 50 m) drop straight in.
- **Scale:** this region is 38 × 36 km. The whole UK needs tiles: a coarse all-UK layer
  (point cloud + contours at 250 m to 1 km), with corridor and detail tiles about 2 km square
  along the route, streamed in near the bike. `DetailBubble` currently samples one in-memory
  grid; its resample function is the seam where tile loading goes.
- **Stop detection:** a naive radius check split one stop in two because GPS jitter during
  braking pushed fixes out of range. It now uses the running centre of the stop plus a merge
  pass. Expect real Beeline data to need tuning of `STOP_RADIUS` / `STOP_MIN`.
- **Build work belongs in the pipeline:** contours are computed in the browser here, which is
  fine for one region. In production, pre-compute them per tile.
- **Road data at UK scale:** Overpass is fine for a region at build time, but it is a shared public
  service (it needs a User-Agent, and instances are often busy, hence the mirror fallback). For the
  whole route, filter a Geofabrik `great-britain-latest.osm.pbf` with osmium, or serve vector
  tiles (Protomaps PMTiles / OpenFreeMap) and decode roads per tile. OSM data needs
  "© OpenStreetMap contributors" attribution (shown bottom right).
- **Real Beeline data:** standard GPX 1.1, about 1 Hz, `<ele>` present, millisecond timestamps, one
  track segment per file, no planned route or waypoints. Stop detection works unchanged on it.
- **Flat water:** screen-space derivatives are zero on dead-flat surfaces (Thirlmere), so shader
  maths dividing by `fwidth` must be guarded or it outputs NaN (black) pixels.
- **Imagery licensing:** Esri World Imagery is fine for a personal or demo project with attribution, but check Esri's terms before any commercial or high-traffic use. EOX Sentinel-2 cloudless is CC BY-NC-SA. OpenTopoMap asks for light use only. For production, consider a keyed provider (MapTiler, Mapbox) or self-hosted tiles. All attributions are shown bottom right.
- **Weather:** Open-Meteo's free tier is for non-commercial use (CC BY 4.0 attribution). The historical-forecast API uses the Met Office 2 km model in the UK; the ERA5 archive is the fallback. Beeline stops recording while parked, so weather samples are de-duplicated per fix.
- **Imagery:** the detail area uses height-based colouring with hillshade. Satellite imagery is
  possible (Sentinel-2 is free at 10 m); most commercial providers restrict pre-baking their tiles.

## Not in the POC yet

Real photos (EXIF extraction + thumbnails), Spotify "now playing" matched by timestamp, a
multi-day/chapter timeline, blog content as Markdown files, a glTF bike model, and mobile
performance tuning.
