# Platformer Visual Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the browser-facing Canvas presentation for the 8-bit platformer by consuming the existing pure game core in `src/core/engine.js`.

**Architecture:** The frontend owns `index.html` and visual/audio presentation only. It imports or otherwise embeds the existing core API, translates keyboard events into canonical input, calls `game.step(input)` on a fixed animation loop, and renders `game.snapshot()` to Canvas. The frontend must not reimplement physics, tile collision, enemy rules, power-up rules, scoring, timer, lives, or level data.

**Tech Stack:** Plain HTML, CSS, JavaScript modules, Canvas 2D, Web Audio API, existing `src/core/engine.js`, existing Node test suite.

---

## Ownership Boundary

Backend/core already exists:

- `src/core/engine.js`
- `tests/core.test.js`
- `package.json`

Frontend visual Agent owns:

- Create: `index.html`
- Optional create: `tests/visual-smoke.test.js`
- Optional modify: `package.json` to add a visual smoke test script
- Do not rewrite: `src/core/engine.js`

If frontend work exposes a missing core capability, add a failing test in `tests/core.test.js` first and request a core change instead of duplicating logic in the renderer.

## Core API To Consume

Import shape:

```js
import { FORMS, MODES, TILE, createGame } from './src/core/engine.js';
```

Core usage:

```js
const game = createGame();
const input = { left: false, right: false, jump: false, runFire: false, start: false };

function frame() {
  const state = game.step(input);
  render(state);
  input.start = false;
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

Snapshot fields the renderer can rely on:

```js
{
  mode,
  score,
  coins,
  lives,
  timeRemaining,
  player,
  level: {
    width,
    height,
    tileSize,
    tileCounts,
    objects
  },
  entities: {
    enemies,
    powerups,
    projectiles,
    particles
  },
  events
}
```

Available direct helpers for frontend convenience:

```js
game.start();
game.step(input);
game.snapshot();
game.fireProjectile();
game.getTile(tx, ty);
game.isSolidAt(tx, ty);
```

## Visual Rules

Use original 8-bit homage visuals. Do not copy Nintendo sprites, exact Mario silhouette, Goomba/Koopa silhouettes, SMB 1-1 layout, logos, music, or sound effects.

Canvas:

- Logical resolution: `256x240`.
- Tile size: consume `state.level.tileSize`, currently `16`.
- CSS: scale responsively with `image-rendering: pixelated`.
- Camera: horizontal follow, clamp from `0` to `level.width * tileSize - 256`.

Palette:

- Sky: `#5c94fc`
- Ground body: `#c84c0c`
- Ground top: `#f8d878`
- Brick: `#b85c20`, edge `#783410`
- Question block: `#f8d878`, punctuation `#783410`
- Used block: `#9c6b3c`
- Pipe: `#00a800`, shade `#007800`
- Player coral/red accent: `#d82800`
- Player dark clothing: `#203050`
- Enemy dark brown: `#6b3a1f`
- Projectile bright accent: `#ffe066`

## Task 1: Create Canvas Shell And Core Integration

**Files:**

- Create: `index.html`

- [ ] Create a single-page game shell with a centered Canvas and no landing-page content.

```html
<canvas id="game" width="256" height="240" aria-label="8-bit platformer game"></canvas>
```

- [ ] Add CSS that keeps the Canvas crisp and responsive.

```css
canvas {
  width: min(100vw, calc(100vh * 256 / 240));
  height: auto;
  max-height: 100vh;
  image-rendering: pixelated;
  background: #5c94fc;
}
```

- [ ] Import the core and start the render loop.

```js
import { MODES, TILE, createGame } from './src/core/engine.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const game = createGame();
let latestState = game.snapshot();

function tick() {
  latestState = game.step(readInput());
  render(latestState);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
```

- [ ] Run `npm test` after creating `index.html`; existing core tests must still pass.

Acceptance checks:

- Opening `index.html` shows a Canvas.
- Console has no import error.
- `npm test` still passes.

## Task 2: Implement Keyboard Input Adapter

**Files:**

- Modify: `index.html`

- [ ] Track keyboard state in the frontend and map both supported schemes to the core input object.

```js
const keys = new Set();

window.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  keys.add(event.code);
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});

function readInput() {
  return {
    left: keys.has('ArrowLeft') || keys.has('KeyA'),
    right: keys.has('ArrowRight') || keys.has('KeyD'),
    jump: keys.has('KeyZ') || keys.has('Space'),
    runFire: keys.has('KeyX') || keys.has('ShiftLeft') || keys.has('ShiftRight'),
    start: keys.has('Enter'),
  };
}
```

