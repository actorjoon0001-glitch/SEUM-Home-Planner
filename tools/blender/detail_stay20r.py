# STAY20-R 디테일 모델 — 도면 자동 모델(plan_to_blend.py 결과)에 카탈로그 실사 사진대로 외부·내부 디테일
#
#   실행:  python tools/blender/detail_stay20r.py -- 기본.blend 도면.json 출력.blend [--preview 폴더] [--shots ext,liv]
#   사진: 정면 레드 브릭 · 측·배면 백색 가로 메탈(하단 블랙) · 다크브라운 트림 · 가운데 거실 구간만 높은 박공(고창 3 + 월넛 슬랫)
#         + 양 날개 외쪽지붕 · 앞쪽 전체 데크(브라운 판재·블랙 난간·베이지 스커트) · 거실·식당 편백 경사천장·우드 실링팬
#         · 대리석 백스플래시 반도형 주방 · 우드 몰딩 · 침실 간접조명 · 현관 가로 슬랫벽
import sys, os, json, math, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from detail_kit import *
from shapely.geometry import box as sbox, Polygon, MultiPolygon, Point
from shapely.ops import unary_union

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('base'); ap.add_argument('plan'); ap.add_argument('out')
ap.add_argument('--lib', default=os.path.join(os.path.dirname(__file__), '..', '..', 'models', 'src', 'seum-hwangto.blend'))
ap.add_argument('--preview', default='')
ap.add_argument('--shots', default='ext,ext2,liv,kit,bed')
ap.add_argument('--samples', type=int, default=40)
A = ap.parse_args(argv)

col = kit_init(A.base, A.lib)
D = json.load(open(A.plan, encoding='utf-8'))
F, H = 0.45, 2.40
FL, CE = F, F + H
CT = F + H + 0.02                 # 기본 외벽 윗단(천장 위 0.02)
TE, TI = 0.15, 0.10
W = 11.6
CX0, CX1 = 4.19, 8.34             # 가운데 높은 박공 구간(거실·식당·주방)
CXM = (CX0 + CX1) / 2
LOW = F + 2.70                    # 날개 외쪽지붕 처마쪽(바깥벽) 지붕 밑면
WING_HI = F + 3.60                # 날개 지붕이 가운데 벽에 닿는 높이
EAVE_C = F + 4.00                 # 가운데 박공 벽 윗단
SC = 0.36                         # 가운데 박공 경사
SW, SE = (WING_HI - LOW) / CX0, (WING_HI - LOW) / (W - CX1)
SPRING, APEX = F + 3.75, F + 3.75 + (CXM - CX0 - 0.05) * SC   # 실내 경사천장
RT, OV = 0.15, 0.45               # 지붕 두께 · 처마 내밀기

def zr(x, region):
    """지붕 밑면 높이 — region: 'W' 서쪽 날개, 'C' 가운데, 'E' 동쪽 날개"""
    if region == 'W': return LOW + x * SW
    if region == 'E': return LOW + (W - x) * SE
    return EAVE_C + min(x - CX0, CX1 - x) * SC
def region_of(x): return 'W' if x < CX0 - 1e-6 else ('E' if x > CX1 + 1e-6 else 'C')

rooms = D['rooms']
def rect_b(r): return (r['x'] / 1000, -(r['y'] + r['d']) / 1000, (r['x'] + r['w']) / 1000, -r['y'] / 1000)
encl = [r for r in rooms if r['type'] not in ('deck', 'porch', 'balcony')]
U = unary_union([sbox(*rect_b(r)) for r in encl]).buffer(0.0005, join_style=2).buffer(-0.0005, join_style=2)
inside = lambda p: U.contains(Point(p.x, p.y))
room_by_name = {r['name']: r for r in rooms}
def room_at(x, y):   # 블렌더 좌표 → 방
    for r in encl:
        x0, y0, x1, y1 = rect_b(r)
        if x0 < x < x1 and y0 < y < y1: return r
    return None

# ---------------------------------------------------------------- 재질
recolor('창틀', '#2a2422', 0.4, 0.2); recolor('창몰딩', '#3b2f28'); recolor('문틀', '#2a2422')
recolor('실내벽', '#dcd9de', 0.85); recolor('천장', '#f4f3f1', 0.9)
recolor('하부_스커트', '#cbb98f', 0.7, 0.0)
fm = bpy.data.materials.get('바닥_마루')
if fm:
    for n in fm.node_tree.nodes:
        if n.bl_idname == 'ShaderNodeRGB': n.outputs[0].default_value = hexrgb('#cdc5b8')
