"""Gera uma trilha instrumental simples, estilo country/caipira, em Sol maior.

Violão dedilhado (Karplus-Strong), baixo "bum-tchá", chocalho e uma melodia
assobiada. Uso: python musica.py <saida.wav> <duracao_em_segundos>
"""
import sys
import wave

import numpy as np

SR = 44100
BPM = 112
BEAT = 60 / BPM
rng = np.random.default_rng(7)

out_path = sys.argv[1]
total = float(sys.argv[2])
n_total = int(SR * (total + 2))
mix = np.zeros((n_total, 2))


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def pluck(freq, dur, bright=0.5):
    """Corda dedilhada (Karplus-Strong)."""
    n = int(SR * dur)
    period = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, period)
    buf = np.convolve(buf, [bright, 1 - bright], mode="same")
    out = np.empty(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = 0.996 * 0.5 * (buf[i % period] + buf[(i + 1) % period])
    return out


def bass(freq, dur):
    t = np.arange(int(SR * dur)) / SR
    env = np.exp(-t * 5) * np.minimum(1, t * 200)
    return (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(4 * np.pi * freq * t)) * env


def whistle(freq, dur):
    t = np.arange(int(SR * dur)) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t * 4)
    phase = 2 * np.pi * freq * np.cumsum(vib) / SR
    env = np.minimum(1, t * 25) * np.minimum(1, (dur - t) * 12).clip(0, 1)
    return (np.sin(phase) + 0.15 * np.sin(2 * phase)) * env


def shaker(dur=0.06):
    n = int(SR * dur)
    noise = rng.uniform(-1, 1, n)
    noise = np.diff(noise, prepend=0)  # deixa mais agudo
    return noise * np.exp(-np.arange(n) / SR * 60)


def add(sig, start, gain, pan=0.0):
    i = int(start * SR)
    if i >= n_total:
        return
    sig = sig[: n_total - i] * gain
    mix[i : i + len(sig), 0] += sig * (1 - pan) / 2 ** 0.5
    mix[i : i + len(sig), 1] += sig * (1 + pan) / 2 ** 0.5


# Acordes (nota do baixo, notas do dedilhado) em MIDI
G = (43, [55, 59, 62, 67])
C = (48, [55, 60, 64, 67])
D = (50, [57, 62, 66, 69])
Em = (40, [55, 59, 64, 67])
PROG = [G, G, C, G, G, Em, D, D, G, G, C, C, G, D, G, G]

# Melodia: (nota MIDI ou None, duração em tempos) — 2 frases de 8 compassos
MEL = [
    (74, 1), (76, 0.5), (74, 0.5), (71, 1), (67, 1),
    (71, 1.5), (74, 0.5), (79, 2),
    (76, 1), (74, 0.5), (72, 0.5), (71, 1), (72, 1),
    (74, 3), (None, 1),
    (74, 1), (76, 0.5), (74, 0.5), (71, 1), (67, 1),
    (64, 1.5), (67, 0.5), (71, 2),
    (69, 1), (71, 0.5), (69, 0.5), (66, 1), (69, 1),
    (67, 3), (None, 1),
    (71, 1), (72, 1), (74, 2),
    (76, 1), (74, 1), (72, 2),
    (71, 1), (72, 0.5), (71, 0.5), (69, 1), (67, 1),
    (69, 3), (None, 1),
    (71, 1), (72, 1), (74, 2),
    (79, 1), (78, 1), (76, 2),
    (74, 1), (71, 1), (69, 1), (66, 1),
    (67, 3), (None, 1),
]
mel_beats = sum(d for _, d in MEL)

bar = 4 * BEAT
n_bars = int(np.ceil(total / bar)) + 1
pluck_cache = {}

for b in range(n_bars):
    t0 = b * bar
    root, notes = PROG[b % len(PROG)]
    intro = b < 2
    # baixo bum-tchá: tônica no 1, quinta no 3
    add(bass(midi_hz(root), BEAT * 0.9), t0, 0.55)
    add(bass(midi_hz(root + 7), BEAT * 0.9), t0 + 2 * BEAT, 0.45)
    # dedilhado em colcheias
    pattern = [0, 2, 1, 3, 0, 2, 1, 3]
    for k, idx in enumerate(pattern):
        m = notes[idx]
        if m not in pluck_cache:
            pluck_cache[m] = pluck(midi_hz(m), 1.2)
        add(pluck_cache[m], t0 + k * BEAT / 2 + rng.uniform(0, 0.008), 0.32, pan=-0.35)
    # chocalho no contratempo
    if not intro:
        for k in range(8):
            add(shaker(), t0 + k * BEAT / 2, 0.10 if k % 2 else 0.05, pan=0.4)

# melodia entra depois de 2 compassos e se repete
t = 2 * bar
while t < total:
    for note, dur in MEL:
        if note is not None and t < total:
            add(whistle(midi_hz(note), dur * BEAT * 0.95), t, 0.22, pan=0.2)
        t += dur * BEAT

# eco curto para dar ambiente
delay = int(0.18 * SR)
wet = np.zeros_like(mix)
wet[delay:] = mix[:-delay] * 0.25
mix += wet

mix = mix[: int(SR * total)]
fade_in, fade_out = int(SR * 0.5), int(SR * 3)
mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
mix[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
mix /= np.max(np.abs(mix)) * 1.12

with wave.open(out_path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print("ok", out_path, total, "s")
