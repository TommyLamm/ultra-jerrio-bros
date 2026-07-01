import assert from 'node:assert/strict';
import test from 'node:test';

import { FORMS, MODES, TILE, createGame } from '../src/core/engine.js';

function stepFrames(game, frames, input = {}) {
  for (let i = 0; i < frames; i += 1) {
    game.step(input);
  }
}

test('loads an original first-stage scale level with required tile and object types', () => {
  const game = createGame();
  const state = game.snapshot();

  assert.equal(state.mode, MODES.TITLE);
  assert.ok(state.level.width >= 180);
  assert.ok(state.level.width <= 220);
  assert.equal(state.level.height, 15);
  assert.ok(state.level.tileCounts[TILE.GROUND] > 0);
  assert.ok(state.level.tileCounts[TILE.GROUND_TOP] > 0);
  assert.ok(state.level.tileCounts[TILE.BRICK] > 0);
  assert.ok(state.level.tileCounts[TILE.QUESTION] > 0);
  assert.ok(state.level.tileCounts[TILE.PIPE_TOP_LEFT] > 0);
  assert.ok(state.level.tileCounts[TILE.STAIR] > 0);
  assert.ok(state.level.tileCounts[TILE.FLAGPOLE] > 0);
  assert.ok(state.level.objects.some((object) => object.type === 'enemy'));
  assert.ok(state.level.objects.some((object) => object.type === 'flag'));
});

test('starts the game, accelerates right, and performs a variable jump', () => {
  const game = createGame();
  game.start();
  stepFrames(game, 30);

  const grounded = game.snapshot().player;
  assert.equal(grounded.grounded, true);

  stepFrames(game, 35, { right: true });
  const moved = game.snapshot().player;
  assert.ok(moved.x > grounded.x + 8);
  assert.ok(moved.vx > 0);

  game.step({ jump: true });
  const launched = game.snapshot().player;
  assert.ok(launched.vy < 0);

  stepFrames(game, 8, { jump: false });
  const released = game.snapshot().player;
  assert.ok(released.y < grounded.y);
  assert.ok(released.vy > launched.vy);
});

test('question blocks pay out once and powerups upgrade player form', () => {
  const game = createGame();
  game.start();

  const coinBlock = game.findTile((tile) => tile.id === TILE.QUESTION && tile.content === 'coin');
  assert.ok(coinBlock);
  assert.equal(game.bumpTile(coinBlock.tx, coinBlock.ty).type, 'coin');
  assert.equal(game.snapshot().coins, 1);
  assert.equal(game.bumpTile(coinBlock.tx, coinBlock.ty).type, 'empty');
  assert.equal(game.snapshot().coins, 1);

  const growthBlock = game.findTile((tile) => tile.id === TILE.QUESTION && tile.content === 'growth');
  assert.ok(growthBlock);
  const growth = game.bumpTile(growthBlock.tx, growthBlock.ty);
  assert.equal(growth.type, 'powerup');
  assert.equal(growth.powerup.kind, 'growth');
  game.collectPowerup(growth.powerup.id);
  assert.equal(game.snapshot().player.form, FORMS.LARGE);

  const chargedBlock = game.findTile((tile) => tile.id === TILE.QUESTION && tile.content === 'charged');
  assert.ok(chargedBlock);
  const charged = game.bumpTile(chargedBlock.tx, chargedBlock.ty);
  assert.equal(charged.type, 'powerup');
  assert.equal(charged.powerup.kind, 'charged');
  game.collectPowerup(charged.powerup.id);
  assert.equal(game.snapshot().player.form, FORMS.CHARGED);
});

test('enemy contacts distinguish stomps from side damage', () => {
  const game = createGame();
  game.start();
  const firstEnemy = game.snapshot().entities.enemies[0];
  assert.ok(firstEnemy);

  game.setPlayerState({
    x: firstEnemy.x,
    y: firstEnemy.y - game.snapshot().player.height + 2,
    vy: 90,
  });
  game.step({});

  const afterStomp = game.snapshot();
  assert.equal(afterStomp.entities.enemies.find((enemy) => enemy.id === firstEnemy.id).alive, false);
  assert.ok(afterStomp.player.vy < 0);
  assert.ok(afterStomp.score >= 100);

  const secondGame = createGame();
  secondGame.start();
  secondGame.setPlayerForm(FORMS.LARGE);
  const enemy = secondGame.snapshot().entities.enemies[0];
  secondGame.setPlayerState({
    x: enemy.x - 4,
    y: enemy.y,
    vy: 0,
  });
  secondGame.step({});

  const damaged = secondGame.snapshot().player;
  assert.equal(damaged.form, FORMS.SMALL);
  assert.ok(damaged.invulnTimer > 0);
});

test('charged projectiles defeat enemies and flag contact clears the level', () => {
  const game = createGame();
  game.start();
  game.setPlayerForm(FORMS.CHARGED);
  const enemy = game.snapshot().entities.enemies[0];

  game.setPlayerState({
    x: enemy.x - 30,
    y: enemy.y,
    facing: 1,
  });
  const projectile = game.fireProjectile();
  assert.ok(projectile);
  stepFrames(game, 25);

  const afterProjectile = game.snapshot();
  assert.equal(afterProjectile.entities.enemies.find((item) => item.id === enemy.id).alive, false);

  const flag = afterProjectile.level.objects.find((object) => object.type === 'flag');
  game.setPlayerState({ x: flag.x, y: flag.y, vy: 0 });
  game.step({});

  const cleared = game.snapshot();
  assert.equal(cleared.mode, MODES.LEVEL_CLEAR);
  assert.ok(cleared.score > afterProjectile.score);
});
