# 블렌더 모델(.blend) → 홈플래너 실물 모델(.glb) 변환
#
#   절차적 재질(나뭇결·사이딩 등 노드 텍스처)을 이미지로 베이크하고, 모디파이어를 적용하고,
#   부품을 (재질, 지붕여부)별로 합쳐 웹에서 가볍게 만든 뒤, 홈플래너 도면 좌표에 맞춰 Draco 압축 GLB 로 내보낸다.
#
#   실행 (Blender 5.x 또는 pip 의 bpy 모듈):
#     blender -b --python tools/blender/blend_to_planner_glb.py -- 입력.blend 출력폴더 --origin-y 5.9
#     python  tools/blender/blend_to_planner_glb.py -- 입력.blend 출력폴더 --origin-y 5.9      (pip install bpy)
#
#   --origin-x / --origin-y : 홈플래너 도면 원점(방들의 북서쪽 모서리)이 블렌더에서 어디인지(m).
#       블렌더 -Y 쪽이 도면의 남쪽(아래)이 된다. 예) 황토찜질방: 본체 뒷벽이 y=5.9 → --origin-y 5.9
#   --roof-z : 이 높이(m) 이상에만 있는 부품은 '지붕·천장'으로 표시 → 홈플래너의 지붕 끄기로 숨겨짐
#             (오브젝트 커스텀 속성 roof=1 이 있으면 높이와 상관없이 지붕 — plan_to_blend.py 가 붙여 줌)
#   --origin-z : 땅 높이(m) — 모델의 땅이 0이 아니면 그만큼 내림
#   --roof-prefix : 이 이름으로 시작하는 오브젝트도 지붕으로 (쉼표 구분, 예: Canopy,PDL)
#   --ceiling-split / --ceiling-z : 벽·천장이 한 덩어리인 부품(쉼표 구분 이름 접두)에서 높이 ceiling-z 이상의
#       천장·윗면만 떼어 지붕으로 표시 → 지붕 끄기 때 천장도 사라져 실내가 보임 (예: A_Shell,B_Shell)
#   --keep-prefix : 이 이름으로 시작하는 오브젝트는 높아도 지붕이 아님 — 지붕 끄기에도 남김 (예: 데크 위 처마 Canopy,CNS)
#   --max-obj-tris : 이보다 무거운 부품(이불·쿠션 주름 등)은 모양 유지하며 간소화 (0=끔)
#   --exclude-collection : 이 컬렉션의 오브젝트는 빼고 변환 (쉼표 구분, 예: Backdrop — 렌더용 배경·잔디)
#   --exclude-objects : 이 이름의 오브젝트는 빼고 변환 (쉼표 구분, 예: Ground — 렌더용 잔디 바닥)
#   --bake-cache : 구운 무늬 저장 폴더 (기본 ~/.cache/seum-bake/<입력이름>) — 재질 설정·부품 모양이 그대로인 재질은
#       지난번 구운 무늬를 그대로 씀 → 바뀐 재질만 새로 구움 (수정 반영이 수십 분 → 몇 분). --no-cache 로 끔
#   --hq : 무늬 굽기 해상도를 한 단계 올림 (큰 면 4096 / 중간 2048 / 작은 부품 1024) — 선명하지만 파일이 커짐
#   겹친 면(같은 자리에 붙은 두 부품의 면)은 웹에서 깜빡이므로 큰 쪽을 0.6mm 뒤로 밀어 정리 (--keep-coplanar 로 끔)
#   이미지 무늬를 쓰는 재질은 원래 UV를 살린 채 새 UV(BakeUV)에 구움 · 렌더 숨김 부품은 제외 · 곡선은 형태로 변환
#   결과: 출력폴더/<입력이름>.glb + <입력이름>.lights.json (조명 — 같은 폴더에 두면 웹이 자동으로 읽음)  (models/ 에 넣고 템플릿의 model3d.url 로 지정)
import bpy
_ = bpy.app.version
import mathutils, collections, os, sys, math, argparse
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--origin-x', type=float, default=0.0)
ap.add_argument('--origin-y', type=float, default=0.0)
ap.add_argument('--roof-z', type=float, default=2.55)
ap.add_argument('--origin-z', type=float, default=0.0)
ap.add_argument('--roof-prefix', default='')
ap.add_argument('--keep-prefix', default='')
ap.add_argument('--ceiling-split', default='')
ap.add_argument('--ceiling-z', type=float, default=2.6)
ap.add_argument('--ceiling-wall', type=float, default=0.15)
ap.add_argument('--max-obj-tris', type=int, default=0)
ap.add_argument('--jpeg', type=int, default=82)
ap.add_argument('--exclude-collection', default='')
ap.add_argument('--exclude-objects', default='')
ap.add_argument('--hq', action='store_true')
ap.add_argument('--bake-cache', default='')
ap.add_argument('--no-cache', action='store_true')
ap.add_argument('--keep-coplanar', action='store_true')
A = ap.parse_args(argv)
SRC, OUT = A.src, A.out
os.makedirs(OUT, exist_ok=True)
NAME = os.path.splitext(os.path.basename(SRC))[0]
bpy.ops.wm.open_mainfile(filepath=SRC)
sc = bpy.context.scene
vl = bpy.context.view_layer

