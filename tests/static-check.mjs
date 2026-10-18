// Static checks only. A passing result does not prove the game plays correctly.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const required = [
  'index.html',
  'assets/css/styles.css',
  'assets/js/game.js',
  'assets/js/firebase.js',
  'archive/rhythm_game_v3_3_6_optimized.html',
];
for (const file of required) {
  if (!existsSync(resolve(root, file))) {
    throw new Error('Required file is missing: ' + file);
  }
}

const html = readFileSync(resolve(root, 'index.html'), 'utf8');
for (const path of ['assets/css/styles.css', 'assets/js/game.js', 'assets/js/firebase.js']) {
  if (!html.includes(path)) {
    throw new Error('index.html does not reference: ' + path);
  }
}
for (const id of ['gameCanvas', 'scoreDisplay', 'comboNum', 'pauseOverlay', 'resultScreen']) {
  if (!html.includes('id="' + id + '"') && !html.includes("id='" + id + "'")) {
    throw new Error('Missing game UI element: ' + id);
  }
}
console.log('Static checks passed (not a gameplay test).');
