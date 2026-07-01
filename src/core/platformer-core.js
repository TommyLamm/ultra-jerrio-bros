// File-url compatible browser bundle for the platformer core.
// Keep game rules here; src/core/engine.js re-exports this API for Node tests.
(function exposePlatformerCore(globalThis) {
const TILE = Object.freeze({
  EMPTY: 0,
  GROUND: 1,
  GROUND_TOP: 2,
  BRICK: 3,
  QUESTION: 4,
  USED: 5,
  PIPE_LEFT: 6,
  PIPE_RIGHT: 7,
  PIPE_TOP_LEFT: 8,
  PIPE_TOP_RIGHT: 9,
  STAIR: 10,
  FLAGPOLE: 11,
  FLAG_TOP: 12,
});

const FORMS = Object.freeze({
  SMALL: 'small',
  LARGE: 'large',
  CHARGED: 'charged',
});

const MODES = Object.freeze({
  TITLE: 'title',
  PLAYING: 'playing',
  DYING: 'dying',
  LEVEL_CLEAR: 'levelClear',
  GAME_OVER: 'gameOver',
});

const CONSTANTS = Object.freeze({
  tileSize: 16,
  levelHeight: 15,
  dt: 1 / 60,
  gravity: 900,
  terminalVelocity: 420,
  walkAcceleration: 720,
  runAcceleration: 980,
  friction: 820,
  maxWalkSpeed: 92,
  maxRunSpeed: 142,
  jumpVelocity: -310,
  jumpCutVelocity: -120,
  coyoteSeconds: 0.08,
  jumpBufferSeconds: 0.09,
  stompBounceVelocity: -220,
  hurtInvulnerability: 1.4,
});

const TILE_META = Object.freeze({
  [TILE.EMPTY]: { solid: false, bumpable: false, breakable: false, visualKind: 'empty' },
  [TILE.GROUND]: { solid: true, bumpable: false, breakable: false, visualKind: 'ground' },
  [TILE.GROUND_TOP]: { solid: true, bumpable: false, breakable: false, visualKind: 'groundTop' },
  [TILE.BRICK]: { solid: true, bumpable: true, breakable: true, visualKind: 'brick' },
  [TILE.QUESTION]: { solid: true, bumpable: true, breakable: false, visualKind: 'question' },
  [TILE.USED]: { solid: true, bumpable: false, breakable: false, visualKind: 'used' },
  [TILE.PIPE_LEFT]: { solid: true, bumpable: false, breakable: false, visualKind: 'pipeLeft' },
  [TILE.PIPE_RIGHT]: { solid: true, bumpable: false, breakable: false, visualKind: 'pipeRight' },
  [TILE.PIPE_TOP_LEFT]: { solid: true, bumpable: false, breakable: false, visualKind: 'pipeTopLeft' },
  [TILE.PIPE_TOP_RIGHT]: { solid: true, bumpable: false, breakable: false, visualKind: 'pipeTopRight' },
  [TILE.STAIR]: { solid: true, bumpable: false, breakable: false, visualKind: 'stair' },
  [TILE.FLAGPOLE]: { solid: false, bumpable: false, breakable: false, visualKind: 'flagpole' },
  [TILE.FLAG_TOP]: { solid: false, bumpable: false, breakable: false, visualKind: 'flagTop' },
});

let nextEntityId = 1;

function createGame(options = {}) {
  const level = createLevel(options.levelWidth ?? 200);
  const state = {
    mode: MODES.TITLE,
    score: 0,
    coins: 0,
    lives: 3,
    timeRemaining: level.timeLimit,
    frame: 0,
    events: [],
    level,
    player: createPlayer(level.spawn.x, level.spawn.y),
    entities: {
      enemies: level.objects
        .filter((object) => object.type === 'enemy')
        .map((object) => createEnemy(object.x, object.y)),
      powerups: [],
      projectiles: [],
      particles: [],
    },
    inputMemory: {
      jumpWasDown: false,
      jumpBuffer: 0,
    },
  };

  function start() {
    if (state.mode === MODES.GAME_OVER || state.mode === MODES.LEVEL_CLEAR) {
      resetProgress();
    }
    state.mode = MODES.PLAYING;
    state.events.push({ type: 'start' });
  }

  function resetProgress() {
    state.score = 0;
    state.coins = 0;
    state.lives = 3;
    state.timeRemaining = level.timeLimit;
    state.player = createPlayer(level.spawn.x, level.spawn.y);
    state.entities.enemies = level.objects
      .filter((object) => object.type === 'enemy')
      .map((object) => createEnemy(object.x, object.y));
    state.entities.powerups = [];
    state.entities.projectiles = [];
    state.entities.particles = [];
  }

  function step(input = {}, dt = CONSTANTS.dt) {
    state.events = [];
    state.frame += 1;

    if (input.start && state.mode !== MODES.PLAYING) {
      start();
      return snapshot();
    }

    if (state.mode !== MODES.PLAYING) {
      return snapshot();
    }

    updateTimer(dt);
    updatePlayer(input, dt);
    updatePowerups(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    resolvePowerupCollection();
    resolveEnemyContacts();
    resolveProjectileContacts();
    resolveFlagContact();
    resolveFallDeath();

    return snapshot();
  }

  function updateTimer(dt) {
    state.timeRemaining = Math.max(0, state.timeRemaining - dt);
    if (state.timeRemaining === 0) {
      killPlayer();
    }
  }

  function updatePlayer(input, dt) {
    const player = state.player;
    if (player.invulnTimer > 0) {
      player.invulnTimer = Math.max(0, player.invulnTimer - dt);
    }

    const left = Boolean(input.left);
    const right = Boolean(input.right);
    const run = Boolean(input.runFire);
    const jumpDown = Boolean(input.jump);

    if (jumpDown && !state.inputMemory.jumpWasDown) {
      state.inputMemory.jumpBuffer = CONSTANTS.jumpBufferSeconds;
    } else {
      state.inputMemory.jumpBuffer = Math.max(0, state.inputMemory.jumpBuffer - dt);
    }
    state.inputMemory.jumpWasDown = jumpDown;

    const acceleration = run ? CONSTANTS.runAcceleration : CONSTANTS.walkAcceleration;
    const maxSpeed = run ? CONSTANTS.maxRunSpeed : CONSTANTS.maxWalkSpeed;

    if (left && !right) {
      player.vx = Math.max(player.vx - acceleration * dt, -maxSpeed);
      player.facing = -1;
    } else if (right && !left) {
      player.vx = Math.min(player.vx + acceleration * dt, maxSpeed);
      player.facing = 1;
    } else {
      applyFriction(player, dt);
    }

    if (player.grounded) {
      player.coyoteTimer = CONSTANTS.coyoteSeconds;
    } else {
      player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
    }

    if (state.inputMemory.jumpBuffer > 0 && player.coyoteTimer > 0) {
      player.vy = CONSTANTS.jumpVelocity;
      player.grounded = false;
      player.coyoteTimer = 0;
      state.inputMemory.jumpBuffer = 0;
      state.events.push({ type: 'jump' });
    }

    if (!jumpDown && player.vy < CONSTANTS.jumpCutVelocity) {
      player.vy = CONSTANTS.jumpCutVelocity;
    }

    player.vy = Math.min(player.vy + CONSTANTS.gravity * dt, CONSTANTS.terminalVelocity);
    moveWithTileCollision(player, player.vx * dt, player.vy * dt, {
      onCeilingHit: (tx, ty) => bumpTile(tx, ty),
    });
  }

  function updatePowerups(dt) {
    for (const powerup of state.entities.powerups) {
      if (!powerup.active) continue;
      if (powerup.emergeTimer > 0) {
        powerup.emergeTimer = Math.max(0, powerup.emergeTimer - dt);
        powerup.y -= 18 * dt;
        continue;
      }
      powerup.vy = Math.min(powerup.vy + CONSTANTS.gravity * dt, CONSTANTS.terminalVelocity);
      moveWithTileCollision(powerup, powerup.vx * dt, powerup.vy * dt, {
        onWallHit: () => {
          powerup.vx *= -1;
        },
      });
    }
  }

  function updateEnemies(dt) {
    for (const enemy of state.entities.enemies) {
      if (!enemy.alive) continue;
      enemy.vy = Math.min(enemy.vy + CONSTANTS.gravity * dt, CONSTANTS.terminalVelocity);
      enemy.vx = enemy.direction * enemy.speed;
      moveWithTileCollision(enemy, enemy.vx * dt, enemy.vy * dt, {
        onWallHit: () => {
          enemy.direction *= -1;
          enemy.vx = enemy.direction * enemy.speed;
        },
      });
      enemy.animationTime += dt;
    }
  }

  function updateProjectiles(dt) {
    for (const projectile of state.entities.projectiles) {
      if (!projectile.active) continue;
      projectile.ttl -= dt;
      if (projectile.ttl <= 0) {
        projectile.active = false;
        continue;
      }
      projectile.vy = Math.min(projectile.vy + 420 * dt, 220);
      moveWithTileCollision(projectile, projectile.vx * dt, projectile.vy * dt, {
        onWallHit: () => {
          projectile.active = false;
        },
        onFloorHit: () => {
          projectile.vy = -120;
        },
      });
    }
  }

  function resolvePowerupCollection() {
    for (const powerup of state.entities.powerups) {
      if (!powerup.active || powerup.emergeTimer > 0) continue;
      if (overlaps(state.player, powerup)) {
        collectPowerup(powerup.id);
      }
    }
  }

  function resolveEnemyContacts() {
    const player = state.player;
    for (const enemy of state.entities.enemies) {
      if (!enemy.alive || !overlaps(player, enemy)) continue;
      const playerBottom = player.y + player.height;
      const stompLine = enemy.y + Math.min(8, enemy.height * 0.55);
      const isStomp = player.vy > 0 && playerBottom <= stompLine;

      if (isStomp) {
        defeatEnemy(enemy, 'stomp');
        player.vy = CONSTANTS.stompBounceVelocity;
        player.grounded = false;
        state.events.push({ type: 'stomp', enemyId: enemy.id });
      } else {
        hurtPlayer();
      }
    }
  }

  function resolveProjectileContacts() {
    for (const projectile of state.entities.projectiles) {
      if (!projectile.active) continue;
      for (const enemy of state.entities.enemies) {
        if (!enemy.alive || !overlaps(projectile, enemy)) continue;
        defeatEnemy(enemy, 'projectile');
        projectile.active = false;
        state.events.push({ type: 'projectileHit', enemyId: enemy.id });
        break;
      }
    }
  }

  function resolveFlagContact() {
    const flag = state.level.objects.find((object) => object.type === 'flag');
    if (!flag) return;
    const flagRect = { x: flag.x, y: flag.y, width: flag.width, height: flag.height };
    if (!overlaps(state.player, flagRect)) return;

    const timeBonus = Math.ceil(state.timeRemaining) * 5;
    state.score += 1000 + timeBonus;
    state.mode = MODES.LEVEL_CLEAR;
    state.events.push({ type: 'levelClear', timeBonus });
  }

  function resolveFallDeath() {
    if (state.player.y > state.level.height * CONSTANTS.tileSize + 32) {
      killPlayer();
    }
  }

  function bumpTile(tx, ty) {
    const tile = getTile(tx, ty);
    if (!tile) return { type: 'empty' };
    const meta = TILE_META[tile.id];

    if (tile.id === TILE.QUESTION && tile.content) {
      const content = tile.content;
      tile.id = TILE.USED;
      tile.content = null;

      if (content === 'coin') {
        state.coins += 1;
        state.score += 200;
        state.events.push({ type: 'coin', tx, ty });
        return { type: 'coin', tx, ty };
      }

      const powerup = createPowerup(content, tx * CONSTANTS.tileSize + 1, ty * CONSTANTS.tileSize - 14);
      state.entities.powerups.push(powerup);
      state.events.push({ type: 'powerupSpawn', powerup: cloneEntity(powerup), tx, ty });
      return { type: 'powerup', powerup: cloneEntity(powerup), tx, ty };
    }

    if (meta?.breakable && state.player.form !== FORMS.SMALL) {
      tile.id = TILE.EMPTY;
      tile.content = null;
      state.score += 50;
      state.events.push({ type: 'brickBreak', tx, ty });
      return { type: 'break', tx, ty };
    }

    if (meta?.bumpable) {
      state.events.push({ type: 'blockBump', tx, ty });
      return { type: 'bump', tx, ty };
    }

    return { type: 'empty' };
  }

  function collectPowerup(id) {
    const powerup = state.entities.powerups.find((item) => item.id === id && item.active);
    if (!powerup) return false;

    powerup.active = false;
    if (powerup.kind === 'growth') {
      setPlayerForm(state.player.form === FORMS.SMALL ? FORMS.LARGE : FORMS.CHARGED);
      state.score += 1000;
    } else if (powerup.kind === 'charged') {
      setPlayerForm(FORMS.CHARGED);
      state.score += 1000;
    }
    state.events.push({ type: 'powerupCollect', id, kind: powerup.kind, form: state.player.form });
    return true;
  }

  function setPlayerForm(form) {
    const previousBottom = state.player.y + state.player.height;
    state.player.form = form;
    applyPlayerDimensions(state.player);
    state.player.y = previousBottom - state.player.height;
  }

  function hurtPlayer() {
    const player = state.player;
    if (player.invulnTimer > 0) return;

    if (player.form === FORMS.CHARGED) {
      setPlayerForm(FORMS.LARGE);
      player.invulnTimer = CONSTANTS.hurtInvulnerability;
      state.events.push({ type: 'hurt', form: player.form });
      return;
    }

    if (player.form === FORMS.LARGE) {
      setPlayerForm(FORMS.SMALL);
      player.invulnTimer = CONSTANTS.hurtInvulnerability;
      state.events.push({ type: 'hurt', form: player.form });
      return;
    }

    killPlayer();
  }

  function killPlayer() {
    if (state.mode !== MODES.PLAYING) return;
    state.lives -= 1;
    state.events.push({ type: 'death', lives: state.lives });

    if (state.lives <= 0) {
      state.mode = MODES.GAME_OVER;
      return;
    }

    state.mode = MODES.DYING;
    respawn();
  }

  function respawn() {
    state.player = createPlayer(level.spawn.x, level.spawn.y);
    state.inputMemory.jumpWasDown = false;
    state.inputMemory.jumpBuffer = 0;
    state.mode = MODES.PLAYING;
  }

  function defeatEnemy(enemy, source) {
    enemy.alive = false;
    enemy.vx = 0;
    enemy.vy = 0;
    state.score += source === 'stomp' ? 100 : 200;
  }

  function fireProjectile() {
    const player = state.player;
    if (state.mode !== MODES.PLAYING || player.form !== FORMS.CHARGED) {
      return null;
    }
    const projectile = {
      id: nextId(),
      type: 'projectile',
      active: true,
      x: player.facing > 0 ? player.x + player.width : player.x - 6,
      y: player.y + Math.min(6, Math.floor(player.height * 0.3)),
      width: 6,
      height: 6,
      vx: player.facing * 180,
      vy: -35,
      ttl: 1.2,
    };
    state.entities.projectiles.push(projectile);
    state.events.push({ type: 'projectileFire', id: projectile.id });
    return cloneEntity(projectile);
  }

  function findTile(predicate) {
    for (let ty = 0; ty < state.level.height; ty += 1) {
      for (let tx = 0; tx < state.level.width; tx += 1) {
        const tile = state.level.tiles[ty][tx];
        const candidate = {
          tx,
          ty,
          id: tile.id,
          content: tile.content,
          meta: TILE_META[tile.id],
        };
        if (predicate(candidate)) return candidate;
      }
    }
    return null;
  }

  function getTile(tx, ty) {
    if (ty < 0 || ty >= state.level.height || tx < 0 || tx >= state.level.width) {
      return null;
    }
    return state.level.tiles[ty][tx];
  }

  function setPlayerState(partial) {
    Object.assign(state.player, partial);
    applyPlayerDimensions(state.player);
  }

  function snapshot() {
    return {
      mode: state.mode,
      score: state.score,
      coins: state.coins,
      lives: state.lives,
      timeRemaining: state.timeRemaining,
      frame: state.frame,
      events: state.events.map((event) => ({ ...event })),
      player: cloneEntity(state.player),
      level: {
        width: state.level.width,
        height: state.level.height,
        spawn: { ...state.level.spawn },
        timeLimit: state.level.timeLimit,
        tileSize: CONSTANTS.tileSize,
        tileCounts: countTiles(state.level),
        objects: state.level.objects.map((object) => ({ ...object })),
      },
      entities: {
        enemies: state.entities.enemies.map(cloneEntity),
        powerups: state.entities.powerups.map(cloneEntity),
        projectiles: state.entities.projectiles.map(cloneEntity),
        particles: state.entities.particles.map(cloneEntity),
      },
    };
  }

  return {
    start,
    step,
    snapshot,
    bumpTile,
    collectPowerup,
    fireProjectile,
    findTile,
    getTile,
    isSolidAt,
    setPlayerForm,
    setPlayerState,
  };

  function isSolidAt(tx, ty) {
    if (tx < 0 || tx >= state.level.width) return true;
    if (ty < 0 || ty >= state.level.height) return false;
    return Boolean(TILE_META[state.level.tiles[ty][tx].id]?.solid);
  }

  function moveWithTileCollision(entity, dx, dy, hooks = {}) {
    entity.x += dx;
    if (dx !== 0) {
      forEachOverlappingSolid(entity, (tx) => {
        if (dx > 0) {
          entity.x = tx * CONSTANTS.tileSize - entity.width;
        } else {
          entity.x = (tx + 1) * CONSTANTS.tileSize;
        }
        entity.vx = 0;
        hooks.onWallHit?.(tx);
      });
    }

    const wasGrounded = Boolean(entity.grounded);
    entity.grounded = false;
    entity.y += dy;
    if (dy !== 0) {
      forEachOverlappingSolid(entity, (tx, ty) => {
        if (dy > 0) {
          entity.y = ty * CONSTANTS.tileSize - entity.height;
          entity.vy = 0;
          entity.grounded = true;
          hooks.onFloorHit?.(tx, ty);
        } else {
          entity.y = (ty + 1) * CONSTANTS.tileSize;
          entity.vy = 0;
          hooks.onCeilingHit?.(tx, ty);
        }
      });
    }
    if (wasGrounded && !entity.grounded && dy === 0) {
      entity.grounded = false;
    }
  }

  function forEachOverlappingSolid(rect, callback) {
    const minTx = Math.floor(rect.x / CONSTANTS.tileSize);
    const maxTx = Math.floor((rect.x + rect.width - 0.001) / CONSTANTS.tileSize);
    const minTy = Math.floor(rect.y / CONSTANTS.tileSize);
    const maxTy = Math.floor((rect.y + rect.height - 0.001) / CONSTANTS.tileSize);

    for (let ty = minTy; ty <= maxTy; ty += 1) {
      for (let tx = minTx; tx <= maxTx; tx += 1) {
        if (isSolidAt(tx, ty)) {
          callback(tx, ty);
        }
      }
    }
  }
}

function createLevel(width) {
  const height = CONSTANTS.levelHeight;
  const tiles = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => createTile(TILE.EMPTY))
  );
  const level = {
    width,
    height,
    spawn: { x: 24, y: 13 * CONSTANTS.tileSize - 14 },
    timeLimit: 400,
    tiles,
    objects: [],
  };

  const gaps = [
    [66, 68],
    [112, 115],
  ];

  for (let tx = 0; tx < width; tx += 1) {
    if (gaps.some(([start, end]) => tx >= start && tx <= end)) continue;
    setTile(level, tx, 13, TILE.GROUND_TOP);
    setTile(level, tx, 14, TILE.GROUND);
  }

  addQuestionRun(level, 18, 9, ['coin', null, 'growth', null, 'coin']);
  addBrickRun(level, 30, 9, 4);
  addQuestionRun(level, 48, 8, ['coin', 'coin', null, 'coin']);
  addPipe(level, 58, 11, 2);
  addBrickRun(level, 75, 9, 3);
  addQuestionRun(level, 81, 9, ['charged', 'coin']);
  addPipe(level, 96, 10, 3);
  addQuestionRun(level, 125, 8, ['coin', 'coin', 'growth']);
  addBrickRun(level, 130, 8, 5);
  addPipe(level, 148, 11, 2);
  addStairs(level, 168, 13, 7);
  addFlag(level, 190);

  for (const x of [34, 52, 88, 122, 142, 158]) {
    level.objects.push({
      id: nextId(),
      type: 'enemy',
      x: x * CONSTANTS.tileSize,
      y: 13 * CONSTANTS.tileSize - 14,
    });
  }

  return level;
}

function createTile(id, content = null) {
  return { id, content };
}

function setTile(level, tx, ty, id, content = null) {
  if (tx < 0 || tx >= level.width || ty < 0 || ty >= level.height) return;
  level.tiles[ty][tx] = createTile(id, content);
}

function addQuestionRun(level, startTx, ty, contents) {
  contents.forEach((content, index) => {
    setTile(level, startTx + index, ty, content ? TILE.QUESTION : TILE.BRICK, content);
  });
}

function addBrickRun(level, startTx, ty, count) {
  for (let i = 0; i < count; i += 1) {
    setTile(level, startTx + i, ty, TILE.BRICK);
  }
}

function addPipe(level, tx, topTy, bodyHeight) {
  setTile(level, tx, topTy, TILE.PIPE_TOP_LEFT);
  setTile(level, tx + 1, topTy, TILE.PIPE_TOP_RIGHT);
  for (let ty = topTy + 1; ty < topTy + 1 + bodyHeight; ty += 1) {
    setTile(level, tx, ty, TILE.PIPE_LEFT);
    setTile(level, tx + 1, ty, TILE.PIPE_RIGHT);
  }
}

function addStairs(level, startTx, groundTy, width) {
  for (let step = 0; step < width; step += 1) {
    for (let ty = groundTy; ty >= groundTy - step; ty -= 1) {
      setTile(level, startTx + step, ty, TILE.STAIR);
    }
  }
}

function addFlag(level, tx) {
  setTile(level, tx, 2, TILE.FLAG_TOP);
  for (let ty = 3; ty <= 12; ty += 1) {
    setTile(level, tx, ty, TILE.FLAGPOLE);
  }
  level.objects.push({
    id: nextId(),
    type: 'flag',
    x: tx * CONSTANTS.tileSize,
    y: 2 * CONSTANTS.tileSize,
    width: 8,
    height: 11 * CONSTANTS.tileSize,
  });
}

function createPlayer(x, y) {
  const player = {
    id: 'player',
    type: 'player',
    x,
    y,
    vx: 0,
    vy: 0,
    width: 12,
    height: 14,
    facing: 1,
    grounded: true,
    form: FORMS.SMALL,
    invulnTimer: 0,
    coyoteTimer: CONSTANTS.coyoteSeconds,
    dead: false,
  };
  applyPlayerDimensions(player);
  return player;
}

function applyPlayerDimensions(player) {
  if (player.form === FORMS.SMALL) {
    player.width = 12;
    player.height = 14;
  } else {
    player.width = 14;
    player.height = 28;
  }
}

function createEnemy(x, y) {
  return {
    id: nextId(),
    type: 'enemy',
    alive: true,
    x,
    y,
    width: 14,
    height: 14,
    vx: -28,
    vy: 0,
    direction: -1,
    speed: 28,
    grounded: true,
    animationTime: 0,
  };
}

function createPowerup(kind, x, y) {
  return {
    id: nextId(),
    type: 'powerup',
    kind,
    active: true,
    x,
    y,
    width: 14,
    height: 14,
    vx: 42,
    vy: 0,
    grounded: false,
    emergeTimer: 0.45,
  };
}

function applyFriction(player, dt) {
  if (player.vx > 0) {
    player.vx = Math.max(0, player.vx - CONSTANTS.friction * dt);
  } else if (player.vx < 0) {
    player.vx = Math.min(0, player.vx + CONSTANTS.friction * dt);
  }
}

function overlaps(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function countTiles(level) {
  const counts = Object.fromEntries(Object.values(TILE).map((id) => [id, 0]));
  for (const row of level.tiles) {
    for (const tile of row) {
      counts[tile.id] = (counts[tile.id] ?? 0) + 1;
    }
  }
  return counts;
}

function cloneEntity(entity) {
  return { ...entity };
}

function nextId() {
  const id = nextEntityId;
  nextEntityId += 1;
  return id;
}


globalThis.PlatformerCore = Object.freeze({
  TILE,
  FORMS,
  MODES,
  CONSTANTS,
  createGame,
});
})(globalThis);
