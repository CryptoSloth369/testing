// Builds a self-contained copy of the game for publishing as a claude.ai artifact.
// Artifacts can't serve .glb files or fetch data: URLs, so the robot model is embedded
// as base64 in assets/robot.js and parsed in memory instead of loaded over the network.
//
//   node tools/build-artifact.mjs [outDir]      (default: dist-artifact/)

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'dist-artifact'));

fs.rmSync(out, { recursive: true, force: true });
for (const item of ['index.html', 'lib', 'src']) fs.cpSync(path.join(root, item), path.join(out, item), { recursive: true });
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });

const b64 = fs.readFileSync(path.join(root, 'assets/RobotExpressive.glb')).toString('base64');
fs.writeFileSync(path.join(out, 'assets/robot.js'), `export default "${b64}";\n`);

const playerPath = path.join(out, 'src/player.js');
const original = fs.readFileSync(playerPath, 'utf8');
const load = `    new GLTFLoader().load('assets/RobotExpressive.glb', (gltf) => resolve(new Player(scene, gltf)),
      (e) => onProgress && e.total && onProgress(e.loaded / e.total), reject);`;
if (!original.includes(load)) throw new Error('player.js load call changed; update tools/build-artifact.mjs');
fs.writeFileSync(playerPath, original.replace(load, `    // Embedded model, parsed in memory (no network request).
    import('../assets/robot.js').then(({ default: b64 }) => {
      const bin = atob(b64), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      onProgress && onProgress(1);
      new GLTFLoader().parse(bytes.buffer, '', (gltf) => resolve(new Player(scene, gltf)), reject);
    }, reject);`));

console.log(`Artifact build written to ${out}`);