M = {
    'brick': bricks('외장_벽돌', '#a0523f', '#b5654c', '#cdc4b9', accent=('#86736b', 0.08)),
    'side': ribbed('외장_가로메탈', '#eceae5', pitch=0.20, horizontal=True, band=(F + 1.0, '#2e3033')),
    'trim': plain('외장_트림', '#3b2f28', 0.5, 0.2),
    'roof': plain('지붕재', '#4a4039', 0.6, 0.2),
    'flash': plain('후레싱', '#3e352f', 0.5, 0.2),
    'walnut': wood('월넛_슬랫', '#5a3f2e', scale=10.0),
    'walnut_bg': plain('슬랫_배경', '#2c211b', 0.8),
    'deck': lib('합성데크', '데크', '#7a4e36'),
    'deck_skirt': ribbed('데크_스커트', '#cbb98f', pitch=0.2, rough=0.7, metal=0.0),
    'rail': plain('난간_블랙', '#1f1e1e', 0.45, 0.4),
    'lamp': plain('벽등_블랙', '#1e1e1f', 0.45, 0.4),
    'glow': plain('조명_발광', '#fff1dc', 0.5, 0.0, emit='#ffe2b8', strength=6.0),
    'cove_glow': plain('간접등_발광', '#ffd9a0', 0.5, 0.0, emit='#ffc27a', strength=10.0),
    'pvc_in': lib('PVC창틀_백색', '창틀_실내', '#f2f2ef'),
    'door_ext': plain('현관문', '#d6d6d3', 0.4, 0.2),
    'door_in': plain('현관문_실내', '#2b2b2d', 0.45, 0.2),
    'lock': lib('도어락_본체_유광블랙', '도어락', '#151515'),
    'idoor': plain('실내문', '#ecebe7', 0.5),
    'iframe': wood('우드몰딩', '#a3846a', scale=12.0),
    'chrome': plain('크롬', '#d6d8da', 0.15, 1.0),
    'pine': lib('편백루바_천장', '편백천장', '#d9b98a'),
    'bath_tile': tiles('욕실_타일벽', '#cfc8bd', '#bdb6ab'),
    'bath_floor': tiles('욕실_바닥', '#8e8b87', '#6f6c68', 0.3, 0.3, floor=True, rough=0.5),
    'ent_floor': tiles('현관_바닥', '#4d5155', '#3a3d40', 0.6, 0.6, floor=True, rough=0.5),
    'marble': tiles('대리석', '#f1f0ee', '#e6e4e0', 1.2, 0.6, vein='#9d9a96', rough=0.2),
    'white': plain('가구_화이트', '#f3f2ee', 0.45),
    'cabinet': plain('주방_하부장', '#e4e0da', 0.5),
    'quartz': plain('주방_상판', '#ecebe8', 0.25),
    'steel': plain('스텐', '#c3c6c9', 0.3, 0.9),
    'glass_black': plain('인덕션_유리', '#121314', 0.08),
    'fabric': plain('소파_패브릭', '#cfcac4', 0.95),
    'sheet': plain('침구_화이트', '#f4f3f0', 0.95),
    'navy': plain('침구_네이비', '#2c3b5e', 0.95),
    'pillow_w': plain('베개_화이트', '#f6f5f2', 0.95),
    'gray_cover': plain('침구_그레이', '#b9b8b6', 0.95),
    'rug': plain('러그', '#e3e0d9', 1.0),
    'stool': plain('스툴_시트', '#f2f1ee', 0.4),
    'porcelain': plain('도기', '#f6f6f4', 0.12),
    'glass': bpy.data.materials.get('유리'),
    'mirror': plain('거울', '#d8dde0', 0.02, 1.0),
    'gold': plain('골드', '#c9a35e', 0.3, 0.9),
    'fan_wood': wood('실링팬_우드', '#c9a273', scale=8.0),
    'fan_body': plain('실링팬', '#f2f2f0', 0.4),
    'ent_slat': wood('현관_슬랫', '#7d6b5d', scale=10.0, direction='X'),
}

# ---------------------------------------------------------------- 1) 기본 지붕·상부벽·코너 걷어내고 다시 만듦
remove(lambda o: o.name.startswith(('지붕_', '박공벽', '외벽_상부', '코너')))
remove(lambda o: o.name in ('천장_거실(식당)', '천장_거실'))