def sel_only(objs, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    vl.objects.active = active or (objs[0] if objs else None)

# 0) 모든 오브젝트 보이게(뷰포트 숨김이면 연산자가 무시함) — 단, 렌더 숨김/불리언 커터는 제외 대상
cutters = set()
for o in bpy.data.objects:
    for m in o.modifiers:
        if m.type == 'BOOLEAN' and m.object: cutters.add(m.object.name)
        if m.type == 'BOOLEAN' and getattr(m, 'collection', None):
            for c in m.collection.all_objects: cutters.add(c.name)
print("cutters:", sorted(cutters))
# 곡선의 단면·굵기 모양으로 쓰는 곡선(렌더 숨김이어도 필요)도 형태 확정 때까지 남겨 둠
for o in bpy.data.objects:
    if o.type == 'CURVE':
        for ref in (o.data.bevel_object, o.data.taper_object):
            if ref: cutters.add(ref.name)
for o in bpy.data.objects:
    o.hide_set(False); o.hide_viewport = False; o.hide_select = False
# 제외할 컬렉션(렌더용 배경·잔디 등)
for cn in [c.strip() for c in A.exclude_collection.split(',') if c.strip()]:
    c = bpy.data.collections.get(cn)
    if not c: print("컬렉션 없음:", cn); continue
    for o in list(c.all_objects): bpy.data.objects.remove(o, do_unlink=True)
    print("제외:", cn)
for on in [c.strip() for c in A.exclude_objects.split(',') if c.strip()]:
    o = bpy.data.objects.get(on)
    if o: bpy.data.objects.remove(o, do_unlink=True); print("제외 오브젝트:", on)
    else: print("오브젝트 없음:", on)
# 블렌더 조명 → 출력폴더/<이름>.lights.json (웹 3D 에서 다운라이트·간접등을 실제 조명으로 켬)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lights_json
lights_json.write(bpy, os.path.join(OUT, NAME + '.lights.json'), ox=A.origin_x, oy=A.origin_y, oz=A.origin_z)
# 렌더에서 숨긴 보조 부품(이전 버전·가이드·경로 곡선 등)은 제외 — 불리언 커터는 형태 확정 때까지 남겨 둠
for o in list(bpy.data.objects):
    if o.hide_render and o.name not in cutters and o.type in ('MESH', 'CURVE', 'SURFACE', 'FONT', 'META'):
        bpy.data.objects.remove(o, do_unlink=True)
# 곡선(수전·의자 다리 등)은 형태(메시)로 변환해 함께 포함
curves = [o for o in bpy.data.objects if o.type in ('CURVE', 'SURFACE', 'FONT', 'META') and o.name not in cutters]
if curves:
    sel_only(curves); bpy.ops.object.convert(target='MESH')

meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.name not in cutters and not o.hide_render]
# 너무 무거운 부품(주름 이불·쿠션 등)은 모양을 유지하며 간소화
if A.max_obj_tris > 0:
    dg0 = bpy.context.evaluated_depsgraph_get()
    for o in meshes:
        ev = o.evaluated_get(dg0); me = ev.to_mesh(); me.calc_loop_triangles(); t = len(me.loop_triangles); ev.to_mesh_clear()
        if t > A.max_obj_tris:
            d = o.modifiers.new('간소화', 'DECIMATE'); d.ratio = A.max_obj_tris / t
            print(f"decimate {o.name}: {t} → ~{A.max_obj_tris}")

# 1) 형태 확정 — 모디파이어 적용(불리언은 커터로 구멍) → 부모 해제 → 커터·카메라·조명·엠프티 삭제
sel_only(meshes)
bpy.ops.object.convert(target='MESH')
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.name not in cutters]
sel_only(meshes)
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')   # 월드 위치 그대로 → 절차적 무늬(Object 좌표)도 그대로
for o in list(bpy.data.objects):
    if o.type != 'MESH' or o.name in cutters:
        bpy.data.objects.remove(o, do_unlink=True)