- [ ] When `runFire` is pressed while the player is charged, call `game.fireProjectile()` on press edge only, not every frame.
- [ ] Clear one-frame start/fire edge state after each loop.

Acceptance checks:

- Arrow keys and `A/D` move through the core.
- `Z` and `Space` jump through the core.
- `X` and `Shift` trigger run input and charged firing.
- `Enter` starts from title.

## Task 3: Render Level Tiles And Camera

**Files:**

- Modify: `index.html`

- [ ] Implement camera from player position.

```js
function cameraX(state) {
  const max = state.level.width * state.level.tileSize - canvas.width;
  return Math.max(0, Math.min(max, state.player.x - 96));
}
```

- [ ] Render sky, simple clouds/hills, then visible tiles only.
- [ ] Use `game.getTile(tx, ty)` for tile lookup.
- [ ] Draw each `TILE` ID with original pixel-block Canvas primitives.
- [ ] Keep flagpole tiles non-solid and visually readable near the finish.

Acceptance checks:

- Scrolling starts after the player moves right.
- Ground, question blocks, bricks, pipes, stairs, and flagpole are visibly distinct.
- No copied sprite sheet or external image file is used.

## Task 4: Render Player, Enemies, Powerups, And Projectiles

**Files:**

- Modify: `index.html`

- [ ] Draw the player from `state.player`, including `small`, `large`, and `charged` forms.
- [ ] Use original silhouette rules: red/coral accent, dark workwear-like body language, no Mario-specific face, mustache, exact cap logo, or copied proportions.
- [ ] Draw enemies from `state.entities.enemies`, skipping or flattening defeated enemies.
- [ ] Draw powerups from `state.entities.powerups` as original sprout, bolt, gem, or starfruit-like icons.
- [ ] Draw projectiles from `state.entities.projectiles` as bright small pixel shots.
- [ ] Use `state.frame` or local animation time for 2 to 4 frame walk/bob effects.

Acceptance checks:

- Every entity from the core snapshot has a visible representation.
- Player form changes are obvious.
- Enemy silhouettes do not resemble Goomba or Koopa.

## Task 5: Render HUD And State Overlays

**Files:**

- Modify: `index.html`

- [ ] Draw HUD inside Canvas top row: score, coins, world label, time, lives.
- [ ] Use `state.mode` to show compact overlays for title, level clear, and game over.
- [ ] Keep instructions only on the title overlay.
- [ ] Do not place the game in a decorative card or landing page layout.

HUD content:

```text
SCORE 000000  COINS 00  WORLD 1-1  TIME 400  LIVES 3
```

Acceptance checks:

- HUD updates after coins, enemy defeats, damage, death, and clear.
- Text fits within 256px logical width.
- The playable game is the first viewport signal.

## Task 6: Add Original Audio And Event Feedback

**Files:**

- Modify: `index.html`

- [ ] Create a small Web Audio helper that initializes only after the first user interaction.
- [ ] Use `state.events` to trigger short original sounds for jump, coin, powerup, stomp, hurt, projectile, death, and level clear.
- [ ] Use oscillator and gain envelopes only; do not import audio files.
- [ ] Add visual feedback for `state.events`: small floating score labels, coin sparkle, block bump, subtle hurt flash.

Acceptance checks:

- No autoplay errors appear after first input.
- Effects are original and short.
- Feedback never blocks controls or obscures the player.

## Task 7: Visual Smoke Test And Manual QA

**Files:**

- Optional create: `tests/visual-smoke.test.js`
- Optional modify: `package.json`

- [ ] Add a smoke test only if the environment can run browser tests reliably.
- [ ] The smoke test should open `index.html`, press `Enter`, hold right, press jump, and assert the Canvas has non-sky pixels.
- [ ] Always run the existing core tests:

```powershell
npm test
```

- [ ] Manually open `index.html` and play from start to flag.

Manual checklist:

- [ ] Title starts with `Enter`.
- [ ] Arrow keys and `A/D` move.
- [ ] `Z` and `Space` jump.
- [ ] `X` and `Shift` run; charged form fires once per press.
- [ ] Question blocks visually change to used blocks.
- [ ] Growth and charged forms are visually distinct.
- [ ] Stomp, hurt, death, game over, and level clear are visible.
- [ ] No protected art, logo, exact sprite, exact map, or original audio is used.

Acceptance checks:

- Core tests pass.
- Direct browser opening works or the final report states the exact browser limitation.
- Visual implementation consumes `src/core/engine.js` rather than replacing it.