def ext_face_mat(o, p):
    """바깥면 재질: 남쪽(정면)·거실 돌출부 옆면 = 벽돌, 나머지 = 백색 가로 메탈(하단 블랙)"""
    n, c = p.normal, p.center
    if n.y < -0.5: return M['brick']
    if abs(n.x) > 0.5 and c.y < -6.3 and CX0 - 0.2 < c.x < CX1 + 0.2: return M['brick']
    return M['side']

def assign_ext(o, ext_names):
    ib, is_, iw = mat_index(o, M['brick']), mat_index(o, M['side']), mat_index(o, bpy.data.materials['실내벽'])
    for p in o.data.polygons:
        if o.data.materials[p.material_index].name not in ext_names: continue
        if abs(p.normal.z) > 0.7: p.material_index = iw; continue      # 벽 윗면(지붕 끄면 보이는 단면)
        p.material_index = ib if ext_face_mat(o, p) == M['brick'] else is_
assign_ext(bpy.data.objects['외벽'], {'외장_사이딩_X', '외장_사이딩_Y'})

# 바깥 외곽 각 변 위로 지붕 밑면까지 상부벽 (사다리꼴·박공)
UPPER = {}
ring = list(U.exterior.coords)[:-1]
for i in range(len(ring)):
    (xa, ya), (xb, yb) = ring[i], ring[(i + 1) % len(ring)]
    if abs(ya - yb) < 1e-6:          # 가로 변 (남·북)
        x0, x1 = sorted((xa, xb)); y = ya
        mid = Point((x0 + x1) / 2, y + 0.05)
        inward = 1 if U.contains(mid) else -1
        eps = 1e-4
        top = [(x0, zr(x0, region_of(x0 + eps)))]
        for bx in (CX0, CXM, CX1):
            if x0 + eps < bx < x1 - eps:
                if bx in (CX0, CX1):
                    l, r_ = region_of(bx - eps), region_of(bx + eps)
                    top.append((bx, zr(bx, l))); top.append((bx, zr(bx, r_)))
                else:
                    top.append((bx, zr(bx, 'C')))
        top.append((x1, zr(x1, region_of(x1 - eps))))
        pts = [(x0, CT), (x1, CT)] + list(reversed(top))
        o = prism_xz('상부벽', pts, y, y + inward * TE, M['side'])
        UPPER[(round(x0, 2), round(x1, 2), round(y, 2))] = o
    else:                            # 세로 변 (동·서)
        y0, y1 = sorted((ya, yb)); x = xa
        reg = 'C' if abs(x - CX0) < 0.01 or abs(x - CX1) < 0.01 else region_of(x)
        z = zr(x, reg) if reg != 'C' else EAVE_C
        inward = 1 if U.contains(Point(x + 0.05, (y0 + y1) / 2)) else -1
        o = box('상부벽', x, y0, CT, x + inward * TE, y1, z, M['side'])
    o['roof'] = 1
    for p in o.data.polygons:
        if abs(p.normal.z) >= 0.7: continue
        q = p.center + p.normal * 0.1
        p.material_index = mat_index(o, bpy.data.materials['실내벽'] if inside(q) else ext_face_mat(o, p))
# 가운데 구간 옆벽(날개 지붕 위로 올라온 부분 포함) — 실내 쪽은 실내벽
WALLIN = bpy.data.materials['실내벽']
for x, ya, yb in ((CX0, 0.0, -6.3), (CX1, -1.08, -6.3)):
    o = box('상부벽_가운데', x - TI / 2, ya, CE, x + TI / 2, yb, EAVE_C, M['side']); o['roof'] = 1
    ii = mat_index(o, WALLIN)
    for p in o.data.polygons:
        if abs(p.normal.x) > 0.5 and ((x == CX0 and p.normal.x > 0) or (x == CX1 and p.normal.x < 0)): p.material_index = ii
# 주방 알코브 위 벽(식당 쪽 경사천장 끝을 막음)
o = prism_xz('상부벽_주방위', [(CX0, CE), (CX1, CE), (CX1, SPRING), (CXM, APEX + 0.05), (CX0, SPRING)], -1.74 + TI / 2, -1.74 - TI / 2, WALLIN); o['roof'] = 1
# 복도 위(식당과 트인 곳) 벽: 위 '상부벽_가운데'가 CE 부터 막음

