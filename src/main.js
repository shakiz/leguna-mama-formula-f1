import Phaser from 'phaser';
import { W, H } from './config.js';
import { getLang } from './i18n.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import ResultScene from './scenes/ResultScene.js';

// Canvas text needs the Bangla font loaded before the first frame, or it falls back silently
function fontsReady() {
  const loads = Promise.all([
    document.fonts.load('800 40px "Noto Sans Bengali"', 'লেগুনা মামা'),
    document.fonts.load('500 28px "Noto Sans Bengali"', 'মামা'),
  ]).catch(() => {});
  return Promise.race([loads, new Promise((r) => setTimeout(r, 3000))]);
}

document.documentElement.lang = getLang();

fontsReady().then(() => {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: '#1a1a2e',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // Sound is synthesised in audio/sfx.js; Phaser's own audio system isn't needed
    audio: { noAudio: true },
    input: { activePointers: 2 },
    disableContextMenu: true,
    scene: [BootScene, MenuScene, GameScene, ResultScene],
  });
  // Handy for poking at scenes from the console during development
  if (import.meta.env.DEV) window.__game = game;
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
