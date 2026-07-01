# 8-bit Platformer Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-playable, single-file 8-bit side-scrolling platformer that evokes a classic first-stage platform game while using original art, characters, level layout, and audio.

**Architecture:** Implement one self-contained `index.html` with Canvas rendering, fixed-step game logic, tile-based collision, entity updates, a generated original pixel-art visual layer, and a lightweight test hook exposed as `window.__gameTest`. Keep player-facing runtime dependency-free; optional Playwright smoke tests may live outside the shipped HTML for verification.

**Tech Stack:** Plain HTML, CSS, JavaScript, Canvas 2D, Web Audio API, optional Playwright for automated smoke testing.

---

## Source Spec

Primary design spec: `docs/superpowers/specs/2026-07-01-8bit-platformer-design.md`

This handoff plan is for another Agent to execute. Do not copy Nintendo, Super Mario Bros., Mario, Goomba, Koopa, exact SMB 1-1 map layout, original sound effects, sprites, logos, or trademarks. The target is faithful mechanics and 8-bit platforming feel using original content.

## Files To Create Or Modify

- Create: `index.html`
  - Single player-facing artifact.
  - Contains markup, style, Canvas, JavaScript modules-as-sections, generated pixel art, Web Audio sounds, level data, game loop, and test API.
- Create: `tests/smoke.spec.mjs`
  - Optional automated browser smoke test for the implementing Agent.
  - Opens `index.html`, verifies Canvas rendering, keyboard movement, jump response, restart flow, and test API availability.
- Create: `package.json`
  - Optional dev-only test script. Do not make the game require `npm` to run.
- Modify: `.gitignore`
  - Keep `.superpowers/` ignored.
  - Add Playwright reports or transient test output if generated.
- Modify: `docs/superpowers/specs/2026-07-01-8bit-platformer-design.md`
  - Only if implementation reveals a necessary scope correction. Record the reason in the commit message.

## Visual Direction

Use the approved visual option A: classic 8-bit homage.

Canvas and scale:

- Logical resolution: `256x240`.
- Tile size: `16x16`.
- CSS display: scale to fit viewport with `image-rendering: pixelated`.
- Camera: horizontal side-scroll with the player near the left-middle third once moving.

Palette:

- Sky: saturated blue, near `#5c94fc`.
- Ground top: warm sand, near `#f8d878`.
- Ground body: reddish brown, near `#c84c0c`.
- Brick: orange-brown with darker pixel edges.
- Question block: golden yellow with dark brown punctuation.
- Pipe: saturated green with darker green lip and side shade.
- Player: original red/coral cap-like head accent, dark overalls, warm face tone.
- Enemy: original squat dark-brown or charcoal creature shape, not a Goomba silhouette.
- Power-up: original sprout, bolt, starfruit, or gem-like object; avoid mushroom/fire-flower copies.

Sprite principles:

- Draw all sprites with Canvas primitives or small pixel matrices.
- Keep outlines chunky and readable at 16px scale.
- Use 2 to 4 animation frames for walking, enemy movement, block bump, coin spin, power-up bob, flag clear.
- Do not import image files.

HUD:

- Top row with score, coins, world label, time, and lives.
- Use monospace pixel-like styling via CSS; no external font dependency.
- Keep HUD visible and not inside a decorative card.

## Gameplay Contract

Controls:

- Left/right: `ArrowLeft`, `ArrowRight`, `A`, `D`.
- Jump: `Z`, `Space`.
- Run/fire: `X`, `Shift`.
- Start/restart: `Enter`.

Player states:

- `small`: one hit causes death.
- `large`: one hit downgrades to `small` and grants brief invulnerability.
- `charged`: upgraded state that can fire an original short-range projectile; one hit downgrades to `large`.

Core mechanics:

- Horizontal acceleration and friction.
- Run key increases max speed and acceleration.
- Variable jump height through early jump release.
- Coyote time and jump buffering for browser input comfort.
- Stomp enemies from above and bounce.
- Side collision with enemy causes hurt or death.
- Hit blocks from below.
- Question blocks emit coins or power-ups once, then become used blocks.
- Large player can break selected brick blocks from below.
- Projectiles defeat enemies and disappear on tile collision.
- Flagpole finish triggers clear state and score conversion from remaining time.

Game states:

- `title`
- `playing`
- `dying`
- `levelClear`
- `gameOver`

## Level Design Contract

Create one original stage, approximately 180 to 220 tiles wide.

Required sections:

- Safe start area with flat ground.
- First enemy on flat terrain after the player has room to move.
- First question block cluster with coins.
- First power-up block before the first meaningful danger spike.
- One short pipe obstacle.
- One optional pipe-like raised platform that cannot be entered unless the implementing Agent explicitly adds a small bonus room.
- A small gap section that teaches jump commitment without being punishing.
- A brick/question-block mixed section with at least one hidden or elevated reward.
- A second enemy grouping where running and jumping both work.
- Stair-step approach near the end.
- Flagpole and short automatic walk-off or clear pose.

Do not reproduce SMB 1-1 tile positions. Use the classic grammar, not the exact map.

## Implementation Tasks

### Task 1: Create The Runtime Skeleton

**Files:**

- Create: `index.html`
- Create: `tests/smoke.spec.mjs`
- Create: `package.json`

- [ ] Add a single HTML file with a Canvas element, basic CSS reset, pixelated scaling, and an overlay for title/game-over text.
- [ ] Define a JavaScript namespace object such as `Game` to avoid leaking many globals.
- [ ] Define constants for logical resolution, tile size, gravity, movement speeds, and fixed timestep.
- [ ] Create the main loop using `requestAnimationFrame` with an accumulator for fixed-step updates.
- [ ] Expose `window.__gameTest` with read-only helpers: `getState()`, `getPlayer()`, `setPlayerPosition(x, y)`, `press(action, frames)`, `forceState(state)`, and `sampleCanvasPixel(x, y)`.
- [ ] Write a smoke test that opens `index.html` by `file://` URL, verifies Canvas exists, verifies the initial state is `title`, presses `Enter`, and verifies state becomes `playing`.
- [ ] Commit: `feat: add platformer runtime skeleton`

Acceptance checks:

- Opening `index.html` shows a nonblank title screen.
- Pressing `Enter` starts the game.
- `window.__gameTest.getState().mode` returns a concrete state object.

### Task 2: Implement Input Mapping

**Files:**

- Modify: `index.html`
- Modify: `tests/smoke.spec.mjs`

- [ ] Implement keydown/keyup tracking with `down`, `pressed`, and `released` semantics.
- [ ] Map both control schemes to canonical actions: `left`, `right`, `jump`, `runFire`, `start`.
- [ ] Prevent default browser scrolling for Space and arrow keys while the game has focus.
- [ ] Add a smoke test that starts the game, holds right for several frames through `page.keyboard.down('ArrowRight')`, and verifies the test API reports positive horizontal intent or player movement.
- [ ] Commit: `feat: add platformer input mapping`

Acceptance checks:

- Arrow keys and `A/D` both move.
- `Z` and `Space` both jump.
- `X` and `Shift` both activate run/fire.
- Holding keys behaves differently from a single tap.

### Task 3: Build Tile Map And Collision Metadata

**Files:**

- Modify: `index.html`
- Modify: `tests/smoke.spec.mjs`

- [ ] Define tile IDs for empty, ground, ground-top, brick, question, used, pipe-left, pipe-right, pipe-top-left, pipe-top-right, stair, flagpole, and flag-top.
- [ ] Store tile metadata in a table: `solid`, `bumpable`, `breakable`, `questionContent`, `visualKind`.
- [ ] Create a level object with `width`, `height`, `spawn`, `timeLimit`, `tiles`, and `objects`.
- [ ] Build helper functions: `tileAt(tx, ty)`, `setTile(tx, ty, id)`, `isSolidAt(tx, ty)`, `worldToTile(value)`, and `forEachOverlappingTile(rect, callback)`.
- [ ] Add a test API helper that returns level dimensions and tile metadata for verification.
- [ ] Add a smoke test that verifies the level width is at least 180 tiles and all required tile IDs are present.
- [ ] Commit: `feat: add tile map metadata`

Acceptance checks:

- Level loads deterministically.
- Solid and non-solid tile behavior is inspectable.
- The map contains ground, question blocks, bricks, pipes, stairs, and flagpole tiles.

### Task 4: Implement Physics And Player Movement

**Files:**

- Modify: `index.html`
- Modify: `tests/smoke.spec.mjs`

- [ ] Implement AABB collision helpers.
- [ ] Implement horizontal movement with acceleration, max speed, run modifier, and friction.
- [ ] Implement vertical movement with gravity, terminal velocity, jump velocity, variable jump cutoff, coyote time, and jump buffer.
- [ ] Resolve horizontal and vertical tile collisions separately to prevent tunneling at normal speeds.
- [ ] Add player fields: `x`, `y`, `vx`, `vy`, `width`, `height`, `facing`, `grounded`, `form`, `invulnTimer`, `dead`.
- [ ] Add tests that verify: player falls onto ground, player moves right when right is held, player y-position decreases shortly after jump, and player does not pass through a solid tile.
- [ ] Commit: `feat: add player physics`