# 코너 트림 (다크브라운) — 외곽 꼭짓점마다
for x, y in ring:
    reg = 'C' if abs(x - CX0) < 0.01 or abs(x - CX1) < 0.01 else region_of(x)
    z = EAVE_C if reg == 'C' else zr(x, reg)
    box('외장_트림', x - 0.045, y - 0.045, F - 0.05, x + 0.045, y + 0.045, CT, M['trim'])
    o = box('외장_트림', x - 0.045, y - 0.045, CT, x + 0.045, y + 0.045, z, M['trim']); o['roof'] = 1   # 천장 위는 지붕과 함께 숨김

# ---------------------------------------------------------------- 2) 지붕 — 날개 외쪽 2 + 가운데 박공
def roof_plane(name, xa, za, xb, zb, y0, y1):
    """x 방향 경사판: (xa,za)→(xb,zb) 밑면, y0~y1, 두께 RT 위로"""
    u = Vector((xb - xa, 0, zb - za)); v = Vector((0, y1 - y0, 0))
    nrm = Vector((-(zb - za), 0, xb - xa)).normalized()
    if nrm.z < 0: nrm = -nrm
    o = slab(name, (xa, y0, za), u, v, nrm * RT, M['roof']); o['roof'] = 1
    return o, nrm
def fascia(name, x, z_under, y0, y1, h=0.22):
    o = box(name, x - 0.03, y0, z_under - 0.05, x + 0.03, y1, z_under - 0.05 + h, M['flash']); o['roof'] = 1
def rake(name, xa, za, xb, zb, y, h=0.22):
    o = slab(name, (xa, y - 0.015, za - 0.05), Vector((xb - xa, 0, zb - za)), Vector((0, 0.03, 0)), Vector((0, 0, h)), M['flash']); o['roof'] = 1

wl = LOW - OV * SW
roof_plane('지붕_서쪽날개', -OV, wl, CX0, WING_HI, OV, -6.3 - OV)
fascia('지붕_후레싱', -OV, wl, OV, -6.3 - OV)
for y in (OV, -6.3 - OV): rake('지붕_후레싱', -OV, wl, CX0, WING_HI, y)
el = LOW - OV * SE
roof_plane('지붕_동쪽날개', CX1, WING_HI, W + OV, el, -1.08 + OV, -6.3 - OV)
fascia('지붕_후레싱', W + OV, el, -1.08 + OV, -6.3 - OV)
for y in (-1.08 + OV, -6.3 - OV): rake('지붕_후레싱', CX1, WING_HI, W + OV, el, y)
OC = 0.35
ze = EAVE_C - OC * SC; zt = EAVE_C + (CXM - CX0) * SC
roof_plane('지붕_가운데', CX0 - OC, ze, CXM, zt, OV, -7.0 - OV)
roof_plane('지붕_가운데', CX1 + OC, ze, CXM, zt, OV, -7.0 - OV)
for x in (CX0 - OC, CX1 + OC): fascia('지붕_후레싱', x, ze, OV, -7.0 - OV)
for y in (OV, -7.0 - OV):
    rake('지붕_후레싱', CX0 - OC, ze, CXM, zt, y); rake('지붕_후레싱', CX1 + OC, ze, CXM, zt, y)
o = box('지붕_용마루', CXM - 0.12, OV + 0.02, zt + RT - 0.02, CXM + 0.12, -7.0 - OV - 0.02, zt + RT + 0.06, M['flash']); o['roof'] = 1

# ---------------------------------------------------------------- 3) 정면 고창 3개 + 사이 월넛 슬랫 / 현관 캐노피·슬랫 / 벽등
front = UPPER.get((CX0, CX1, -7.0))
CW_, CH_, CZ = 0.62, 1.10, F + 2.78
if front:
    for k, dx in enumerate((-1.0, 0.0, 1.0)):
        add_window(f'고창{k}', Vector((CXM + dx, -7.0, 0)), Vector((1, 0, 0)), Vector((0, -1, 0)), CW_, CH_, CZ, front,
                   bpy.data.materials['창틀'], M['pvc_in'], bpy.data.materials['유리'], trim=M['trim'])
    for dx in (-0.5, 0.5):
        slat_wall('고창_슬랫', 'x', -7.0, CXM + dx - 0.18, CXM + dx + 0.18, CZ, CZ + CH_, -1, M['walnut'], M['walnut_bg'], w=0.035, gap=0.02, depth=0.02)