# 1.4) 천장 떼기 — 벽·천장이 한 덩어리면 높이로 지붕을 가를 수 없음 → 높은 곳의 큰 수평·경사면만 분리해 지붕으로
#   · 창·문 위 인방 아랫면처럼 좁은 면(폭 0.5m 이하)은 남김
#   · 평평한 윗덮개는 벽 두께(--ceiling-wall)만큼 가장자리를 남기고, 안쪽 천장 높이까지 턱을 내려 벽 윗면을 막음
#     (덮개를 통째로 떼면 벽 두께 속이 비어 보임)
CEIL_PREFIX = tuple(p.strip() for p in A.ceiling_split.split(',') if p.strip())
if CEIL_PREFIX:
    import bmesh
    for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith(CEIL_PREFIX)]:
        M = o.matrix_world; R = M.to_3x3(); Mi = M.inverted()
        bm = bmesh.new(); bm.from_mesh(o.data)
        def info(f):
            ws = [M @ v.co for v in f.verts]
            return (min(w.z for w in ws), max(w.z for w in ws), min(w.x for w in ws), max(w.x for w in ws),
                    min(w.y for w in ws), max(w.y for w in ws), (R @ f.normal).normalized().z)
        top = []
        for f in bm.faces:
            z0, z1, x0, x1, y0, y1, nz = info(f)
            if z0 >= A.ceiling_z and abs(nz) > 0.3 and min(x1 - x0, y1 - y0) > 0.5: top.append(f)
        if not top or len(top) == len(bm.faces): bm.free(); continue
        downs = [info(f) for f in top if info(f)[6] < -0.3]
        flat_up = [f for f in top if info(f)[6] > 0.995]   # 경사 덮개(박공)는 통째로 뗌
        for f in flat_up:
            z0, z1, x0, x1, y0, y1, nz = info(f)
            under = [d for d in downs if d[1] < z0 and d[2] >= x0 - 1e-3 and d[3] <= x1 + 1e-3 and d[4] >= y0 - 1e-3 and d[5] <= y1 + 1e-3]
            bmesh.ops.inset_individual(bm, faces=[f], thickness=A.ceiling_wall, use_even_offset=True)
            if under:
                dz = z0 - max(d[1] for d in under)
                ex = bmesh.ops.extrude_edge_only(bm, edges=list(f.edges))
                nv = [e for e in ex['geom'] if isinstance(e, bmesh.types.BMVert)]
                # 안쪽 덮개 테두리를 아래로 내려 턱 만들기 — 원래 면(f)은 위에 남겨 지붕으로 떼어냄
                bmesh.ops.translate(bm, verts=nv, vec=Mi.to_3x3() @ mathutils.Vector((0, 0, -dz)))
        for f in bm.faces: f.select_set(False)
        for f in top: f.select_set(True)
        bm.to_mesh(o.data); bm.free()
        sel_only([o])
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.separate(type='SELECTED'); bpy.ops.object.mode_set(mode='OBJECT')
        for n in [x for x in bpy.context.selected_objects if x != o]: n['roof'] = 1; n.name = o.name + '_천장'
        print(f"천장 떼기: {o.name} 면 {len(top)}개 (덮개 테두리 {len(flat_up)})")

# 1.3) 다각형(n-gon) 미리 삼각형으로 — 문·창 구멍이 뚫린 큰 벽 면은 오목한 다각형이라,
#   아래에서 꼭짓점을 조금씩 밀거나 떼어낸 뒤 내보낼 때 나누면 삼각형이 구멍을 덮어 버림(문에 검은 대각선)
import bmesh
for o in [o for o in bpy.data.objects if o.type == 'MESH']:
    if not any(len(p.vertices) > 4 for p in o.data.polygons): continue
    if o.data.users > 1: o.data = o.data.copy()
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4], quad_method='BEAUTY', ngon_method='BEAUTY')
    bm.to_mesh(o.data); bm.free(); o.data.update()