Acceptance checks:

- Movement has inertia, not instant start/stop.
- Jump height changes when jump is released early.
- Player lands cleanly on ground and does not jitter through tiles.

### Task 5: Add Camera And Core Rendering

**Files:**

- Modify: `index.html`
- Modify: `tests/smoke.spec.mjs`

- [ ] Implement camera tracking based on player position with left clamp and level-end clamp.
- [ ] Render sky, distant hills or clouds, tile map, player, and HUD in correct order.
- [ ] Render with crisp pixel edges by disabling image smoothing.
- [ ] Add simple player animation frames for idle, run, jump, large, charged, hurt flicker.
- [ ] Add a smoke test that samples Canvas pixels from sky and ground areas and verifies they differ.
- [ ] Commit: `feat: render pixel platformer scene`

Acceptance checks:

- Canvas is nonblank.
- Player remains visible while moving right.
- Camera scrolls horizontally and does not show outside level bounds.

### Task 6: Implement Blocks, Coins, And Power-Ups

**Files:**

- Modify: `index.html`
- Modify: `tests/smoke.spec.mjs`

- [ ] Detect upward player collision with bumpable tiles.
- [ ] Convert question blocks to used blocks after activation.
- [ ] Spawn coin particles and increment coin count/score.
- [ ] Spawn original growth power-up from selected question blocks.
- [ ] Spawn original charged-state power-up from one later block if the player is already large.
- [ ] Implement power-up movement: emerges upward, then moves horizontally, reverses on solid collision, falls with gravity.
- [ ] Implement player collection: small to large, large to charged, charged reward score if already charged.
- [ ] Add tests for question block conversion, coin increment, and player form upgrade.
- [ ] Commit: `feat: add interactive blocks and powerups`

Acceptance checks:

- Question blocks only pay out once.
- Power-up emerges and can be collected.
- Large form changes player height and collision box without clipping into tiles.

### Task 7: Implement Enemies, Stomps, And Projectiles

**Files:**

- Modify: `index.html`
- Modify: `tests/smoke.spec.mjs`

- [ ] Define original enemy entities with position, velocity, direction, width, height, alive state, and animation timer.
- [ ] Spawn enemies from level object definitions when near camera range.
- [ ] Move enemies with tile collision, gravity, direction reversal on wall collision, and natural falling when they walk off ledges.
- [ ] Implement stomp detection: player descending, player bottom near enemy top, overlap in x-axis.
- [ ] On stomp, defeat enemy, add score, spawn particles, and set player bounce velocity.
- [ ] On side contact, hurt player unless invulnerable.
- [ ] Implement charged-state projectile: short-range, bounces or travels forward, defeats one enemy, expires on wall or timer.
- [ ] Add tests for stomp defeat, side-contact hurt, and projectile defeat.
- [ ] Commit: `feat: add enemies and projectile combat`

Acceptance checks:

- Enemies are threatening but readable.
- Stomps feel forgiving enough for keyboard play.
- Hurt state has brief invulnerability.

### Task 8: Build Full Original Stage

**Files:**

- Modify: `index.html`

- [ ] Replace any temporary level with the full 180 to 220 tile stage.
- [ ] Include all required sections from the Level Design Contract.
- [ ] Place power-ups before difficulty spikes.
- [ ] Place coins to guide jumps and reward exploration.
- [ ] Ensure no gap or enemy setup blocks progress for a normal small player.
- [ ] Tune timer to allow casual completion while still feeling like a countdown.
- [ ] Commit: `feat: build complete first stage`

Acceptance checks:

- A first-time player can understand the route.
- The stage is original and not a coordinate copy of SMB 1-1.
- There is at least one safe power-up opportunity before the mid-stage.

### Task 9: Add Game State, Lives, Scoring, Timer, And Finish

**Files:**

- Modify: `index.html`
- Modify: `tests/smoke.spec.mjs`

- [ ] Implement title, playing, dying, levelClear, and gameOver transitions.
- [ ] Add score for coins, blocks, power-ups, enemy defeats, and flag finish.
- [ ] Add coin counter and life counter.
- [ ] Add countdown timer that decreases during playing state only.
- [ ] Implement death from enemy hit, falling below level, and timer reaching zero.
- [ ] Implement life loss, respawn, game over, and restart.
- [ ] Implement flagpole collision and level-clear scoring from remaining time.
- [ ] Add tests for death restart, game over restart, and level clear state.
- [ ] Commit: `feat: add scoring and game states`

Acceptance checks:

- Player can die and restart without refreshing.
- Level clear is visually and mechanically distinct from death.
- HUD values update while playing.

### Task 10: Add Original Audio And Feedback Effects

**Files:**