# 고창 실내 몰딩
for dx in (-1.0, 0.0, 1.0):
    casing_parts('실내몰딩_고창', Vector((CXM + dx, -7.0, 0)), Vector((1, 0, 0)), Vector((0, -1, 0)), CW_, CZ, CZ + CH_, -TE, -1, M['iframe'], False, F)
# 현관: 문 왼쪽 월넛 세로 슬랫 + 캐노피
slat_wall('현관_외부슬랫', 'x', -6.3, 2.72, 3.02, F, F + 2.35, -1, M['walnut'], M['walnut_bg'], w=0.03, gap=0.015)
box('현관_캐노피', 2.66, -6.3, F + 2.42, 4.12, -6.85, F + 2.48, M['trim'])
box('현관_캐노피', 2.66, -6.82, F + 2.36, 4.12, -6.85, F + 2.48, M['trim'])
for i, (x, y, nrm) in enumerate(((0.55, -6.3, -1), (4.0, -6.3, -1), (8.55, -6.3, -1), (11.1, -6.3, -1))):
    box('외부벽등', x - 0.04, y, F + 2.20, x + 0.04, y - 0.07, F + 2.32, M['lamp'], bevel=0.005)
    box('외부벽등_발광', x - 0.03, y - 0.01, F + 2.195, x + 0.03, y - 0.06, F + 2.20, M['glow'])

# ---------------------------------------------------------------- 4) 데크 (앞쪽 전체) + 스커트 + 블랙 난간 + 계단
DT = F - 0.02
DY0, DY1 = -8.2, -6.3
y = DY0 + 0.005; rows = []
while y + 0.14 <= DY1 + 1e-6:
    if y + 0.14 > -7.0:     # 거실 돌출부 옆은 두 조각
        rows += [(0.005, y, DT - 0.025, CX0 - 0.005, y + 0.14, DT), (CX1 + 0.005, y, DT - 0.025, W - 0.005, y + 0.14, DT)]
    else:
        rows.append((0.005, y, DT - 0.025, W - 0.005, y + 0.14, DT))
    y += 0.146
multi_box('데크판', rows, M['deck'])
box('데크_스커트', 0, DY0, 0, W, DY0 + 0.025, DT - 0.025, M['deck_skirt'])
box('데크_스커트', 0, DY0, 0, 0.025, DY1, DT - 0.025, M['deck_skirt'])
box('데크_스커트', W - 0.025, DY0, 0, W, DY1, DT - 0.025, M['deck_skirt'])
box('데크_계단', 1.0, DY0 - 0.38, 0, 2.6, DY0, 0.20, M['deck_skirt'])
box('데크_계단판', 0.99, DY0 - 0.39, 0.20, 2.61, DY0, 0.225, M['deck'])
def railing(ax, ay, bx, by):
    L = math.hypot(bx - ax, by - ay); d = ((bx - ax) / L, (by - ay) / L)
    P = lambda t: (ax + d[0] * t, ay + d[1] * t)
    def bar(t0, t1, z0, z1, wd):
        (x0_, y0_), (x1_, y1_) = P(t0), P(t1)
        if abs(d[0]) > 0.5: return (x0_, y0_ - wd / 2, z0, x1_, y1_ + wd / 2, z1)
        return (x0_ - wd / 2, y0_, z0, x1_ + wd / 2, y1_, z1)
    rs = []
    n = max(1, math.ceil(L / 1.8))
    for i in range(n + 1):
        t = min(max(L * i / n, 0.03), L - 0.03); rs.append(bar(t - 0.03, t + 0.03, DT, DT + 1.0, 0.06))
    rs.append(bar(0, L, DT + 0.96, DT + 1.0, 0.045)); rs.append(bar(0, L, DT + 0.09, DT + 0.12, 0.03))
    k = int(L / 0.12)
    for i in range(1, k): rs.append(bar(i * L / k - 0.009, i * L / k + 0.009, DT + 0.12, DT + 0.96, 0.018))
    multi_box('난간', rs, M['rail'])
railing(0.03, DY0 + 0.03, 1.0, DY0 + 0.03); railing(2.6, DY0 + 0.03, W - 0.03, DY0 + 0.03)
railing(0.03, DY0 + 0.03, 0.03, DY1); railing(W - 0.03, DY0 + 0.03, W - 0.03, DY1)