# 1.5) 겹친 면 정리 — 서로 다른 부품의 면이 같은 자리·같은 방향으로 겹치면 웹에서 깜빡임(z-fighting)
#   (창 몰딩이 마감재 속에 묻힌 경우, 천장 마감판이 처마 밑면과 딱 붙은 경우 등)
#   → 겹친 두 부품 중 큰 쪽의 그 면을 0.6mm 뒤로 밀어 작은 부품(디테일)이 보이게 함. 축에 나란한 면만 검사
def fix_coplanar(push=0.0006, tol=0.00025, cell=0.3):
    import numpy as np
    from collections import defaultdict
    objs = [o for o in bpy.data.objects if o.type == 'MESH' and o.data.polygons]
    size = {}
    faces = defaultdict(list)          # (축, 방향) → [(평면값, 2D 사각범위, 2D 다각형, 오브젝트, 폴리곤 index)]
    for oi, o in enumerate(objs):
        M = o.matrix_world; me = o.data
        co = np.empty(len(me.vertices) * 3, dtype=np.float64); me.vertices.foreach_get('co', co)
        W = co.reshape(-1, 3) @ np.array(M.to_3x3()).T + np.array(M.translation)
        size[oi] = float(np.prod(np.maximum(W.max(0) - W.min(0), 0.01))) if len(W) else 0
        for p in me.polygons:
            n = M.to_3x3() @ p.normal
            if n.length < 1e-9: continue
            n.normalize()
            a = max(range(3), key=lambda i: abs(n[i]))
            if abs(n[a]) < 0.999: continue
            V = W[list(p.vertices)]
            ax = [i for i in range(3) if i != a]
            P2 = V[:, ax]
            faces[(a, 1 if n[a] > 0 else -1)].append((float(V[:, a].mean()), P2.min(0), P2.max(0), P2, oi, p.index))
    def area(poly):
        x, y = poly[:, 0], poly[:, 1]
        return 0.5 * float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))
    def clip(subj, cl):
        if area(cl) < 0: cl = cl[::-1]
        out = list(map(tuple, subj))
        for i in range(len(cl)):
            A, B = cl[i], cl[(i + 1) % len(cl)]
            inp, out = out, []
            if not inp: break
            ins = lambda q: (B[0]-A[0]) * (q[1]-A[1]) - (B[1]-A[1]) * (q[0]-A[0]) >= -1e-12
            def X(q, r):
                d = (q[0]-r[0]) * (A[1]-B[1]) - (q[1]-r[1]) * (A[0]-B[0])
                if abs(d) < 1e-18: return r
                t = ((q[0]-A[0]) * (A[1]-B[1]) - (q[1]-A[1]) * (A[0]-B[0])) / d
                return (q[0] + t * (r[0]-q[0]), q[1] + t * (r[1]-q[1]))
            for j in range(len(inp)):
                q, r = inp[j], inp[(j + 1) % len(inp)]
                if ins(r):
                    if not ins(q): out.append(X(q, r))
                    out.append(r)
                elif ins(q): out.append(X(q, r))
        return np.array(out) if len(out) >= 3 else None
    # 같은 평면에서 겹치는 부품끼리 묶고(연결 요소), 작은 부품부터 0, 0.6, 1.2mm … 순서로 층을 나눔
    #   (한 쌍씩 큰 쪽만 밀면 그 부품이 다른 부품과 다시 겹칠 수 있음 — 벽 모서리처럼 여럿이 만나는 곳)
    parent = {}
    def find(x):
        while parent.setdefault(x, x) != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x
    node_faces = defaultdict(list)
    hits = defaultdict(float)
    for (a, sg), L in faces.items():
        L.sort(key=lambda f: f[0])
        i0 = 0
        for i, f in enumerate(L):          # 평면값이 tol 이내인 것끼리만 (정렬 후 슬라이딩)
            while L[i0][0] < f[0] - tol: i0 += 1
            for g in L[i0:i]:
                if g[4] == f[4]: continue
                if (f[1] > g[2] - 1e-6).any() or (g[1] > f[2] - 1e-6).any(): continue
                ov = clip(f[3], g[3])
                if ov is None or abs(area(ov)) < 1e-6: continue    # 1cm² 미만은 무시
                nf = (f[4], a, sg, round(f[0] / (2 * tol))); ng = (g[4], a, sg, round(g[0] / (2 * tol)))
                parent[find(nf)] = find(ng)
                hits[tuple(sorted((objs[f[4]].name, objs[g[4]].name)))] += abs(area(ov))
            node_faces[(f[4], a, sg, round(f[0] / (2 * tol)))].append(f[5])
    comps = defaultdict(list)
    for nd in parent: comps[find(nd)].append(nd)
    moves = defaultdict(dict)          # 오브젝트 → {꼭짓점: 월드 이동 벡터}
    for members in comps.values():
        members.sort(key=lambda nd: (size[nd[0]], objs[nd[0]].name))
        for rank, (oi, a, sg, _) in enumerate(members):
            if not rank: continue
            vd = moves[oi]
            for pi in node_faces[(oi, a, sg, _)]:
                for vi in objs[oi].data.polygons[pi].vertices:
                    v = vd.setdefault(vi, [0.0, 0.0, 0.0])
                    if rank * push > abs(v[a]): v[a] = -sg * rank * push
    for oi, vd in moves.items():
        o = objs[oi]
        if o.data.users > 1: o.data = o.data.copy()
        Minv = o.matrix_world.to_3x3().inverted()
        for vi, d in vd.items(): o.data.vertices[vi].co += Minv @ mathutils.Vector(d)
        o.data.update()
    print(f"겹친 면 정리: {len(hits)}쌍, 부품 {len(moves)}개 조정")
    for k, v in sorted(hits.items(), key=lambda x: -x[1])[:12]: print(f"  {k[0]} ↔ {k[1]}  {v*1e4:.0f}cm²")
