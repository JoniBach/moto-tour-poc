# GT Retrospective

A grand-touring retrospective: a tour told as a little globe you can turn, a street map and a
blog, from its rides, photos and stories. Live at https://gt-retrospective.vercel.app/the-parks-26 (the bare domain and the old
moto-tour-poc.vercel.app address redirect there). Each tour lives under its own path, its
`slug` in tour.config.json (SvelteKit's `paths.base`). It began as the proof of concept described below.

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

`/` is the whole tour over Great Britain; `/day/2026-09-09` … `/day/2026-09-26` are the 18 days.

**The personal data is not in git.** Everything under `static/data/tours/` and `static/photos/`
is generated from private sources (the rides in `tours/<id>/gpx/`, originals in
`tours/<id>/photos-src/jpg/`, privacy zones in `tours/<id>/privacy.json`) and git-ignored (see
[Tours](#tours)). To rebuild on a fresh checkout, put those in place, then:

```sh
npm run data                         # all days, tour index, parks
node scripts/build-photos.mjs        # resize + place photos
```

Only the tour configs, titles, pins and stories are committed.

## Tours

Everything tour-specific lives in `tours/<id>/`; the site and scripts are the same for every
tour. `TOUR=<id>` picks one for the data scripts, `vite dev`/`build` and the deploy (default
`uk-2026`); a build carries only that tour.

```
tours/uk-2026/
  tour.config.json   name, wording, locale, time zone, units, speed policy   (committed)
  day-titles.json    day title overrides                                     (committed)
  pins.json          authored pins                                           (committed)
  blog/              stories, Markdown                                       (committed)
  gpx/               the rides (Beeline export)                              (git-ignored)
  photos-src/jpg/    original photos                                         (git-ignored)
  privacy.json       privacy zones                                           (git-ignored)
```

Outputs go to `static/data/tours/<id>/` (days, `tour.json`, `photos.json`, `blog.json`,
`feed.json`, `parks.*`, `region/` the backdrop terrain) and `static/photos/<id>/`, all
git-ignored.

`tour.config.json`:

| Field | Example | Used for |
| --- | --- | --- |
| `id` | `uk-2026` | folder names and URLs of data and photos |
| `slug` | `the-parks-26` | the tour's path on the site: every page, and its data and photos, live under `/<slug>` |
| `deploy` | `false` | optional: `npm run deploy` refuses the tour (test tours) |
| `name`, `when` | `UK Tour`, `September 2026` | site name, titles, headers |
| `title`, `summary` | `A motorcycle tour of Britain's national parks`, `from Pembrokeshire to the Cairngorms and back` | blog headline and intro, globe overview |
| `activity` | `motorcycle` | `motorcycle`, `bicycle`, `car` or `walk`: the 3D figure, the words ("Ride here" / "Drive here" / "Walk here", "the bike" / "the car"), whether lean is offered, what counts as fast for the speed shade (`src/lib/activity.ts`) |
| `locale` | `en-GB` | `<html lang>`, dates and numbers |
| `timeZone` | `Europe/London` | every clock and date, in the site and the scripts |
| `units` | `{ "distance": "mi", "temperature": "C" }` | `mi`/`km`, `C`/`F` (data stays metric) |
| `speed` | `1` | 0 no speed, 1 relative shade only, 2 figures |
| `model` | `{ "src": "/models/vespa_model.glb", "length": 2.7, "forward": "-x", "color": "#9fd3c2" }` | optional: the vehicle as a GLB under `static/` (Draco allowed; the decoder is served from `static/draco/`), sized to `length` metres, turned from its `forward` axis, painted `color`, with a simple seated rider if `"rider": true`; without it, a figure built from primitives |
| `region.name` | `UK` | the whole-tour chip |
| `region.centre` | `[-2.3179, 55.4734]` | overview origin and the projection's centre (`init-tour` sets it from the rides) |
| `region.projection` | British National Grid | optional proj4 string; default a transverse Mercator on the centre (fine to ~1,000 km out) |
| `region.backdrop` | `{ "extent": [0, 0, 700000, 1250000], "spacing": 1000, "sea": [[lon0, lat0, lon1, lat1], …] }` | optional: the backdrop's box (projected metres; default the rides + 100 km), spacing (default: under a million points) and land to treat as sea |
| `protectedAreas` | `{ "one": "National Park", "many": "national parks", "names": {…} }` | park wording, and which parks: `names` (map name → display name, only those) or `classes` (OpenMapTiles park classes, default `["national_park"]`) at least `minKm2` (default 10) |

**A new tour:**

```sh
node scripts/init-tour.mjs my-tour          # creates tours/my-tour/ with a config to edit
# put the rides in tours/my-tour/gpx/ (YYYY-MM-DD…gpx), photos in photos-src/jpg/, zones in privacy.json
node scripts/init-tour.mjs my-tour          # again: sets region.centre from the rides
TOUR=my-tour npm run data                   # backdrop, days, tour index, parks, feed
TOUR=my-tour npm run data:photos
TOUR=my-tour npm run dev
```

`tours/alps-test/` is a made-up two-day cycling tour over the Swiss passes (km, °F, en-US,
Europe/Zurich, a test privacy zone) that proves all of this works away from the UK and on a
bicycle: `node scripts/make-sample-gpx.mjs tours/alps-test/sample-rides.json` makes its rides,
then `node scripts/init-tour.mjs alps-test` and the steps above. Inland regions have no coast,
so the overview outlines their mountains with a line every 1,000 m instead.

## Blog posts

**Writing on the move: the story editor** at `/wysiwyg` (https://gt-retrospective.vercel.app/wysiwyg,
not linked from the site and not indexed). A WYSIWYG editor: the page is the story page itself
(`StoryArticle`), and the title and story are typed straight into it, formatted with a toolbar that
floats above the on-screen keyboard (bold, italic, headings, quote, lists, link, ＋ Photo or map:
any day's photos, or a snapshot of the 2D map at a moment, each with a caption typed under it).
Map snapshots are saved as `![caption](map:2026-09-16T11:40@13)` (the tour's local time, optional
zoom) and drawn in the reader's browser from the 2D map's own style (`src/lib/map/mapShot.ts`: the
day's route, the part ridden by then, the bike there), then kept as a still image; MapLibre loads
only on stories that have one. The whole journey, every day in its colour and numbered where it set
off, is `![caption](map:tour)`, or `map:tour~2026-09-16` with that day picked out (the Map tab's "The
whole journey"). Places on the route that a story mentions ("the Lakes", "Keswick",
"Honister Pass", "the Brecon Beacons") get a dotted underline once typing pauses (never the word
being typed: iPad Safari loses the cursor if it's redrawn); tap one to link it to the moment the
ride was there, on the story's own day if it was there that day, else the first visit, or link
them all at once with the toolbar's "📍 Link places" (it counts the ones waiting) or "Link all" in
Story settings. Saved as `[the Lakes](tour:2026-09-16T10:29)`, published as a link to the
tour at that moment. The gazetteer is `npm run data:places` (`scripts/build-places.mjs`, also run by
`data:tour`): national parks (the moment the route enters them) and towns, villages, peaks and
lakes by the route (the nearest moment), none near a privacy zone; nicknames ("Beacons", "Lakes",
"Dales"…) in `tours/<id>/places.json`. Tap the cover to choose it; day, time, address
and draft are in "Story settings", with the notes on what's missing and the Markdown it saves. The
story is a Tiptap (ProseMirror) document read from and written to the story's Markdown
(`src/lib/editor/storyEditor.ts`, `@tiptap/markdown`, which parses with Marked like the build), and
offers only what the blog publishes; stories come back from a load and save rendering exactly as
they did. Nothing leaves the device: "Open .md" loads a file, "Save a copy" downloads a new
timestamped copy (`<slug> (saved 2026-10-01 14.30).md`; its `slug:` header keeps the address, so
the file name doesn't matter), and the draft stays in the browser between visits. "Share link" puts the
whole story (header, text, photos by id, draft flag) in a link, compressed into its fragment
(`/wysiwyg#story=…`, never sent to the server; `src/lib/editor/shareLink.ts`): opening it on another
device loads the story into the editor, asking first if a different one is in progress.
Drop the saved file into `tours/<id>/blog/` and build as below.


Stories can also be from before or after the trip: `when: before` pins one to where the journey set
off (first on Day 1, before "Set off"), `when: after` to where it ended (last on the final day, after
"Arrived"); their `time` is then optional, a date shown on the story (`time: 2026-09-07`). The
editor's Story settings switch between Before the trip, During and After the trip.

Write Markdown in `tours/<id>/blog/` (committed), one file per post, tied to a moment of the ride:

```md
---
title: Honister Pass
time: 2026-09-16 11:30      # the tour's local time; the post appears where the bike was then
cover: 20260916_113010      # optional photo id (file name without extension)
---
Markdown body. Embed tour photos by id: ![caption](photo:20260916_115051)
```

`npm run data:blog` places each post against the track (like photos), renders it, and writes
`static/data/tours/<id>/blog.json` (git-ignored). Files starting with `_` are drafts (see
`tours/<id>/blog/_template.md`). Posts appear as ✎ markers on the map, entries in the events
drawer, ticks on the scrubber and pop-ups during playback, and open in a reader with "Ride here"
and previous/next. In dev, **✎ Post here** on the scrubber copies a ready-made header for the moment
on screen (with the nearest photo as cover). Posts whose moment is inside a privacy zone are
refused, and embedded photos withheld for privacy are removed.

## The blog (plain pages)

`/blog` is the same tour without the 3D view: the whole trip as a traditional blog, for readers
who'd rather scroll and read (or who need to: keyboard/screen-reader friendly, follows the system's
light/dark setting, scales with browser zoom, reduced motion respected).

- `/blog`: every day and **every event** (the same list as the events drawer: set off/arrived,
  breaks ≥ 30 min, photo drops, notes/pins, stories)
- `/blog/<day>`: one day with larger photos · `/blog/<day>/<post>`: an article ·
  `/blog/<day>/photo/<id>`: a photo with previous/next
- Every timestamp links to that moment in the 3D view (`/day/<day>?t=…&post=…&photo=…`); the 3D
  view's **📖 Blog** button (and "Read in the blog" in the reader) comes back the other way.

Reading the timeline: each event's first line is time · icon · title · chevron. The time and the
icon open that moment in the 3D view; the chevron folds the details (photos, note text) away, and
**Collapse all events** folds the lot so a day reads as one-liners. Stories never fold: they're
the heart of the blog, and folding everything else quietens the page around them.

**Filter and group** (`src/lib/blog/view.svelte.ts`, `ViewControls.svelte`): show or hide each
kind of event (set off and arrived, breaks, photos, notes and places, stories), pick a range of
days (index), and group back-to-back similar events (on by default: a run of photo stops, breaks
or notes becomes one row that opens to the events; stories never group). Settings carry across
blog pages and live in the URL (`?show=photos,pin&from=2026-09-14&to=2026-09-16&group=0`), so a
filtered view can be shared. Pages are prerendered showing everything; the URL is applied once
the page runs.

Data: `scripts/build-feed.mjs` writes `static/data/feed.json` from the same event logic as the
drawer (`src/lib/events-core.js`, shared by app and pipeline) plus the nearest town/village for
each event, the day's parks and weather. It holds no coordinates, and place names are left out
within 8 km of a privacy zone. It runs as part of `npm run data`, `data:photos` and `data:blog`.

Routes: the 3D experience lives in the `(dx)` route group (URLs unchanged) so the blog never loads
the canvas; the root layout holds the shared theme.

Performance: blog pages are server-rendered and prerendered at build time (`blog/+layout.ts`,
data from `src/lib/server/blog-data.ts`), so the HTML arrives with the content and no blog page
loads three.js or the app state (don't import `$lib/app.svelte` under `routes/blog`). Photos go
through `src/lib/blog/Photo.svelte`: WebP `srcset` (thumb 320 / medium 800 / large 1600) with
`sizes`, width/height set (no layout shift), lazy-loaded and decoded off the main thread; only a
page's main image (post cover, photo page) is eager with `fetchpriority="high"`. Off-screen days on
the index skip layout/paint (`content-visibility: auto`). `vercel.json` caches `/photos` for 30
days and `/data` for an hour, both with stale-while-revalidate.

Accessibility target: WCAG 2.2 AAA. Text contrast ≥ 7:1 in light and dark, targets ≥ 44 px,
skip link, landmarks and breadcrumbs, one `h1` per page, unique link names (screen-reader text
like "View on the map at 10:42"), durations in words, 1.5 line/paragraph spacing, visible focus
not hidden by the sticky header, reflow at 320 px, ← / → between photos. To re-check after
changes, build, run `npx vite preview`, then audit with axe-core (`wcag2aaa` + `wcag22aa` tags);
axe can't check target size, reflow, text spacing or focus visibility, so test those by hand.

## Following the blog: RSS feed, sitemap and share cards

- **RSS feed** at `/<tour>/blog/feed.xml` (https://gt-retrospective.vercel.app/the-parks-26/blog/feed.xml;
  keep this address: readers and the mailing list poll it). Every story in full, newest first,
  prerendered by `src/routes/blog/feed.xml/+server.ts`. Every page's `<head>` links to it (the
  shell's `%tour.feed%`, `src/hooks.server.ts`) and the blog's footer has "Follow new stories by RSS".
- **Dated by when it went out**, not the ride moment it's about: each story's `published` is its
  header's `published:` if set, else when its file was first committed (`scripts/build-blog.mjs`).
  A story about September posted in October is new in October, so the mailing list sends it.
- **Standing alone**: in the feed every address is made full, photos are 1200 px JPEG copies
  (WebP isn't safe in email) and map snapshots, which the story page draws with script, are
  stills. `npm run data:email` (`scripts/build-email-images.mjs`, also run by `data:blog`) makes
  the JPEGs in `static/photos/<id>/email/`; the map stills (`static/photos/<id>/maps/`) need the
  site running: `BASE=http://localhost:5173/the-parks-26 npm run data:email` opens each story in
  Chrome and saves what the site draws. Without a still the feed links to the map instead.
- **Sitemap** at `/<tour>/sitemap.xml` (`src/routes/sitemap.xml/+server.ts`, named in `robots.txt`):
  the front page and every blog page.
- **Share cards**: blog pages set their title, description, canonical address and Open Graph /
  Twitter tags with `src/lib/blog/Meta.svelte`; the image is the story's cover (the JPEG copy) or the
  day's photo. Full addresses use the tour config's `origin`.

- **Mailing list** (Buttondown, `newsletter.buttondown` in the tour config; flag `newsletter`):
  `src/lib/blog/Subscribe.svelte` is a plain form posting to Buttondown's embed-subscribe address
  (the CSP's `form-action` allows it; no script), on the blog's front page, at the end of every
  story and in the footer elsewhere. Buttondown asks for a confirmation click, then sends each new
  story from the RSS feed (its RSS-to-email automation, set up in Buttondown). After confirming,
  people land on `/<tour>/blog/subscribed` (Buttondown's subscription confirmation redirect URL).

After writing a story: `npm run data:blog`, then (if it has a map snapshot) the `BASE=…` run above,
then deploy.

## The 2D map

The same tour on a flat street map, for anyone who'd rather not fly around in 3D (or whose
device struggles with it). **🗺 2D map / ⛰ 3D** in the trip bar (phones: the button strip)
switches between them in place: same day, same moment, same panels (scrubber, events, gallery,
reader, pins), same shareable URLs with `?view=2d` added. The choice is remembered per browser
(`localStorage`); a URL's `?view=` wins. The blog's day pages link to both.

- `src/lib/map/Map2D.svelte`: MapLibre GL over [OpenFreeMap](https://openfreemap.org) vector
  tiles (free, no key; attribution from the style). Draws every day's route (click one to open
  it), the active day's track (ridden part solid), the bike, national parks, photo clusters
  (click: gallery), stories, pins and day markers (the markers are real buttons: keyboard and
  screen-reader reachable). Follows the bike until you drag; "Follow the bike" brings it back.
  No tilt or rotation, on purpose.
- `src/lib/map/features.ts`: projected metres → lon/lat GeoJSON from the same privacy-filtered data.
- Each view is its own chunk (`Scene3D.svelte` / `Map2D.svelte`, loaded with dynamic
  `import()`), and the region's terrain backdrop only loads for 3D, so the 2D map never downloads the
  3D scene. MapLibre's worker is bundled via `?worker&url` + `setWorkerUrl`.
- Map tiles come from openfreemap.org, so viewers' browsers talk to that service; the base map
  covers everywhere (it's just a map), while the tour's own routes, photos and posts are the
  same privacy-filtered data as the 3D view.

## The globe

A third, artistic view, grown from the 3D view's detail bubble: the day's landscape as a round
diorama on a plinth, with the bike always at the centre while the land slides beneath it as the
day plays. **◍ Globe** in the trip bar (phones: the view button steps 3D → map → globe);
`?view=globe` in links.

- North never moves (the far side, as the globe first appears); you turn the globe by dragging,
  it never turns itself. Zoom, no pan, no looking from underneath.
- `DioramaTerrain.svelte`: a 20 m grid re-sampled as the bike drifts (day grid, then full-res
  Terrarium tiles, as in the detail bubble), cut to a circle that follows the bike exactly, with
  a wall of layered earth around the rim down to the plinth. The floor eases to the lowest ground
  in reach, so hills stand up out of the base. Pastel by height ("Plain") or the 3D view's
  imagery (satellite / Sentinel-2 / topo), elevation lines every 20 m (bold every 100 m).
- `sky.ts`: the real sun and moon positions for the bike's place and moment (suncalc-style
  formulas). They sit on an arc around the globe, set the light's direction and colour, and the
  sky gradient behind (night, blue hour, golden hour, day), greyed by cloud. The moon is lit by
  the sun, so it shows its phase.
- `GlobeWeather.svelte`: clouds from the recorded cover, drifting with the recorded wind; rain
  from the recorded precipitation (drizzle gets a floor), slanted by the wind.
- `GlobePins.svelte`: places, photos (round thumbnails, grouped when taken together) and stories
  grow in as they come over the rim and shrink away as they leave; only those inside can be
  clicked or tabbed to.
- `GlobeLabels.svelte`: OSM names (peaks with heights, lakes, towns, villages, hamlets; small
  localities only on small globes), fading in and out at the rim like the pins, at most 14 at
  once by importance.
- Size: 0.8–6 km from the bike to the rim (`settings.globeRadius`, kept across days). The globe
  stays the same size on screen (scene units `V`); the landscape is scaled to fit, so a bigger
  globe shows more land with flatter hills. A new size remounts what's cut to the circle; the
  floor eases to its new level.
- Buttons over the scene need `{@attach clickThroughControls}` (the orbit controls capture the
  pointer), and the globe pins' Threlte wrappers are click-through so shifted pins stay clickable.
- Surroundings (`GlobeHalo.svelte`, "Surroundings" switch): beyond the rim, as the 3D view shows
  beyond its detail bubble, faint elevation lines, the route, roads, rivers and park edges carry
  on at their real heights, with small non-interactive dots where the pins are, all fading out
  into the air (and away below the globe's floor, so nothing sits in front of the plinth).
- Map lines on the land (`GlobeLines.svelte`, shapes from `lines.ts`): OSM roads (white, by
  tier), rivers (blue) and national park edges (dashed green), each on its switch. A chip above
  the banner names the park the bike is in (`parkAt`).
- Route colour: Plain (terracotta) or the ride's data like the 3D view (speed as a relative
  shade only, lean, gradient), with a key; a darker edge keeps pale colours readable.
- The events list (drawer / ☰ sheet) works over the globe, restyled light; the pop-up place
  cards don't show there (the banner covers them; a place pin jumps the ride to its moment).
- Dual view: in the globe, a small map card in the corner (`MiniMap.svelte`, SVG: the day's
  route, the part ridden, the bike, north, a ring for the ground the globe covers); in the map, a
  small live globe (`MiniGlobe.svelte`: the globe scene in `mini` mode, its own chunk, following
  the ride the map plays). Each switches to the other view; shown only when both are released.
- No pop-ups anywhere: one quiet event banner (`GlobeBanner.svelte`) names the latest moment in
  every view (above the scrubber in 3D and the map); clicking a place pin jumps the ride there.
- Light: sky fill plus sun with a soft ceiling, so a clear midday sun (or weather switched off)
  can't wash the pastel land out.
- `RouteRibbon.svelte`: the route as a ribbon on the land, terracotta behind the bike and chalk
  ahead, re-draped on the landscape's own heights each re-sample.
- `Plinth.svelte`: engraved compass ring and the day's name and date lettered around the front.
- `GlobeBanner.svelte`: instead of the pop-up cards, one thin line above the play bar names the
  latest moment passed (set off, break, place, photos, story) with a small thumbnail at its end;
  each new one fades in in place. Photos and stories open on click.
- `GlobeUI.svelte`: deliberately small: play bar (play/pause, speed, time, weather, slider) and a
  settings card (surface, elevation lines, route, weather, places, photos, stories, relief).
- Own chunk (`Globe3D.svelte`); needs no region backdrop.
- Before a day is chosen (and while one loads): `GlobeOverview.svelte`, the same plinth with a
  flat meadow (fields, hedgerows, a country road) and the bike parked in the middle, beside the
  day list. The globe is the default view for new visitors (`DEFAULT_VIEW` in `flags.ts`).

## Music (now playing)

`npm run data:music` reads the Spotify listening history in `tours/<id>/spotify/` (git-ignored:
`StreamingHistory_music_*.json` from "Account data", or `Streaming_History_Audio_*.json` from the
extended history, which names tracks exactly) and writes `music.json`: plays of 30 s or more that
overlap a ride (times are UTC), none inside a privacy zone, each track matched on Spotify (ID and
a 64 px cover) by search with the app credentials in `.env.local` (`SPOTIFY_CLIENT_ID`,
`SPOTIFY_CLIENT_SECRET`, client-credentials only; the secret never leaves the build). Lookups are
cached in `tours/<id>/spotify/lookup.json` (`--retry` redoes misses); fix a wrong match in
`tours/<id>/spotify/overrides.json` (`{ "Artist|Track": "<track id>" | null }`).

The app shows the track playing at the ride's moment as a pill above the event banner
(`src/lib/ui/NowPlaying.svelte`). On phones and short screens (`COMPACT_QUERY` in `src/lib/ui.svelte.ts`)
there's no separate pill: the event banner keeps each event for 8 minutes of ride time, then shows
the song until the next event (`GlobeBanner`'s `music`). The Spotify parts (cover, "Spotify ↗" link, "▶ Listen" which
opens Spotify's embed player, 30 s previews unless the viewer is signed in to Spotify) degrade to
the plain names when (`src/lib/spotify.svelte.ts`):
- the `spotify` flag is off: `FEATURES="spotify=off" npm run deploy -- --prod` for an outage or a terms change
- the browser is offline
- Spotify doesn't answer: a cover that fails to load, and every "Listen", first asks Spotify's
  oEmbed endpoint about the track; a timeout, network error or 5xx marks Spotify down for the visit

The player never starts or changes by itself: Spotify's developer terms don't allow syncing
recordings to visual media, so the music is shown alongside the ride, not played to it.

## Stretches: sharing a bit of a ride

A stretch is part of one day's ride between two clock times (`src/lib/stretch.ts`): to send a
friend the road you'd recommend, or to write about a route.

- **Shared as a link**: `/day/2026-09-16?t=11:10&to=11:45&name=The+Honister+Pass` opens the tour
  with the stretch banded on the map (and on the globe's corner map), framed, and a card: its name,
  distance, climb, highest point and roads (no ride time: the tour shows no speeds), with ▶ Play it
  (plays from its start and stops at its end), ⬇ GPX (positions and heights, no times: for a satnav,
  Beeline, a Garmin…) and Share.
- **Chosen in the tour**: "✂ Share a stretch" (by "Share moment" in the 3D view and the map; ✂ in the
  globe's play bar): move to the start, "Start here", move on, "End here".
- **Named in pins.json**: a pin with an `end` is a named stretch (type `route`), e.g.
  `{ "title": "The Honister Pass Experience", "time": "2026-09-16 11:10", "end": "11:45" }`
  (`time` can be the tour's local time). It's in the day's events (tapping it opens the stretch) and
  the blog's day page links to it. Rebuild the day (`node scripts/build-track.mjs <day>`, then the feed).
- **In stories**: `![The Honister Pass Experience](map:2026-09-16T11:10-11:45)` is a map snapshot framed
  to the stretch, with its facts and a GPX button under it; `[Honister](tour:2026-09-16T11:10-11:45)`
  links to it in the tour. The editor's Map tab has "A stretch" (from, to, with a preview).

## Privacy zones

`tours/<id>/privacy.json` lists circles (town centre + radius) where nothing personal may appear:
`build-track` drops every GPS fix inside them before anything else (a ride through a zone
becomes separate pieces, never joined across it), `build-terrain` sizes the day grid from what's
left, pins inside a zone are dropped, and `build-photos` withholds (and deletes the resized copies
of) any photo taken inside a zone, judged from the *unfiltered* GPS at the moment it was taken.
Words count too: each zone has a `name`, and no place name is published within 8 km of a zone
(`PRIVACY_MARGIN` in `scripts/lib/geo.mjs`: `build-osm` drops those labels, `build-feed` gives no
"near …" there). Day titles are yours to keep clean (`tours/<id>/day-titles.json`: "Setting off",
"Journey's end"). `scripts/scrub-places.mjs` applies both rules to days built before them.

`npm run audit:privacy` (`scripts/audit-privacy.mjs`) checks every served position (tracks, route
rasters, pins, tour lines, photos, stray photo files, place labels near a zone) and every word
people read (day titles, the feed, pins, stories, place labels) for a zone's name; the deploy
refuses to run if it finds anything.

## Checks

- `npm run check`: types (also on GitHub, `.github/workflows/check.yml`, on every push).
- `npm run audit:privacy`: see above (needs the personal data, so local only; deploy runs it).
- `npm run test:smoke`: against a running site (`BASE=http://localhost:5199`): each released view
  loads and plays without errors or Content Security Policy blocks, the blog passes axe at WCAG 2.2
  AAA, unknown URLs get the friendly 404. Needs Chrome (`CHROME=` to point at it).

## Security and hosting

- `vercel.json`: `nosniff`, a strict referrer policy, no camera/microphone/location, HSTS, and
  no framing by other sites; long caching for photos, an hour for data.
- Content Security Policy (`vite.config.ts`, SvelteKit `csp` in hash mode): scripts only from the
  site itself (SvelteKit's inline start-up by hash), everything else only from the services the
  views use (`TILE_HOSTS`). A new map or imagery source must be added there.
- Deploys pin the Vercel CLI (`scripts/deploy.mjs`) and retry interrupted uploads.
- Memory on long sessions: the app keeps only the current day and its neighbours, and at most 64
  elevation tiles. The 2D map loads days light (no terrain, rasters or OSM: ~5 MB less a day) and
  only animates while playing; the region backdrop and parks are served gzipped.
- Third-party map terms to settle before a busy public launch: Esri World Imagery (an ArcGIS
  account for public apps), OpenTopoMap (not for use as an app's default map), EOX Sentinel-2
  2023 (CC BY-NC-SA: non-commercial, credited).

## Deploy

`npm run deploy` builds a **private Vercel preview** (Vercel login required to view): packs the day
files as `.gz` (275 MB -> 86 MB; the app decompresses them), runs the privacy audit, builds with
every page prerendered as static files, and uploads with `--prebuilt`. Uploads resume, so on a
flaky connection just re-run. `node scripts/deploy.mjs --prod` would publish publicly.
`TOUR=<id>` deploys another tour; only that tour's data and photos are uploaded.

**Publishing stories: `npm run release`** (`scripts/publish.mjs`). From "I've dropped a story into
`tours/<id>/blog/`" to live and in subscribers' inboxes:

1. commits changes in `tours/<id>/blog/` (a story's `published` date is its first commit),
2. builds the blog, its email images (starting the site briefly if a map snapshot needs drawing)
   and the events feed,
3. deploys to production (privacy audit first),
4. reads the live RSS feed back and creates a **draft** email in Buttondown for each story not
   emailed before (the feed's own copy of the story); check and send it in Buttondown.
   `tours/<id>/emails.json` (committed) records which stories have been emailed.

`-- --send` sends instead of drafting, `-- --no-email` leaves the mailing list alone, `-- --no-deploy`
only builds. Emails need `BUTTONDOWN_API_KEY` in `.env.local` (Buttondown → Settings → API; the API
is free, unlike Buttondown's own RSS-to-email). Nothing is pushed to GitHub. In Claude Code: `/release`.

## Customising the globe

The globe's "Customise" drawer (surface, route colour, what to show, surroundings, size, relief)
(and the vehicle's size) keeps its choices in the page's address, only where they differ from the defaults, so a refresh or
a shared link opens the globe the same way: `surface=satellite`, `route=plain`, `size=3000` (metres
to the rim; default 4000), `relief=1.5`, `vehicle=1.5`, `fog=1.4,3.5` (where the surroundings begin, with a crisp edge, and where the outer fog has closed in, in multiples of the radius; default 1.2,2.6), `halo=0`, `off=roads,labels`, `on=backdropPoints`
(`Settings.writeParams` / `readParams` in `src/lib/settings.svelte.ts`). "Reset to the defaults"
clears them.

## Release flags (phased release)

`src/lib/flags.ts` decides at build time which parts of the site exist, so features can launch
one at a time:

| Flag | What it switches |
| --- | --- |
| `blog` | the blog: `/blog` pages (not built; URLs 404) and every 📖 link to them |
| `map` | the 2D map view |
| `dx3d` | the 3D view |
| `globe` | the globe view |
| `photos` | photos everywhere: pins, gallery, pop-ups, the blog's photo events and pages |
| `stories` | blog posts everywhere: pins, reader, banner, story cards and pages |
| `weather` | recorded weather: readouts, rain, clouds, the blog's temperatures |
| `blogFilters` | the blog's filter and group panel |
| `newsletter` | the mailing list's sign-up forms (needs the tour config's `newsletter`) |
| `music` | the now-playing card (track names, from our own data); off = not fetched |
| `spotify` | Spotify on that card: cover, link, in-page player. Off = track names only (see Music) |

- Two sets in `flags.ts`: `preview` (dev and `npm run deploy`: everything on, for testing) and
  `production` (the release plan, used by `deploy --prod`). Launching a feature = flip it in the
  production set, deploy with `--prod`.
- One-off overrides: `FEATURES="globe=off,photos=on" npm run deploy` (also `-globe` / `+globe`).
  Unknown names fail the build. `vite.config.ts` injects `RELEASE` and `FEATURES` into the code.
- The views follow the flags everywhere: switchers show only views that are on, `?view=` and the
  remembered choice fall back to the default view (`DEFAULT_VIEW`: globe, then 3D, then map, whichever is on), and the blog names that view in its
  links ("See this moment in the 3D tour" / "…on the map"). With no view on, `/` goes to the blog
  and the blog's times are plain text.
- Photos, stories and weather are cut at the source (the app doesn't fetch them; the blog's data
  drops them), so every view follows without its own checks.
- These hide features; they don't make them secret (switched-off code can still be in a shared
  bundle, and the repo is public). Private previews stay the place for unreleased work.
- Speed figures keep their own levels in `src/lib/config.ts`.

## Multi-day architecture: phased resolution, one page per day

| Level | What | Loaded |
| --- | --- | --- |
| **L0 Region** | The region around the tour (`region/`; for the UK all of Great Britain at 1 km), every day's simplified route (`tour.json`) | Always: home page and backdrop |
| **L1 Day** | A day bundle (`static/data/tours/<id>/days/<date>/`): terrain grid, corridor, track, OSM, water, weather, pins. Grid spacing adapts to the day's size (25 m for the Lakes loop, 75 m for the 225 km run to Dunbar) | One day at a time; the next day is prefetched |
| **L2 Near bike** | Full-resolution Terrarium tiles streamed in the browser around the bike (`nearTerrain.ts`), feeding a fixed 25 m detail mesh | Continuously, around the rider |

- **One world:** everything is in the tour's projected metres (British National Grid for the UK, a transverse Mercator on the tour's centre elsewhere). Each day's data is stored relative to its own origin (whole km), and the world origin is the *active* day's origin, so the day renders untransformed with full float precision. The region layer and the other days' routes are offset against it.
- **Day transitions** (`app.svelte.ts`): climb to a point above both days, shift the world origin and the camera by the same amount (invisible), swap the day, fly back down. Driven by the URL: the trip bar, day markers, **Shift + ←/→** and auto-advance at the end of a day all just navigate.
- **Settings persist across days** (`settings.svelte.ts`); `Tour` is per-day playback and forwards them.
- **Grid north ≠ true north:** the projection's grid is rotated from Mercator by up to ~3°, so imagery UVs near the bike use a full affine map, and far UVs come from a 2 km lookup table rather than per-vertex projection.

## Data pipeline

```sh
npm run data                         # every day in tours/<id>/gpx/, then the tour index
node scripts/build-days.mjs 2026-09-18 2026-09-19   # just these days
npm run data:region                  # L0 backdrop around the tour (once; build-days runs it if missing)
npm run data:tour                    # rebuild tour.json from the built days
```

The Beeline export lives in `tours/<id>/gpx/` (git-ignored); files are grouped into days by their
date prefix, so a day with several rides (e.g. a breakfast run plus the main ride) becomes one
day with breaks between rides. Day titles come from the file names unless overridden in
`tours/<id>/day-titles.json`. Pins are authored once in `tours/<id>/pins.json` and assigned to days by time
or position.

| Script | Out |
| --- | --- |
| `init-tour.mjs <id>` | Scaffolds `tours/<id>/`; sets `region.centre` from the rides |
| `build-region.mjs` | `region/terrain.*`: the backdrop (for the UK: GB at 1 km from Terrarium z8, Ireland and the Continent masked as sea) |
| `build-terrain.mjs <day>` | `days/<day>/terrain.*`: adaptive-spacing grid around the day's rides |
| `build-track.mjs <day>` | `track.json` (draped on full-res tiles, stops, riding time, lean, ride breaks), `corridor.bin`, `pins.json` |
| `build-osm.mjs <day>` | `osm.json` + `water.bin`: Overpass queried in ~32 km chunks along the route (minor roads/hamlets within 1.5 km, main roads/towns/peaks/water within 8 km), each chunk cached |
| `build-weather.mjs <day>` | `weather.json` from Open-Meteo, every 10 min along the ride |
| `build-parks.mjs` | `parks.json` + `parks.bin`: the protected areas around the tour from OpenMapTiles z9 (for the UK the 15 national parks incl. the Broads, by name), rasterised at 200 m and traced into clean outlines, which tour days pass through each, and a mask on the backdrop grid for tinting |
| `build-tour.mjs` | `tour.json`: days, origins, extents, stats, simplified lines |
| `build-music.mjs` (`npm run data:music`) | `music.json`: the ride's plays from the Spotify history, with track IDs and covers (see Music) |
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
| Items without GPS (receipts, untagged photos) | Pins can carry `lat/lon` **or** just a `time`; time-only pins are snapped to the track position at that moment | `tours/<id>/pins.json`, `build-track.mjs` |
| Real road detail | OSM roads via Overpass at build time, draped as fat lines styled by class; place and peak labels that appear by camera distance (and fell height); the HUD shows the current road, speed limit and single-track status | `build-osm.mjs`, `Roads.svelte`, `PlaceLabels.svelte`, `Scrubber.svelte` |
| Water | OSM lakes/reservoirs (multipolygons included) rasterised at build time into an anti-aliased coverage mask on the height grid; used by all three terrain layers (shimmering sheets in the point cloud, a glassy surface with a glowing shoreline in the detail area, flat blue sheets in the terraces); rivers as draped lines; named lakes labelled | `build-osm.mjs` (`water.bin`), `HoloPoints`, `DetailBubble`, `Terraces`, `Rivers.svelte` |
| Map styles | Hologram / Satellite (Esri) / Sentinel-2 (EOX) / Topo (OpenTopoMap), fetched as XYZ tiles in the browser and stitched into canvas textures: a regional one (z12, exact per-vertex UVs) colours the point cloud and terraces; a sharp one (z14–15) follows the bike and drapes the detail area, falling back to the regional one while tiles load | `imagery.ts`, `HoloPoints`, `Terraces`, `DetailBubble` |
| Point cloud visibility | Size and glow sliders; alpha is scaled by sampling density so the dense route corridor glows without saturating under additive blending | `HoloPoints.svelte` |
| Historical weather | HUD (conditions, °C, wind arrow, rain), rain bars and a temperature trace on the scrubber, and rain streaks in 3D whose density follows precipitation (drizzle codes get a floor) and whose slant follows the recorded wind | `build-weather.mjs`, `Rain.svelte`, `Scrubber.svelte` |
| Camera | Follow (keeps your orbit offset), Chase (behind the bike, never under the terrain), Overview, Free, with fly-to transitions | `CameraRig.svelte` |

**Feature flags** live in `src/lib/config.ts` (hard-coded; change and rebuild). `FEATURES.speed`
sets how much riding speed the tour reveals:

| Level | Speed colouring | Figures (HUD readout, mph legend) |
| --- | --- | --- |
| 0 | no | no |
| **1 (default)** | yes, legend reads "slower → faster" | no |
| 2 | yes | yes |

This is a travelogue, and published speed figures could read as encouraging people to race these
roads. Note that the flag only controls the UI: playback timing and `track.json` still imply
speed, so strip or resample the data before publishing if that matters.

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

Built since the first POC: all 18 days with day-to-day flights, national parks layer, photos
(resized, placed by time, clustered pins + exact-spot dots, gallery, scrubber ticks, playback
pop-ups), the events drawer and timeline day list, rider-scoped terrain, screen-density point LOD,
privacy zones and a private deploy.

Still to do: fuel/food receipts as pins (`tours/<id>/pins.json`
supports `"type": "fuel"` etc.), exact photo positions from Google Takeout sidecars, videos,
blog content as Markdown files, a glTF bike model, and mobile performance tuning.