# ---------------------------------------------------------------- 5) 창호 투톤·실내 우드 몰딩·문
finish_openings(D, F, inside, {'pvc_in': M['pvc_in'], 'door_ext': M['door_ext'], 'door_in': M['door_in'], 'idoor': M['idoor'],
                               'iframe': M['iframe'], 'casing': M['iframe'], 'chrome': M['chrome'], 'lock': M['lock']})

# ---------------------------------------------------------------- 6) 실내 마감 — 욕실 타일벽, 바닥, 거실 경사천장(편백)
BATHS = [r for r in encl if r['type'] == 'bath']
def in_room(r, x, y):
    x0, y0, x1, y1 = rect_b(r); return x0 < x < x1 and y0 < y < y1
for wn in ('외벽', '칸막이'):
    o = bpy.data.objects.get(wn)
    if not o: continue
    it = mat_index(o, M['bath_tile'])
    for p in o.data.polygons:
        if o.data.materials[p.material_index].name != '실내벽' or abs(p.normal.z) > 0.7: continue
        q = p.center + p.normal * 0.06
        if any(in_room(r, q.x, q.y) for r in BATHS): p.material_index = it
for o in list(col.objects):
    if o.name.startswith('바닥_'):
        if '현관' in o.name: o.data.materials[0] = M['ent_floor']
        elif '욕실' in o.name: o.data.materials[0] = M['bath_floor']
# 경사천장 (식당·거실 구간) + 다운라이트
VY0, VY1 = -1.74 - TI / 2, -7.0 + TE
for xa, xb in ((CX0 + TI / 2, CXM), (CX1 - TI / 2, CXM)):
    za, zb = SPRING, APEX
    o = slab('경사천장', (xa, VY0, za), Vector((xb - xa, 0, zb - za)), Vector((0, VY1 - VY0, 0)), Vector((0, 0, 0.02)), M['pine']); o['roof'] = 1
li = 0
for xa, sgn in ((CX0 + TI / 2, 1), (CX1 - TI / 2, -1)):
    for y in (-2.7, -4.3, -5.9):
        x = xa + sgn * 0.9; z = SPRING + 0.9 * SC - 0.01
        ang = math.atan(SC) * sgn
        for nm, r, m in (('다운라이트_테두리', 0.075, M['white']), ('다운라이트_발광', 0.06, M['glow'])):
            c_ = cyl(nm, 0, 0, -0.006, 0.0, r, m, n=32)
            c_.data.transform(Matrix.Translation(Vector((x, y, z))) @ Matrix.Rotation(ang, 4, 'Y')); c_['roof'] = 1
        li += 1; L_ = light(f'LT_DL{li}', 'SPOT', (x, y, z - 0.02), 120, (1.0, 0.86, 0.72))
# 실링팬 (경사천장 꼭대기에서)
fan(CXM, -4.6, APEX, F + 3.15, M['fan_body'], M['fan_wood'], n=3, r=0.7)
# 평천장 다운라이트
DLS = [(1.32, -1.1), (1.32, -2.3), (1.32, -4.2), (1.32, -5.4), (9.97, -4.2), (9.97, -5.4), (10.8, -4.8),
       (3.41, -2.6), (3.41, -3.9), (3.41, -5.4), (5.8, -0.9), (7.4, -0.9), (3.8, -0.85), (9.06, -2.2), (10.7, -1.75), (10.7, -2.88)]
for x, y in DLS:
    li += 1; downlight(li, x, y, CE, M['white'], M['glow'], energy=100 if li < 20 else 70)
# 침실 간접조명 (창 있는 바깥벽 위)
cove('간접몰딩_침실1', 0.15, -0.15, 2.59, -0.29, CE, 'LT_COVE1', M['white'], M['cove_glow'])
cove('간접몰딩_침실2', 0.15, -6.15, 2.59, -6.01, CE, 'LT_COVE2', M['white'], M['cove_glow'])
cove('간접몰딩_안방', 8.39, -6.15, W - 0.15, -6.01, CE, 'LT_COVE3', M['white'], M['cove_glow'])

# ---------------------------------------------------------------- 7) 주방 (알코브) — 키큰장·하부장·대리석·상부장·반도 바
NY = -TE; KX0, KX1 = 5.75, CX1 - TE
box('키큰장', 5.03, NY - 0.62, FL, 5.70, NY, CE, M['white'])
box('키큰장_가전칸', 5.08, NY - 0.63, FL + 0.95, 5.65, NY - 0.30, FL + 1.45, plain('가전칸', '#6d6f72', 0.5))
box('주방_걸레받이', KX0, NY - 0.56, FL, KX1, NY, FL + 0.1, M['cabinet'])
box('주방_몸통', KX0, NY - 0.60, FL + 0.1, KX1, NY, FL + 0.86, M['cabinet'])
nd = round((KX1 - KX0) / 0.5); dw = (KX1 - KX0) / nd
for i in range(nd):
    box('주방_하부장', KX0 + i * dw + 0.002, NY - 0.62, FL + 0.103, KX0 + (i + 1) * dw - 0.002, NY - 0.60, FL + 0.857, M['cabinet'], bevel=0.002)