- Modify: `index.html`

- [ ] Use Web Audio oscillators and gain envelopes for short original effects.
- [ ] Add sounds for jump, coin, block bump, power-up spawn, power-up collect, stomp, hurt, projectile, death, and clear.
- [ ] Gate audio initialization behind first user interaction to satisfy browser autoplay restrictions.
- [ ] Add particles or floating score labels for coin, block, stomp, break, and clear rewards.
- [ ] Add screen shake only for brick break or hurt, kept subtle enough not to disrupt platforming.
- [ ] Commit: `feat: add audio and feedback effects`

Acceptance checks:

- No external audio files.
- No console autoplay errors after first interaction.
- Feedback makes player actions legible.

### Task 11: Polish Visual Fidelity And Accessibility Basics

**Files:**

- Modify: `index.html`

- [ ] Add a compact instruction strip on title screen only.
- [ ] Ensure all on-screen text fits within the logical Canvas or overlay at desktop and laptop sizes.
- [ ] Keep UI outside nested card patterns; the game itself is the first screen.
- [ ] Add a mute toggle only after all required mechanics work; omit pause controls for the first version.
- [ ] Tune sprite silhouettes so original character, enemy, item, and terrain are distinct at 2x and 3x scale.
- [ ] Scan colors and adjust if the game becomes one-note; keep sky/ground/green/gold/red balanced.
- [ ] Commit: `style: polish 8-bit platformer presentation`

Acceptance checks:

- The first viewport is the playable game, not a landing page.
- Text does not overlap game content incoherently.
- The scene reads as 8-bit platformer homage without copied sprites.

### Task 12: Verify And Prepare Handoff Completion

**Files:**

- Modify: `tests/smoke.spec.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] Run automated smoke tests.
- [ ] Open `index.html` manually in Chromium, Edge, or Chrome and play from start to flag at least once.
- [ ] Verify keyboard controls: arrows, `A/D`, `Z`, `Space`, `X`, `Shift`, `Enter`.
- [ ] Verify required mechanics: run, jump, variable jump, stomp, hurt, question block, coin, growth item, charged item, projectile, pipe obstacle, gap, stairs, flag, restart.
- [ ] Capture any known limitations in the final handoff message.
- [ ] Commit: `test: verify platformer smoke coverage`

Acceptance checks:

- `index.html` runs directly from disk.
- Tests pass or documented environment limitations explain why they could not run.
- The game is complete enough to be played end-to-end.

## Automated Test Guidance

Preferred smoke commands for the implementing Agent:

```powershell
npm install
npm test
```

The game itself must still run without `npm`. `npm` is only for tests.

Suggested `package.json` shape:

```json
{
  "scripts": {
    "test": "playwright test tests/smoke.spec.mjs"
  },
  "devDependencies": {
    "@playwright/test": "latest"
  }
}
```

Suggested smoke coverage:

- Canvas exists and has nonblank pixels.
- Start screen transitions to playing.
- Holding right changes player x-position.
- Jump changes player y-position.
- Test API can force death and restart.
- Test API can force player near flag and verify level clear.

## Manual QA Checklist

- [ ] Open `index.html` directly from the file system.
- [ ] Start game with `Enter`.
- [ ] Move with arrow keys.
- [ ] Move with `A/D`.
- [ ] Jump with `Z`.
- [ ] Jump with `Space`.
- [ ] Run with `X`.
- [ ] Run with `Shift`.
- [ ] Collect a coin from a question block.
- [ ] Collect growth item and become large.
- [ ] Collect charged item and fire a projectile.
- [ ] Stomp an enemy.
- [ ] Take damage and observe downgrade or death.
- [ ] Fall into a gap and lose a life.
- [ ] Reach flagpole and trigger clear.
- [ ] Restart after death or game over.

## Commit Strategy

Commit after each task. Use small, reviewable commits:

- `feat: add platformer runtime skeleton`
- `feat: add platformer input mapping`
- `feat: add tile map metadata`
- `feat: add player physics`
- `feat: render pixel platformer scene`
- `feat: add interactive blocks and powerups`
- `feat: add enemies and projectile combat`
- `feat: build complete first stage`
- `feat: add scoring and game states`
- `feat: add audio and feedback effects`
- `style: polish 8-bit platformer presentation`
- `test: verify platformer smoke coverage`

## Final Delivery Criteria

- `index.html` exists and is playable directly in a browser.
- No copied Nintendo art, sound, exact map, names, logos, or trademarks.
- One original complete first-stage style level exists.
- Canvas rendering is nonblank and pixelated.
- Core mechanics from the source spec are implemented.
- The implementing Agent reports test results and any remaining limitations.
