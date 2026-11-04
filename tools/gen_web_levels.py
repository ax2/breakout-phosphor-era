import io, json, os
src = "data/levels.json"
dst = "web/data/levels.js"
d = json.load(io.open(src, encoding="utf-8"))
out = "/* 由 tools/gen_web_levels.py 从 data/levels.json 生成，请勿手改 */\n"
out += "window.LEVELDB = " + json.dumps(d, ensure_ascii=False, indent=2) + ";\n"
io.open(dst, "w", encoding="utf-8").write(out)
print("wrote", dst, len(out), "bytes")
