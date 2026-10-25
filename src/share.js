import { FONT, CSS } from './config.js';
import { t, fmtTime } from './i18n.js';

function roundRect(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}

// Square score card sized for Facebook / Messenger. Uses the browser's text shaping, so Bangla renders correctly.
function drawCard(scene, time) {
  const c = document.createElement('canvas');
  c.width = c.height = 1080;
  const x = c.getContext('2d');

  x.fillStyle = CSS.magenta;
  x.fillRect(0, 0, 1080, 1080);
  for (let i = 45; i < 1080; i += 90) {
    for (let j = 45; j < 1080; j += 90) {
      x.fillStyle = (i + j) % 180 ? CSS.yellow : CSS.teal;
      x.beginPath();
      x.arc(i, j, 12, 0, Math.PI * 2);
      x.fill();
    }
  }

  roundRect(x, 80, 80, 920, 920, 48);
  x.fillStyle = CSS.cream;
  x.fill();
  x.lineWidth = 16;
  x.strokeStyle = CSS.magenta;
  x.stroke();
  roundRect(x, 100, 100, 880, 880, 36);
  x.lineWidth = 6;
  x.strokeStyle = CSS.yellow;
  x.stroke();

  const art = scene.textures.get('leguna-side').getSourceImage();
  x.drawImage(art, 220, 140, 640, (640 * art.height) / art.width);

  const s = fmtTime(time);
  x.textAlign = 'center';
  x.fillStyle = CSS.ink;
  x.font = `800 58px ${FONT}`;
  x.fillText(t('shareLine1'), 540, 560);
  x.fillText(t('shareLine2', { t: s }), 540, 650);
  x.fillStyle = CSS.magenta;
  x.font = `800 84px ${FONT}`;
  x.fillText(t('shareLine3'), 540, 790);
  x.fillStyle = CSS.teal;
  x.font = `800 40px ${FONT}`;
  x.fillText(`${t('title')} — ${t('subtitle')}`, 540, 900);
  return c;
}

export async function shareResult(scene, { time }) {
  const canvas = drawCard(scene, time);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], 'leguna-mama.png', { type: 'image/png' });
  const message = `${t('shareLine1')} ${t('shareLine2', { t: fmtTime(time) })} ${t('shareLine3')} ${location.href}`;

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: message, title: t('title') });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }

  // Desktop and in-app browsers without file sharing: download the image instead
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'leguna-mama.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'saved';
}