KZ = FL + 0.90
box('주방_상판', KX0, NY - 0.63, KZ - 0.04, KX1, NY, KZ, M['quartz'], bevel=0.003)
box('싱크볼', 6.95, NY - 0.52, KZ - 0.001, 7.65, NY - 0.10, KZ + 0.002, M['steel'])
cyl('수전', 7.3, NY - 0.06, KZ, KZ + 0.32, 0.016, M['gold'], n=16)
box('수전', 7.29, NY - 0.06, KZ + 0.30, 7.31, NY - 0.26, KZ + 0.32, M['gold'])
box('인덕션', 7.85, NY - 0.52, KZ, KX1 - 0.05, NY - 0.08, KZ + 0.006, M['glass_black'])
WIN0, WIN1 = 7.25 - 0.67, 7.25 + 0.67
box('대리석_백스플래시', KX0, NY - 0.01, KZ, WIN0, NY, FL + 2.4, M['marble'])
box('대리석_백스플래시', WIN1, NY - 0.01, KZ, KX1, NY, FL + 2.4, M['marble'])
box('대리석_백스플래시', WIN0, NY - 0.01, KZ, WIN1, NY, FL + 1.05 - 0.07, M['marble'])
box('대리석_옆벽', KX1 - 0.01, NY, FL, KX1, -1.69, FL + 2.4, M['marble'])
for ux0, ux1 in ((KX0, WIN0 - 0.02), (WIN1 + 0.02, KX1)):
    box('주방_상부장', ux0, NY - 0.35, FL + 1.55, ux1, NY, CE, M['white'])
    nu = max(1, round((ux1 - ux0) / 0.42)); uw = (ux1 - ux0) / nu
    for i in range(nu):
        box('주방_상부장문', ux0 + i * uw + 0.002, NY - 0.37, FL + 1.552, ux0 + (i + 1) * uw - 0.002, NY - 0.35, CE - 0.002, M['white'], bevel=0.002)
# 반도 바 (식당 쪽) + 바스툴 2
PY0, PY1 = -1.70, -2.30
box('반도_몸통', 5.85, PY0, FL, 7.95, PY1 + 0.25, KZ - 0.04, M['cabinet'])
box('반도_상판', 5.80, PY0 + 0.02, KZ - 0.04, 8.0, PY1 - 0.05, KZ, M['quartz'], bevel=0.003)
P = Place(0, 0, 0)
for x in (6.5, 7.3): bar_stool(P, x, PY1 - 0.38, FL, M['stool'], M['chrome'])
# 알코브 입구 우드 몰딩
box('주방_입구몰딩', CX0 + 0.75, -1.74 - 0.06, CE - 0.07, CX1 - 0.05, -1.74 - 0.05, CE, M['iframe'])

# ---------------------------------------------------------------- 8) 거실 — 소파·TV장·테이블·러그
P = Place(CX0 + TI / 2, -5.85, 270); sofa(P, 2.3, 0.95, FL, M['fabric'], M['chrome'])
P = Place(CX1 - TI / 2, -5.6, 90)
P.box('TV장', -0.9, -0.42, FL + 0.08, 0.9, -0.02, FL + 0.48, M['white'], bevel=0.01)
rs = [(-0.88 + i * 0.04, -0.425, FL + 0.10, -0.865 + i * 0.04, -0.415, FL + 0.46) for i in range(44)]
o = multi_box('TV장_플루트', rs, M['white']); o.data.transform(P.M)
P.box('TV장_다리', -0.85, -0.38, FL, 0.85, -0.06, FL + 0.08, M['chrome'])
cyl('테이블_상판', 6.3, -5.85, FL + 0.38, FL + 0.42, 0.3, M['white'], n=48, rx=0.55, ry=0.32)
cyl('테이블_받침', 6.3, -5.85, FL, FL + 0.38, 0.2, M['white'], n=40, rx=0.32, ry=0.18)
box('러그', 5.2, -6.75, FL, 7.6, -4.85, FL + 0.012, M['rug'], bevel=0.004)

