import Phaser from 'phaser';
import {
  W, H, ROAD_X, ROAD_W, LANES, LANE_W, laneX, PLAYER_Y, HUD_H,
  BASE_SPEED, ACCEL, ROUTE_LENGTH, KINDS, STRETCHES, FARE_PER_PASSENGER, CLOSE_MARGIN, CLOSE_BONUS, COLORS, CSS,
  BRAKE_DECEL, RED_LIGHT_FINE, JUNCTION,
} from '../config.js';
import { pick, fmtTime, num } from '../i18n.js';
import { startMusic, stopMusic, isMuted, setMuted } from '../audio/sfx.js';
import { pickMeme, getEvent, playSound } from '../memes.js';
import { load, save } from '../storage.js';
import { text, artFrame } from '../ui.js';
import { buildTrack, offsetAt, angleAt, features, zoneAt } from '../track.js';
import RoadRenderer from '../road.js';
import { ROOFS } from '../art/textures.js';

const MEME_COOLDOWN = 1800; // ms between non-forced meme popups
const BAR_X = 40;
const BAR_W = W - 80;
// Distance from spawn (y = -120) to the player, so the finish banner arrives as the route ends
const FINISH_BANNER_LEAD = PLAYER_Y + 120;
const BUILDING_GAP = 205; // rooftops are 220 tall, so neighbours overlap a little like a real street
const OVERHEAD_PARALLAX = 1.07; // overhead things slide a touch faster than the road, so they read as higher up
const SPAWN_AHEAD = PLAYER_Y + 320; // route distance ahead of the player at which set pieces are created
// Signal lamp offsets from the signal head's centre, per state
const LAMP = { red: [20, -16, 0xff3b30], yellow: [20, 3, 0xffcc00], green: [20, 22, 0x2ecc40] };

const nearJunction = (d) => features.some((f) => f.type === 'junction' && Math.abs(d - f.d) < JUNCTION.clear);

// Everything in the world lives in road coordinates: rx is the sideways position on a straight road
// (what laneX gives) and ry the screen row. place() bends that onto the screen, so gameplay, lanes and
// collisions never need to know about curves. Optional extras: tilt (deg) and lift (px) for animations.

