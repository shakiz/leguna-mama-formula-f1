"""Turn public/memes.json into a recording script for the friends voicing the game.

    python3 tools/recording_script.py
    python3 tools/recording_script.py --memes path/to/memes.json --out docs/recording-script.md

Python 3 standard library only. Lists every meme line (`triggers`), every helper callout (event
`caption`) and every synthesised placeholder sound (`sfx`), each with a suggested file name, a
delivery note and whether it is already recorded (has `audio`). Run it again whenever memes.json
changes; the output is deterministic, so an unchanged memes.json gives an identical file.

Descriptions and delivery notes come from the EVENTS table below (exact names, then `prefix_*`
rules); an event it doesn't know still gets a generic row, so add a line there for new events.
"""
import argparse
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Readable names for the `<event>_<thing>` suffixes
THINGS = {
    'rickshaw': 'rickshaw', 'cng': 'CNG', 'bus': 'bus', 'car': 'private car', 'police': 'traffic police',
    'cow': 'cow', 'hawker': 'hawker', 'brtc': 'BRTC double-decker', 'pedestrian': 'pedestrian',
    'manhole': 'open manhole', 'pothole': 'pothole', 'manikmia': 'Manik Mia Avenue', 'asadgate': 'Asad Gate',
    'bike': 'motorbike', 'tesla': 'battery rickshaw ("Tesla")', 'vip': 'VIP car',
    'asadave': 'Asad Avenue', 'mohammadpur': 'Mohammadpur', 'flood': 'waterlogged road',
    'left': 'left', 'right': 'right', 'ahead': 'ahead',
}

# Sort groups: start, driving, crashes, set pieces, anything unknown, finish
START, DRIVING, CRASH, SETPIECE, OTHER, FINISH = range(6)