if not A.keep_coplanar:
    for _ in range(2): fix_coplanar()   # 두 번째는 밀면서 새로 생긴 겹침 정리

# 2) 재질별로 분리 — 부품마다 재질 하나 → 재질마다 따로 펼쳐 무늬 이미지를 꽉 채워 굽기 위함
sel_only(list(bpy.data.objects))
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='MATERIAL')
bpy.ops.object.mode_set(mode='OBJECT')
for o in list(bpy.data.objects):
    if not o.data.polygons: bpy.data.objects.remove(o, do_unlink=True)
def obj_mat(o):
    if not o.material_slots: return None
    i = o.data.polygons[0].material_index
    return o.material_slots[min(i, len(o.material_slots) - 1)].material

# 3) 절차적·이미지 무늬 재질 → 이미지로 굽기
def bsdf_of(m):
    return next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m and m.node_tree else None
proc = [m for m in bpy.data.materials if bsdf_of(m) and bsdf_of(m).inputs['Base Color'].is_linked]
users = {m.name: [o for o in bpy.data.objects if obj_mat(o) == m] for m in proc}
proc = [m for m in proc if users[m.name]]
print("procedural:", [m.name for m in proc])

def world_area(objs):
    a = 0.0
    for o in objs:
        sx, sy, sz = o.matrix_world.to_scale()
        k = max(abs(sx * sy), abs(sy * sz), abs(sx * sz))
        a += sum(p.area for p in o.data.polygons) * k
    return a

# Cycles 베이크 설정 (색만, 조명 없음)
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 1
sc.render.bake.use_pass_direct = False
sc.render.bake.use_pass_indirect = False
sc.render.bake.use_pass_color = True
sc.render.bake.margin = 16

def pushpull(rgb, mask):
    # 정사각 2의 거듭제곱 이미지: 채워진 픽셀만으로 피라미드를 만들고, 빈 곳은 한 단계 거친 평균색으로 채워 내려옴
    c = rgb * mask[..., None]; a = mask.astype(np.float32)
    pyr = [(c, a)]
    while c.shape[0] > 1:
        h = c.shape[0] // 2
        c = c.reshape(h, 2, h, 2, 3).sum((1, 3)); a = a.reshape(h, 2, h, 2).sum((1, 3))
        pyr.append((c, a))
    col = pyr[-1][0] / np.maximum(pyr[-1][1], 1e-6)[..., None]
    for c, a in reversed(pyr[:-1]):
        up = col.repeat(2, 0).repeat(2, 1)
        w = np.clip(a, 0, 1)[..., None]
        col = (c / np.maximum(a, 1e-6)[..., None]) * w + up * (1 - w)
    return col

dummy = bpy.data.images.new("__dummy", 4, 4)
def set_active_img(mat, img):
    nt = mat.node_tree
    n = nt.nodes.get("__bake")
    if not n:
        n = nt.nodes.new('ShaderNodeTexImage'); n.name = "__bake"
    n.image = img
    for x in nt.nodes: x.select = False
    n.select = True; nt.nodes.active = n

import numpy as np
# 구운 무늬 캐시 — 재질 지문(노드 설정 + 그 재질 부품들의 모양·위치) 이 같으면 지난번 이미지·UV 재사용
import hashlib, json as _json
CACHE = '' if A.no_cache else (A.bake_cache or os.path.join(os.path.expanduser('~/.cache/seum-bake'), NAME))
if CACHE: os.makedirs(CACHE, exist_ok=True)
def _val(v):
    if isinstance(v, (int, float, bool, str)) or v is None: return v
    try: return [round(x, 6) if isinstance(x, float) else x for x in v]
    except TypeError: return str(v)
