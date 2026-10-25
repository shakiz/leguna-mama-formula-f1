import Phaser from 'phaser';
import {
  W, H, ROAD_X, ROAD_W, LANES, LANE_W, laneX, PLAYER_Y, HUD_H,
  BASE_SPEED, ACCEL, ROUTE_LENGTH, KINDS, STRETCHES, FARE_PER_PASSENGER, CLOSE_MARGIN, CLOSE_BONUS, COLORS, CSS,
} from '../config.js';
import { pick, fmtTime, num } from '../i18n.js';
import { startMusic, stopMusic, isMuted, setMuted } from '../audio/sfx.js';
import { pickMeme, getEvent, playSound } from '../memes.js';
import { load, save } from '../storage.js';
import { text, artFrame } from '../ui.js';

const MEME_COOLDOWN = 1800; // ms between non-forced meme popups
const BAR_X = 40;
const BAR_W = W - 80;
// Distance from spawn (y = -120) to the player, so the finish banner arrives as the route ends
const FINISH_BANNER_LEAD = PLAYER_Y + 120;

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
    this.road = this.add.tileSprite(W / 2, H / 2, W, H, 'road');
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
    this.stretchIdx = -1;
    this.finished = false;
    this.finishBanner = false;
    this.lastMemeAt = -Infinity;

    this.player = this.add.image(laneX(1), PLAYER_Y, 'leguna').setDepth(20);

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

    // Dev-only test keys: 1-9 spawn each vehicle kind in your lane, Shift+1-9 in the next lane over
    if (import.meta.env.DEV) {
      kb.on('keydown', (e) => {
        const kind = Object.keys(KINDS)[Number(e.code.replace('Digit', '')) - 1];
        if (!kind) return;
        const lane = e.shiftKey ? (this.lane === LANES - 1 ? this.lane - 1 : this.lane + 1) : this.lane;
        this.spawn(kind, lane);
      });
    }

    // Swipe steers as soon as the finger has moved far enough; a plain tap steers towards its side on release
    this.input.on('pointerdown', (p) => {
      this.gesture = p.y > HUD_H ? { x: p.x, handled: false } : null;
    });
    this.input.on('pointermove', (p) => {
      const g = this.gesture;
      if (!g || g.handled || !p.isDown) return;
      const dx = p.x - g.x;
      if (Math.abs(dx) > 36) {
        g.handled = true;
        this.steer(Math.sign(dx));
      }
    });
    this.input.on('pointerup', (p) => {
      const g = this.gesture;
      this.gesture = null;
      if (g && !g.handled) this.steer(p.x < W / 2 ? -1 : 1);
    });
  }

  steer(dir) {
    if (this.finished) return;
    const to = Phaser.Math.Clamp(this.lane + dir, 0, LANES - 1);
    if (to === this.lane) return;
    this.checkNearMiss(this.lane, dir);
    this.lane = to;
    this.steerTween?.stop();
    this.steerTween = this.tweens.add({ targets: this.player, x: laneX(to), duration: 130, ease: 'Sine.easeOut' });
    this.player.angle = dir * 10;
  }

  // Dodging out of a lane just before hitting something is a close turn. checkProximity pays it out
  // once the vehicle is outside the close zone; crashing into it before then cancels the payout.
  checkNearMiss(fromLane, dir) {
    const playerTop = this.player.y - this.player.displayHeight / 2;
    for (const o of this.things) {
      if (!o.kind || o.done || o.lane !== fromLane || !KINDS[o.kind].solid) continue;
      const bottom = o.y + o.displayHeight / 2;
      if (bottom <= playerTop - 150 || bottom >= playerTop + 10) continue;
      if (!o.close) this.fireEvent(dir > 0 ? 'helper_left' : 'helper_right', { meme: false });
      o.close = 'closeturn';
    }
  }

  // Coming within CLOSE_MARGIN of a vehicle without touching it: the helper shouts which side it's on
  // straight away, and the bonus lands once the vehicle has cleared the zone
  checkProximity(o) {
    const p = this.player;
    const dx = o.x - p.x;
    const gapX = Math.abs(dx) - (o.displayWidth + p.displayWidth) / 2;
    const gapY = Math.abs(o.y - p.y) - (o.displayHeight + p.displayHeight) / 2;
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

  // --- world -------------------------------------------------------------

  enterStretch(i) {
    this.stretchIdx = i;
    const st = STRETCHES[i];
    this.spawnBanner(pick(st.name), i === 0 ? COLORS.green : COLORS.teal);
    if (i > 0) this.fireEvent(`stretch_${st.id}`, { forceMeme: true });
  }

  spawnBanner(label, color) {
    const c = this.add.container(0, -120).setDepth(30);
    const g = this.add.graphics();
    const x = ROAD_X - 50;
    const w = ROAD_W + 100;
    g.fillStyle(0x555560).fillRect(x - 6, -10, 18, 60).fillRect(x + w - 12, -10, 18, 60);
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x + 6, -36, w, 84, 14);
    g.fillStyle(color).fillRoundedRect(x, -46, w, 84, 14);
    g.lineStyle(5, COLORS.yellow).strokeRoundedRect(x, -46, w, 84, 14);
    const label_ = text(this, W / 2, -4, label, 42, CSS.cream, { stroke: CSS.ink, strokeThickness: 6 }).setOrigin(0.5);
    c.add([g, label_]);
    c.vy = 0;
    this.things.push(c);
  }

  // forceKind / forceLane skip the fairness checks; the dev test keys use them
  spawn(forceKind, forceLane) {
    const st = STRETCHES[this.stretchIdx];
    const kind = forceKind ?? weightedPick(st.spawn);
    const def = KINDS[kind];
    let lane = forceLane;
    if (lane === undefined) {
      const nearTop = this.things.filter((o) => o.kind && o.y < 220);
      const free = [0, 1, 2].filter((l) => !nearTop.some((o) => o.lane === l));
      if (!free.length) return;
      // Always leave at least one lane without a solid obstacle
      if (def.solid) {
        const blocked = new Set(nearTop.filter((o) => KINDS[o.kind].solid).map((o) => o.lane));
        if (blocked.size >= LANES - 1) return;
      }
      lane = Phaser.Utils.Array.GetRandom(free);
    }
    const img = this.add.image(laneX(lane), -200, def.tex).setDepth(kind === 'puddle' ? 5 : 15);
    img.kind = kind;
    img.lane = lane;
    img.done = false;
    img.vy = def.vy * Phaser.Math.FloatBetween(0.85, 1.15);
    // Never approach faster than whatever is already ahead in the lane, so sprites don't overlap
    for (const o of this.things) {
      if (o.kind && o.lane === lane) img.vy = Math.max(img.vy, o.vy);
    }
    if (kind === 'passenger') this.tweens.add({ targets: img, angle: 10, duration: 260, yoyo: true, repeat: -1 });
    if (kind === 'cow') img.setAngle(Phaser.Math.Between(-20, 20));
    this.things.push(img);
    this.fireEvent(`spawn_${kind}`, { meme: false });
  }

  spawnDecor() {
    const left = Math.random() < 0.5;
    const tex = Math.random() < 0.6 ? 'tree' : 'stall';
    const img = this.add.image(left ? ROAD_X / 2 - 6 : W - ROAD_X / 2 + 6, -140, tex).setDepth(4);
    if (tex === 'stall') img.setFlipX(!left);
    img.vy = 0;
    this.things.push(img);
  }

  // --- collisions ---------------------------------------------------------

  collide(o) {
    const dx = Math.abs(o.x - this.player.x);
    const dy = Math.abs(o.y - this.player.y);
    if (dx > LANE_W * 0.55 || dy > ((o.displayHeight + this.player.displayHeight) / 2) * 0.8) return;
    const def = KINDS[o.kind];

    if (def.effect === 'fare') {
      o.done = true;
      this.fare += FARE_PER_PASSENGER;
      this.fireEvent('pickup');
      this.floatText(`+৳${num(FARE_PER_PASSENGER)}`, o.x, o.y, CSS.yellow);
      this.tweens.add({ targets: o, y: o.y - 40, scale: 0.3, alpha: 0, duration: 250 });
    } else if (def.effect === 'slow') {
      o.done = true;
      this.slow = 1.3;
      this.fireEvent('puddle');
      this.splash(this.player.x, this.player.y - 60);
      this.cameras.main.shake(150, 0.004);
    } else if (def.solid && this.invuln <= 0) {
      o.done = true;
      this.crashes++;
      this.speed = 0;
      this.stun = 0.8;
      this.invuln = 2;
      this.cameras.main.shake(260, 0.014);
      this.fireEvent(`crash_${o.kind}`, { forceMeme: true });
      const push = o.x < this.player.x ? -70 : 70;
      this.tweens.add({ targets: o, x: o.x + push, angle: push / 3, duration: 300, ease: 'Cubic.easeOut' });
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
    let target = BASE_SPEED * (st.speedBonus ?? 1);
    if (this.slow > 0) target *= 0.5;
    if (this.stun > 0 || this.finished) target = 0;
    this.speed = this.speed < target
      ? Math.min(target, this.speed + ACCEL * dt)
      : Math.max(target, this.speed - ACCEL * 2 * dt);

    const dy = this.speed * dt;
    this.distance += dy;
    this.road.tilePositionY -= dy;

    this.player.angle *= 0.85;
    this.player.alpha = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 ? 0.35 : 1;
    this.player.y = PLAYER_Y + Math.sin(this.time.now / 45) * (this.speed > 0 ? 1.5 : 0.6);

    const progress = Math.min(1, this.distance / ROUTE_LENGTH);
    const next = STRETCHES[this.stretchIdx + 1];
    if (next && progress >= next.at) this.enterStretch(this.stretchIdx + 1);

    if (!this.finished && this.distance < ROUTE_LENGTH - FINISH_BANNER_LEAD) {
      this.sinceSpawn += dy;
      if (this.sinceSpawn >= this.nextGap) {
        this.sinceSpawn = 0;
        this.spawn();
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

    for (let i = this.things.length - 1; i >= 0; i--) {
      const o = this.things[i];
      o.y += (this.speed - o.vy) * dt;
      if (o.y > H + 260 || o.y < -700) {
        o.destroy();
        this.things.splice(i, 1);
        continue;
      }
      if (o.kind && !o.done && !this.finished) {
        this.collide(o);
        if (!o.done && KINDS[o.kind].solid) this.checkProximity(o);
      }
    }

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
    const result = { time: this.elapsed, fare: this.fare, crashes: this.crashes, closeCalls: this.closeCalls, isBest };
    this.time.delayedCall(1800, () => this.scene.start('Result', result));
  }
}