# name or 'prefix_*': (group, when it plays, delivery). `{x}` is the readable suffix.
EVENTS = {
    'start': (START, 'The run starts at Farmgate and the helper calls in passengers.',
              'Loud street hawking, the helper banging on the side of the leguna. Fast and rhythmic.'),
    'pickup': (DRIVING, 'A passenger is picked up.',
               'Haggling at the door: quick, a bit cheeky, two voices if you have them.'),
    'puddle': (DRIVING, 'The leguna splashes through standing water.',
               'Disgusted passenger, half laughing, half complaining.'),
    'close': (DRIVING, 'A near miss with any vehicle (+2 taka bonus).',
              'Breathless relief, a nervous laugh.'),
    'close_*': (DRIVING, 'A near miss with {ax} (+2 taka bonus).',
                'Breathless and a bit cheeky, like a passenger who just watched the {x} slide past.'),
    'closeturn': (DRIVING, 'A last-second swerve out of the way (+2 taka bonus).',
                  'Panicked passenger, then relief. Short gasp first.'),
    'closeturn_*': (DRIVING, 'A last-second swerve away from {ax} (+2 taka bonus).',
                    'Panicked passenger, then relief. Short gasp first.'),
    'helper_left': (DRIVING, 'The helper hanging off the back warns about traffic on your left.',
                    'Shouted warning over traffic noise, flat and practised, like he says it a hundred times a day.'),
    'helper_right': (DRIVING, 'The helper hanging off the back warns about traffic on your right.',
                     'Shouted warning over traffic noise, flat and practised, like he says it a hundred times a day.'),
    'helper_ahead': (DRIVING, 'The helper hanging off the back warns about traffic straight ahead.',
                     'Shouted warning over traffic noise, flat and practised, like he says it a hundred times a day.'),
    'helper_behind': (DRIVING, 'The helper warns that the VIP car is right behind the leguna (a close call from behind).',
                      'Shouted warning, more urgent than the others: it is coming up fast from behind.'),
    'helper_*': (DRIVING, 'The helper hanging off the back warns about {ax} coming up in your lane.',
                 'Shouted warning over traffic noise, urgent: the driver has a second to react.'),
    'spawn_*': (DRIVING, '{AX} appears on the road (ambient sound).', 'Ambient street sound, not a voice.'),
    'pass_tesla': (DRIVING, 'The leguna overtakes a battery rickshaw ("Tesla"), in any lane, without touching it '
                   '(at most once every 10 s).',
                   'Over-polite greeting to the Tesla driver as you sail past, like greeting an elder brother: warm, a bit smug.'),
    'pass_*': (DRIVING, 'The leguna overtakes {ax}.', 'Smug, a little cheeky, as you sail past.'),
    'speedup': (DRIVING, 'The leguna is back up to speed after a real slowdown (a crash, braking, the red light or the '
                'flood), and 1.5 s into Manik Mia Avenue\'s open road. At most once every 25 s.',
                'Rally cry: pumped up and loud, like a crowd at a big match.'),
    'vip_spotted': (DRIVING, 'A VIP car is coming up from behind: the flashing warning appears at the bottom of the '
                    'screen in its lane, about 2 s before it reaches the leguna. The siren starts with it.',
                    'Startled and suspicious, turning round to look: who on earth are these people?'),
    'vip_siren': (DRIVING, 'Together with the VIP warning: the motorcade\'s siren as it comes up from behind.',
                  'Not a voice: a sound effect (see the siren below).'),
    'vip_gaveway': (DRIVING, 'You were in the VIP\'s lane when the warning came and moved out of its way in time (+5 taka).',
                    'Mock-deferential and sarcastic: "after you, sir", bowing and scraping.'),
    'bump_honk': (DRIVING, 'The car you bumped honks back angrily.', 'Angry, long horn blasts.'),
    'brtc_honk': (DRIVING, 'The BRTC double-decker blasts its air horn.', 'Deep, very loud diesel air horn.'),
    'crash': (CRASH, 'Any crash that has no lines of its own.',
              'Dramatic and over the top: shock, then a sarcastic jab at the driver.'),
    'crash_*': (CRASH, 'The leguna crashes into {ax}.',
                'Dramatic and over the top: shock, then a sarcastic jab at the driver.'),
    'rickshaw_dhur': (CRASH, 'A quarter of a second after the leguna crashes into a rickshaw or a "Tesla": the driver '
                      'swears at the leguna.',
                      'Fed-up rickshaw-wala: a long, disgusted "dhur", then the jab. Annoyed, not angry.'),
    'voice_crash': (CRASH, 'Right after any other collision (cars, buses, the BRTC, the VIP, bikes, cows, manholes, '
                    'pedestrians): someone checks on the leguna driver.',
                    'Mock-concerned and a little sarcastic, like a bystander leaning in: "you alright, hm?"'),
    'stretch_manikmia': (SETPIECE, 'Entering Manik Mia Avenue: wide, empty and fast.', 'Excited, egging the driver on.'),
    'stretch_asadgate': (SETPIECE, 'Entering Asad Gate: the jam and the signal.', 'Fed up, exasperated.'),
    'stretch_asadave': (SETPIECE, 'Entering Asad Avenue: waterlogged in the rain.', 'Resigned, half laughing at the water.'),
    'stretch_mohammadpur': (SETPIECE, 'Entering Mohammadpur: the last stretch to the bus stand.',
                            'Announcing the stop like a helper: loud, sing-song.'),
    'stretch_*': (SETPIECE, 'Entering {x} on the route.', 'Announcing the stop like a helper: loud, proud, a bit sing-song.'),
    'zone_*': (SETPIECE, 'Driving into the {x}.', 'Resigned, sarcastic commentary.'),
    'speedbreaker': (SETPIECE, 'Going over a speed breaker.', 'Bounced passenger: a grunt, then complaining.'),
    'speedbreaker_fast': (SETPIECE, 'Taking a speed breaker fast and flying.', 'Excited and scared at once, like a fairground ride.'),
    'pothole': (SETPIECE, 'Hitting a pothole.', 'Jolted passenger, sarcastic about the road.'),
    'signal_yellow': (SETPIECE, 'The junction signal turns yellow as you approach.', 'Urgent shouted warning.'),
    'signal_red': (SETPIECE, 'The signal turns red: the helper shouts to stop (the first time in a run, the brake '
                   'control is also shown on screen).', 'Urgent shout, telling the driver to stop right now.'),
    'signal_green': (SETPIECE, 'The signal turns green after waiting.', 'Impatient and happy: go go go.'),
    'stopped_at_red': (SETPIECE, 'You waited at the red light.', 'Mock-amazed, sarcastic praise.'),
    'red_light': (SETPIECE, 'You crossed the stop line on red and got fined.', 'Stern traffic police, then a groan.'),
    'finish': (FINISH, 'Reaching Mohammadpur Bus Stand.', 'Proud and triumphant, like a commentator at the finish line.'),
    'newbest': (FINISH, 'A new personal best time.', 'Over-the-top proud, show-off.'),
    'finish_voice': (FINISH, 'A quarter of a second after the finish (or new record) fanfare at Mohammadpur Bus Stand.',
                     'Wistful, dramatic farewell, half joking, like a hero leaving the stage.'),
}
# Delivery for a helper callout when it differs from the event's (whose note is about its voice clip)
CALLOUT_TONE = {
    'vip_spotted': 'The helper shouting over the siren: urgent, telling the driver to pull aside now.',
}

