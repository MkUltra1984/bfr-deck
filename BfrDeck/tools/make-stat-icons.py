"""Makes the small symbols of the account row and the Today shortcuts (wwwroot/img/s-*.png) with the OpenAI image
API. The deck's own gem, Zel and Karma symbols go along as the style to match. One sheet of ten symbols on a green
background is asked for, the green is keyed out and the sheet is cut into single pictures (two rows of five, found
by their gaps). The key is read from a gitignored .env outside this repository and never printed.
Six of the ten (level, gifts, box, cost, todo, story) were afterwards redrawn from the game's own interface symbols with the
same API (edit endpoint, the originals on a 3 x 2 sheet); energy was redone in yellow because a green bolt is lost with the green background.
usage: python -I tools/make-stat-icons.py [raw-sheet.png to cut again without a new request]
"""
import os, sys, io, json, uuid, base64, urllib.request, urllib.error
from PIL import Image
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); img = os.path.join(here, 'wwwroot', 'img')
ENV = os.path.join(os.path.expanduser('~'), 'Desktop', 'Projects', 'ML Draft', '.env')
NAMES = ['level', 'energy', 'orbs', 'gifts', 'box', 'cost', 'todo', 'evolve', 'challenge', 'story']
PROMPT = ('The picture shows three finished game interface icons (a blue gem, a gold coin, a blue soul orb) in the top row. They are the STYLE to match: '
          'small glossy fantasy RPG icons, rich colour gradients, a dark outline, a soft highlight on top, readable at 16 pixels. '
          'Draw a NEW sheet of exactly ten icons in that same style, in 2 rows of 5, evenly spaced with wide empty gaps between them, each centred in its cell, all the same size:\n'
          'Row 1: (1) a golden five-pointed star for player level; (2) a green lightning bolt for energy; (3) a purple glowing orb with a four-pointed sparkle inside for arena orbs; '
          '(4) a red gift box with a gold ribbon and bow; (5) a wooden treasure chest with gold bands, closed, for the unit box.\n'
          'Row 2: (6) a blue shield with a white plus sign for the squad cost limit; (7) a parchment checklist on a clipboard with two green check marks; '
          '(8) an orange upward arrow rising out of a small flame for evolution; (9) a steel sword pointing up-right with a bronze hilt for a challenge; (10) an open blue book for the story.\n'
          'No text, no letters, no numbers, no frames, no shadows on the background. Background: completely flat, uniform, pure bright green (#00FF00) everywhere; no green inside the icons.')

def key():
    for line in open(ENV, encoding='utf-8'):
        if line.strip().startswith('OPENAI_API_KEY='): return line.split('=', 1)[1].strip()
    raise SystemExit('no OPENAI_API_KEY in the .env file')

def request():
    ref = Image.new('RGB', (1536, 1024), (20, 22, 32))
    for i, n in enumerate(('gem', 'zel', 'karma')):
        ic = Image.open(os.path.join(img, n + '.png')).convert('RGBA').resize((300, 300), Image.LANCZOS); ref.paste(ic, (160 + i * 458, 100), ic)
    buf = io.BytesIO(); ref.save(buf, 'PNG'); b = uuid.uuid4().hex; parts = []
    for k, v in (('model', 'gpt-image-2'), ('prompt', PROMPT), ('size', '1536x1024'), ('quality', 'medium')):
        parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode('utf-8'))
    parts.append(f'--{b}\r\nContent-Disposition: form-data; name="image"; filename="ref.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + buf.getvalue() + b'\r\n')
    parts.append(f'--{b}--\r\n'.encode())
    req = urllib.request.Request('https://api.openai.com/v1/images/edits', data=b''.join(parts), headers={'Authorization': f'Bearer {key()}', 'Content-Type': f'multipart/form-data; boundary={b}'})
    try:
        with urllib.request.urlopen(req, timeout=400) as r: data = json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        raise SystemExit(f'the image service answered {e.code} {e.reason}: {e.read().decode("utf-8", "replace")[:300]}')
    return Image.open(io.BytesIO(base64.b64decode(data['data'][0]['b64_json']))).convert('RGBA')

def keyed(sheet):
    px = sheet.load()
    for y in range(sheet.height):
        for x in range(sheet.width):
            r, g, b, _ = px[x, y]; gr = g - max(r, b); a = 0 if gr > 90 else 255 if gr < 30 else int(255 * (90 - gr) / 60)
            px[x, y] = (r, min(g, max(r, b)) if a < 255 else g, b, a)
    return sheet

def runs(flags, min_len):
    out, start = [], None
    for i, f in enumerate(list(flags) + [False]):
        if f and start is None: start = i
        if not f and start is not None:
            if i - start >= min_len: out.append((start, i))
            start = None
    return out

def cut(sheet):
    a = sheet.getchannel('A'); w, h = sheet.size; ap = a.load()
    rows = runs([any(ap[x, y] > 60 for x in range(0, w, 3)) for y in range(h)], 60)
    cells = []
    for y0, y1 in rows[:2]:
        cols = runs([any(ap[x, y] > 60 for y in range(y0, y1, 3)) for x in range(w)], 60)
        cells += [(x0, y0, x1, y1) for x0, x1 in cols[:5]]
    if len(cells) != 10: raise SystemExit(f'found {len(cells)} symbols instead of 10; the raw sheet is kept, try again')
    for name, box in zip(NAMES, cells):
        ic = sheet.crop(box); ic = ic.crop(ic.getbbox()); side = int(max(ic.size) * 1.08)
        sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.paste(ic, ((side - ic.width) // 2, (side - ic.height) // 2), ic)
        sq.resize((96, 96), Image.LANCZOS).save(os.path.join(img, f's-{name}.png'))
    print('ok', len(cells))

raw = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get('TEMP', '.'), 'bfr-stat-icons-raw.png')
if len(sys.argv) > 1: sheet = Image.open(raw).convert('RGBA')
else: sheet = request(); sheet.save(raw)
cut(keyed(sheet))
