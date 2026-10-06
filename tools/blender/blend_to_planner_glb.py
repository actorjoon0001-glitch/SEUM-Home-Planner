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
#   --max-obj-tris : 이보다 무거운 부품(이불·쿠션 주름 등)은 모양 유지하며 간소화 (0=끔)
#   --exclude-collection : 이 컬렉션의 오브젝트는 빼고 변환 (쉼표 구분, 예: Backdrop — 렌더용 배경·잔디)
#   --hq : 무늬 굽기 해상도를 한 단계 올림 (큰 면 4096 / 중간 2048 / 작은 부품 1024) — 선명하지만 파일이 커짐
#   이미지 무늬를 쓰는 재질은 원래 UV를 살린 채 새 UV(BakeUV)에 구움 · 렌더 숨김 부품은 제외 · 곡선은 형태로 변환
#   결과: 출력폴더/<입력이름>.glb  (models/ 에 넣고 템플릿의 model3d.url 로 지정)
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
ap.add_argument('--max-obj-tris', type=int, default=0)
ap.add_argument('--jpeg', type=int, default=82)
ap.add_argument('--exclude-collection', default='')
ap.add_argument('--hq', action='store_true')
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
for o in bpy.data.objects:
    o.hide_set(False); o.hide_viewport = False; o.hide_select = False
# 제외할 컬렉션(렌더용 배경·잔디 등)
for cn in [c.strip() for c in A.exclude_collection.split(',') if c.strip()]:
    c = bpy.data.collections.get(cn)
    if not c: print("컬렉션 없음:", cn); continue
    for o in list(c.all_objects): bpy.data.objects.remove(o, do_unlink=True)
    print("제외:", cn)
# 렌더에서 숨긴 보조 부품(이전 버전·가이드·경로 곡선 등)은 제외 — 불리언 커터는 형태 확정 때까지 남겨 둠
for o in list(bpy.data.objects):
    if o.hide_render and o.name not in cutters and o.type in ('MESH', 'CURVE', 'SURFACE', 'FONT', 'META'):
        bpy.data.objects.remove(o, do_unlink=True)
# 곡선(수전·의자 다리 등)은 형태(메시)로 변환해 함께 포함
curves = [o for o in bpy.data.objects if o.type in ('CURVE', 'SURFACE', 'FONT', 'META')]
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
baked = {}
for m in proc:
    objs = users[m.name]
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
        px[~filled, :3] = px[filled, :3].mean(axis=0)
    px[:, 3] = 1.0
    img.pixels = px.ravel().tolist()
    img.pack()
    baked[m.name] = img
    print(f"baked {m.name:<20} objs={len(objs):3d} area={area:6.1f}m2 size={size} fill={filled.mean():.0%}")

# 베이크한 재질을 단순 PBR(이미지 → 기본색)로 교체
for m in proc:
    b = bsdf_of(m)
    rough, metal = b.inputs['Roughness'].default_value, b.inputs['Metallic'].default_value
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

# 4) (재질, 지붕여부)로 다시 합치기
groups = collections.defaultdict(list)
ROOF_PREFIX = tuple(p.strip() for p in A.roof_prefix.split(',') if p.strip())
for o in list(bpy.data.objects):
    zs = [(o.matrix_world @ v.co).z for v in o.data.vertices]
    roof = (min(zs) >= A.roof_z or bool(o.get('roof'))   # 벽 윗선 근처 이상(천장·조명) 또는 생성기가 지붕으로 표시한 부품
            or (bool(ROOF_PREFIX) and o.name.startswith(ROOF_PREFIX)))
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
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7)
print("GLB size:", os.path.getsize(os.path.join(OUT, NAME + ".glb")))