def tree_sig(nt, seen=None):
    seen = seen if seen is not None else set()
    out = []
    for n in sorted(nt.nodes, key=lambda n: n.name):
        d = [n.bl_idname, n.name]
        for pr in n.bl_rna.properties:
            if pr.is_readonly or pr.identifier in ('name', 'label', 'location', 'width', 'height', 'select', 'hide', 'color', 'use_custom_color', 'show_options', 'show_preview', 'show_texture', 'mute' ) : continue
            try: v = getattr(n, pr.identifier)
            except Exception: continue
            if hasattr(v, 'name') and hasattr(v, 'bl_rna'):
                v = v.name + (':' + str(tuple(v.size)) if hasattr(v, 'size') else '')
            d.append((pr.identifier, _val(v)))
        if n.type == 'VALTORGB':
            d.append([(round(e.position, 5), _val(e.color)) for e in n.color_ramp.elements] + [n.color_ramp.interpolation])
        if getattr(n, 'node_tree', None) and n.node_tree.name not in seen:
            seen.add(n.node_tree.name); d.append(tree_sig(n.node_tree, seen))
        d.append([(i.identifier, _val(getattr(i, 'default_value', None)) if not i.is_linked else 'L') for i in n.inputs])
        out.append(d)
    out.append(sorted((l.from_node.name, l.from_socket.identifier, l.to_node.name, l.to_socket.identifier) for l in nt.links))
    return out
def obj_sig(o):
    me = o.data
    co = np.empty(len(me.vertices) * 3, dtype=np.float32); me.vertices.foreach_get('co', co)
    lv = np.empty(len(me.loops), dtype=np.int32); me.loops.foreach_get('vertex_index', lv)
    ls = np.empty(len(me.polygons), dtype=np.int32); me.polygons.foreach_get('loop_total', ls)
    h = hashlib.sha1(); h.update(np.round(co, 5).tobytes()); h.update(lv.tobytes()); h.update(ls.tobytes())
    h.update(np.round(np.array(o.matrix_world, dtype=np.float64), 6).tobytes())
    for uvl in me.uv_layers:   # 이미지 무늬 재질은 원래 UV 로 무늬를 읽음
        if uvl.name == 'BakeUV': continue
        uv = np.empty(len(me.loops) * 2, dtype=np.float32); uvl.data.foreach_get('uv', uv); h.update(np.round(uv, 5).tobytes())
    return h.hexdigest()
def mat_key(m, objs):
    h = hashlib.sha1(_json.dumps(tree_sig(m.node_tree), default=str).encode())
    h.update(str(A.hq).encode()); h.update(b'v1')
    for s_ in sorted(obj_sig(o) for o in objs): h.update(s_.encode())
    return h.hexdigest()[:20]

baked = {}
n_hit = 0
for m in proc:
    objs = users[m.name]
    key = mat_key(m, objs) if CACHE else None
    cpath = os.path.join(CACHE, f"{key}.png") if key else None
    if cpath and os.path.exists(cpath) and os.path.exists(cpath[:-4] + '.npz'):
        uvz = np.load(cpath[:-4] + '.npz')
        ok = True
        for o in objs:
            k = obj_sig(o)
            if k not in uvz or len(uvz[k]) != len(o.data.loops) * 2: ok = False; break
        if ok:
            for o in objs:
                uvs = o.data.uv_layers
                if 'BakeUV' not in uvs:
                    had = len(uvs) > 0
                    nu = uvs.new(name='BakeUV')
                    if not had: nu.active_render = True
                uvs['BakeUV'].data.foreach_set('uv', uvz[obj_sig(o)])
            img = bpy.data.images.load(cpath); img.name = "bake_" + m.name; img.pack()
            baked[m.name] = img; n_hit += 1
            print(f"cached {m.name:<20} objs={len(objs):3d} size={img.size[0]}")
            continue
    # 새 UV(BakeUV)에 펼침 — 이미지 무늬 재질은 원래 UV(렌더용)로 읽어야 무늬가 안 깨짐
    for o in objs:
        uvs = o.data.uv_layers
        if 'BakeUV' not in uvs:
            had = len(uvs) > 0
            nu = uvs.new(name='BakeUV')
            if not had: nu.active_render = True
        uvs.active = uvs['BakeUV']
    # 펼칠 때만 크기 배율을 형태에 적용(실제 크기 기준으로 UV 면적 배분) → 펼친 뒤 원래대로
    #   (mm 단위로 만들고 0.001배 한 부품이 섞이면, 그 부품이 UV를 독차지하고 나머지는 점처럼 찌그러짐)
    saved = {}
    for o in objs:
        sv = o.scale.copy()
        if o.data.name in saved or all(abs(v - 1) < 1e-6 for v in sv): continue
        co = np.empty(len(o.data.vertices) * 3, dtype=np.float32); o.data.vertices.foreach_get('co', co)
        saved[o.data.name] = (o, co, sv)
        o.data.vertices.foreach_set('co', (co.reshape(-1, 3) * np.array(sv, dtype=np.float32)).ravel())
        o.scale = (1, 1, 1)
    sel_only(objs)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.003, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    for o, co, sv in saved.values():
        o.data.vertices.foreach_set('co', co); o.scale = sv; o.data.update()
    vl.update()   # 되돌린 크기 배율을 matrix_world 에 반영 (안 하면 면적이 mm² 로 계산돼 굽기 해상도가 과해짐)
    area = world_area(objs)
    size = (4096 if area > 40 else (2048 if area > 4 else 1024)) if A.hq else (2048 if area > 30 else (1024 if area > 2 else 512))
    img = bpy.data.images.new("bake_" + m.name, size, size, alpha=True)
    img.generated_color = (0, 0, 0, 0)
    for om in {s.material for o in objs for s in o.material_slots if s.material}:
        set_active_img(om, img if om == m else dummy)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=16, use_clear=True)
    # 빈 곳(구워지지 않은 픽셀)은 평균색으로 — 멀리서 볼 때(밉맵) 검은색이 번져 어둡게 보이는 것 방지
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    filled = px[:, 3] > 0.5
    if filled.any():
        # 빈 곳은 가까운 무늬 색이 번지듯 채움(밀어올리기-끌어내리기) — 한 가지 평균색으로 채우면
        #   멀리서 볼 때(밉맵) 그 색이 가는 부품(루버 날개 등) 사이로 섞여 얼룩 줄무늬가 생김
        px[:, :3] = pushpull(px[:, :3].reshape(size, size, 3), filled.reshape(size, size)).reshape(-1, 3)
    px[:, 3] = 1.0
    img.pixels = px.ravel().tolist()
    if cpath:   # 캐시에 저장 (이미지 + 부품별 BakeUV)
        uvsave = {}
        for o in objs:
            uv = np.empty(len(o.data.loops) * 2, dtype=np.float32); o.data.uv_layers['BakeUV'].data.foreach_get('uv', uv)
            uvsave[obj_sig(o)] = uv
        img.filepath_raw = cpath; img.file_format = 'PNG'; img.save()
        np.savez(cpath[:-4] + '.npz', **uvsave)
    img.pack()
    baked[m.name] = img
    print(f"baked {m.name:<20} objs={len(objs):3d} area={area:6.1f}m2 size={size} fill={filled.mean():.0%}")