GENERIC = (OTHER, 'Game event `{name}` (no description yet: add it to EVENTS in tools/recording_script.py).',
           'Natural, energetic street Bangla; match the line.')

# Placeholder synth sounds (see SFX in src/audio/sfx.js): what the real one should be
SFX = {
    'airhorn': 'BRTC double-decker diesel air horn: deep, very loud, two blasts.',
    'angryhonk': 'Angry private-car horn: one long blast then three short ones.',
    'bell': 'Rickshaw bell: the quick "kring-kring" thumb bell.',
    'bigcrash': 'Leguna into a double-decker: long, deep crash with a sheet-metal clang.',
    'bonus': 'Short bright "bonus" chime, e.g. coins shaken in a hand. Can stay synthetic.',
    'beep': 'Two short car horn beeps.',
    'boing': 'Comedy "boing" (spring or a mouth sound).',
    'clunk': 'Wheel dropping into a pothole: heavy metal clunk and rattle.',
    'coin': 'Coins dropped into the helper\'s hand or a tin box.',
    'crash': 'Metal-and-plastic crash, not too long.',
    'crunch': 'Bumper crunch: plastic cracking, a light car-to-car bump.',
    'ding': 'Signal change "ding" (a small bell or a glass tapped). Can stay synthetic.',
    'helper': 'The helper\'s voice placeholder. Replaced by the helper callouts above, nothing extra to record.',
    'horn': 'Two-tone Dhaka bus horn: "pyaa-pou pyaa-pou".',
    'moo': 'A cow mooing ("hamba").',
    'rumble': 'Diesel bus engine rumble passing close by.',
    'sad': 'Sad "wah-wah-waaah" trombone; hum or whistle it if there is no instrument.',
    'slap': 'Two hand slaps on the leguna\'s metal side (the helper\'s "go" signal).',
    'splash': 'Tyre splashing through a puddle.',
    'sting': 'Short victory fanfare (whistle, harmonica or humming is fine).',
    'tap': 'Light tap / click.',
    'thud': 'Leguna thumping over a speed breaker: two dull thuds, front and back wheels.',
    'whistle': 'Traffic police whistle: two sharp blasts.',
    'whoosh': 'Fast whoosh of a vehicle passing very close.',
    'rev': 'Motorbike: a throttle blip ("brrRAAP") and two quick pips on its tiny horn.',
    'ewhine': 'Battery rickshaw ("Tesla"): its thin electric motor whine rising, then a tinny squeeze horn.',
    'siren': 'VIP motorcade siren: a two-tone wail rising and falling, about 4 s, swelling in and fading out.',
}
SFX_GENERIC = 'No description yet: add it to SFX in tools/recording_script.py. See SFX in src/audio/sfx.js.'

