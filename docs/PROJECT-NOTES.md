# Virtual World: project notes

Everything from the first build session (Nov 5–6, 2026), so the work can be picked up later without the original chat. The code in this repo is the source of truth; this file holds the decisions, references and open questions that aren't in the code.

**Goal (Davied):** a mini 3D world to test with now (3 buildings, a bench, a controllable person who can sit), in a surrealist, hallucinogenic style. Later, a full virtual world for the **Mystic Sloth** oracle-card website (repo `CryptoSloth369/mystic-sloth`).

## Where things are

| What | Where |
| --- | --- |
| Code | `CryptoSloth369/testing`, branch `main` |
| Playable link (private claude.ai artifact) | https://claude.ai/artifact/8RdtuLjrszcq9Ms3D78cyu |
| GitHub Pages (if enabled from `main`) | https://cryptosloth369.github.io/testing/ (never verified; the cloud session couldn't reach github.io) |
| Run locally | `python3 -m http.server 8000` in the repo, open http://localhost:8000 |

The artifact link lives in your claude.ai artifact gallery, not in the chat, so it should keep working if the chat is deleted. If it ever disappears, rebuild it (see "Publishing the artifact" below).

## What was built, in order

1. **Repo set up:** `testing` was empty; added a README containing "start".
2. **Plan agreed:** Three.js in the browser, no game engine, no build step. Free CC0 robot model with ready-made animations. Desktop first.
3. **First build ("Soft Hours", renamed "Virtual World"):** Dalí desert, 3 buildings, bench, robot, trip effects, generative sound. Merged to `main`.
4. **Phone controls:** floating joystick, drag to look, pinch to zoom, Sit/Stand, Dance and sound buttons; lighter graphics on phones.
5. **Artifact link fixes:** the viewer can't serve `.glb` files or fetch `data:` URLs, so the artifact copy embeds the model and parses it in memory (`tools/build-artifact.mjs`).
6. **Black screen when sitting on iPhone:** hardened the trip shaders (see Open issues). **Fix not yet confirmed on a real iPhone.**

## Art direction

The idea: two moods in one world. Walking around is a calm **Dalí dreamscape**; **sitting on the bench starts a trip** into the neon, fractal, "visionary art" style, which spreads outward from the bench like a wave. Standing up fades it back.

**Reference images Davied shared** (not stored in the repo because they're other artists' copyrighted work; Davied has the originals):
1. Salvador Dalí, *The Persistence of Memory*: ochre plain, teal-to-gold sky, cliffs on a glassy sea, melting clocks on a branch and a ledge, ants on an orange watch.
2. Salvador Dalí, *The Burning Giraffe*: a figure with drawers opening out of its body, soft forms held up by crutches, blue sky.
3. A swirling pastel paint mass on black (pink, cream, lavender, yellow, blue strands) with small flowers on stems.
4. A psychedelic illustration: a cobra, two green aliens, a shaman with a cauldron.
5. Visionary fractal art: a rainbow mandala around an alien face, eyes everywhere, a hand with an eye.

How they became the world (all original pieces, nothing copied from the paintings):
- **Calm world** (images 1–2): flat ochre desert, teal/gold gradient sky, low sun and long shadows, glassy sea with a cliff headland, a dark ledge with a dead tree, melting clocks whose hands run backwards, an orange watch with ants, two elephants on spider legs walking the horizon. An oil-paint (Kuwahara) filter plus vignette and grain give a painted look.
- **Drawer Tower** (image 2): tall green figure-like tower, 7 drawers sliding in and out, soft arms and a tongue propped on crutches, a burning head.
- **Clock House** (image 1): leaning house with a roof melting over the walls in drips, a melting wall clock, clocks sliding off the roof, a bent chimney.
- **Flesh Bloom** (image 3): lumpy swirling pastel blob on a stalk, flower tendrils, two spiral horns, a dark red-glowing mouth as its door.
- **Bench:** left end melts down onto a small crutch, tiny clock draped over the armrest. The sitter faces the sea.
- **The trip** (images 4–5): kaleidoscope mandala sky with a giant blinking eye over the sea, rainbow mandala floor spreading from the bench, every surface shifting through rainbow colors, eyes opening on the buildings and floating in the air (all looking at the player), bloom, chromatic fringing, ripples and a kaleidoscope border, hue rotation, and the music opens up with a shimmering chord and bells.

## How the code is organised

Plain ES modules, loaded through an import map in `index.html`. Three.js r160 is vendored in `lib/three/` (only the files used).

- `src/main.js`: renderer, game loop, keyboard input, UI, wiring. `window.__dream` exposes internals for testing.
- `src/shared.js`: shared uniforms (`uTime`, `uTrip`, `uCenter`), noise (JS and GLSL), `tripify()` which patches any standard material so it reacts to the trip (modes `surface`, `swirl`, `ground`), geometry helpers, canvas textures (clock face, hands, eye, ants).
- `src/world.js`: sky shader (calm sky + trip mandala + giant eye), ground, sea (translucent, with a mirrored cliff underneath as a fake reflection), cliffs, lights, fog, the ledge/tree/clocks, stones, elephants.
- `src/buildings.js`: Drawer Tower, Clock House, Flesh Bloom, bench, and their colliders and eye positions.
- `src/clocks.js`: melting clocks (flat clock built from subdivided parts, bent with a "drape over an edge" function).
- `src/player.js`: loads the robot, animation states (Idle, Walking, Running, Sitting, Standing, Dance), camera-relative movement, circle/box collision, world boundary, sitting sequence.
- `src/camera.js`: third-person orbit camera (pointer lock or drag, wheel or pinch zoom, gentle drift while seated).
- `src/trip.js`: trip curve (~5 s up, ~6 s down), floating eyes, post-processing (oil paint → bloom → trip shader → output).
- `src/touch.js`: phone controls.
- `src/audio.js`: generative Web Audio (drone, wind, trip pad, bells). No audio files.

