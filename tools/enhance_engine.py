"""Turn a phone recording of a leguna engine into the game's seamless engine loop (mono MP3).

    python3 -m venv .venv && .venv/bin/pip install numpy scipy lameenc
    .venv/bin/python -I tools/enhance_engine.py ~/Downloads/leguna-engine.mp3 \
        public/audio/engine/leguna-engine.mp3

Decoding: a .wav input is read directly; anything else (MP3, M4A, ...) is first decoded to a
temporary 16-bit WAV with macOS `afconvert -f WAVE -d LEI16`, or with `ffmpeg` where that exists.
The same decoder reads the finished MP3 back to check its peak and loop seam.

Chain: downmix to mono, DC removal, 70 Hz high-pass (rumble below the engine's lowest harmonic),
+3 dB bell at 160 Hz (body), -4 dB high shelf from 5 kHz and a 10 kHz low-pass (hiss and wind),
then the steadiest stretch is picked (flattest level, matching level at both ends), lightly
compressed (2.5:1, 10 ms / 150 ms), its tail crossfaded into its head, and peak-normalised.

Loop layout: the file holds PAD s of the loop's end, the loop itself (exactly --length s), then PAD
s of its start. The audio repeats with period --length throughout, so any loopStart inside it gives
a click-free loop as long as loopEnd = loopStart + length. That makes it immune to MP3 encoder and
decoder padding, which browsers do or don't trim. sfx.js plays it with loopStart = PAD and
loopEnd = PAD + length; change ENGINE_LOOP there if you change --length.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile

import lameenc
import numpy as np
from scipy import signal
from scipy.io import wavfile

PAD = 0.1  # s of wrap-around audio before and after the loop; covers any MP3 padding (< 0.06 s)

ap = argparse.ArgumentParser()
ap.add_argument('src')
ap.add_argument('out')
ap.add_argument('--length', type=float, default=3.5, help='loop length in seconds (rounded to 147-sample steps)')
ap.add_argument('--start', type=float, help='use the section starting here (s) instead of the steadiest one')
ap.add_argument('--kbps', type=int, default=64)
ap.add_argument('--peak', type=float, default=-1.0, help='target peak, dBFS')
args = ap.parse_args()


def log(msg):
    print(msg, file=sys.stderr)


def db(v):
    return 20 * np.log10(max(float(v), 1e-12))


def decode(path):
    if path.lower().endswith('.wav'):
        sr, x = wavfile.read(path)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            wav = os.path.join(tmp, 'decoded.wav')
            if shutil.which('afconvert'):
                cmd = ['afconvert', '-f', 'WAVE', '-d', 'LEI16', path, wav]
            elif shutil.which('ffmpeg'):
                cmd = ['ffmpeg', '-loglevel', 'error', '-i', path, '-c:a', 'pcm_s16le', wav]
            else:
                sys.exit('Need afconvert (macOS) or ffmpeg to decode ' + path)
            subprocess.run(cmd, check=True)
            sr, x = wavfile.read(wav)
    x = x.astype(np.float64) / (32768 if x.dtype == np.int16 else 1)
    return sr, x


def stats(name, x, sr):
    f, p = signal.welch(x, sr, nperseg=8192)
    tot = p.sum()
    share = lambda a, b: 100 * p[(f >= a) & (f < b)].sum() / tot
    w = int(0.05 * sr)
    r = [db(np.sqrt(np.mean(x[i:i + w] ** 2))) for i in range(0, len(x) - w, w)]
    r = [v for v in r if v > -100]  # ignore digital silence where the phone started recording
    log(f'{name}: {len(x) / sr:.2f} s, peak {db(np.abs(x).max()):.1f} dBFS, RMS {db(np.sqrt(np.mean(x ** 2))):.1f} dBFS, '
        f'50 ms RMS spread {np.std(r):.1f} dB, quietest 50 ms {min(r):.1f} dBFS; energy <80 Hz {share(0, 80):.1f}%, '
        f'80-320 {share(80, 320):.1f}%, 320-1250 {share(320, 1250):.1f}%, 1.25-5k {share(1250, 5000):.1f}%, '
        f'>5k {share(5000, sr / 2):.1f}%')


def biquad(kind, f0, sr, q=0.707, gain_db=0.0):
    # RBJ cookbook biquads as second-order sections
    a = 10 ** (gain_db / 40)
    w = 2 * np.pi * f0 / sr
    cw, alpha = np.cos(w), np.sin(w) / (2 * q)
    if kind == 'peak':
        b = [1 + alpha * a, -2 * cw, 1 - alpha * a]
        den = [1 + alpha / a, -2 * cw, 1 - alpha / a]
    elif kind == 'highshelf':
        s = 2 * np.sqrt(a) * alpha
        b = [a * ((a + 1) + (a - 1) * cw + s), -2 * a * ((a - 1) + (a + 1) * cw), a * ((a + 1) + (a - 1) * cw - s)]
        den = [(a + 1) - (a - 1) * cw + s, 2 * ((a - 1) - (a + 1) * cw), (a + 1) - (a - 1) * cw - s]
    b, den = np.array(b) / den[0], np.array(den) / den[0]
    return np.concatenate([b, den])[None, :]


def rms_env(x, sr, win):
    n = max(1, int(win * sr))
    return np.sqrt(np.convolve(x ** 2, np.ones(n) / n, mode='same') + 1e-12)


sr, x = decode(args.src)
if x.ndim == 2:
    log(f'input: {x.shape[1]} channels, L/R correlation {np.corrcoef(x[:, 0], x[:, 1])[0, 1]:.4f} -> mono')
    x = x.mean(1)
stats('raw', x, sr)

# 1. DC and sub-rumble out, body in, hiss down. Zero-phase so nothing smears the firing pulses.
x = x - x.mean()
sos = np.vstack([
    signal.butter(2, 70, 'highpass', fs=sr, output='sos'),
    biquad('peak', 160, sr, q=0.9, gain_db=3),
    biquad('highshelf', 5000, sr, q=0.707, gain_db=-4),
    signal.butter(2, 10000, 'lowpass', fs=sr, output='sos'),
])
y = signal.sosfiltfilt(sos, x)
stats('filtered', y, sr)

# 2. Steadiest section: loop length is a multiple of 147 samples at 44.1 kHz so it is a whole number
# of samples at 48 kHz too (decodeAudioData resamples to the device rate)
step = sr // 300 if sr % 300 == 0 else 1
n = int(round(args.length * sr / step)) * step
xf = int(0.25 * sr)  # crossfade
need = n + xf
if need > len(y):
    sys.exit(f'Recording too short: need {need / sr:.2f} s')
lvl = 20 * np.log10(rms_env(y, sr, 0.05))
edge = int(0.05 * sr)  # skip the first/last 50 ms, where the phone starts/stops recording
if args.start is not None:
    s0 = int(args.start * sr)
else:
    best = None
    for s in range(edge, len(y) - need - edge, int(0.01 * sr)):
        seg = lvl[s:s + need:int(0.01 * sr)]
        head = lvl[s:s + xf].mean()
        tail = lvl[s + n:s + n + xf].mean()
        # Flat level, no level jump at the seam, and the crossfaded parts alike in shape
        corr = np.corrcoef(y[s:s + xf], y[s + n:s + n + xf])[0, 1]
        score = np.std(seg) + abs(head - tail) - 2 * corr
        if best is None or score < best[0]:
            best = (score, s, np.std(seg), head - tail, corr)
    _, s0, sd, jump, corr = best
    log(f'section: {s0 / sr:.2f}-{(s0 + need) / sr:.2f} s, level spread {sd:.1f} dB, '
        f'head/tail level difference {jump:+.1f} dB, seam correlation {corr:.2f}')
seg = y[s0:s0 + need].copy()

# 3. Light compression: RMS detector, 2.5:1 above the section's median level - 2 dB
env = 20 * np.log10(rms_env(seg, sr, 0.02))
thr = np.median(env) - 2
target = -np.maximum(env - thr, 0) * (1 - 1 / 2.5)
gain = np.empty_like(target)
g = target[0]
att, rel = np.exp(-1 / (0.01 * sr)), np.exp(-1 / (0.15 * sr))
for i, t in enumerate(target):
    c = att if t < g else rel
    g = c * g + (1 - c) * t
    gain[i] = g
seg *= 10 ** (gain / 20)
log(f'compression: threshold {thr:.1f} dBFS, ratio 2.5:1, gain reduction avg {-gain.mean():.1f} dB, max {-gain.min():.1f} dB')

# 4. Seamless loop: the audio just after the loop end fades out over the loop's first 0.25 s while
# the head fades in (equal power, as engine noise is mostly uncorrelated), so the last sample
# flows into the first one exactly as in the recording
t = np.linspace(0, np.pi / 2, xf)
loop = seg[:n].copy()
loop[:xf] = seg[:xf] * np.sin(t) + seg[n:n + xf] * np.cos(t)

# 5. Normalise, then wrap PAD s on both sides (see the docstring)
loop *= 10 ** (args.peak / 20) / np.abs(loop).max()
pad = int(PAD * sr)
body = np.concatenate([loop[-pad:], loop, loop[:pad]])
stats('loop', loop, sr)
d = np.diff(np.concatenate([loop, loop[:1]]))
w = int(0.05 * sr)
log(f'loop seam: jump {abs(loop[0] - loop[-1]):.4f}, larger than {100 * np.mean(np.abs(d) < abs(loop[0] - loop[-1])):.0f}% '
    f'of the loop\'s own sample steps (max {np.abs(d).max():.4f}); level last 50 ms {db(np.sqrt(np.mean(loop[-w:] ** 2))):.1f} dBFS, '
    f'first 50 ms {db(np.sqrt(np.mean(loop[:w] ** 2))):.1f} dBFS')


def encode(sig):
    enc = lameenc.Encoder()
    enc.set_bit_rate(args.kbps)
    enc.set_in_sample_rate(sr)
    enc.set_channels(1)
    enc.set_quality(2)
    pcm = np.clip(np.round(sig * 32767), -32768, 32767).astype('<i2').tobytes()
    return bytes(enc.encode(pcm) + enc.flush())


# 6. Encode; MP3 can overshoot the source peak, so check the decoded file and back off if needed
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
scale = 1.0
for _ in range(4):
    data = encode(body * scale)
    with open(args.out, 'wb') as fh:
        fh.write(data)
    _, dec = decode(args.out)
    if dec.ndim == 2:
        dec = dec.mean(1)
    over = db(np.abs(dec).max()) - (args.peak + 0.3)
    if over <= 0:
        break
    scale *= 10 ** (-over / 20)
log(f'encoded: {args.out}, {len(data)} bytes, {args.kbps} kbps mono, {len(body) / sr:.2f} s '
    f'(loop {n / sr:.4f} s = {n} samples at {sr} Hz, pad {PAD} s each side)')
stats('decoded mp3', dec, sr)
# Where the decoder put the content (padding), and whether the loop region sfx.js plays (PAD to
# PAD + length, without trimming the padding) still joins cleanly
lag = np.argmax(signal.correlate(dec[:pad * 3], body[:pad * 2], mode='valid'))
a = dec[pad:pad + n]
steps = np.abs(np.diff(a))
jump = abs(a[0] - a[-1])
log(f'decoded: content offset {lag} samples ({lag / sr * 1000:.1f} ms of padding); seam jump '
    f'{jump:.4f}, larger than {100 * np.mean(steps < jump):.0f}% of the loop\'s own sample steps (max {steps.max():.4f}); '
    f'level last 50 ms {db(np.sqrt(np.mean(a[-w:] ** 2))):.1f} dBFS, first 50 ms {db(np.sqrt(np.mean(a[:w] ** 2))):.1f} dBFS')