# What each recorded event clip says: (Bangla, meaning). Add a line when a new clip goes into an event's `audio`.
CLIPS = {
    'audio/clips/are-era-kara.mp3': ('আরে এরা কারা?', 'Hey, who are these people?'),
    'audio/clips/assalamualaikum-boro-bhai.mp3': ('আসসালামু আলাইকুম বড় ভাই', 'Assalamu alaikum, big brother'),
    'audio/clips/dhur-beta.mp3': ('ধুর বেটা, এইটা হইল বেটা?', 'Ugh, mate, what was that, mate?'),
    'audio/clips/khela-hobe.mp3': ('খেলা হবে!', 'Game on!'),
    'audio/clips/aj-chole-jacchi.mp3': ('আজ চলে যাচ্ছি, কিন্তু যাচ্ছি না', "I'm leaving today, but I'm not really leaving"),
}

STOPWORDS = {'a', 'an', 'the', 'is', 'are', 'of', 'to', 'and', 'on', 'in', 'at', 'it', 'mama', 'that', 'this', 'so'}


def lookup(name):
    """(group, when, delivery) for an event, by exact name, then the longest matching prefix."""
    if name in EVENTS:
        return EVENTS[name]
    best = None
    for key in EVENTS:
        if key.endswith('_*') and name.startswith(key[:-1]) and (best is None or len(key) > len(best)):
            best = key
    if best is None:
        g, w, d = GENERIC
        return g, w.format(name=name), d
    x = name[len(best) - 1:]
    x = THINGS.get(x, x.replace('_', ' '))
    ax = ('an ' if x[:1].lower() in 'aeiou' else 'a ') + x
    g, w, d = EVENTS[best]
    f = dict(x=x, ax=ax, AX=ax[0].upper() + ax[1:])
    return g, w.format(**f), d.format(**f)


def event_order(names):
    def key(n):
        g = lookup(n)[0]
        # within a group: the order of EVENTS (exact name, then its prefix rule), then alphabetical
        keys = list(EVENTS)
        if n in EVENTS:
            pos = keys.index(n)
        else:
            pref = [k for k in keys if k.endswith('_*') and n.startswith(k[:-1])]
            pos = keys.index(max(pref, key=len)) if pref else len(keys)
        return (g, pos, n)
    return sorted(names, key=key)


def kebab(text, limit=5, stop=STOPWORDS):
    text = text.lower().replace("'", '').replace('\u2019', '')
    words = [w for w in re.split(r'[^a-z0-9]+', text) if w]
    kept = [w for w in words if w not in stop][:limit] or words[:limit]
    return '-'.join(kept)


def as_list(v):
    if v is None:
        return []
    return v if isinstance(v, list) else [v]


def cell(text):
    return str(text).replace('|', '\\|').replace('\n', ' ').strip()


def status(audio, suggested, public):
    """Done when memes.json points at a clip; recorded-not-hooked-up when the suggested file exists."""
    if audio:
        return 'Done', ', '.join('`%s`' % a for a in audio)
    if os.path.isfile(os.path.join(public, 'audio', suggested)):
        return 'Recorded, add to memes.json', '`audio/%s`' % suggested
    return 'To record', '`%s`' % suggested


class Names:
    """Hands out unique file names in call order."""
    def __init__(self):
        self.used = set()

    def get(self, folder, base):
        name, n = base, 2
        while '%s/%s' % (folder, name) in self.used:
            name, n = '%s-%d' % (base, n), n + 1
        self.used.add('%s/%s' % (folder, name))
        return '%s/%s.mp3' % (folder, name)


