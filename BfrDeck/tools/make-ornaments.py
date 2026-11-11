"""Decorative art for BFR Deck ("Midnight Gilt") via the OpenAI image API (a few cents per image).
Reads OPENAI_API_KEY from the gitignored Brave Frontier\\.env (or the environment). No game logos, characters or assets.
usage: python -I tools/make-ornaments.py [--only corner,crest,empty]
Output: wwwroot/img/<name>.png
"""
import os, json, base64, io, argparse, urllib.request
from PIL import Image

here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))          # ...\BfrDeck
img_dir = os.path.join(here, 'wwwroot', 'img')
ENV_PATHS = [os.path.join(os.path.dirname(here), '.env'),
             os.path.expandvars(r'%USERPROFILE%\Desktop\Projects\Brave Frontier\.env')]   # worktree has no .env; the real project does

def load_key():
    for p in ENV_PATHS:
        if os.path.exists(p):
            for line in open(p, encoding='utf-8'):
                if line.strip().startswith('OPENAI_API_KEY='): return line.split('=', 1)[1].strip()
    k = os.environ.get('OPENAI_API_KEY')
    if k: return k
    raise SystemExit('no OPENAI_API_KEY')

GREEN = ' Place it on a completely flat, uniform, pure bright green (#00FF00) background with no gradient, shadow, glow or outline touching it. No text, no letters, no logos.'
ART = {
    'crest':  dict(size='1024x1024', out=256, square=True,  prompt='Small heraldic crest emblem for a fantasy game companion app: a stylised winged shield with an upward pointing sword behind it, engraved antique gold (#f2d27a to #8f6a1e) with a deep indigo (#1a1e38) shield face, thin fine lines, minimal detail so it stays readable at 32 pixels, perfectly symmetric, flat vector illustration with subtle gold highlights, centred, fills 85% of the canvas.'),
    'empty':  dict(size='1536x1024', out=480, square=False, prompt='An empty ornate stone pedestal with a faint glowing gold ring floating above it and a few drifting gold sparkles, fantasy RPG style, soft indigo (#232848) and antique gold palette, muted and low contrast so it sits quietly on a dark navy panel, painterly but clean, no characters, centred.'),
}

def key_green(im, square):
    px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            gr = g - max(r, b)
            if gr > 110: px[x, y] = (r, g, b, 0)
            elif gr > 40: px[x, y] = (r, max(r, b), b, int(255 * (110 - gr) / 70))
    bbox = im.getbbox()
    if bbox:
        m = 0 if not square else int(0.04 * max(im.size))
        im = im.crop((max(0, bbox[0]-m), max(0, bbox[1]-m), min(w, bbox[2]+m), min(h, bbox[3]+m)))
        if square:
            side = max(im.size); sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.paste(im, ((side-im.width)//2, (side-im.height)//2)); im = sq
    return im

def generate(key, name, spec):
    body = {'model': 'gpt-image-2', 'prompt': spec['prompt'] + GREEN, 'size': spec['size'], 'quality': 'medium', 'n': 1}
    req = urllib.request.Request('https://api.openai.com/v1/images/generations', data=json.dumps(body).encode('utf-8'),
                                 headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=300) as r: data = json.loads(r.read().decode('utf-8'))
    im = Image.open(io.BytesIO(base64.b64decode(data['data'][0]['b64_json']))).convert('RGBA')
    im = key_green(im, spec['square'])
    scale = spec['out'] / max(im.size); im = im.resize((max(1, round(im.width*scale)), max(1, round(im.height*scale))), Image.LANCZOS)
    out = os.path.join(img_dir, f'{name}.png'); im.save(out, optimize=True); print(f'{name}: {out} {im.size}')

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--only', default=''); a = ap.parse_args()
    key = load_key()
    for n in [x for x in a.only.split(',') if x] or list(ART):
        try: generate(key, n, ART[n])
        except Exception as e: print(f'{n}: FAILED {e}')
