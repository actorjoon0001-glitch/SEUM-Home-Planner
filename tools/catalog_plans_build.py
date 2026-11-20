#!/usr/bin/env python3
"""카탈로그 CAD 도면(PDF)에서 옮겨 적은 JSON → src/catalogPlans.js (홈플래너 전시장 도면 템플릿)

사용: python3 tools/catalog_plans_build.py <out_dir> <groups.json> <catalog_models.json>
  out_dir            : 모델별 <slug>.json (도면 판독 결과)
  groups.json        : {"groups": [[slug, ...], ...]} — 같은 PDF 를 쓰는 카탈로그 모델 묶음
  catalog_models.json: 카탈로그 models (slug, name, size, category_type, main_image, showrooms)
"""
import json, os, re, sys

out_dir, groups_path, models_path = sys.argv[1:4]
groups = json.load(open(groups_path))['groups']
models = {m['slug']: m for m in json.load(open(models_path))}
by_code = {}
for m in models.values():
    if not m.get('is_hidden'):
        by_code.setdefault(re.sub(r'\s+', '', m['name']).upper(), []).append(m)

ROOM_TYPES = {'living', 'kitchen', 'bedroom', 'bath', 'utility', 'entrance', 'dress', 'room', 'study', 'pantry',
              'hall', 'attic', 'deck', 'porch', 'balcony', 'sunroom'}
WIN_TYPES = {'double', 'sliding', 'casement', 'casement2', 'fixed', 'foldWin', 'balcony', 'door', 'swingDoor',
             'doubleDoor', 'slideDoor', 'glassSlide', 'pocketDoor', 'pivotDoor', 'folding', 'foldSwing'}
FURN = {'toilet', 'basin', 'bathtub', 'sink', 'sink18', 'fridge', 'washer', 'bedQ', 'bedS', 'sofa3', 'sofa2',
        'dining4', 'tvstand', 'shelf', 'stairs', 'induction', 'induction2'}
EXT = {'metal', 'metalV', 'cement', 'ceramic', 'stucco', 'brick', 'wood', 'stone'}
ROOF = {'flat', 'gable', 'asymGable', 'hip', 'shed'}


def thumb(url):
    m = re.search(r'/storage/v1/object/public/(.+)$', url or '')
    return f"https://aypugjvzvwinnmpquguj.supabase.co/storage/v1/render/image/public/{m.group(1)}?width=640&height=480&resize=cover&quality=70" if m else url


