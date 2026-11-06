# Virtual World

A tiny surreal 3D world in the browser. You walk a little robot across a Dalí-style desert where clocks melt over branches and rooftops, elephants stride by on spider legs, and three strange buildings stand on the sand. Sit on the melting bench and the world slides into a psychedelic trip: kaleidoscope sky, a giant eye, rainbow mandala ground, floating eyes and shimmering music. Stand up and it fades back.

## Run it

It's a static site with no build step, but it has to be served over HTTP (ES modules don't load from `file://`):

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Works on desktop browsers and phones.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | walk |
| Shift | run |
| Mouse (click to lock) / drag | look around |
| Scroll | zoom |
| E | sit on / stand up from the bench |
| Q | dance |
| M | sound on/off |
| P | oil-paint filter on/off |
| Esc | release the mouse |

On a phone or tablet the game switches to touch controls automatically: drag with your left thumb to walk (push to the edge to run), drag on the right side to look, pinch to zoom, and use the **Sit / Stand**, **Dance** and **♪** buttons. Graphics are lightened a little on phones to keep it smooth.

`?trip=0.5` (or any value 0–1) in the URL forces the trip level, which is handy for testing visuals.

## What's where

- `src/world.js`: sky shader, desert, glassy sea, cliffs, lighting, the ledge with the dead tree, spider elephants
- `src/buildings.js`: Drawer Tower, Clock House, Flesh Bloom, the bench
- `src/clocks.js`: melting clock builder (bent geometry, hands that run backwards)
- `src/player.js`: robot loading, animation states, movement, collision, sitting
- `src/camera.js`: third-person orbit camera
- `src/touch.js`: phone controls (joystick, look, pinch zoom, buttons)
- `src/trip.js`: trip curve, floating eyes, post-processing (oil paint, bloom, kaleidoscope/chromatic shader)
- `src/audio.js`: generative Web Audio soundscape
- `src/shared.js`: noise, the shader patch that makes every material react to the trip, helpers

## Credits

- [three.js](https://threejs.org) r160 (MIT), vendored in `lib/three/`
- "RobotExpressive" model by Tomás Laulhé (Quaternius), modifications by Don McCurdy, CC0, from the three.js examples
- Everything else (geometry, shaders, textures, sound) is generated in code.
