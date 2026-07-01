# Classic Crisp Text via High-Resolution Canvas Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the blurry text in the game by loading the classic "Press Start 2P" NES pixel font and scaling the canvas to support High-DPI screen resolutions dynamically.

**Architecture:** We will load the Google Font, change the internal canvas dimensions (`width`/`height`) dynamically to match the display boundaries multiplied by the device pixel ratio, scale the context so the coordinate space remains a logical `256x240`, replace references to `canvas.width` and `canvas.height` with `LOGICAL_WIDTH` and `LOGICAL_HEIGHT` to prevent layout breaks, and restructure the HUD into an authentic 8-bit two-line layout.

**Tech Stack:** Vanilla JavaScript, HTML Canvas 2D API, Google Fonts

---

### Task 1: Load Retro Web Font and Setup CSS

**Files:**
- Modify: `f:\Desktop\super mario bros\index.html:1-74`

- [ ] **Step 1: Add Google Fonts link in head**
  Add the preconnect and font stylesheet link tags for "Press Start 2P" in the `<head>` block of `index.html`.
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
  ```

- [ ] **Step 2: Update CSS font-family**
  Update the `body` CSS declaration to prioritize the `'Press Start 2P'` font family.
  ```css
  body {
    background: #0f0f12;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    overflow: hidden;
    font-family: 'Press Start 2P', 'Courier New', Courier, monospace;
  }
  ```

- [ ] **Step 3: Commit CSS and Font integration**
  ```bash
  git add index.html
  git commit -m "feat: load Press Start 2P font and update CSS"
  ```

---

### Task 2: Implement High-Resolution Canvas Scaling and Logical Coordinates

**Files:**
- Modify: `f:\Desktop\super mario bros\index.html:83-132` (Canvas Initialization & Helpers)
- Modify: `f:\Desktop\super mario bros\index.html:886-910` (Background drawing)
- Modify: `f:\Desktop\super mario bros\index.html:1104-1157` (Overlays)
- Modify: `f:\Desktop\super mario bros\index.html:1357-1405` (Render loop)

- [ ] **Step 1: Define logical dimensions and resizeCanvas function**
  In the `<script>` tag of `index.html` after creating `canvas` and `ctx`, define logical dimensions and implement `resizeCanvas` to resize internal canvas resolution. Add a `resize` listener.
  ```javascript
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');

  const LOGICAL_WIDTH = 256;
  const LOGICAL_HEIGHT = 240;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const scaleX = canvas.width / LOGICAL_WIDTH;
    const scaleY = canvas.height / LOGICAL_HEIGHT;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(scaleX, scaleY);

    ctx.imageSmoothingEnabled = false;
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  ```

- [ ] **Step 2: Update logical coordinate references**
  Replace all game-world references to `canvas.width` and `canvas.height` with `LOGICAL_WIDTH` and `LOGICAL_HEIGHT`.
  
  Modify `cameraX(state)`:
  ```javascript
  function cameraX(state) {
    const max = state.level.width * state.level.tileSize - LOGICAL_WIDTH;
    return Math.max(0, Math.min(max, state.player.x - 96));
  }
  ```

  Modify `drawBackground(ctx, camX, state)`:
  ```javascript
  function drawBackground(ctx, camX, state) {
    // Sky color
    ctx.fillStyle = '#5c94fc';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Parallax Clouds (30% speed)
    const cloudCamX = camX * 0.3;
    for (let cx = -100; cx < state.level.width * 16; cx += 160) {
      const x = cx - cloudCamX;
      if (x > -80 && x < LOGICAL_WIDTH + 80) {
        drawPixelArt(ctx, Math.round(x), 30, SPRITE_CLOUD, PALETTES.cloud);
      }
    }

    // Parallax Hills/Bushes (50% speed)
    const hillCamX = camX * 0.5;
    for (let hx = -50; hx < state.level.width * 16; hx += 240) {
      const x = hx - hillCamX;
      if (x > -100 && x < LOGICAL_WIDTH + 100) {
        drawPixelArt(ctx, Math.round(x), 196, SPRITE_CLOUD, PALETTES.bush);
      }
    }
  }
  ```

  Modify `render(state)` viewport check and full screen hurt flash:
  ```javascript
  function render(state) {
    const camX = Math.round(cameraX(state));
    
    // Clear canvas with background
    drawBackground(ctx, camX, state);

    ctx.save();
    ctx.translate(-camX, 0);

    // Render visible level tiles only
    const tileSize = state.level.tileSize;
    const minTx = Math.max(0, Math.floor(camX / tileSize));
    const maxTx = Math.min(state.level.width - 1, Math.ceil((camX + LOGICAL_WIDTH) / tileSize));
    // ...
    ctx.restore();

    // Render HUD
    drawHUD(ctx, state);

    // Full screen hurt/death flash
    if (hurtFlashTimer > 0) {
      ctx.fillStyle = `rgba(216, 40, 0, ${hurtFlashTimer * 0.8})`;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }

    // Render state overlays
    drawOverlays(ctx, state);
  }
  ```

- [ ] **Step 3: Commit Canvas Resizing implementation**
  ```bash
  git add index.html
  git commit -m "feat: implement high-res canvas scaling with devicePixelRatio"
  ```

---

### Task 3: Redesign HUD Layout and Update Font Styling

**Files:**
- Modify: `f:\Desktop\super mario bros\index.html:1086-1156` (drawHUD & drawOverlays)
- Modify: `f:\Desktop\super mario bros\index.html:1257-1285` (drawVisualEffects)

- [ ] **Step 2: Update drawHUD for Two-Line NES Layout**
  Redesign HUD labels and values in `drawHUD` to render in two rows utilizing `"Press Start 2P"`.
  ```javascript
  function drawHUD(ctx, state) {
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Labels (Row 1)
    fillTextWithOutline(ctx, 'MARIO', 4, 6);
    fillTextWithOutline(ctx, 'COINS', 64, 6);
    fillTextWithOutline(ctx, 'WORLD', 120, 6);
    fillTextWithOutline(ctx, 'LIVES', 172, 6);
    fillTextWithOutline(ctx, 'TIME', 220, 6);

    // Values (Row 2)
    const scoreText = String(state.score).padStart(6, '0');
    const coinsText = 'x' + String(state.coins).padStart(2, '0');
    const worldText = '1-1';
    const livesText = 'x' + String(state.lives);
    const timeText = String(Math.ceil(state.timeRemaining)).padStart(3, '0');

    fillTextWithOutline(ctx, scoreText, 4, 16);
    fillTextWithOutline(ctx, coinsText, 72, 16);
    fillTextWithOutline(ctx, worldText, 128, 16);
    fillTextWithOutline(ctx, livesText, 184, 16);
    fillTextWithOutline(ctx, timeText, 224, 16);
  }
  ```

- [ ] **Step 2: Update drawOverlays font configurations**
  Modify overlay screens (Title, Level Clear, Game Over) to use the new pixel font and appropriate sizes.
  ```javascript
  function drawOverlays(ctx, state) {
    if (state.mode === MODES.PLAYING) return;

    // Darken background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (state.mode === MODES.TITLE) {
      // Large title
      ctx.font = '16px "Press Start 2P"';
      fillTextWithOutline(ctx, 'ULTRA JERRIO', LOGICAL_WIDTH / 2, 70, '#000000', '#f8d878');

      // Flashing instructions
      const flash = Math.floor(state.frame / 20) % 2 === 0;
      if (flash) {
        ctx.font = '8px "Press Start 2P"';
        fillTextWithOutline(ctx, 'PRESS ENTER TO START', LOGICAL_WIDTH / 2, 110, '#000000', '#ffffff');
      }

      // Instructions
      ctx.font = '8px "Press Start 2P"';
      fillTextWithOutline(ctx, 'MOVE: A/D or LEFT/RIGHT ARROWS', LOGICAL_WIDTH / 2, 150, '#000000', '#cccccc');
      fillTextWithOutline(ctx, 'JUMP: Z or SPACEBAR', LOGICAL_WIDTH / 2, 165, '#000000', '#cccccc');
      fillTextWithOutline(ctx, 'RUN/FIRE: X or SHIFT KEY', LOGICAL_WIDTH / 2, 180, '#000000', '#cccccc');
    } else if (state.mode === MODES.LEVEL_CLEAR) {
      ctx.font = '14px "Press Start 2P"';
      fillTextWithOutline(ctx, 'STAGE CLEAR!', LOGICAL_WIDTH / 2, 90, '#000000', '#80e080');

      ctx.font = '8px "Press Start 2P"';
      fillTextWithOutline(ctx, 'TIME BONUS ADDED!', LOGICAL_WIDTH / 2, 125, '#000000', '#ffe066');
      
      const flash = Math.floor(state.frame / 20) % 2 === 0;
      if (flash) {
        ctx.font = '8px "Press Start 2P"';
        fillTextWithOutline(ctx, 'PRESS ENTER TO PLAY AGAIN', LOGICAL_WIDTH / 2, 160, '#000000', '#ffffff');
      }
    } else if (state.mode === MODES.GAME_OVER) {
      ctx.font = '16px "Press Start 2P"';
      fillTextWithOutline(ctx, 'GAME OVER', LOGICAL_WIDTH / 2, 90, '#000000', '#d82800');

      ctx.font = '8px "Press Start 2P"';
      fillTextWithOutline(ctx, 'FINAL SCORE: ' + String(state.score).padStart(6, '0'), LOGICAL_WIDTH / 2, 125, '#000000', '#ffffff');

      const flash = Math.floor(state.frame / 20) % 2 === 0;
      if (flash) {
        ctx.font = '8px "Press Start 2P"';
        fillTextWithOutline(ctx, 'PRESS ENTER TO RESTART', LOGICAL_WIDTH / 2, 160, '#000000', '#ffffff');
      }
    }
  }
  ```

- [ ] **Step 3: Update drawVisualEffects for floating text particles**
  Update particle floating texts to use the new pixel font.
  ```javascript
  function drawVisualEffects(ctx) {
    visualEffects.forEach(fx => {
      const alpha = Math.max(0, Math.min(1, fx.life / fx.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      
      const rx = Math.round(fx.x);
      const ry = Math.round(fx.y);

      if (fx.type === 'text') {
        ctx.font = '8px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeText(fx.text, rx, ry);
        ctx.fillStyle = fx.color;
        ctx.fillText(fx.text, rx, ry);
      } else if (fx.type === 'sparkle') {
        ctx.fillStyle = fx.color;
        ctx.fillRect(rx - 1, ry - 1, 2, 2);
      } else if (fx.type === 'debris') {
        ctx.fillStyle = fx.color;
        ctx.fillRect(rx - 2, ry - 2, 4, 4);
      }
      
      ctx.restore();
    });
  }
  ```

- [ ] **Step 4: Commit HUD and Text updates**
  ```bash
  git add index.html
  git commit -m "feat: redesign HUD and update overlays to use Press Start 2P pixel font"
  ```
