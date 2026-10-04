# 홈플래너 도면(JSON) → 블렌더 실물 모델(.blend) 생성기
#
#   전시모델을 도면 치수 그대로 블렌더로 만든다. 재질은 황토찜질방 원본(models/src/seum-hwangto.blend)의
#   우드패턴 강판·합성데크·오크 장판·로이유리 등을 가져와 같은 품질로 맞춘다.
#   결과 .blend 는 tools/blender/blend_to_planner_glb.py 로 GLB 변환 → models/ 에 넣고 템플릿 model3d 로 연결.
#
#   실행:  python tools/blender/plan_to_blend.py -- 도면.json 출력.blend [--lib models/src/seum-hwangto.blend] [--preview 미리보기.png]
#          (pip install bpy shapely)   ·   blender -b --python ... 도 가능(shapely 설치 필요)
#
#   좌표: 블렌더 X = 도면 x(mm)/1000, 블렌더 Y = -도면 y/1000 (도면 아래=남쪽 = 블렌더 -Y), 땅 = Z 0
#         → 변환 시 --origin-x 0 --origin-y 0, --roof-z (기초+천장높이-0.02)
#
#   재질 이름 = GLB 부품 이름 (제품 옵션 parts 에 그대로 씀)
#     외장_사이딩_X/Y(앞뒤/옆 벽), 외장_코너, 하부_스커트, 창틀, 유리, 창몰딩, 문짝, 문틀, 손잡이,
#     데크, 철골, 기둥, 실내벽, 바닥_마루, 바닥_타일, 천장, 징크(박공)/지붕방수(평지붕), 후레싱, 처마밑
#     (천장 위 부품은 변환 때 '지붕_' 이 앞에 붙음 → 예: 지붕_징크, 지붕_외장_사이딩_X)
import bpy
_ = bpy.app.version
import bmesh, json, math, sys, os, argparse
from mathutils import Vector, Matrix
from mathutils.geometry import tessellate_polygon
from shapely.geometry import box as sbox, LineString, Polygon, MultiPolygon, Point
from shapely.ops import unary_union

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('plan'); ap.add_argument('out')
ap.add_argument('--lib', default=os.path.join(os.path.dirname(__file__), '..', '..', 'models', 'src', 'seum-hwangto.blend'))
ap.add_argument('--preview', default='')
A = ap.parse_args(argv)
D = json.load(open(A.plan, encoding='utf-8'))

OPEN_TYPES = {'porch', 'deck', 'balcony'}
WET_TYPES = {'bath', 'utility', 'entrance'}
DOOR_TYPES = {'door', 'swingDoor', 'doubleDoor', 'slideDoor', 'glassSlide', 'pocketDoor', 'pivotDoor', 'folding', 'foldSwing', 'balcony', 'slide'}
F = (D.get('foundationHeight') or 0) / 1000.0            # 바닥 높이(m)
H = (D.get('ceilingHeight') or 2400) / 1000.0            # 천장 높이(m)
TE, TI = 0.15, 0.10                                      # 외벽 / 칸막이 두께
ROOF = D.get('roof') or {}
FLAT_TOP = 0.45                                          # 평지붕: 천장 위 파라펫 높이

# ---------------------------------------------------------------- 장면 초기화
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.unit_settings.system = 'METRIC'
col = bpy.data.collections.new(D.get('name') or 'model'); sc.collection.children.link(col)

def hexrgb(h, a=1.0):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x ** 2.2 for x in c] + [a]                    # sRGB → 선형

# ---------------------------------------------------------------- 재질
LIB = {}
if os.path.exists(A.lib):
    want = ['우드톤_강판사이딩_X', '우드톤_강판사이딩_Y', '합성데크', '오크장판', '로이복층유리', '각관_분체도장_차콜', '징크_차콜', '처마밑_강판_X', '처마밑_강판_Y']
    with bpy.data.libraries.load(A.lib, link=False) as (src, dst):
        dst.materials = [n for n in want if n in src.materials]
    for m in dst.materials:
        if m: LIB[m.name] = m

