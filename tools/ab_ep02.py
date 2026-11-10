#!/usr/bin/env python3
"""EP-02 blind A/B: our captures vs the GoT reference frames.
Pairs shots with matched references, emits side-by-side composites labelled
A|B (hash-chosen sides) plus 1:1 crops; the key goes to a separate directory.
  python3 tools/ab_ep02.py --ours shots/latest --out shots/ab --keydir shots/ab_key
"""
import argparse, hashlib, json, os
from PIL import Image

PAIRS = {
    "golden_hour_vista":   "field_24.png",  # open golden field, hills, water
    "player_third_person": "field_16.png",  # rider in golden field, backlit
    "forest_interior":     "field_2.png",   # golden forest, rider, god rays
    "log_bridge":          "field_24.png",  # bridge over the stream
    "town_street":         "shrine_night.png",  # the shrine bar
    "integration_gallop":  "field_9.png",   # rider crossing the field
}
REGIONS = {
    "foreground": (0.30, 0.72, 0.40, 0.24),
    "midground":  (0.30, 0.42, 0.40, 0.24),
    "sky":        (0.10, 0.04, 0.55, 0.24),
}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ours", required=True)
    ap.add_argument("--ref", default="references")
    ap.add_argument("--out", required=True)
    ap.add_argument("--keydir", required=True)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    os.makedirs(a.keydir, exist_ok=True)
    key = {}
    for shot, ref in PAIRS.items():
        ours_p = os.path.join(a.ours, shot + ".png")
        ref_p = os.path.join(a.ref, ref)
        if not os.path.exists(ours_p) or not os.path.exists(ref_p):
            print("skip", shot); continue
        A = Image.open(ours_p).convert("RGB")
        B = Image.open(ref_p).convert("RGB")
        W = min(A.width, B.width, 1280)
        H = min(A.height, B.height, 720)
        A = A.resize((W, H))
        B = B.resize((W, H))
        side = int(hashlib.sha256(f"ep02|{shot}|{ref}".encode()).hexdigest(), 16) % 2
        comp = Image.new("RGB", (W * 2 + 12, H + 34), (12, 12, 12))
        left, right = (A, B) if side == 0 else (B, A)
        comp.paste(left, (0, 34)); comp.paste(right, (W + 12, 34))
        from PIL import ImageDraw
        d = ImageDraw.Draw(comp)
        d.text((8, 8), "A", fill=(240, 220, 160))
        d.text((W + 20, 8), "B", fill=(240, 220, 160))
        comp.save(os.path.join(a.out, f"{shot}__ab.png"))
        # crops stacked A over B at 1:1
        for rname, (fx, fy, fw, fh) in REGIONS.items():
            box = (int(fx * W), int(fy * H), int((fx + fw) * W), int((fy + fh) * H))
            ca, cb = A.crop(box), B.crop(box)
            stack = Image.new("RGB", (ca.width, ca.height * 2 + 8), (12, 12, 12))
            top, bot = (ca, cb) if side == 0 else (cb, ca)
            stack.paste(top, (0, 0)); stack.paste(bot, (0, ca.height + 8))
            stack.save(os.path.join(a.out, f"{shot}__crop_{rname}.png"))
        key[shot] = {"A": "ours" if side == 0 else "reference",
                     "B": "reference" if side == 0 else "ours", "ref": ref}
    with open(os.path.join(a.keydir, "key.json"), "w") as f:
        json.dump(key, f, indent=2)
    print("pairs:", len(key))

main()