# ---------------------------------------------------------------- 9) 침실 — 침대 3
P = Place(TE, -1.6, 270); bed(P, 1.5, 2.0, FL, M['sheet'], M['gray_cover'], M['pillow_w'])
P = Place(TE, -4.9, 270); bed(P, 1.5, 2.0, FL, M['sheet'], M['sheet'], M['pillow_w'], runner=M['navy'])
o = cyl('협탁', 0.42, -3.9, FL, FL + 0.55, 0.2, M['white'], n=32)
P = Place(W - TE, -4.85, 90); bed(P, 1.6, 2.05, FL, M['sheet'], M['gray_cover'], M['pillow_w'])

# ---------------------------------------------------------------- 10) 현관 — 가로 슬랫벽 + 벽등 + 선반
slat_wall('현관_슬랫벽', 'y', 2.64 + TI / 2, -6.3 + TE, -4.58 - TI / 2, FL, CE, 1, M['ent_slat'], M['walnut_bg'], w=0.04, gap=0.012, horizontal=True)
box('현관_선반', 3.0, -4.58 - TI / 2, FL + 1.9, 3.8, -4.95, FL + 1.93, M['iframe'])
box('현관_벽등', 4.14 - 0.02, -5.6, FL + 1.75, 4.14, -5.4, FL + 1.95, M['white'], bevel=0.01)
light('LT_WALL1', 'POINT', (3.9, -5.5, FL + 1.85), 10, (1.0, 0.85, 0.7))

# ---------------------------------------------------------------- 11) 욕실·드레스룸·파우더룸
P = Place(3.13, -TE, 0); toilet(P, FL, M['porcelain'], M['chrome'])
P = Place(3.85, -TE, 0); wall_basin(P, FL, M['porcelain'], M['chrome'])
box('거울', 3.6, -TE - 0.01, FL + 1.15, 4.1, -TE, FL + 1.85, M['mirror'])
P = Place(4.55, -TE, 0); shower(P, FL, M['chrome'], M['white'], M['glass'], w=0.95, gx=-0.38)
P = Place(8.34 + TI / 2, -2.89, 270); toilet(P, FL, M['porcelain'], M['chrome'])
P = Place(8.34 + TI / 2, -1.85, 270); wall_basin(P, FL, M['porcelain'], M['chrome'])
P = Place(9.78 - TI / 2, -1.5, 90); shower(P, FL, M['chrome'], M['white'], M['glass'], w=0.9, gx=-0.55)
P = Place(10.69, -1.08 - TE, 0); wardrobe(P, 1.6, 0.55, FL, 2.2, M['white'], M['white'])
slat_wall('파우더_슬랫', 'y', W - TE, -3.34 + TI / 2, -2.42 + 0.02, FL, CE, -1, M['ent_slat'], M['walnut_bg'], w=0.03, gap=0.012, horizontal=True)
P = Place(W - TE - 0.02, -2.88, 90)
P.box('파우더_화장대', -0.42, -0.45, FL + 0.70, 0.42, -0.0, FL + 0.74, M['quartz'])
P.box('파우더_서랍', -0.40, -0.43, FL + 0.55, 0.40, -0.02, FL + 0.70, M['white'])
o = cyl('파우더_거울', 0, 0, -0.012, 0.0, 0.3, M['mirror'], n=48)
o.data.transform(P.M @ Matrix.Translation(Vector((0, -0.005, FL + 1.45))) @ Matrix.Rotation(math.pi / 2, 4, 'X'))

# ---------------------------------------------------------------- 저장 + 미리보기
SHOTS = {
    'ext':  ((5.8, -21.0, 2.3), (5.8, -3.5, 2.4), 30),
    'ext2': ((17.0, -15.5, 5.5), (6.0, -3.6, 1.8), 30),
    'liv':  ((6.3, -2.6, 1.55), (6.3, -7.0, 2.6), 15),
    'kit':  ((6.6, -6.4, 1.55), (6.8, -0.6, 1.5), 17),
    'bed':  ((2.45, -3.5, 1.65), (0.4, -5.6, 0.8), 15),
}
shots = {k: SHOTS[k] for k in A.shots.split(',') if k in SHOTS}
backdrop((5.8, -4.0), {**SHOTS})
save_and_preview(A.out, A.preview, list(shots), samples=A.samples)
