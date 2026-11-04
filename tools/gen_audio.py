#!/usr/bin/env python3
"""BREAKOUT: 磷光纪元 —— 程序化音效/音乐生成器 (原创素材, 无第三方授权)

所有音频由本脚本合成，输出 16-bit PCM WAV 到 assets/audio/。
运行: python tools/gen_audio.py
"""
import math
import os
import random
import struct
import wave

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "audio")
SR = 44100
rng = random.Random(20261028)


def write_wav(name, samples, sr=SR):
    os.makedirs(OUT, exist_ok=True)
    peak = max(1e-9, max(abs(s) for s in samples))
    norm = 0.82 / peak
    path = os.path.join(OUT, name)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        data = bytearray()
        for s in samples:
            v = int(max(-1.0, min(1.0, s * norm)) * 32767)
            data += struct.pack("<h", v)
        w.writeframes(bytes(data))
    print(f"  {name:22s} {len(samples)/sr:6.2f}s  {os.path.getsize(path)/1024:9.1f} KB")


def env(i, n, attack=0.004, decay=None, power=2.0):
    """fast attack, exponential-ish decay"""
    t = i / SR
    a = 1.0 if t >= attack else t / max(1e-6, attack)
    d = decay if decay is not None else n / SR * 0.35
    return a * math.exp(-max(0.0, t - attack) / max(1e-4, d)) ** power


def sine(t, f, ph=0.0):
    return math.sin(2 * math.pi * f * t + ph)


def square(t, f, duty=0.5):
    return 1.0 if (t * f) % 1.0 < duty else -1.0


def tri(t, f):
    x = (t * f) % 1.0
    return 4.0 * abs(x - 0.5) - 1.0


def saw(t, f):
    return 2.0 * ((t * f) % 1.0) - 1.0


def lowpass(sig, cutoff, sr=SR):
    out = []
    a = 1.0 - math.exp(-2.0 * math.pi * cutoff / sr)
    y = 0.0
    for s in sig:
        y += a * (s - y)
        out.append(y)
    return out


def noise(n):
    return [rng.uniform(-1, 1) for _ in range(n)]


def blank(dur):
    return [0.0] * int(dur * SR)


# ---------------------------------------------------------------- SFX
def sfx_serve():
    n = int(0.20 * SR)
    out = []
    for i in range(n):
        t = i / SR
        f = 420 + 700 * min(1.0, t / 0.16)
        e = env(i, n, 0.003, 0.07)
        out.append((sine(t, f) * 0.6 + square(t, f * 2, 0.3) * 0.15) * e)
    return out


def sfx_paddle():
    n = int(0.10 * SR)
    out = []
    nz = noise(n)
    for i in range(n):
        t = i / SR
        e = env(i, n, 0.001, 0.028, 1.6)
        body = sine(t, 250 - 60 * t) * 0.7 + tri(t, 520) * 0.25
        out.append((body + nz[i] * 0.25) * e)
    return out


def sfx_wall():
    n = int(0.06 * SR)
    out, nz = [], noise(n)
    for i in range(n):
        t = i / SR
        e = env(i, n, 0.001, 0.014, 2.0)
        out.append((square(t, 900, 0.25) * 0.35 + nz[i] * 0.3) * e)
    return out


def sfx_brick():
    n = int(0.09 * SR)
    out, nz = [], noise(n)
    for i in range(n):
        t = i / SR
        e = env(i, n, 0.001, 0.022, 1.8)
        out.append((sine(t, 1180 - 500 * t) * 0.45 + nz[i] * 0.4) * e)
    return out


def sfx_brick_break():
    n = int(0.18 * SR)
    out = []
    nz = lowpass(noise(n), 5200)
    for i in range(n):
        t = i / SR
        e = env(i, n, 0.001, 0.055, 1.7)
        body = sine(t, 520 - 300 * t) * 0.35 + saw(t, 160 - 60 * t) * 0.18
        out.append((body + nz[i] * 0.55) * e)
    return out


def sfx_tough():
    n = int(0.14 * SR)
    out, nz = [], noise(n)
    for i in range(n):
        t = i / SR
        e = env(i, n, 0.001, 0.035, 2.2)
        metal = sine(t, 1830) * 0.28 + sine(t, 2710, 1.3) * 0.2 + sine(t, 4310, 0.6) * 0.1
        out.append((metal + nz[i] * 0.22) * e)
    return out


def sfx_explode():
    n = int(0.50 * SR)
    raw = noise(n)
    out = []
    prev = 0.0
    for i in range(n):
        t = i / SR
        cut = 2400 * math.exp(-t / 0.12) + 180
        a = 1.0 - math.exp(-2.0 * math.pi * cut / SR)
        prev += a * (raw[i] - prev)
        e = env(i, n, 0.002, 0.16, 1.3)
        thump = sine(t, 75 - 25 * t) * 0.5
        out.append((prev * 1.7 + thump) * e)
    return out


def sfx_life_lost():
    n = int(0.75 * SR)
    out = []
    for i in range(n):
        t = i / SR
        f = 420 * math.exp(-t / 0.28) + 55
        e = env(i, n, 0.01, 0.30, 1.2)
        vib = 1.0 + 0.012 * math.sin(2 * math.pi * 7 * t)
        out.append((tri(t * vib, f) * 0.5 + sine(t, f * 0.5) * 0.3) * e)
    return out


