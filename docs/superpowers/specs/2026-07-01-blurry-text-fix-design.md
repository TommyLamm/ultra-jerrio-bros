# Spec: Classic Crisp Text via High-Resolution Canvas Scaling

## Goal
The game text is currently rendered on a low-resolution canvas (`256x240`) and scaled up via CSS, which causes the default browser font rendering to be anti-aliased and extremely blurry when upscaled. This specification details how to integrate a classic NES-style pixel font ("Press Start 2P") and implement a high-resolution canvas scaling system to render all game text and graphics with pixel-perfect crispness.

## Proposed Design

### 1. Web Font Integration
We will load the retro 8-bit Google Font **"Press Start 2P"** by adding standard Google Fonts `<link>` tags to the HTML `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
```

### 2. High-Resolution Canvas Resizing
Instead of having a fixed canvas size of `256x240` that gets stretched by CSS, we will dynamically size the canvas's internal dimensions (`canvas.width` and `canvas.height`) to match its actual physical rendering size on the screen (taking `window.devicePixelRatio` into account for High-DPI/Retina screens).

#### Implementation Details
We will introduce a `resizeCanvas` function:
```javascript
const LOGICAL_WIDTH = 256;
const LOGICAL_HEIGHT = 240;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // Set physical resolution
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  // Reset transforms and apply scale factor to match logical coordinates
  const scaleX = canvas.width / LOGICAL_WIDTH;
  const scaleY = canvas.height / LOGICAL_HEIGHT;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(scaleX, scaleY);

  // Disable smoothing since canvas resizing resets state
  ctx.imageSmoothingEnabled = false;
}
```
We will call `resizeCanvas()` on initial page load and on window `resize` events.

### 3. Font and Text Drawing Adjustments
We will update text rendering styles across the game loop to use `"Press Start 2P"`:
* **HUD**: Update `ctx.font` from `'bold 8px monospace'` to `'8px "Press Start 2P"'`.
* **Title & Overlays**: Update font sizes from `'bold 18px monospace'`, `'bold 10px monospace'`, etc. to `'16px "Press Start 2P"'`, `'8px "Press Start 2P"'`, etc. (pixel fonts are larger than monospace fonts, so we might need slight adjustments).
* **Floating Particles**: Update floating text rendering to use `'8px "Press Start 2P"'`.
* **Outline Stroke**: Since text strokes are now scaled automatically by the context matrix, we will adjust `ctx.lineWidth` to look correct at the new resolution.

## Verification Plan
1. Open the updated game page in a browser subagent.
2. Verify that the HUD texts ("SCORE", "COINS", "WORLD", "TIME", "LIVES") render in a classic NES pixel style and are perfectly crisp.
3. Check the Title screen, stage clear screen, and game over screen text.
4. Verify that floating score/damage values (+100, +200) render correctly and crisp.
5. Resize the window to verify that canvas rendering scales dynamically and remains crisp without visual glitches or pixelation/blurriness on the text.