print(f"굽기 캐시: {n_hit}/{len(proc)} 재질 재사용" + (f" ({CACHE})" if CACHE else " (끔)"))

# 노드가 연결된 값(거칠기·금속성)의 대표값 — 연결된 채로 내보내면 GLB 에 값이 빠져 '완전 무광(1.0)'이 됨
#   (거칠기에 노이즈→Map Range 를 걸어 둔 재질이 많음 → 출력 범위의 가운데 값을 씀)
def eff_value(inp):
    if not inp.is_linked: return inp.default_value
    fn = inp.links[0].from_node
    if fn.type == 'MAP_RANGE':
        lo, hi = fn.inputs['To Min'], fn.inputs['To Max']
        if not lo.is_linked and not hi.is_linked: return (lo.default_value + hi.default_value) / 2
    if fn.type == 'MIX':
        vals = [i.default_value for i in fn.inputs if i.name in ('A', 'B') and i.type == 'VALUE' and not i.is_linked]
        if vals: return sum(vals) / len(vals)
    if fn.type == 'VALUE': return fn.outputs[0].default_value
    return inp.default_value
def bake_pbr_values(m):
    b = bsdf_of(m)
    if not b: return
    for k in ('Roughness', 'Metallic'):
        i = b.inputs[k]
        if i.is_linked:
            v = eff_value(i)
            for l in list(i.links): m.node_tree.links.remove(l)
            i.default_value = v

# 베이크한 재질을 단순 PBR(이미지 → 기본색)로 교체
for m in proc:
    b = bsdf_of(m)
    rough, metal = eff_value(b.inputs['Roughness']), eff_value(b.inputs['Metallic'])
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nb = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nb.inputs['Roughness'].default_value = rough; nb.inputs['Metallic'].default_value = metal
    ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = baked[m.name]
    nt.links.new(ti.outputs['Color'], nb.inputs['Base Color'])
    nt.links.new(nb.outputs['BSDF'], out.inputs['Surface'])
# UV 정리 — 구운 재질 부품은 BakeUV 한 벌만, 무늬 없는 재질 부품은 UV 없음
#   (합칠 때 부품마다 UV 이름이 다르면 UV가 두 벌 생기고, 웹이 엉뚱한 쪽으로 무늬를 읽어 단색·검정으로 보임)
baked_names = set(baked)
for o in bpy.data.objects:
    uvs = o.data.uv_layers
    m = obj_mat(o)
    keep = 'BakeUV' if (m and m.name in baked_names and 'BakeUV' in uvs) else None
    for name in [l.name for l in uvs if l.name != keep]:
        uvs.remove(uvs[name])
    if keep:
        uvs[keep].active = True; uvs[keep].active_render = True
