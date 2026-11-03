import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[2]
index = json.loads((root / "src" / "data" / "local-papers" / "index.json").read_text(encoding="utf-8"))["papers"]
items = []
for row in index:
    paper = json.loads(
        (root / "public" / "local-papers" / "papers" / f"{row['slug']}.json").read_text(encoding="utf-8")
    )["exam"]
    for q in paper["questions"]:
        for asset in q["assets"]:
            if asset["kind"] == "options":
                items.append((row["slug"], q["id"], root / "public" / asset["path"].lstrip("/")))

print("composites", len(items))
font = ImageFont.truetype("arial.ttf", 15)
cell_w, cell_h = 330, 300
cols = 5
per_sheet = 15
for sheet_index in range((len(items) + per_sheet - 1) // per_sheet):
    chunk = items[sheet_index * per_sheet : (sheet_index + 1) * per_sheet]
    rows = (len(chunk) + cols - 1) // cols
    canvas = Image.new("RGB", (cols * cell_w, rows * cell_h), "white")
    draw = ImageDraw.Draw(canvas)
    for idx, (slug, qid, path) in enumerate(chunk):
        x = (idx % cols) * cell_w + 6
        y = (idx // cols) * cell_h + 6
        label = f"{slug[:26]} {qid}"
        draw.text((x, y), label, fill="black", font=font)
        if path.exists():
            im = Image.open(path).convert("RGB")
            im.thumbnail((cell_w - 12, cell_h - 32))
            canvas.paste(im, (x, y + 20))
    out = f"_composites_{sheet_index + 1}.png"
    canvas.save(out)
    print(out, canvas.size, len(chunk))
