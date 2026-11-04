#!/usr/bin/env python3
"""只下载 Godot export_templates.tpz 里的 web 模板（HTTP Range + ZIP 中央目录）。"""
import os, struct, sys, time, urllib.request, zlib

URL = sys.argv[1] if len(sys.argv) > 1 else "https://github.com/godotengine/godot/releases/download/4.7.1-stable/Godot_v4.7.1-stable_export_templates.tpz"
OUTDIR = sys.argv[2] if len(sys.argv) > 2 else os.path.expanduser("~/AppData/Roaming/Godot/export_templates/4.7.1.stable")
WANT_PREFIX = "templates/web"
WANT_EXTRA = ("templates/icudt_godot.dat", "icudt_godot.dat")


def get_range(url, start, end):
    req = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end}", "User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def total_size_and_url(url):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return int(r.headers["Content-Length"]), r.geturl()


def parse_cd(buf):
    entries = []
    i = 0
    while True:
        i = buf.find(b"PK\x01\x02", i)
        if i < 0:
            break
        (method, csize, usize) = struct.unpack_from("<HH8xII", buf, i + 10)[0], None, None
        vals = struct.unpack_from("<HHHHIIIHHHHHII", buf, i + 4)
        method = vals[3]
        csize = vals[7]
        usize = vals[8]
        nlen = vals[9]
        elen = vals[10]
        clen = vals[11]
        off = vals[15]
        name = buf[i + 46:i + 46 + nlen].decode("utf-8", "replace")
        entries.append({"name": name, "method": method, "csize": csize, "usize": usize, "off": off})
        i += 46 + nlen + elen + clen
    return entries


def main():
    print("HEAD ...", flush=True)
    size, final = total_size_and_url(URL)
    print(f"total={size/1e6:.1f} MB", flush=True)
    tail_len = min(131072, size)
    tail = get_range(final, size - tail_len, size - 1)
    eocd = tail.rfind(b"PK\x05\x06")
    if eocd < 0:
        print("EOCD not found"); return 1
    cd_size, cd_off = struct.unpack_from("<II", tail, eocd + 12)
    print(f"CD at {cd_off} size {cd_size}", flush=True)
    cd = get_range(final, cd_off, cd_off + cd_size - 1) if cd_off + cd_size > size - tail_len else tail[cd_off - (size - tail_len): cd_off - (size - tail_len) + cd_size]
    entries = parse_cd(cd)
    print(f"entries={len(entries)}", flush=True)
    targets = [e for e in entries if e["name"].startswith(WANT_PREFIX) or e["name"] in WANT_EXTRA]
    if not targets:
        print("no web template entries; names sample:", [e["name"] for e in entries[:40]]); return 1
    os.makedirs(OUTDIR, exist_ok=True)
    for e in targets:
        base = os.path.basename(e["name"])
        dest = os.path.join(OUTDIR, base)
        if os.path.exists(dest) and os.path.getsize(dest) == e["usize"]:
            print("skip", base); continue
        # 本地文件头
        head = get_range(final, e["off"], e["off"] + 1024)
        nlen, elen = struct.unpack_from("<HH", head, 26)
        data_start = e["off"] + 30 + nlen + elen
        data_end = data_start + e["csize"] - 1
        print(f"downloading {base} {e['csize']/1e6:.1f} MB ...", flush=True)
        t0 = time.time()
        blob = get_range(final, data_start, data_end)
        while len(blob) < e["csize"]:
            got = get_range(final, data_start + len(blob), data_end)
            if not got:
                break
            blob += got
            print(f"  {len(blob)/1e6:.1f}/{e['csize']/1e6:.1f} MB", flush=True)
        raw = zlib.decompress(blob, -15) if e["method"] == 8 else blob
        with open(dest, "wb") as f:
            f.write(raw)
        print(f"  saved {dest} {len(raw)/1e6:.2f} MB in {time.time()-t0:.0f}s", flush=True)
    # version.txt
    vt = os.path.join(OUTDIR, "version.txt")
    if not os.path.exists(vt):
        v = [e for e in entries if e["name"].endswith("version.txt")]
        if v:
            head = get_range(final, v[0]["off"], v[0]["off"] + 1024)
            nlen, elen = struct.unpack_from("<HH", head, 26)
            ds = v[0]["off"] + 30 + nlen + elen
            blob = get_range(final, ds, ds + v[0]["csize"] - 1)
            raw = zlib.decompress(blob, -15) if v[0]["method"] == 8 else blob
            open(vt, "wb").write(raw)
            print("version.txt:", raw.decode("utf-8", "replace").strip())
    print("DONE")
    return 0


if __name__ == "__main__":
    sys.exit(main())