for m in bpy.data.materials:
    if m.node_tree and m.node_tree.nodes.get("__bake"): m.node_tree.nodes.remove(m.node_tree.nodes["__bake"])
for m in bpy.data.materials:            # 굽지 않은 재질도 연결된 거칠기·금속성은 대표값으로 고정
    if m.node_tree and m.name not in baked_names: bake_pbr_values(m)
# 유리 — 투명 BSDF·유리 BSDF 를 섞어 만든 유리(바깥은 투명+반사 등)는 내보낼 때 불투명 판이 됨
#   → 프린시플드에 낮은 알파를 넣어 반투명(BLEND)으로 내보냄 (웹에서 유리 재질로 바뀜)
for m in bpy.data.materials:
    nt = m.node_tree
    if not nt or m.name in baked_names: continue
    if any(n.type in ('BSDF_TRANSPARENT', 'BSDF_GLASS') for n in nt.nodes):
        for n in nt.nodes:
            if n.type == 'BSDF_PRINCIPLED' and not n.inputs['Alpha'].is_linked and n.inputs['Alpha'].default_value > 0.2:
                n.inputs['Alpha'].default_value = 0.12
        if hasattr(m, 'surface_render_method'): m.surface_render_method = 'BLENDED'
        print("유리로 처리:", m.name)

# 4) (재질, 지붕여부)로 다시 합치기
groups = collections.defaultdict(list)
ROOF_PREFIX = tuple(p.strip() for p in A.roof_prefix.split(',') if p.strip())
KEEP_PREFIX = tuple(p.strip() for p in A.keep_prefix.split(',') if p.strip())
for o in list(bpy.data.objects):
    zs = [(o.matrix_world @ v.co).z for v in o.data.vertices]
    roof = (min(zs) >= A.roof_z or bool(o.get('roof'))   # 벽 윗선 근처 이상(천장·조명) 또는 생성기가 지붕으로 표시한 부품
            or (bool(ROOF_PREFIX) and o.name.startswith(ROOF_PREFIX)))
    if KEEP_PREFIX and o.name.startswith(KEEP_PREFIX): roof = False
    mat = obj_mat(o)
    groups[(mat.name if mat else "", roof)].append(o)
for (mname, roof), objs in groups.items():
    sel_only(objs)
    if len(objs) > 1: bpy.ops.object.join()
    j = vl.objects.active
    j.name = ("지붕_" if roof else "") + (mname or "무재질")
    if roof: j["roof"] = 1
# 5) 원점 맞춤: 홈플래너 도면 (0,0) = 블렌더 (origin-x, origin-y)
for o in bpy.data.objects:
    o.location.x -= A.origin_x; o.location.y -= A.origin_y; o.location.z -= A.origin_z
vl.update()   # 이동한 위치를 행렬에 반영해야 아래 크기 리포트가 맞음
# 크기 리포트
mn = mathutils.Vector((1e9,)*3); mx = -mn; tri = 0
for o in bpy.data.objects:
    for v in o.data.vertices:
        w = o.matrix_world @ v.co; mn = mathutils.Vector(map(min, mn, w)); mx = mathutils.Vector(map(max, mx, w))
    o.data.calc_loop_triangles(); tri += len(o.data.loop_triangles)
print("final objects:", len(bpy.data.objects), "roof:", sum(1 for o in bpy.data.objects if o.get("roof")), "tris:", tri)
print("bbox", tuple(round(v,3) for v in mn), tuple(round(v,3) for v in mx))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, NAME + ".glb"), export_format='GLB',
    export_apply=True, export_extras=True, export_cameras=False, export_lights=False, export_yup=True,
    export_image_format='JPEG', export_jpeg_quality=A.jpeg,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    # 위치 정밀도 — Draco 는 부품(재질)마다 자기 크기 기준으로 좌표를 반올림함. 기본 14비트면 9m 집에서 0.6mm 단위라
    #   서로 맞닿은 부품의 경계가 어긋나 틈으로 뒤가 비쳐 흰 점선(이음매)이 보임 → 18비트(약 0.04mm)
    export_draco_position_quantization=18, export_draco_normal_quantization=12, export_draco_texcoord_quantization=14)
print("GLB size:", os.path.getsize(os.path.join(OUT, NAME + ".glb")))