def build(memes, public):
    events = memes.get('events', {})
    triggers = memes.get('triggers', {})
    names = Names()

    # Helper callouts: every event with a caption
    callouts = []
    for ev in event_order([n for n in events if isinstance(events[n], dict) and events[n].get('caption')]):
        e = events[ev]
        cap = e['caption']
        base = 'callout-' + (kebab(ev[len('helper_'):] if ev.startswith('helper_') else ev, 8, ()) or 'line')
        # An event clip elsewhere (audio/clips/) is a different line that plays with the callout, not the callout
        own = [a for a in as_list(e.get('audio')) if a.startswith('audio/voice/')]
        st, f = status(own, names.get('voice', base), public)
        _, when, tone = lookup(ev)
        tone = CALLOUT_TONE.get(ev, tone)
        callouts.append((ev, when, cap.get('bn', ''), cap.get('en', ''), tone, st, f))

    # Recorded voice clips on events (they play with the event's own sound, captions and popups)
    clip_rows = []
    for ev in event_order([n for n in events if isinstance(events[n], dict)]):
        for a in as_list(events[ev].get('audio')):
            if a.startswith('audio/sfx/') or a.startswith('audio/engine/'):
                continue
            _, when, tone = lookup(ev)
            bn, en = CLIPS.get(a, ('(not transcribed: add it to CLIPS in tools/recording_script.py)', ''))
            on_disk = os.path.isfile(os.path.join(public, a))
            clip_rows.append((ev, when, bn, en, tone, 'Done' if on_disk else 'Missing file', '`%s`' % a))

    # Meme lines: every entry in triggers, grouped by event
    voice = []
    for ev in event_order([n for n in triggers if isinstance(triggers[n], list)]):
        _, when, tone = lookup(ev)
        rows = []
        for line in triggers[ev]:
            if not isinstance(line, dict):
                continue
            base = kebab(ev, 8, ()) + '-' + (kebab(line.get('en', '')) or 'line')
            if not line.get('audio') and isinstance(events.get(ev), dict) and events[ev].get('audio'):
                # The event already plays its own recorded clip with this popup; a clip here would cut it off
                rows.append((line.get('bn', ''), line.get('en', ''), 'Text only (event has its own clip)', '-'))
                continue
            st, f = status(as_list(line.get('audio')), names.get('voice', base), public)
            rows.append((line.get('bn', ''), line.get('en', ''), st, f))
        voice.append((ev, when, tone, rows))

    # Sound effects: every sfx name in events and triggers
    used = {}
    for ev, e in events.items():
        if isinstance(e, dict):
            for s in as_list(e.get('sfx')):
                used.setdefault(s, set()).add(ev)
    for ev, lines in triggers.items():
        for line in lines if isinstance(lines, list) else []:
            if isinstance(line, dict):
                for s in as_list(line.get('sfx')):
                    used.setdefault(s, set()).add(ev + ' meme line')
    effects = []
    for s in sorted(used):
        suggested = 'sfx/%s.mp3' % kebab(s, 8, ())
        if s == 'helper':
            st, f = 'Covered by callouts', '(none)'
        else:
            # done once any event plays the suggested clip
            hooked = ['audio/' + suggested] if any(
                'audio/' + suggested in as_list(e.get('audio')) for e in events.values() if isinstance(e, dict)) else []
            st, f = status(hooked, suggested, public)
        effects.append((s, SFX.get(s, SFX_GENERIC), sorted(used[s]), st, f))

    # Clips already in public/audio, and what uses them
    refs = {}
    for ev, e in events.items():
        if isinstance(e, dict):
            for a in as_list(e.get('audio')):
                refs.setdefault(a, set()).add('event `%s`' % ev)
    for ev, lines in triggers.items():
        for line in lines if isinstance(lines, list) else []:
            if isinstance(line, dict):
                for a in as_list(line.get('audio')):
                    refs.setdefault(a, set()).add('meme line in `%s`' % ev)
    on_disk = []
    audio_dir = os.path.join(public, 'audio')
    for dirpath, dirs, files in os.walk(audio_dir):
        dirs.sort()
        for fn in sorted(files):
            if fn.startswith('.'):
                continue
            on_disk.append(os.path.relpath(os.path.join(dirpath, fn), public).replace(os.sep, '/'))
    on_disk.sort()
    existing = []
    for p in on_disk:
        if p == 'audio/engine/leguna-engine.mp3':
            use = 'engine loop (src/audio/sfx.js)'
        else:
            use = ', '.join(sorted(refs.get(p, []))) or 'not used in memes.json yet'
        existing.append((p, use))
    missing = sorted(p for p in refs if p not in on_disk)

    return render(callouts, clip_rows, voice, effects, existing, missing)