function weightedPick(weights) {
  const entries = Object.entries(weights);
  let r = Math.random() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[0][0];
}

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    buildTrack();
    this.road = new RoadRenderer(this, this);
    this.things = [];
    this.lane = 1;
    this.speed = 0;
    this.distance = 0;
    this.elapsed = 0;
    this.fare = 0;
    this.crashes = 0;
    this.closeCalls = 0;
    this.eventAt = {};
    this.stun = 0;
    this.invuln = 0;
    this.slow = 0;
    this.sinceSpawn = 0;
    this.nextGap = 700;
    this.sinceDecor = 0;
    this.sinceBuilding = 0;
    this.sinceDecal = 0;
    this.sinceWires = 600;
    this.featureIdx = 0;
    this.junction = null;
    this.braking = false;
    this.flooded = false;
    this.hop = 0;
    this.fines = 0;
    this.playerOff = 0;
    this.stretchIdx = -1;
    this.finished = false;
    this.finishBanner = false;
    this.lastMemeAt = -Infinity;

    this.player = this.add.image(0, 0, 'leguna').setDepth(20);
    this.player.rx = laneX(1);
    this.player.ry = PLAYER_Y;
    this.player.tilt = 0;

    // Fill the street before the first frame so the roadside isn't empty at the start
    for (let y = H + 110; y > -160; y -= BUILDING_GAP) this.spawnBuildings(y);
    for (let y = H + 60; y > -140; y -= 240) this.spawnDecor(y);

    this.createHud();
    this.setupInput();
    this.enterStretch(0);
    this.fireEvent('start', { forceMeme: true });
    startMusic();
    this.events.once('shutdown', () => stopMusic());
  }

  // --- input -------------------------------------------------------------

  setupInput() {
    const kb = this.input.keyboard;
    kb.on('keydown-LEFT', () => this.steer(-1));
    kb.on('keydown-A', () => this.steer(-1));
    kb.on('keydown-RIGHT', () => this.steer(1));
    kb.on('keydown-D', () => this.steer(1));
    for (const key of ['DOWN', 'S']) {
      kb.on(`keydown-${key}`, () => (this.braking = true));
      kb.on(`keyup-${key}`, () => (this.braking = false));
    }

    // Dev-only test keys: 1-9 spawn each vehicle kind in your lane, Shift+1-9 in the next lane over
    if (import.meta.env.DEV) {
      kb.on('keydown', (e) => {
        const kind = Object.keys(KINDS)[Number(e.code.replace('Digit', '')) - 1];
        if (!kind) return;
        const lane = e.shiftKey ? (this.lane === LANES - 1 ? this.lane - 1 : this.lane + 1) : this.lane;
        this.spawn(kind, lane);
      });
      // C toggles a line down the middle of the road, for tuning bends
      kb.on('keydown-C', () => {
        this.road.showCentre = !this.road.showCentre;
      });
    }

    // Swipe sideways steers as soon as the finger has moved far enough, swipe down brakes until the
    // finger lifts, and a plain tap steers towards its side on release
    this.input.on('pointerdown', (p) => {
      this.gesture = p.y > HUD_H ? { x: p.x, y: p.y, handled: false, brake: false } : null;
    });
    this.input.on('pointermove', (p) => {
      const g = this.gesture;
      if (!g || g.handled || !p.isDown) return;
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      if (dy > 40 && dy > Math.abs(dx)) {
        g.handled = g.brake = true;
        this.braking = true;
      } else if (Math.abs(dx) > 36) {
        g.handled = true;
        this.steer(Math.sign(dx));
      }
    });
    this.input.on('pointerup', (p) => {
      const g = this.gesture;
      this.gesture = null;
      if (g?.brake) this.braking = false;
      else if (g && !g.handled) this.steer(p.x < W / 2 ? -1 : 1);
    });
  }

  steer(dir) {
    if (this.finished) return;
    const to = Phaser.Math.Clamp(this.lane + dir, 0, LANES - 1);
    if (to === this.lane) return;
    this.checkNearMiss(this.lane, dir);
    this.lane = to;
    this.steerTween?.stop();
    this.steerTween = this.tweens.add({ targets: this.player, rx: laneX(to), duration: 130, ease: 'Sine.easeOut' });
    this.player.tilt = dir * 10;
  }

  // Dodging out of a lane just before hitting something is a close turn. checkProximity pays it out
  // once the vehicle is outside the close zone; crashing into it before then cancels the payout.
  checkNearMiss(fromLane, dir) {
    const playerTop = PLAYER_Y - this.player.displayHeight / 2;
    for (const o of this.things) {
      if (!o.kind || o.done || o.lane !== fromLane || !KINDS[o.kind].solid) continue;
      const bottom = o.ry + o.displayHeight / 2;
      if (bottom <= playerTop - 150 || bottom >= playerTop + 10) continue;
      if (!o.close) this.fireEvent(dir > 0 ? 'helper_left' : 'helper_right', { meme: false });
      o.close = 'closeturn';
    }
  }

  // Coming within CLOSE_MARGIN of a vehicle without touching it: the helper shouts which side it's on
  // straight away, and the bonus lands once the vehicle has cleared the zone
  checkProximity(o) {
    const p = this.player;
    const dx = o.rx - p.rx;
    const gapX = Math.abs(dx) - ((o.colW ?? o.displayWidth) + p.displayWidth) / 2;
    const gapY = Math.abs(o.ry - PLAYER_Y) - ((o.colH ?? o.displayHeight) + p.displayHeight) / 2;
    const inZone = gapX < CLOSE_MARGIN && gapY < CLOSE_MARGIN;
    if (inZone && !o.close) {
      o.close = 'close';
      const side = Math.abs(dx) < 40 ? 'ahead' : dx < 0 ? 'left' : 'right';
      this.fireEvent(`helper_${side}`, { meme: false });
    } else if (!inZone && o.close && !o.closePaid) {
      o.closePaid = true;
      this.closeCalls++;
      this.fare += CLOSE_BONUS;
      this.floatText(`+৳${num(CLOSE_BONUS)}`, p.x, p.y - 120, CSS.cream);
      this.fireEvent(`${o.close}_${o.kind}`);
    }
  }

  // --- road geometry -------------------------------------------------------

  // Route distance shown at screen row y, and the row showing route distance d
  distAt(y) {
    return this.distance + (PLAYER_Y - y);
  }

  yOf(d) {
    return PLAYER_Y - (d - this.distance);
  }

  // Sideways shift of row y, relative to the player's row so the leguna stays put and the road bends around it
  offAt(y) {
    return offsetAt(this.distAt(y)) - this.playerOff;
  }

  place(o) {
    o.x = o.rx + this.offAt(o.ry);
    o.y = o.ry + (o.lift ?? 0);
    o.rotation = angleAt(this.distAt(o.ry)) + Phaser.Math.DegToRad(o.tilt ?? 0);
  }

  // --- world -------------------------------------------------------------

  enterStretch(i) {
    this.stretchIdx = i;
    const st = STRETCHES[i];
    this.spawnBanner(pick(st.name), i === 0 ? COLORS.green : COLORS.teal);
    if (i > 0) this.fireEvent(`stretch_${st.id}`, { forceMeme: true });
  }

  spawnBanner(label, color) {
    // Built around the road's centre so it pivots correctly on bends
    const c = this.add.container(0, 0).setDepth(30);
    c.rx = W / 2;
    c.ry = -120;
    const g = this.add.graphics();
    const x = ROAD_X - 50 - W / 2;
    const w = ROAD_W + 100;
    g.fillStyle(0x555560).fillRect(x - 6, -10, 18, 60).fillRect(x + w - 12, -10, 18, 60);
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x + 6, -36, w, 84, 14);
    g.fillStyle(color).fillRoundedRect(x, -46, w, 84, 14);
    g.lineStyle(5, COLORS.yellow).strokeRoundedRect(x, -46, w, 84, 14);
    const label_ = text(this, 0, -4, label, 42, CSS.cream, { stroke: CSS.ink, strokeThickness: 6 }).setOrigin(0.5);
    c.add([g, label_]);
    c.vy = 0;
    this.place(c);
    this.things.push(c);
  }

  // forceKind / forceLane skip the fairness checks; the dev test keys use them
  spawn(forceKind, forceLane) {
    const st = STRETCHES[this.stretchIdx];
    const kind = forceKind ?? weightedPick(st.spawn);
    const def = KINDS[kind];
    let lane = forceLane;
    if (lane === undefined) {
      const nearTop = this.things.filter((o) => o.kind && o.ry < 220);
      const free = [0, 1, 2].filter((l) => !nearTop.some((o) => o.lane === l));
      if (!free.length) return;
      // Always leave at least one lane without a solid obstacle
      if (def.solid) {
        const blocked = new Set(nearTop.filter((o) => KINDS[o.kind].solid).map((o) => o.lane));
        if (blocked.size >= LANES - 1) return;
      }
      lane = Phaser.Utils.Array.GetRandom(free);
    }
    const img = this.makeThing(kind, laneX(lane), -200, lane);
    // Never approach faster than whatever is already ahead in the lane, so sprites don't overlap
    for (const o of this.things) {
      if (o.kind && o.lane === lane) img.vy = Math.max(img.vy, o.vy);
    }
    if (kind === 'passenger') this.tweens.add({ targets: img, tilt: 10, duration: 260, yoyo: true, repeat: -1 });
    if (kind === 'cow') img.tilt = Phaser.Math.Between(-20, 20);
    this.fireEvent(`spawn_${kind}`, { meme: false });
  }

  makeThing(kind, rx, ry, lane, tex) {
    const def = KINDS[kind];
    const img = this.add.image(0, 0, tex ?? def.tex).setDepth(def.depth ?? (kind === 'puddle' ? 5 : 15));
    Object.assign(img, { rx, ry, kind, lane, done: false, vy: def.vy * Phaser.Math.FloatBetween(0.85, 1.15) });
    this.place(img);
    this.things.push(img);
    return img;
  }

  // Scenery with no gameplay: rooftops, stalls, decals, overhead wires...
  makeProp(tex, rx, ry, depth, extra = {}) {
    const img = this.add.image(0, 0, tex).setDepth(depth);
    Object.assign(img, { rx, ry, vy: 0 }, extra);
    this.place(img);
    this.things.push(img);
    return img;
  }

  // --- set pieces ----------------------------------------------------------

  spawnFeature(f) {
    const ry = this.yOf(f.d);
    if (f.type === 'speedbreaker') {
      this.makeThing('speedbreaker', W / 2, ry, -1);
    } else if (f.type === 'zebra') {
      this.spawnPedestrians(ry);
    } else if (f.type === 'footbridge') {
      this.makeProp('footbridge', W / 2, ry + 46, 6, { tint: 0x000000, alpha: 0.25 });
      this.makeProp('footbridge', W / 2, ry, 40, { par: OVERHEAD_PARALLAX });
    } else if (f.type === 'bunting') {
      this.makeProp('bunting', W / 2, ry, 40, { par: OVERHEAD_PARALLAX });
    } else if (f.type === 'junction') {
      this.setupJunction(f.d);
    }
  }

  // People crossing at a zebra, walking from either pavement
  spawnPedestrians(ry) {
    for (const [i, dir] of [[0, 1], [1, -1]]) {
      const rx = dir > 0 ? ROAD_X - 30 - i * 60 : ROAD_X + ROAD_W + 30 + i * 60;
      const ped = this.makeThing('pedestrian', rx, ry + (i ? 30 : -30), -1, i ? 'ped1' : 'ped0');
      ped.vx = dir * Phaser.Math.Between(70, 95);
      ped.tilt = dir * 90;
    }
    this.fireEvent('spawn_pedestrian', { meme: false });
  }

  setupJunction(dj) {
    const J = JUNCTION;
    const signalRy = this.yOf(dj - J.zebra[1] - 40);
    const j = { dj, stopD: dj - J.stopLine, state: 'green', timer: 0, waited: 0, cycled: false, sinceCross: 1, dir: 1, lamps: [] };
    for (const left of [true, false]) {
      const rx = left ? ROAD_X - 44 : ROAD_X + ROAD_W + 44;
      const head = this.makeProp('signal', rx, signalRy, 41);
      head.setFlipX(!left);
      const lamp = this.add.circle(0, 0, 8, LAMP.green[2]).setDepth(42);
      Object.assign(lamp, { rx, ry: signalRy, vy: 0, head, side: left ? 1 : -1 });
      this.things.push(lamp);
      j.lamps.push(lamp);
    }
    this.makeProp('police', ROAD_X + ROAD_W + 64, this.yOf(dj + J.halfWidth + 80), 14);
    this.junction = j;
    this.setSignal('green');
  }

  setSignal(state) {
    const j = this.junction;
    j.state = state;
    for (const lamp of j.lamps) lamp.setFillStyle(LAMP[state][2]);
  }

  // The Asad Gate signal: turns as the leguna approaches, holds red until it has waited at the line
  // (or the light times out), and fines anyone who crosses the stop line on red
  updateJunction(dt) {
    const j = this.junction;
    if (!j) return;
    for (const lamp of j.lamps) {
      const [dx, dy] = LAMP[j.state];
      lamp.rx = lamp.head.rx + lamp.side * dx;
      lamp.ry = lamp.head.ry + dy;
    }
    const front = this.distance + this.player.displayHeight / 2;
    const toStop = j.stopD - front;
    if (j.state === 'green' && !j.cycled && toStop < 1500) {
      this.setSignal('yellow');
      j.timer = 1.4;
      this.fireEvent('signal_yellow', { meme: false });
    } else if (j.state === 'yellow') {
      j.timer -= dt;
      if (j.timer <= 0) {
        this.setSignal('red');
        j.timer = 7;
        this.fireEvent('signal_red', { forceMeme: true });
      }
    } else if (j.state === 'red') {
      j.timer -= dt;
      if (toStop > -10 && this.speed < 15) j.waited += dt;
      j.sinceCross += dt;
      if (j.sinceCross > 0.9) {
        j.sinceCross = 0;
        this.spawnCrossTraffic(j);
      }
      if (j.waited > 2.2 || j.timer <= 0) {
        this.setSignal('green');
        j.cycled = true;
        this.fireEvent(j.waited > 2.2 ? 'stopped_at_red' : 'signal_green', { forceMeme: true });
      }
    }
    if (j.state === 'red' && !j.violated && j.prevToStop > 0 && toStop <= 0) {
      j.violated = true;
      this.fines += RED_LIGHT_FINE;
      this.fare = Math.max(0, this.fare - RED_LIGHT_FINE);
      this.floatText(`-৳${num(RED_LIGHT_FINE)}`, this.player.x, PLAYER_Y - 120, '#ff6b6b');
      this.fireEvent('red_light', { forceMeme: true });
    }
    j.prevToStop = toStop;
    if (toStop < -2000) this.junction = null;
  }

  // Traffic crossing the junction on red; driving on the left, so eastbound uses the far lane
  spawnCrossTraffic(j) {
    const dir = (j.dir = -j.dir);
    const kind = Phaser.Utils.Array.GetRandom(['car', 'car', 'cng', 'bus', 'rickshaw']);
    const o = this.makeThing(kind, dir > 0 ? -260 : W + 260, this.yOf(j.dj + dir * 48), -1);
    o.vy = 0;
    o.vx = dir * (kind === 'rickshaw' ? 170 : 360);
    o.tilt = dir * 90;
    o.colW = o.displayHeight;
    o.colH = o.displayWidth;
  }

  // Random spawns pause while the signal is ahead, so the junction is about the light and cross traffic
  junctionAhead() {
    const j = this.junction;
    return j && !j.cycled && j.dj - this.distance < 2600;
  }

  spawnDecor(ry = -140) {
    const d = this.distAt(ry);
    if (nearJunction(d)) return;
    const left = Math.random() < 0.5;
    if (!left && zoneAt(d, 'busstand')) return;
    // The avenue's left side is a planted median: trees only
    const tex = Math.random() < 0.6 || (left && zoneAt(d, 'avenue')) ? 'tree' : 'stall';
    const img = this.makeProp(tex, left ? ROAD_X / 2 - 6 : W - ROAD_X / 2 + 6, ry, 4);
    if (tex === 'stall') img.setFlipX(!left);
  }

  // A rooftop on each side beyond the pavement; mostly off-screen until a bend slides the road over.
  // Lawns along the avenue, parked buses at the bus stand, and nothing on the junction's cross road.
  spawnBuildings(ry = -160) {
    const d = this.distAt(ry);
    if (nearJunction(d)) return;
    if (zoneAt(d, 'avenue')) {
      if (Math.random() < 0.6) this.makeProp('tree', -Phaser.Math.Between(40, 160), ry, 3);
    } else {
      this.makeProp(Phaser.Utils.Array.GetRandom(ROOFS), -102, ry, 3, { flipX: Math.random() < 0.5 });
    }
    if (zoneAt(d, 'busstand')) {
      this.makeProp('bus', W + 80, ry, 3, { tilt: Math.random() < 0.5 ? 90 : -90 });
    } else {
      this.makeProp(Phaser.Utils.Array.GetRandom(ROOFS), W + 102, ry, 3, { flipX: Math.random() < 0.5 });
    }
  }

  spawnDecal() {
    if (nearJunction(this.distAt(-150))) return;
    const tex = Phaser.Utils.Array.GetRandom(['patch', 'crack', 'oil', 'crack']);
    this.makeProp(tex, Phaser.Math.Between(ROAD_X + 60, ROAD_X + ROAD_W - 60), -150, 1, { tilt: Phaser.Math.Between(0, 1) * 180 });
  }

  // --- collisions ---------------------------------------------------------

  collide(o) {
    const def = KINDS[o.kind];
    const p = this.player;
    const dx = Math.abs(o.rx - p.rx);
    const dy = Math.abs(o.ry - PLAYER_Y);
    if (!def.span && dx > (((o.colW ?? o.displayWidth) + p.displayWidth) / 2) * 0.75) return;
    if (dy > (((o.colH ?? o.displayHeight) + p.displayHeight) / 2) * 0.8) return;

    if (def.effect === 'fare') {
      o.done = true;
      this.fare += FARE_PER_PASSENGER;
      this.fireEvent('pickup');
      this.floatText(`+৳${num(FARE_PER_PASSENGER)}`, o.x, o.y, CSS.yellow);
      this.tweens.add({ targets: o, lift: -40, scale: 0.3, alpha: 0, duration: 250 });
    } else if (def.effect === 'slow') {
      o.done = true;
      this.slow = 1.3;
      this.fireEvent('puddle');
      this.splash(this.player.x, this.player.y - 60);
      this.cameras.main.shake(150, 0.004);
    } else if (def.effect === 'bump') {
      // Speed breaker: everyone goes over it; take it fast and the leguna takes off
      o.done = true;
      const fast = this.speed > BASE_SPEED * 0.8;
      this.fireEvent('speedbreaker', { forceMeme: fast });
      this.cameras.main.shake(fast ? 260 : 140, fast ? 0.012 : 0.005);
      this.tweens.add({ targets: this, hop: fast ? -18 : -6, duration: 120, yoyo: true });
      if (fast) this.slow = 0.5;
    } else if (def.effect === 'jolt') {
      o.done = true;
      this.slow = 0.7;
      this.fireEvent('pothole');
      this.cameras.main.shake(220, 0.01);
    } else if (def.solid && this.invuln <= 0) {
      o.done = true;
      this.crashes++;
      this.speed = 0;
      this.stun = 0.8;
      this.invuln = 2;
      this.cameras.main.shake(260, 0.014);
      this.fireEvent(`crash_${o.kind}`, { forceMeme: true });
      if (o.vx) o.vx = 0;
      const push = o.rx < this.player.rx ? -70 : 70;
      this.tweens.add({ targets: o, rx: o.rx + push, tilt: (o.tilt ?? 0) + push / 3, duration: 300, ease: 'Cubic.easeOut' });
    }
  }

  floatText(str, x, y, color) {
    const label = text(this, x, y, str, 40, color, { stroke: CSS.ink, strokeThickness: 6 }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: label, y: y - 110, alpha: 0, duration: 800, onComplete: () => label.destroy() });
  }

  splash(x, y) {
    for (let i = 0; i < 10; i++) {
      const d = this.add.circle(x, y, Phaser.Math.Between(5, 11), 0x8ec5f2).setDepth(25);
      const a = Phaser.Math.FloatBetween(-Math.PI, 0);
      this.tweens.add({
        targets: d,
        x: x + Math.cos(a) * Phaser.Math.Between(60, 130),
        y: y + Math.sin(a) * Phaser.Math.Between(40, 110),
        alpha: 0,
        duration: 450,
        onComplete: () => d.destroy(),
      });
    }
  }

  // --- events & memes -------------------------------------------------------

  // Every game event goes through here: its sound and caption (from memes.json `events`, with a
  // per-event cooldown), then a meme popup (shared cooldown), then any chained follow-up events
  fireEvent(name, { forceMeme = false, meme = true } = {}) {
    const ev = getEvent(name);
    if (ev.chance !== undefined && Math.random() > ev.chance) return;
    const now = this.time.now;
    if (now - (this.eventAt[name] ?? -Infinity) >= (ev.cooldown ?? 0)) {
      this.eventAt[name] = now;
      playSound(ev);
      if (ev.caption) this.callout(pick(ev.caption));
    }
    if (meme && (ev.memeChance === undefined || Math.random() < ev.memeChance)) this.meme(name, forceMeme);
    for (const next of ev.chain ?? []) this.time.delayedCall(next.delay ?? 0, () => this.fireEvent(next.event));
  }

  meme(trigger, force = false) {
    const now = this.time.now;
    if (!force && now - this.lastMemeAt < MEME_COOLDOWN) return;
    const m = pickMeme(trigger);
    if (!m) return;
    this.lastMemeAt = now;
    playSound(m);
    this.showBubble(pick(m));
  }

  // The helper hanging off the back of the leguna shouts a warning
  callout(str) {
    this.calloutLabel?.destroy();
    const label = text(this, this.player.x, PLAYER_Y + 128, `🗣️ ${str}`, 30, CSS.ink, {
      backgroundColor: CSS.yellow,
      padding: { left: 16, right: 16, top: 10, bottom: 6 },
    }).setOrigin(0.5).setDepth(55);
    label.x = Phaser.Math.Clamp(label.x, label.width / 2 + 12, W - label.width / 2 - 12);
    label.setScale(0.4);
    this.calloutLabel = label;
    this.tweens.add({ targets: label, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({ targets: label, alpha: 0, delay: 750, duration: 200, onComplete: () => label.destroy() });
  }

  showBubble(str) {
    this.bubble?.destroy();
    const c = this.add.container(W / 2, 300).setDepth(60);
    const label = text(this, 0, 0, str, 36, CSS.ink, { align: 'center', wordWrap: { width: 500 } }).setOrigin(0.5);
    const w = Math.max(320, label.width + 80);
    const h = label.height + 44;
    const g = this.add.graphics();
    artFrame(g, -w / 2, -h / 2, w, h);
    c.add([g, label]);
    c.setScale(0);
    this.bubble = c;
    this.tweens.add({ targets: c, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: 1700, duration: 300, onComplete: () => c.destroy() });
  }

  // --- HUD -----------------------------------------------------------------

  createHud() {
    const g = this.add.graphics().setDepth(90);
    g.fillStyle(COLORS.ink, 0.92).fillRect(0, 0, W, HUD_H);
    for (let x = 0; x < W; x += 40) g.fillStyle((x / 40) % 2 ? COLORS.magenta : COLORS.yellow).fillRect(x, HUD_H - 10, 40, 10);

    // Route progress: a track with a dot per stretch and a little leguna riding along it
    g.lineStyle(8, COLORS.cream, 0.4).lineBetween(BAR_X, 112, BAR_X + BAR_W, 112);
    for (const st of STRETCHES) g.fillStyle(COLORS.teal).fillCircle(BAR_X + BAR_W * st.at, 112, 8);
    g.fillStyle(COLORS.magenta).fillCircle(BAR_X + BAR_W, 112, 11);
    this.marker = this.add.image(BAR_X, 104, 'leguna-side').setScale(0.1).setDepth(91);

    this.hudTime = text(this, 28, 14, '', 40, CSS.yellow).setDepth(91);
    this.hudFare = text(this, W / 2, 14, '', 40, CSS.cream).setOrigin(0.5, 0).setDepth(91);
    const mute = text(this, W - 28, 14, isMuted() ? '🔇' : '🔊', 40, CSS.cream).setOrigin(1, 0).setDepth(91);
    mute.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      setMuted(!isMuted());
      mute.setText(isMuted() ? '🔇' : '🔊');
    });
  }

  updateHud(progress) {
    this.hudTime.setText(`⏱ ${fmtTime(this.elapsed)}`);
    this.hudFare.setText(`৳ ${num(this.fare)}`);
    this.marker.x = BAR_X + BAR_W * progress;
  }

  // --- loop ----------------------------------------------------------------

  update(_, deltaMs) {
    const dt = Math.min(deltaMs, 50) / 1000;
    if (!this.finished) this.elapsed += dt;
    this.stun = Math.max(0, this.stun - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.slow = Math.max(0, this.slow - dt);

    const st = STRETCHES[this.stretchIdx];
    const wasFlooded = this.flooded;
    this.flooded = !!zoneAt(this.distance, 'flood');
    if (this.flooded && !wasFlooded) this.fireEvent('zone_flood', { forceMeme: true });

    let target = BASE_SPEED * (st.speedBonus ?? 1);
    if (this.flooded) target *= 0.7;
    if (this.slow > 0) target *= 0.5;
    if (this.stun > 0 || this.finished || this.braking) target = 0;
    this.speed = this.speed < target
      ? Math.min(target, this.speed + ACCEL * dt)
      : Math.max(target, this.speed - (this.braking ? BRAKE_DECEL : ACCEL * 2) * dt);
    const brakeTex = this.braking && !this.finished ? 'legunaBrake' : 'leguna';
    if (this.player.texture.key !== brakeTex) this.player.setTexture(brakeTex);

    const dy = this.speed * dt;
    this.distance += dy;
    this.playerOff = offsetAt(this.distance);

    this.player.tilt *= 0.85;
    this.player.alpha = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 ? 0.35 : 1;
    this.player.lift = Math.sin(this.time.now / 45) * (this.speed > 0 ? 1.5 : 0.6) + this.hop;
    if (this.flooded && this.speed > 120 && Math.random() < dt * 3) this.splash(this.player.x, PLAYER_Y + 90);

    const progress = Math.min(1, this.distance / ROUTE_LENGTH);
    const next = STRETCHES[this.stretchIdx + 1];
    if (next && progress >= next.at) this.enterStretch(this.stretchIdx + 1);

    while (this.featureIdx < features.length && features[this.featureIdx].d - this.distance <= SPAWN_AHEAD) {
      this.spawnFeature(features[this.featureIdx++]);
    }
    this.updateJunction(dt);

    if (!this.finished && this.distance < ROUTE_LENGTH - FINISH_BANNER_LEAD) {
      this.sinceSpawn += dy;
      if (this.sinceSpawn >= this.nextGap) {
        this.sinceSpawn = 0;
        if (!this.junctionAhead()) this.spawn();
        this.nextGap = Phaser.Math.Between(...STRETCHES[this.stretchIdx].gap);
      }
    }
    if (!this.finishBanner && this.distance >= ROUTE_LENGTH - FINISH_BANNER_LEAD) {
      this.finishBanner = true;
      this.spawnBanner(`🏁 ${pick(STRETCHES[STRETCHES.length - 1].name)}`, COLORS.magenta);
    }
    this.sinceDecor += dy;
    if (this.sinceDecor > 240) {
      this.sinceDecor = 0;
      this.spawnDecor();
    }
    this.sinceBuilding += dy;
    if (this.sinceBuilding > BUILDING_GAP) {
      this.sinceBuilding -= BUILDING_GAP;
      this.spawnBuildings(-160 + this.sinceBuilding);
    }
    this.sinceDecal += dy;
    if (this.sinceDecal > 430) {
      this.sinceDecal = 0;
      this.spawnDecal();
    }
    this.sinceWires += dy;
    if (this.sinceWires > 1150) {
      this.sinceWires = 0;
      this.makeProp('wires', W / 2 + Phaser.Math.Between(-60, 60), -300, 40, { par: OVERHEAD_PARALLAX });
    }

    for (let i = this.things.length - 1; i >= 0; i--) {
      const o = this.things[i];
      o.ry += (this.speed * (o.par ?? 1) - o.vy) * dt;
      if (o.vx) {
        o.rx += o.vx * dt;
        // Things moving sideways (pedestrians, cross traffic) count as in a lane only while on the road
        if (o.kind && !o.colW) o.lane = o.rx > ROAD_X && o.rx < ROAD_X + ROAD_W ? Math.floor((o.rx - ROAD_X) / LANE_W) : -1;
      }
      if (o.ry > H + 260 || o.ry < -700 || o.rx < -400 || o.rx > W + 400) {
        o.destroy();
        this.things.splice(i, 1);
        continue;
      }
      if (o.kind && !o.done && !this.finished) {
        this.collide(o);
        const def = KINDS[o.kind];
        if (!o.done && def.solid) this.checkProximity(o);
        // The helper spots hazards coming up in our lane
        if (def.warn && !o.warned && o.lane === this.lane && PLAYER_Y - o.ry < 380 && PLAYER_Y - o.ry > 0) {
          o.warned = true;
          this.fireEvent(def.warn, { meme: false });
        }
      }
      this.place(o);
    }
    this.place(this.player);
    this.road.draw();

    this.updateHud(progress);
    if (!this.finished && progress >= 1) this.finish();
  }

  finish() {
    this.finished = true;
    stopMusic();
    const best = load('best', null);
    const isBest = best === null || this.elapsed < best;
    if (isBest) save('best', this.elapsed);
    this.fireEvent(isBest && best !== null ? 'newbest' : 'finish', { forceMeme: true });
    const result = { time: this.elapsed, fare: this.fare, crashes: this.crashes, closeCalls: this.closeCalls, fines: this.fines, isBest };
    this.time.delayedCall(1800, () => this.scene.start('Result', result));
  }
}