Layout (x, z; sea starts at z = -72): spawn (0, 8) · bench (0, -16) · Drawer Tower (-22, -30) · Clock House (25, -28) · Flesh Bloom (-32, 6) · ledge with tree (17, 4). The robot is scaled to 0.5 (about 2 units tall); the bench seat height (0.37) matches the robot's Sitting pose.

Controls: WASD/arrows walk, Shift run, mouse look, scroll zoom, E sit/stand, Q dance, M sound, P paint filter. On phones: left thumb joystick (push to the edge to run), right thumb look, pinch zoom, buttons. `?trip=0.5` (0–1) in the URL forces the trip level for testing.

Credits: three.js (MIT); "RobotExpressive" by Tomás Laulhé (Quaternius), modifications by Don McCurdy, CC0. Everything else is generated in code.

## Testing and publishing

- **Smoke test:** `node tools/smoke-test.cjs` (desktop) or `node tools/smoke-test.cjs phone`. It walks, sits, forces the trip and saves screenshots to `test-shots/`. It uses headless Chromium with software rendering (about 1 frame per second), so it checks behaviour, not smoothness. Real-device speed has never been measured.
- **Publishing the artifact:** run `node tools/build-artifact.mjs`, then publish `dist-artifact/index.html` with every file under `dist-artifact/` (`assets/robot.js`, `lib/…`, `src/…`) to the same artifact URL above. Test the build first with `ROOT=dist-artifact node tools/smoke-test.cjs phone`; the test server sends the same `connect-src` restriction the viewer uses.
- **Git workflow used so far:** work on a branch, push it, fast-forward `main`, push `main`.

## Open issues and ideas

- **iPhone black screen when sitting (unconfirmed fix).** The suspected cause is invalid pixels (NaN or negative colors from `atan(0,0)`, `pow()` of negatives, and the hue rotation), which the bloom pass spreads across the whole screen. The shaders were hardened, and bad pixels are now dropped before bloom. If it's still black: if the "ran out of graphics memory" message appears, lighten the trip on phones; if it's plain black, make a simpler iPhone mode with bloom and the paint filter off.
- **GitHub Pages:** enable it under Settings → Pages → Deploy from branch → `main`. Not verified.
- **The cloud session's `gh` login was invalid**, so GitHub settings (Pages, repo rename) had to be done by hand. Git push worked.
- **Visual polish:** the Flesh Bloom swirl is blotchier than reference image 3 (it should be long flowing strands), and the desert ground is plain.
- **Repo name** is still `testing`; renaming it changes the Pages address.

## Mystic Sloth: what readings look like (from the `mystic-sloth` repo)

`mystic-sloth` is a Next.js 16 + Supabase site (Vercel; Stripe for LZY packs; Claude for readings; OpenAI for card-art drafts; Resend for email). At the time it had sign-up/sign-in, the welcome gift, the Deck page and the 28 card pages. **Readings weren't built yet** ("Readings open soon").

What the database (`supabase/migrations/20261104000000_foundation.sql`) says about readings:
- **Modes:** `standard` and `deep`. New sign-ups are meant to go straight into a deep reading.
- **Draw:** `ai` (Claude chooses the cards) or `random` (dealt cards are stored so they can't be redrawn).
- **Inputs:** a question, context, and a **tension**. There's an "Is that it?" tension-check step (setting `tension_check_enabled`, on by default).
- **After the reading:** a follow-up conversation with a limited number of messages (`messages_left`), then feedback: "Did the tension feel true?" (yes / partly / no, plus a note).
- **Cost:** in LZY (ledger with reserve/spend/release). Sign-up gives 7 LZY and the whole Original Deck.
- **Deck:** the Original Deck has 28 cards in sections (e.g. "cross"). Each section has an element, tense, figure, hand, card back and its own **spread** (name, description, how to use). Each card has art, a tension line, card text, closing questions and related cards. Only public, confirmed, released cards (`live_cards`) appear in readings.

Still unknown (these live in documents outside the repo: the Launch Roadmap, the Build Brief, the Beta Handoff, and the deck pack `original-deck.json`): the step-by-step reading flow, the reading engine's prompts, what standard vs deep include and cost, and how spread positions are used.

Ideas discussed for bringing readings into the world:
- The bench is where you ask your question; the trip's build-up is the draw.
- Cards rise out of the trip effects and land in the spread's positions, then turn over to show their meaning.
- Buildings stand for sections or reading types (e.g. the Drawer Tower's drawers open to reveal cards for a deep reading).

## Picking this up again

Start a new Claude Code session with the `testing` repo (and `mystic-sloth` if the work touches the site) and say something like:

> Read `docs/PROJECT-NOTES.md` in the testing repo. I want to start building the full virtual world for Mystic Sloth.

Have ready: the Launch Roadmap / Build Brief / Beta Handoff and the deck pack, how a reading should feel, and whether the world should live inside the Mystic Sloth site or as its own page.