def render(callouts, clip_rows, voice, effects, existing, missing):
    out = []
    w = out.append
    n_lines = sum(1 for _, _, _, rows in voice for r in rows if not r[2].startswith('Text only'))
    done_lines = sum(1 for _, _, _, rows in voice for r in rows if r[2] == 'Done')
    done_calls = sum(1 for c in callouts if c[5] == 'Done')
    todo_fx = [e for e in effects if e[3] != 'Covered by callouts']
    done_fx = sum(1 for e in todo_fx if e[3] == 'Done')

    w('# Recording script: লেগুনা মামা — Formula F1')
    w('')
    w('<!-- Generated by tools/recording_script.py from public/memes.json. Do not edit by hand: '
      'run `python3 tools/recording_script.py` again instead. -->')
    w('')
    w('Almost every sound in the game is a computer-made placeholder. This is the list of everything '
      'we would love real voices and sounds for: the helper shouting warnings, passengers complaining, '
      'horns and bells. Pick any line, record it on your phone, and send it over.')
    w('')
    w('## Checklist')
    w('')
    w('| What | Total | Recorded | Left |')
    w('|---|---|---|---|')
    w('| Helper callouts (record these first) | %d | %d | %d |' % (len(callouts), done_calls, len(callouts) - done_calls))
    done_clips = sum(1 for c in clip_rows if c[5] == 'Done')
    w('| Event voice clips | %d | %d | %d |' % (len(clip_rows), done_clips, len(clip_rows) - done_clips))
    w('| Meme voice lines | %d | %d | %d |' % (n_lines, done_lines, n_lines - done_lines))
    w('| Sound effects | %d | %d | %d |' % (len(todo_fx), done_fx, len(todo_fx) - done_fx))
    w('| Clips already in the game | %d | %d | 0 |' % (len(existing), len(existing)))
    w('')
    w('## How to record')
    w('')
    w('- **Quiet room**, fan off, door closed. Soft furnishings (a bedroom, a wardrobe full of clothes) beat a tiled bathroom.')
    w('- **Phone close**: about a hand\'s width (10–15 cm) from your mouth, slightly to the side so you don\'t pop the mic.')
    w('- **Re-perform** the line in your own voice. Don\'t rip clips from films, TikTok or YouTube.')
    w('- **2–3 takes** of each line with a little variation; we pick the best one (or use several, the game picks at random).')
    w('- **Short and punchy**: 1–3 seconds. Act it big: it plays over traffic noise, so energy matters more than polish.')
    w('- **Trim the silence** at the start and end, so the sound starts right on the word.')
    w('- Lines with English in them ("What happening?!") are said as written, in the meme accent.')
    w('- Emojis are just there to show the mood. Don\'t say them.')
    w('')
    w('**Format:** mono MP3, 48–64 kbps, ideally under 40 KB per file. If that\'s fiddly, just send the raw phone '
      'recording (any format) with the file name below and we\'ll convert it.')
    w('')
    w('**Where files go:** voice lines and callouts in `public/audio/voice/`, sound effects in `public/audio/sfx/`, '
      'using the suggested file name from the tables. Then hook the file up in `public/memes.json` by adding an '
      '`audio` list (the path is relative to `public/`):')
    w('')
    w('```json')
    w('{ "bn": "মামা, আস্তে!", "en": "Mama, slow down!", "audio": ["audio/voice/closeturn-slow-down.mp3"] }')
    w('```')
    w('')
    w('For a meme line add it to that line in `triggers`; for a helper callout or a sound effect add it to the event '
      'in `events` (several takes: list them all, one is picked at random). Then run '
      '`python3 tools/recording_script.py` to tick it off in this document.')
    w('')

    w('## Helper callouts (top priority)')
    w('')
    w('The helper hangs off the back of the leguna and shouts these every time something is coming up. '
      'They repeat constantly during a run, so they matter most. Shout them like a real helper: loud, quick, '
      'a bit hoarse, over the engine and the horns. Add the file to the event\'s `audio`.')
    w('')
    w('| Event | When it plays | Bangla | Meaning | Delivery | Status | File |')
    w('|---|---|---|---|---|---|---|')
    for ev, when, bn, en, tone, st, f in callouts:
        w('| `%s` | %s | %s | %s | %s | %s | %s |' % (ev, cell(when), cell(bn), cell(en), cell(tone), st, f))
    w('')

    w('## Event voice clips (recorded)')
    w('')
    w('Recorded lines that play on a game event, together with its sound effect, helper callout and popup. '
      'They are done; re-record one only to improve it, keeping the same file name.')
    w('')
    w('| Event | When it plays | Bangla | Meaning | Delivery | Status | File |')
    w('|---|---|---|---|---|---|---|')
    for ev, when, bn, en, tone, st, f in clip_rows:
        w('| `%s` | %s | %s | %s | %s | %s | %s |' % (ev, cell(when), cell(bn), cell(en), cell(tone), st, f))
    w('')

    w('## Voice lines')
    w('')
    w('Meme popups that appear during the run, roughly in the order you meet them: start, driving, crashes, '
      'set pieces along the route, finish. Each event shows one of its lines at random, so any of them is useful. '
      'Add the file to that line\'s `audio`.')
    w('')
    for ev, when, tone, rows in voice:
        w('### `%s`' % ev)
        w('')
        w('**When it plays:** %s  ' % when)
        w('**Delivery:** %s' % tone)
        w('')
        w('| Bangla | Meaning | Status | File |')
        w('|---|---|---|---|')
        for bn, en, st, f in rows:
            w('| %s | %s | %s | %s |' % (cell(bn), cell(en), st, f))
        w('')

    w('## Sound effects to record or source')
    w('')
    w('Real-world sounds to replace the synthesised placeholders. Record them on the street (stand back from horns, '
      'they clip easily), or use a free clip that is **CC0 only** (public domain, no attribution needed), for example '
      '[Freesound](https://freesound.org) with the licence filter set to "Creative Commons 0". Note the source link '
      'when you send it. Add the file to the `audio` of each event listed.')
    w('')
    w('| Placeholder | Real sound | Used by | Status | File |')
    w('|---|---|---|---|---|')
    for s, desc, users, st, f in effects:
        w('| `%s` | %s | %s | %s | %s |' % (s, cell(desc), ', '.join(('`%s` meme line' % u[:-10]) if u.endswith(' meme line') else '`%s`' % u for u in users), st, f))
    w('')

    w('## Already in the game')
    w('')
    if existing:
        w('| File | Used for |')
        w('|---|---|')
        for p, use in existing:
            w('| `public/%s` | %s |' % (p, cell(use)))
    else:
        w('Nothing yet.')
    w('')
    if missing:
        w('**Listed in memes.json but missing from `public/audio/`:** ' + ', '.join('`%s`' % m for m in missing))
        w('')
    return '\n'.join(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--memes', default=os.path.join(ROOT, 'public', 'memes.json'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'docs', 'recording-script.md'))
    ap.add_argument('--public', help='folder holding audio/ (default: the folder memes.json is in)')
    args = ap.parse_args()
    with open(args.memes, encoding='utf-8') as f:
        memes = json.load(f)
    public = args.public or os.path.dirname(os.path.abspath(args.memes))
    text = build(memes, public)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    rel = os.path.relpath(args.out)
    print('Wrote %s' % (args.out if rel.startswith('..') else rel))


if __name__ == '__main__':
    main()