def clean_floor(f, warn):
    rooms, keys = [], set()
    for r in f.get('rooms') or []:
        if r.get('type') not in ROOM_TYPES: warn.append(f"room type {r.get('type')} → room"); r['type'] = 'room'
        if not all(isinstance(r.get(k), (int, float)) for k in ('x', 'y', 'w', 'd')) or r['w'] < 200 or r['d'] < 200:
            warn.append(f"bad room {r.get('key')}"); continue
        o = {k: r[k] for k in ('key', 'type', 'name') if k in r}
        o.update({k: int(round(r[k])) for k in ('x', 'y', 'w', 'd')})
        for k in ('open', 'rail'):
            v = [s for s in (r.get(k) or []) if s in ('n', 's', 'e', 'w')]
            if v: o[k] = v
        if not o.get('key'): o['key'] = f"r{len(rooms)}"
        keys.add(o['key']); rooms.append(o)
    rk = {r['key']: r for r in rooms}
    ops = []
    for p in f.get('openings') or []:
        r = rk.get(p.get('roomKey'))
        if not r or p.get('side') not in ('n', 's', 'e', 'w'): warn.append(f"opening no room {p.get('roomKey')}"); continue
        wt = p.get('winType') if p.get('winType') in WIN_TYPES else 'double'
        L = r['w'] if p['side'] in ('n', 's') else r['d']
        w = int(p.get('w') or 900); h = int(p.get('h') or 1200)
        pos = int(round(p.get('pos') or L / 2))
        pos = max(min(pos, L - w // 2), w // 2) if w < L else L // 2
        o = {'roomKey': r['key'], 'side': p['side'], 'pos': pos, 'winType': wt, 'w': min(w, L), 'h': h}
        if p.get('sill') is not None: o['sill'] = int(p['sill'])
        ops.append(o)
    furn = []
    for it in f.get('furniture') or []:
        if it.get('catalogId') in FURN and isinstance(it.get('x'), (int, float)) and isinstance(it.get('y'), (int, float)):
            furn.append({'catalogId': it['catalogId'], 'x': int(it['x']), 'y': int(it['y']), 'rotation': int(it.get('rotation') or 0) % 360})
    out = {'rooms': rooms, 'openings': ops, 'furniture': furn}
    if f.get('name'): out['name'] = f['name']
    return out


entries, report = [], []
# 집이 아닌 특수 시설 등 자동 3D 로 보여주기 어려운 도면
# 도면 제목과 카탈로그 모델명이 다른데 도면 내용(다락 등)이 카탈로그 쪽이 맞는 경우
CODE_OVERRIDE = {'stay10w': 'FOREST10-4-W'}
SKIP = {'cube5-wd': '지상형 수영장 큐브 — 주거 도면이 아니라 자동 3D 제외'}
for grp in groups:
    rep = grp[0]
    p = os.path.join(out_dir, rep + '.json')
    if not os.path.exists(p): report.append(f"MISSING {rep}"); continue
    j = json.load(open(p))
    warn = []
    if rep in SKIP: report.append(f"SKIP {rep}: {SKIP[rep]}"); continue
    # 도면 제목(괄호 설명 빼고)에서 모델명 — 'FOREST6-G,B' 처럼 여러 모델(색상 변형)용이면 모델명마다 따로 템플릿
    raw = re.sub(r'\s+', '', re.sub(r'\(.*?\)', '', j.get('pdfTitle') or '')).upper() or re.sub(r'\s+', '', j.get('code') or '').upper()
    if rep in CODE_OVERRIDE: raw = CODE_OVERRIDE[rep]
    m0 = re.match(r'^(.*-)([A-Z0-9]+(?:,[A-Z0-9]+)+)$', raw)
    codes = [m0.group(1) + v for v in m0.group(2).split(',')] if m0 else [raw]
    fix = lambda c: re.sub(r'^(FOREST|STAY|CUBE)-(?=\d)', r'\1', c)   # 'FOREST-10-E' → 'FOREST10-E'
    codes = [c if c in by_code else fix(c) for c in codes]
    # 도면 제목 모델명이 카탈로그에 없으면 이 PDF 를 올린 카탈로그 모델명으로
    known = [c for c in codes if c in by_code]
    if not known:
        known = list(dict.fromkeys(re.sub(r'\s+', '', models[s]['name']).upper() for s in grp if s in models))
    codes = known or codes
    b = j.get('base') or {}
    floors = b.get('floors')
    fl = [clean_floor(f, warn) for f in floors] if floors else [clean_floor(b, warn)]
    if not fl[0]['rooms']: report.append(f"NO ROOMS {rep}"); continue
    ex = b.get('exterior') or {}
    exterior = {'material': ex.get('material') if ex.get('material') in EXT else 'metal', 'color': ex.get('color') or '#8d96a0'}
    if ex.get('dir') == 'v': exterior['dir'] = 'v'
    # 세로 골 메탈(metalV) 질감은 우드 프린트라 색이 안 먹음 → 우드색이 아니면 가로 메탈을 세로로 시공
    if exterior['material'] == 'metalV' and exterior['color'].lower() not in ('#b8773e', '#9c7244', '#c08f5a', '#7c5a36'):
        exterior['material'] = 'metal'; exterior['dir'] = 'v'
    # 천장보다 높은 고창(복층 거실 등)은 자동 3D 벽 위로 튀어나오므로 1층에선 뺌
    H0 = int(b.get('ceilingHeight') or 2400)
    for fi, f in enumerate(fl):
        if fi > 0: continue
        keep = [o for o in f['openings'] if (o.get('sill') or 0) + o['h'] <= H0 + 50]
        if len(keep) != len(f['openings']): warn.append(f"고창 {len(f['openings']) - len(keep)}개 제외"); f['openings'] = keep
    if ex.get('corner'): exterior['corner'] = ex['corner']
    rf = b.get('roof') or {}
    roof = {'type': rf.get('type') if rf.get('type') in ROOF else 'flat', 'color': rf.get('color') or '#3a3f44'}
    if rf.get('ridge') in ('x', 'z'): roof['ridge'] = rf['ridge']
    if isinstance(rf.get('rise'), (int, float)) and 200 <= rf['rise'] <= 4000: roof['rise'] = int(rf['rise'])
    for code in codes:
        # 카탈로그 모델: 도면 제목의 모델명과 같은 것 우선, 없으면 이 PDF 를 쓰는 첫 모델
        cat_rows = by_code.get(code) or [models[s] for s in grp if s in models]
        cm = cat_rows[0] if cat_rows else {}
        sub = (j.get('subtitle') or '').strip()
        pt = b.get('productType') if b.get('productType') in ('주택', '체류형 쉼터', '농막') else ('체류형 쉼터' if '쉼터' in (j.get('category') or sub) else '주택')
        category = j.get('category') if j.get('category') in ('체류형 쉼터', '주택', '농막', '특별모델') else pt
        tid = 'cat-' + re.sub(r'[^a-z0-9-]', '-', code.lower()).strip('-')
        if any(e['id'] == tid for e in entries): tid += '-' + rep
        # 도면 제목의 괄호 설명(예: '(본사)')은 같은 모델명 다른 도면 구분용 꼬리표
        mnote = re.search(r'\(([^)]+)\)', j.get('pdfTitle') or '')
        code_note = mnote.group(1).strip() if mnote else None
        title = f"{code} {sub}".strip() + (f" ({code_note})" if code_note else '')
        base = {'name': title, 'productType': pt, 'ceilingHeight': int(b.get('ceilingHeight') or 2400),
                'foundationHeight': int(b.get('foundationHeight') or 300), 'wallThickness': int(b.get('wallThickness') or 280),
                'exterior': exterior, 'roof': roof}
        if b.get('wallThicknessInt'): base['wallThicknessInt'] = int(b['wallThicknessInt'])
        if len(fl) > 1: base['floors'] = fl
        else: base.update(fl[0])
        showroom = ((cm.get('showrooms') or [None])[0]) if cm else None
        entries.append({
            'id': tid, 'title': title, 'category': category, 'showroom': showroom or '기타',
            'tags': ['카탈로그도면', code] + ([sub] if sub else []),
            'photo': thumb(cm.get('main_image')) if cm else None, 'code': code, 'catSlugs': grp,
            **({'codeNote': code_note} if code_note else {}),
            'source': 'catalog-cad', 'confidence': j.get('confidence') or 'medium', 'base': base,
        })
        mism = [s for s in grp if s in models and re.sub(r'\s+', '', models[s]['name']).upper() != code]
        report.append(f"{rep:16s} {code:16s} {j.get('confidence','?'):6s} rooms={len(fl[0]['rooms'])} ops={sum(len(f['openings']) for f in fl)} floors={len(fl)}"
                      + (f"  [PDF가 다른 모델에도 올라감: {', '.join(models[s]['name'] + '(' + s + ')' for s in mism)}]" if mism else '')
                      + (f"  warn={warn}" if warn else ''))

js = ("// 자동 생성 — tools/catalog_plans_build.py (온라인 카탈로그 CAD 도면 PDF 를 판독해 옮긴 전시장 도면)\n"
      "//   3D 는 도면 기반 자동 모델. 블렌더 실물 모델이 생기면 templates.js 의 실물 템플릿으로 교체\n"
      "export const CATALOG_PLANS = " + json.dumps(entries, ensure_ascii=False, indent=1) + ";\n")
open(os.path.join(os.path.dirname(__file__), '..', 'src', 'catalogPlans.js'), 'w').write(js)
print('\n'.join(report))
print(f"→ {len(entries)} templates written")