def plain(name, color, rough=0.6, metal=0.0, alpha=1.0, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = hexrgb(color)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if alpha < 1: b.inputs['Alpha'].default_value = alpha
    if emit: b.inputs['Emission Color'].default_value = hexrgb(emit); b.inputs['Emission Strength'].default_value = 3.0
    m.diffuse_color = hexrgb(color)
    return m

def from_lib(src, name, fallback_color, preview_color=None):
    m = LIB.get(src)
    if m:
        m = m.copy(); m.name = name
    else:
        m = plain(name, fallback_color)
    m.diffuse_color = hexrgb(preview_color or fallback_color)
    return m

def siding_mat(name, kind, color, axis):
    """메탈사이딩(가로 판, 200mm) / 골강판(세로 골, 76mm) — 판 이음·골 음영을 색으로 표현 (변환 때 구워짐)
       axis: 세로 골의 가로 좌표축 'X'(앞뒤 벽) / 'Y'(옆 벽)"""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; Lk = nt.links
    b = N.get('Principled BSDF')
    b.inputs['Roughness'].default_value = 0.42; b.inputs['Metallic'].default_value = 0.35
    tc = N.new('ShaderNodeTexCoord'); sx = N.new('ShaderNodeSeparateXYZ'); Lk.new(tc.outputs['Object'], sx.inputs['Vector'])
    mul = N.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
    fr = N.new('ShaderNodeMath'); fr.operation = 'FRACT'
    base = hexrgb(color)[:3]
    sh = lambda k: [min(1.0, c * k) for c in base] + [1.0]
    ramp = N.new('ShaderNodeValToRGB'); el = ramp.color_ramp.elements
    if kind == 'metal':
        Lk.new(sx.outputs['Z'], mul.inputs[0]); mul.inputs[1].default_value = 1 / 0.2
        stops = [(0.0, 0.42), (0.035, 0.7), (0.07, 1.12), (0.55, 1.0), (1.0, 0.86)]
    else:
        Lk.new(sx.outputs[axis], mul.inputs[0]); mul.inputs[1].default_value = 1 / 0.076
        stops = [(0.0, 0.78), (0.25, 1.12), (0.5, 0.86), (0.75, 0.66), (1.0, 0.78)]
    el[0].position, el[0].color = stops[0][0], sh(stops[0][1])
    el[1].position, el[1].color = stops[-1][0], sh(stops[-1][1])
    for pos, k in stops[1:-1]:
        e = el.new(pos); e.color = sh(k)
    Lk.new(mul.outputs[0], fr.inputs[0]); Lk.new(fr.outputs[0], ramp.inputs['Fac'])
    # 잔잔한 얼룩(완전 균일하면 CG 같아 보임)
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3.0
    Lk.new(tc.outputs['Object'], nz.inputs['Vector'])
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 0.06
    Lk.new(ramp.outputs['Color'], mix.inputs['A']); Lk.new(nz.outputs['Color'], mix.inputs['B'])
    Lk.new(mix.outputs['Result'], b.inputs['Base Color'])
    m.diffuse_color = hexrgb(color)
    return m

ext = D.get('exterior') or {}
openings = D.get('openings') or []
win_col = next((o.get('color') for o in openings if o.get('winType') not in DOOR_TYPES and o.get('color')), '#1c1f24')
door_col = next((o.get('color') for o in openings if o.get('winType') in ('door', 'swingDoor') and o.get('color')), '#2b2b2b')
M = {
    'ext_x': (siding_mat('외장_사이딩_X', 'metalV' if ext.get('material') == 'metalV' else 'metal', ext.get('color', '#3d4651'), 'X')
              if ext.get('material') in ('metal', 'metalV') else from_lib('우드톤_강판사이딩_X', '외장_사이딩_X', ext.get('color', '#975227'))),
    'ext_y': (siding_mat('외장_사이딩_Y', 'metalV' if ext.get('material') == 'metalV' else 'metal', ext.get('color', '#3d4651'), 'Y')
              if ext.get('material') in ('metal', 'metalV') else from_lib('우드톤_강판사이딩_Y', '외장_사이딩_Y', ext.get('color', '#975227'))),
    'corner': plain('외장_코너', ext.get('corner') or '#2a2b2e', 0.45, 0.4),
    'skirt': plain('하부_스커트', '#3a3b3e', 0.6, 0.3),
    'frame': plain('창틀', win_col, 0.4, 0.2),
    'glass': from_lib('로이복층유리', '유리', '#9eb1ab'),
    'trim': plain('창몰딩', '#2a2b2e', 0.45, 0.4),
    'door': plain('문짝', door_col, 0.45, 0.15),
    'doorframe': plain('문틀', '#2a2b2e', 0.45, 0.3),
    'handle': plain('손잡이', '#c9c9cc', 0.25, 0.9),
    'deck': from_lib('합성데크', '데크', '#55493e'),
    'steel': from_lib('각관_분체도장_차콜', '철골', '#333336'),
    'wall_in': plain('실내벽', '#eeebe4', 0.85),
    'floor': from_lib('오크장판', '바닥_마루', '#c9a57a'),
    'tile': plain('바닥_타일', '#d4d3cf', 0.35),
    'ceil': plain('천장', '#f4f3ef', 0.9),
    'roof': plain('지붕방수', '#3c3d40', 0.8, 0.1),
    'flash': plain('후레싱', ROOF.get('fascia') or ROOF.get('color') or '#3a3f44', 0.45, 0.5),
    'soffit': from_lib('처마밑_강판_Y', '처마밑', '#c9a57a') if ROOF.get('soffit') == 'wood' else plain('처마밑', '#e9e6df', 0.7),
    'post': plain('기둥', ROOF.get('postColor') or '#2f3033', 0.45, 0.4),
}
if ROOF.get('type', 'gable') != 'flat':   # 박공·외쪽 지붕은 징크(스탠딩심) 색
    M['roof'] = plain('징크', ROOF.get('color') or '#3b3837', 0.45, 0.55)

# ---------------------------------------------------------------- 메시 헬퍼 (월드 좌표 그대로 — 절차적 무늬가 벽마다 이어지게)
def mesh_obj(name, verts, faces, mats, face_mat=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    for m in mats: me.materials.append(m)
    if face_mat:
        for i, p in enumerate(me.polygons): p.material_index = face_mat[i]
    me.validate(); me.update()
    o = bpy.data.objects.new(name, me); col.objects.link(o)
    return o

def box(name, x0, y0, z0, x1, y1, z1, mat):
    x0, x1 = sorted((x0, x1)); y0, y1 = sorted((y0, y1)); z0, z1 = sorted((z0, z1))
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return mesh_obj(name, v, f, [mat])

def side_mat_ext(nx, ny):     # 벽 바깥면 방향 → 사이딩 X(앞뒤 벽) / Y(옆 벽)
    return 0 if abs(ny) >= abs(nx) else 1

def extrude_poly(name, poly, z0, z1, outer_mats, inner_mat, cap_mat):
    """shapely 다각형(구멍 포함)을 z0~z1 로 세움. 바깥 테두리 옆면은 방향별 outer_mats, 구멍 테두리는 inner_mat."""
    polys = list(poly.geoms) if isinstance(poly, MultiPolygon) else [poly]
    verts, faces, fm = [], [], []
    mats = list(outer_mats) + [inner_mat, cap_mat]
    I_IN, I_CAP = len(outer_mats), len(outer_mats) + 1
    for pg in polys:
        if pg.is_empty or pg.area < 1e-6: continue
        rings = [list(pg.exterior.coords)[:-1]] + [list(r.coords)[:-1] for r in pg.interiors]
        # 뚜껑(위·아래)
        flat = [[Vector((x, y, 0)) for x, y in r] for r in rings]
        tris = tessellate_polygon(flat)
        allpts = [p for r in rings for p in r]
        base = len(verts)
        for x, y in allpts: verts.append((x, y, z0))
        for x, y in allpts: verts.append((x, y, z1))
        n = len(allpts)
        for a, b, c in tris:
            faces.append((base + c, base + b, base + a)); fm.append(I_CAP)
            faces.append((base + n + a, base + n + b, base + n + c)); fm.append(I_CAP)
        # 옆면
        for ri, r in enumerate(rings):
            ccw = Polygon(r).exterior.is_ccw
            for i in range(len(r)):
                (xa, ya), (xb, yb) = r[i], r[(i + 1) % len(r)]
                dx, dy = xb - xa, yb - ya
                L = math.hypot(dx, dy)
                if L < 1e-6: continue
                # 바깥 방향 법선: 외곽 링이면 링 방향 기준 오른쪽/왼쪽, 구멍 링이면 반대
                nx, ny = (dy / L, -dx / L) if ccw else (-dy / L, dx / L)
                if ri > 0: nx, ny = -nx, -ny   # 구멍 링은 안쪽(방)을 향함 — 링 방향과 무관하게 아래에서 다시 판정
                k = len(verts)
                verts += [(xa, ya, z0), (xb, yb, z0), (xb, yb, z1), (xa, ya, z1)]
                # 면이 법선 방향을 보도록 정점 순서 결정
                fn = Vector((dx, dy, 0)).cross(Vector((0, 0, 1)))
                f = (k, k + 1, k + 2, k + 3) if fn.dot(Vector((nx, ny, 0))) > 0 else (k + 3, k + 2, k + 1, k)
                faces.append(f)
                fm.append(I_IN if ri > 0 else side_mat_ext(nx, ny))
    o = mesh_obj(name, verts, faces, mats, fm)
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(o.data); bm.free()
    return o

# ---------------------------------------------------------------- 평면 해석
def rect_b(r):        # 도면 방(mm) → 블렌더 평면 사각형 (minx, miny, maxx, maxy)
    return (r['x'] / 1000, -(r['y'] + r['d']) / 1000, (r['x'] + r['w']) / 1000, -r['y'] / 1000)

rooms = D['rooms']
encl = [r for r in rooms if r['type'] not in OPEN_TYPES]
outs = [r for r in rooms if r['type'] in OPEN_TYPES]
U = unary_union([sbox(*rect_b(r)) for r in encl]).buffer(0.0005, join_style=2).buffer(-0.0005, join_style=2)
INNER = U.buffer(-TE, join_style=2)
RING = U.difference(INNER)
ROOF_TYPE = ROOF.get('type', 'gable')
WALL_TOP = F + H + (FLAT_TOP if ROOF_TYPE == 'flat' else 0.25)

# ---------------------------------------------------------------- 벽
#   천장 아래(외벽)와 천장 위(외벽_상부)를 나눔 → 홈플래너에서 '지붕 끄기' 하면 천장 위가 함께 숨겨져 실내가 보임
CEIL_TOP = F + H + 0.02
walls_ext = extrude_poly('외벽', RING, F - 0.05, CEIL_TOP, [M['ext_x'], M['ext_y']], M['wall_in'], M['ext_x'])
extrude_poly('외벽_상부', RING, CEIL_TOP, WALL_TOP, [M['ext_x'], M['ext_y']],
             M['roof'] if ROOF_TYPE == 'flat' else M['ceil'], M['ext_x'])

# 칸막이: 닫힌 방끼리 맞닿은 변 (어느 쪽이든 open 이면 생략)
OPP = {'n': 's', 's': 'n', 'e': 'w', 'w': 'e'}
def edge_of(r, side):
    x0, y0, x1, y1 = r['x'], r['y'], r['x'] + r['w'], r['y'] + r['d']
    return {'n': ((x0, y0), (x1, y0)), 's': ((x0, y1), (x1, y1)), 'w': ((x0, y0), (x0, y1)), 'e': ((x1, y0), (x1, y1))}[side]
parts = []
for i, a in enumerate(encl):
    for b in encl[i + 1:]:
        for s in 'nsew':
            (ax0, ay0), (ax1, ay1) = edge_of(a, s)
            (bx0, by0), (bx1, by1) = edge_of(b, OPP[s])
            if s in 'ns' and abs(ay0 - by0) < 1:
                lo, hi = max(ax0, bx0), min(ax1, bx1)
                seg = ((lo, ay0), (hi, ay0)) if hi - lo > 50 else None
            elif s in 'ew' and abs(ax0 - bx0) < 1:
                lo, hi = max(ay0, by0), min(ay1, by1)
                seg = ((ax0, lo), (ax0, hi)) if hi - lo > 50 else None
            else:
                seg = None
            if not seg: continue
            if s in (a.get('open') or []) or OPP[s] in (b.get('open') or []): continue
            (sx0, sy0), (sx1, sy1) = seg
            parts.append(LineString([(sx0 / 1000, -sy0 / 1000), (sx1 / 1000, -sy1 / 1000)]).buffer(TI / 2, cap_style=2, join_style=2))
walls_in = None
if parts:
    PART = unary_union(parts).intersection(INNER.buffer(0.0005))
    if not PART.is_empty:
        walls_in = extrude_poly('칸막이', PART, F - 0.05, F + H, [M['wall_in'], M['wall_in']], M['wall_in'], M['wall_in'])

# ---------------------------------------------------------------- 창·문
def opening_frame(o):
    """개구부의 벽 위 위치: (중심점 블렌더 xy, 벽 방향 단위벡터 u, 바깥 법선 n, 외벽 여부)"""
    r = next(rr for rr in rooms if rr['id'] == o['roomId'])
    s, pos = o['side'], o['pos']
    if s in 'ns':
        px, py = r['x'] + pos, r['y'] + (0 if s == 'n' else r['d'])
        u = Vector((1, 0, 0)); n = Vector((0, 1, 0)) if s == 'n' else Vector((0, -1, 0))
    else:
        px, py = r['x'] + (0 if s == 'w' else r['w']), r['y'] + pos
        u = Vector((0, -1, 0)); n = Vector((-1, 0, 0)) if s == 'w' else Vector((1, 0, 0))
    c = Vector((px / 1000, -py / 1000, 0))
    probe = c + n * 0.08
    exterior = not U.contains(Point(probe.x, probe.y))
    return c, u, n, exterior

class Builder:
    """개구부 로컬 좌표(u=벽 따라, v=바깥쪽+, z=위) 로 부재를 만들고 월드로 옮김"""
    def __init__(self, c, u, n, tag):
        self.c, self.u, self.n, self.tag, self.objs = c, u, n, tag, []
    def part(self, name, u0, u1, v0, v1, z0, z1, mat):
        w = lambda uu, vv, zz: self.c + self.u * uu + self.n * vv + Vector((0, 0, zz))
        pts = [w(u0, v0, z0), w(u1, v0, z0), w(u1, v1, z0), w(u0, v1, z0), w(u0, v0, z1), w(u1, v0, z1), w(u1, v1, z1), w(u0, v1, z1)]
        f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        o = mesh_obj(f'{self.tag}_{name}', pts, f, [mat])
        # 법선이 뒤집힌 경우(u×n 방향에 따라) 바로잡기
        bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(o.data); bm.free()
        self.objs.append(o); return o
    def rect_frame(self, name, u0, u1, z0, z1, v0, v1, fw, mat, bottom=True):
        self.part(name + '_상', u0, u1, v0, v1, z1 - fw, z1, mat)
        if bottom: self.part(name + '_하', u0, u1, v0, v1, z0, z0 + fw, mat)
        self.part(name + '_좌', u0, u0 + fw, v0, v1, z0, z1, mat)
        self.part(name + '_우', u1 - fw, u1, v0, v1, z0, z1, mat)

cutters = []
for k, o in enumerate(openings):
    t = o['winType']; w, h = o['w'] / 1000, o['h'] / 1000
    sill = (o.get('sill') or 0) / 1000
    c, u, n, ext_wall = opening_frame(o)
    z0, z1 = F + sill, F + sill + h
    is_door = t in DOOR_TYPES
    # 벽 구멍
    if ext_wall: va, vb = -TE - 0.05, 0.05
    else: va, vb = -TI / 2 - 0.05, TI / 2 + 0.05
    B = Builder(c, u, n, f'개구부{k:02d}')
    cut = B.part('cut', -w / 2, w / 2, va, vb, z0 if not is_door else F - 0.06, z1, M['wall_in'])
    B.objs.remove(cut); cutters.append(cut)
    # 위치(벽 두께 안): 외벽은 바깥면에서 3cm 안쪽, 칸막이는 가운데
    if ext_wall: fv0, fv1 = -0.10, -0.03
    else: fv0, fv1 = -0.035, 0.035
    fw = 0.06
    if not is_door:
        B.rect_frame('틀', -w / 2, w / 2, z0, z1, fv0, fv1, fw, M['frame'])
        panes = {'double': 2, 'sliding': 2, 'casement2': 2, 'foldWin': 4}.get(t, 1)
        slide = t in ('double', 'sliding', 'foldWin')
        iw = w - 2 * fw
        for p in range(panes):
            pw = iw / panes + (0.03 if slide and panes > 1 else 0)
            pu0 = -iw / 2 + p * iw / panes - (0.015 if slide and p > 0 else 0)
            dv = (-0.02 if (slide and p % 2) else 0)
            sv0, sv1 = fv0 + 0.015 + dv, fv0 + 0.045 + dv
            B.rect_frame(f'창짝{p}', pu0, pu0 + pw, z0 + fw, z1 - fw, sv0, sv1, 0.045, M['frame'])
            B.part(f'유리{p}', pu0 + 0.04, pu0 + pw - 0.04, (sv0 + sv1) / 2 - 0.006, (sv0 + sv1) / 2 + 0.006, z0 + fw + 0.04, z1 - fw - 0.04, M['glass'])
        if ext_wall:   # 바깥 몰딩 + 창대
            B.rect_frame('몰딩', -w / 2 - 0.06, w / 2 + 0.06, z0 - 0.06, z1 + 0.06, 0.0, 0.02, 0.06, M['trim'], bottom=False)
            B.part('창대', -w / 2 - 0.08, w / 2 + 0.08, -0.03, 0.06, z0 - 0.035, z0, M['trim'])
    else:
        glassy = t in ('folding', 'foldSwing', 'glassSlide', 'balcony', 'slide')
        B.rect_frame('문틀', -w / 2, w / 2, F, z1, fv0 - (0.02 if ext_wall else 0), fv1, 0.05, M['doorframe'], bottom=False)
        B.part('문턱', -w / 2, w / 2, fv0, fv1, F - 0.01, F + 0.012, M['doorframe'])
        iw = w - 0.10
        if glassy:
            panes = {'folding': 4, 'foldSwing': 4, 'glassSlide': 3, 'balcony': 3, 'slide': 2}.get(t, 2)
            for p in range(panes):
                pu0 = -iw / 2 + p * iw / panes
                dv = -0.025 if (t in ('glassSlide', 'balcony', 'slide') and p % 2) else 0
                sv0, sv1 = fv0 + 0.02 + dv, fv0 + 0.055 + dv
                B.rect_frame(f'문짝{p}', pu0, pu0 + iw / panes, F + 0.012, z1 - 0.05, sv0, sv1, 0.05, M['frame'])
                B.part(f'유리{p}', pu0 + 0.045, pu0 + iw / panes - 0.045, (sv0 + sv1) / 2 - 0.006, (sv0 + sv1) / 2 + 0.006, F + 0.06, z1 - 0.095, M['glass'])
            if t == 'foldSwing':   # 출입문 칸 손잡이
                B.part('손잡이', iw / 2 - iw / 4 + 0.06, iw / 2 - iw / 4 + 0.08, fv1 + 0.0, fv1 + 0.05, F + 0.9, F + 1.2, M['handle'])
        else:
            leaves = 2 if t == 'doubleDoor' else 1
            sv0, sv1 = (fv0 + 0.01, fv0 + 0.05) if ext_wall else (-0.02, 0.02)
            for p in range(leaves):
                lu0 = -iw / 2 + p * iw / leaves
                B.part(f'문짝{p}', lu0 + 0.002, lu0 + iw / leaves - 0.002, sv0, sv1, F + 0.012, z1 - 0.05, M['door'])
            # 레버 손잡이 (안·밖)
            hu = iw / 2 - 0.07 if leaves == 1 else 0.06
            for vv in (sv1, sv0 - 0.06):
                B.part('레버', hu - 0.13, hu, vv, vv + 0.06, F + 0.98, F + 1.0, M['handle'])
            if ext_wall:   # 현관 도어락 본체(바깥)
                B.part('도어락', hu - 0.035, hu + 0.035, sv1, sv1 + 0.025, F + 0.9, F + 1.42, M['door'])

for w_obj in [walls_ext] + ([walls_in] if walls_in else []):
    mod = w_obj.modifiers.new('구멍', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.solver = 'EXACT'
    cc = bpy.data.collections.new('__cut_' + w_obj.name); sc.collection.children.link(cc)
    for ct in cutters:
        cc.objects.link(ct.copy() if ct.users_collection else ct)
    mod.operand_type = 'COLLECTION'; mod.collection = cc
    bpy.context.view_layer.objects.active = w_obj
    bpy.ops.object.select_all(action='DESELECT'); w_obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for ob in list(cc.objects): bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.collections.remove(cc)
for ct in cutters:
    if ct.name in bpy.data.objects: bpy.data.objects.remove(ct, do_unlink=True)

# ---------------------------------------------------------------- 바닥·천장·하부
for r in encl:
    x0, y0, x1, y1 = rect_b(r)
    box(f'바닥_{r["name"]}', x0, y0, F - 0.06, x1, y1, F, M['tile'] if r['type'] in WET_TYPES else M['floor'])
    box(f'천장_{r["name"]}', x0, y0, F + H, x1, y1, F + H + 0.02, M['ceil'])
if F > 0.08:
    SK = U.buffer(-0.04, join_style=2)
    extrude_poly('하부', SK, 0.0, F - 0.05, [M['skirt'], M['skirt']], M['skirt'], M['skirt'])

# 외벽 모서리 몰딩 (바깥 꼭짓점마다 세로 L바)
for pg in (U.geoms if isinstance(U, MultiPolygon) else [U]):
    for x, y in list(pg.exterior.coords)[:-1]:
        box('코너', x - 0.035, y - 0.035, F - 0.05, x + 0.035, y + 0.035, CEIL_TOP, M['corner'])
        box('코너_상부', x - 0.035, y - 0.035, CEIL_TOP, x + 0.035, y + 0.035, WALL_TOP, M['corner'])

# ---------------------------------------------------------------- 지붕
if ROOF_TYPE == 'flat':
    # 파라펫(외벽이 천장 위로 올라옴) + 윗단 후레싱 + 방수 지붕면
    cap = U.buffer(0.02, join_style=2).difference(INNER.buffer(-0.02, join_style=2))
    extrude_poly('지붕_후레싱', cap, WALL_TOP, WALL_TOP + 0.025, [M['flash'], M['flash']], M['flash'], M['flash'])
    extrude_poly('지붕면', INNER, F + H + 0.25, F + H + 0.28, [M['roof'], M['roof']], M['roof'], M['roof'])
    # 파라펫 바깥 띠 후레싱 (위쪽 12cm)
    band = U.buffer(0.012, join_style=2).difference(U)
    extrude_poly('지붕_띠', band, WALL_TOP - 0.12, WALL_TOP, [M['flash'], M['flash']], M['flash'], M['flash'])

def obox(name, o, au, av, aw, mat):
    """임의 방향 상자: 원점 o 에서 au, av, aw 세 변 벡터로 만든 평행육면체"""
    o, au, av, aw = Vector(o), Vector(au), Vector(av), Vector(aw)
    pts = [o, o + au, o + au + av, o + av, o + aw, o + au + aw, o + au + av + aw, o + av + aw]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    ob = mesh_obj(name, pts, f, [mat])
    bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(ob.data); bm.free()
    return ob

def gable_roof(minx, miny, maxx, maxy, ridge_y, rise=None):
    """박공지붕 — ridge_y=True 면 용마루가 블렌더 Y(도면 세로) 방향. 징크 판 + 스탠딩심 + 용마루캡 + 처마 테두리 + 처마밑 + 박공벽"""
    E, RG, T = 0.45, 0.35, 0.12                # 처마 내밀기, 박공쪽 내밀기, 지붕판 두께
    S = (maxx - minx) if ridge_y else (maxy - miny)       # 경사 방향 폭
    L0, L1 = (miny, maxy) if ridge_y else (minx, maxx)    # 용마루 방향 범위
    R = rise if rise else 0.26 * S
    tan = R / (S / 2); Zb = WALL_TOP
    c = ((minx + maxx) / 2) if ridge_y else ((miny + maxy) / 2)
    def P(across, along, z):   # across: 경사방향 좌표, along: 용마루방향 좌표 → 월드
        return (across, along, z) if ridge_y else (along, across, z)
    for sgn in (-1, 1):
        # 경사판: 용마루(c) → 처마(c ± (S/2+E))
        a0, a1 = c, c + sgn * (S / 2 + E)
        z0, z1 = Zb + R, Zb - E * tan
        o = P(a0, L0 - RG, z0); au = Vector(P(a1, L0 - RG, z1)) - Vector(o); av = Vector(P(a0, L1 + RG, z0)) - Vector(o)
        nrm = au.cross(av).normalized()
        if nrm.z < 0: nrm = -nrm
        obox('지붕_징크판', Vector(o), au, av, -nrm * T, M['roof'])
        # 스탠딩심 (0.45m 간격, 경사 따라)
        n = int((L1 - L0 + 2 * RG) / 0.45)
        for i in range(1, n):
            t = L0 - RG + i * (L1 - L0 + 2 * RG) / n
            so = Vector(P(a0, t - 0.012, z0)) ; sau = Vector(P(a1, t - 0.012, z1)) - so
            obox('지붕_스탠딩심', so, sau, Vector(P(0, 0.024, 0)) if ridge_y else Vector((0.024, 0, 0)), nrm * 0.03, M['roof'])
        # 처마 테두리(물끊기) — 처마 끝선
        eo = Vector(P(a1, L0 - RG, z1)) - nrm * T
        obox('지붕_처마테두리', eo, Vector(P(0, L1 - L0 + 2 * RG, 0)) if ridge_y else Vector((L1 - L0 + 2 * RG, 0, 0)), nrm * (T + 0.02), Vector(P(sgn * 0.03, 0, 0)), M['flash'])
        # 박공쪽 테두리 (양 끝)
        for along in (L0 - RG, L1 + RG - 0.03):
            bo = Vector(P(a0, along, z0)) - nrm * T
            obox('지붕_박공테두리', bo, Vector(P(a1, along, z1)) - Vector(P(a0, along, z0)), Vector(P(0, 0.03, 0)) if ridge_y else Vector((0.03, 0, 0)), nrm * (T + 0.02), M['flash'])
        # 처마밑 (벽 밖으로 나온 부분 아래면)
        wa = c + sgn * S / 2
        zs = z1 - T - 0.004                     # 처마 끝 아랫면 높이 — 벽에서 처마 끝까지 수평 처마밑
        so = Vector(P(wa, L0 - RG, zs)); sau = Vector(P(a1, L0 - RG, zs)) - so
        obox('지붕_처마밑', so, sau, Vector(P(0, L1 - L0 + 2 * RG, 0)) if ridge_y else Vector((L1 - L0 + 2 * RG, 0, 0)), Vector((0, 0, -0.012)), M['soffit'])
    # 용마루 캡
    rc = Vector(P(c - 0.13, L0 - RG - 0.01, Zb + R - 0.02))
    obox('지붕_용마루', rc, Vector(P(0.26, 0, 0)) if ridge_y else Vector((0, 0.26, 0)), Vector(P(0, L1 - L0 + 2 * RG + 0.02, 0)) if ridge_y else Vector((L1 - L0 + 2 * RG + 0.02, 0, 0)), Vector((0, 0, 0.07)), M['flash'])
    # 박공 삼각벽 (벽 바깥면과 같은 면, 두께 TE 안쪽으로)
    for along, inward in ((L0, 1), (L1, -1)):
        tri = [(c - S / 2, Zb), (c + S / 2, Zb), (c, Zb + R - T * 0.9)]
        verts = []
        for a_, z_ in tri: verts.append(P(a_, along, z_))
        for a_, z_ in tri: verts.append(P(a_, along + inward * TE, z_))
        faces = [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
        ob = mesh_obj('박공벽', verts, faces, [M['ext_x'] if ridge_y else M['ext_y'], M['ceil']])
        bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(ob.data); bm.free()
    return Zb, R, tan

def porch_roof(r, house_bounds):
    """포치 처마지붕(외쪽) — 본채 벽에 붙여 바깥으로 완만히 내려감 + 바깥 모서리 기둥"""
    x0, y0, x1, y1 = rect_b(r)
    hx0, hy0, hx1, hy1 = house_bounds
    zt = WALL_TOP - 0.05; drop = 0.18; T = 0.10; O = 0.25
    # 본채와 맞닿은 변 찾기 → 반대쪽으로 경사
    if abs(y1 - hy0) < 0.01: hi, lo = (x0 - O, y1, x1 + O, y1), (x0 - O, y0 - O, x1 + O, y0 - O)   # 포치가 본채 남쪽
    elif abs(y0 - hy1) < 0.01: hi, lo = (x0 - O, y0, x1 + O, y0), (x0 - O, y1 + O, x1 + O, y1 + O)
    elif abs(x0 - hx1) < 0.01: hi, lo = (x0, y0 - O, x0, y1 + O), (x1 + O, y0 - O, x1 + O, y1 + O)
    else: hi, lo = (x1, y0 - O, x1, y1 + O), (x0 - O, y0 - O, x0 - O, y1 + O)
    o = Vector((hi[0], hi[1], zt)); au = Vector((hi[2], hi[3], zt)) - o; av = Vector((lo[0], lo[1], zt - drop)) - o
    nrm = au.cross(av).normalized()
    if nrm.z < 0: nrm = -nrm
    obox('지붕_포치지붕', o, au, av, -nrm * T, M['roof'])
    obox('지붕_포치테두리', Vector((lo[0], lo[1], zt - drop)) - nrm * T, Vector((lo[2] - lo[0], lo[3] - lo[1], 0)), nrm * (T + 0.02), (Vector((lo[0], lo[1], 0)) - Vector((hi[0], hi[1], 0))).normalized() * 0.03, M['flash'])
    # 포치 천장(처마밑) + 기둥 (바깥 변 모서리 + 3m 간격)
    box('지붕_포치천장', x0, y0, zt - drop - T - 0.01, x1, y1, zt - drop - T, M['soffit'])
    ox0, oy0, ox1, oy1 = lo[0], lo[1], lo[2], lo[3]
    L = math.hypot(ox1 - ox0, oy1 - oy0); n = max(1, math.ceil(L / 3.0))
    for i in range(n + 1):
        t = i / n
        px = ox0 + (ox1 - ox0) * t; py = oy0 + (oy1 - oy0) * t
        px = min(max(px, x0 + 0.06), x1 - 0.06); py = min(max(py, y0 + 0.06), y1 - 0.06)
        box('포치기둥', px - 0.05, py - 0.05, F - 0.04, px + 0.05, py + 0.05, zt - drop - T, M['post'])

if ROOF_TYPE in ('gable', 'asymGable'):
    ridge_y = (ROOF.get('ridge') or 'z') != 'x'
    rise = (ROOF.get('rise') or 0) / 1000 or None
    span = D.get('gen', {}).get('roofSpan')        # 'all' = 데크·포치까지 한 지붕으로
    if span == 'all':
        allb = unary_union([sbox(*rect_b(r)) for r in rooms]).bounds
        gable_roof(*allb, ridge_y, rise)
        # 지붕 아래 데크 쪽 박공벽은 비어 있으므로 기둥으로 받침
        for r in outs:
            x0, y0, x1, y1 = rect_b(r)
            for px, py in ((x0 + 0.06, y0 + 0.06), (x1 - 0.06, y0 + 0.06), (x0 + 0.06, y1 - 0.06), (x1 - 0.06, y1 - 0.06)):
                box('포치기둥', px - 0.05, py - 0.05, F - 0.04, px + 0.05, py + 0.05, WALL_TOP, M['post'])
    else:
        for pg in (U.geoms if isinstance(U, MultiPolygon) else [U]):
            gable_roof(*pg.bounds, ridge_y, rise)
        for r in outs:
            if r['type'] == 'porch': porch_roof(r, U.bounds)

# ---------------------------------------------------------------- 데크·포치 (판재 + 철골 + 난간)
def deck(r):
    x0, y0, x1, y1 = rect_b(r)
    low = F < 0.15
    top = 0.04 if low else F - 0.012           # 낮은 집은 침목 위 데크(지면 +4cm)
    along_x = (r.get('deckDir') or ('x' if (x1 - x0) >= (y1 - y0) else 'y')) == 'x'
    bw, gap, th = 0.14, 0.006, 0.025
    if along_x:
        y = y0 + 0.005; i = 0
        while y + bw <= y1 + 1e-6:
            box(f'데크판{i}', x0 + 0.005, y, top - th, x1 - 0.005, y + bw, top, M['deck']); y += bw + gap; i += 1
    else:
        x = x0 + 0.005; i = 0
        while x + bw <= x1 + 1e-6:
            box(f'데크판{i}', x, y0 + 0.005, top - th, x + bw, y1 - 0.005, top, M['deck']); x += bw + gap; i += 1
    # 철골 테두리 + 기둥 (지면 위 데크는 생략)
    bz0, bz1 = top - th - 0.15, top - th
    if low:
        box('데크침목', x0, y0, 0.0, x1, y1, top - th, M['steel'])
    if not low:
        box('데크테', x0, y0, bz0, x1, y0 + 0.05, bz1, M['steel']); box('데크테', x0, y1 - 0.05, bz0, x1, y1, bz1, M['steel'])
        box('데크테', x0, y0, bz0, x0 + 0.05, y1, bz1, M['steel']); box('데크테', x1 - 0.05, y0, bz0, x1, y1, bz1, M['steel'])
        nx = max(1, round((x1 - x0) / 1.8)); ny = max(1, round((y1 - y0) / 1.8))
        for i in range(nx + 1):
            for j in range(ny + 1):
                if 0 < i < nx and 0 < j < ny: continue
                px = x0 + (x1 - x0) * i / nx; py = y0 + (y1 - y0) * j / ny
                px = min(max(px, x0 + 0.05), x1 - 0.05); py = min(max(py, y0 + 0.05), y1 - 0.05)
                box('데크기둥', px - 0.04, py - 0.04, 0, px + 0.04, py + 0.04, bz0, M['steel'])
    # 난간
    for s in r.get('rail') or []:
        if s == 'n': a, b = (x0, y1), (x1, y1)
        elif s == 's': a, b = (x0, y0), (x1, y0)
        elif s == 'w': a, b = (x0, y0), (x0, y1)
        else: a, b = (x1, y0), (x1, y1)
        L = math.hypot(b[0] - a[0], b[1] - a[1]); d = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
        inset = (-d[1] * 0.03, d[0] * 0.03) if s in 'sw' else (d[1] * 0.03, -d[0] * 0.03)
        if s == 's': inset = (0, 0.03)
        if s == 'n': inset = (0, -0.03)
        if s == 'w': inset = (0.03, 0)
        if s == 'e': inset = (-0.03, 0)
        P = lambda t: (a[0] + d[0] * t + inset[0], a[1] + d[1] * t + inset[1])
        def bar(t0, t1, z0, z1, wd, nm):
            (ax, ay), (bx, by) = P(t0), P(t1)
            if abs(d[0]) > 0.5: box(nm, ax, ay - wd / 2, z0, bx, by + wd / 2, z1, M['steel'])
            else: box(nm, ax - wd / 2, ay, z0, bx + wd / 2, by, z1, M['steel'])
        np_ = max(1, math.ceil(L / 1.6))
        for i in range(np_ + 1):
            t = min(max(L * i / np_, 0.025), L - 0.025)
            bar(t - 0.025, t + 0.025, top, top + 1.0, 0.05, '난간기둥')
        bar(0, L, top + 0.96, top + 1.0, 0.05, '난간상부'); bar(0, L, top + 0.08, top + 0.11, 0.04, '난간하부')
        cnt = int(L / 0.11)
        for i in range(1, cnt):
            t = i * L / cnt
            bar(t - 0.01, t + 0.01, top + 0.11, top + 0.96, 0.02, '난간살')
for r in outs: deck(r)

# ---------------------------------------------------------------- 저장 + 미리보기
for o in col.objects:
    if o.type == 'MESH':
        for p in o.data.polygons: p.use_smooth = False
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(A.out))
tris = 0
for o in col.objects:
    if o.type == 'MESH':
        o.data.calc_loop_triangles(); tris += len(o.data.loop_triangles)
print(f"saved {A.out}: objects={len(col.objects)} tris={tris} bounds={U.bounds} F={F} H={H} roof={ROOF_TYPE}")

if A.preview:
    # 확인용 렌더 (GPU 없이 Cycles CPU · 저샘플 + 노이즈 제거)
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24
    try: sc.cycles.use_denoising = True
    except Exception: pass
    sc.render.resolution_x, sc.render.resolution_y = 1200, 760
    sc.view_settings.view_transform = 'AgX'
    wd = bpy.data.worlds.new('sky'); sc.world = wd; wd.use_nodes = True
    bg = wd.node_tree.nodes.get('Background'); bg.inputs['Color'].default_value = (0.55, 0.68, 0.85, 1); bg.inputs['Strength'].default_value = 0.9
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); col.objects.link(sun)
    sun.data.energy = 4.0; sun.rotation_euler = (math.radians(50), 0, math.radians(-35))
    g = bpy.data.meshes.new('ground'); bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40); bm.to_mesh(g); bm.free()
    go = bpy.data.objects.new('ground', g); col.objects.link(go); g.materials.append(plain('잔디', '#6f8a52', 0.95))
    minx, miny, maxx, maxy = U.union(unary_union([sbox(*rect_b(r)) for r in outs]) if outs else U).bounds
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2; R = max(maxx - minx, maxy - miny)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); col.objects.link(cam); sc.camera = cam
    cam.location = (cx - R * 0.9, cy - R * 1.25, R * 0.85)
    dirv = Vector((cx, cy, 1.2)) - cam.location
    cam.rotation_euler = dirv.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 32
    sc.render.filepath = os.path.abspath(A.preview)
    bpy.ops.render.render(write_still=True)
    print('preview', A.preview)