def arp(notes, step=0.11, dur=0.9, wave_fn=square, gain=0.45):
    n = int(dur * SR)
    out = [0.0] * n
    for k, f in enumerate(notes):
        start = int(k * step * SR)
        segn = n - start
        for j in range(segn):
            t = j / SR
            e = env(j, segn, 0.004, 0.20, 1.3)
            out[start + j] += wave_fn(t, f) * e * gain * (0.85 ** k)
    return out


def sfx_level_clear():
    return arp([523.25, 659.25, 783.99, 1046.50, 1318.51], 0.10, 1.30, square, 0.38)


def sfx_game_over():
    return arp([392.00, 349.23, 293.66, 220.00], 0.16, 1.40, tri, 0.5)


def sfx_ui_move():
    n = int(0.045 * SR)
    return [square(i / SR, 1250, 0.3) * env(i, n, 0.001, 0.010, 2.0) * 0.28 for i in range(n)]


def sfx_ui_confirm():
    n = int(0.16 * SR)
    out = []
    for i in range(n):
        t = i / SR
        f = 660 if t < 0.06 else 990
        e = env(i, n, 0.002, 0.06, 1.4)
        out.append(square(t, f, 0.35) * 0.26 * e)
    return out


def sfx_correct():
    n = int(0.28 * SR)
    out = []
    for i in range(n):
        t = i / SR
        e = env(i, n, 0.004, 0.09, 1.5)
        out.append((sine(t, 1320) * 0.3 + sine(t, 1980, 0.7) * 0.15) * e)
    return out


def sfx_pickup():
    n = int(0.22 * SR)
    out = []
    for i in range(n):
        t = i / SR
        f = 880 + 900 * min(1.0, t / 0.12)
        e = env(i, n, 0.002, 0.07, 1.4)
        out.append((sine(t, f) * 0.4 + tri(t, f * 1.5) * 0.12) * e)
    return out


# ---------------------------------------------------------------- music
def music_loop(bpm=100.0, bars=8, sr=32000):
    """无缝循环: 所有音符尾音按模长回卷混入开头。"""
    beat = 60.0 / bpm
    total = int(bars * 4 * beat * sr)
    buf = [0.0] * total

    def add(start_sec, dur_sec, f, gain, kind="sine", detune=1.0):
        s0 = int(start_sec * sr)
        n = int(dur_sec * sr)
        for j in range(n):
            t = j / sr
            e = math.exp(-t / (dur_sec * 0.30)) * min(1.0, t / 0.01)
            if kind == "sine":
                v = math.sin(2 * math.pi * f * t)
            elif kind == "tri":
                x = (t * f) % 1.0
                v = 4.0 * abs(x - 0.5) - 1.0
            else:
                v = 1.0 if (t * f) % 1.0 < 0.25 else -1.0
            idx = (s0 + j) % total
            buf[idx] += v * e * gain
            if detune != 1.0:
                v2 = math.sin(2 * math.pi * f * detune * t)
                buf[(s0 + j + 17) % total] += v2 * e * gain * 0.5

    # A minor pentatonic pad progression: Am - F - C - G  (x2)
    prog = [
        (220.00, [440.00, 523.25, 659.25, 880.00]),
        (174.61, [349.23, 440.00, 523.25, 698.46]),
        (261.63, [523.25, 659.25, 783.99, 1046.50]),
        (196.00, [392.00, 493.88, 587.33, 783.99]),
    ]
    step = beat / 2.0  # 8th notes
    for b in range(bars):
        root, chord = prog[b % 4]
        # bass on beats 1 and 3
        add(b * 4 * beat, beat * 1.6, root / 2.0, 0.16, "sine")
        add((b * 4 + 2) * beat, beat * 1.4, root / 2.0, 0.12, "sine")
        # sparse arpeggio, deterministic pattern
        pattern = [0, 2, 1, 3, 2, 0, 3, 1]
        for k in range(8):
            idx = pattern[(k + b) % 8]
            f = chord[idx]
            add(b * 4 * beat + k * step, 0.55, f, 0.052, "tri", 1.003)
        # pad swell every bar
        add(b * 4 * beat, 2.2, chord[0] * 0.5, 0.030, "sine", 1.002)

    # gentle one-pole smoothing to soften edges
    return lowpass(buf, 3200, sr), sr


def main():
    print("BREAKOUT: 磷光纪元 —— 生成原创音频素材")
    write_wav("sfx_serve.wav", sfx_serve())
    write_wav("sfx_paddle.wav", sfx_paddle())
    write_wav("sfx_wall.wav", sfx_wall())
    write_wav("sfx_brick.wav", sfx_brick())
    write_wav("sfx_brick_break.wav", sfx_brick_break())
    write_wav("sfx_tough.wav", sfx_tough())
    write_wav("sfx_explode.wav", sfx_explode())
    write_wav("sfx_life_lost.wav", sfx_life_lost())
    write_wav("sfx_level_clear.wav", sfx_level_clear())
    write_wav("sfx_game_over.wav", sfx_game_over())
    write_wav("sfx_ui_move.wav", sfx_ui_move())
    write_wav("sfx_ui_confirm.wav", sfx_ui_confirm())
    write_wav("sfx_correct.wav", sfx_correct())
    write_wav("sfx_pickup.wav", sfx_pickup())
    m, sr = music_loop()
    write_wav("music_loop.wav", m, sr)


if __name__ == "__main__":
    main()
