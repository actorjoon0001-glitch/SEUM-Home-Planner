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

# 1) 절차적 색 재질 찾기
def bsdf_of(m):
    return next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m and m.node_tree else None
proc = [m for m in bpy.data.materials if bsdf_of(m) and bsdf_of(m).inputs['Base Color'].is_linked]
print("procedural:", [m.name for m in proc])
users = {m.name: [o for o in meshes if any(s.material == m for s in o.material_slots)] for m in proc}

# 재질 그룹이 오브젝트를 공유하면 같은 UV 배치를 써야 하므로 union-find 로 묶음
parent = {m.name: m.name for m in proc}
def find(a):
    while parent[a] != a: parent[a] = parent[parent[a]]; a = parent[a]
    return a
owner = {}
for mn, objs in users.items():
    for o in objs:
        if o.name in owner: parent[find(mn)] = find(owner[o.name])
        else: owner[o.name] = mn
unions = collections.defaultdict(list)
for m in proc: unions[find(m.name)].append(m)

def world_area(objs, mat=None):
    a = 0.0
    for o in objs:
        me = o.data
        for p in me.polygons:
            if mat is None or (p.material_index < len(o.material_slots) and o.material_slots[p.material_index].material == mat):
                a += p.area * (o.matrix_world.to_scale().x * o.matrix_world.to_scale().y)
    return a

# 2) Cycles 베이크 설정 (색만, 조명 없음)
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 1
sc.render.bake.use_pass_direct = False
sc.render.bake.use_pass_indirect = False
sc.render.bake.use_pass_color = True
sc.render.bake.margin = 8

dummy = bpy.data.images.new("__dummy", 4, 4)
all_mats = {s.material for o in meshes for s in o.material_slots if s.material}
def set_active_img(mat, img):
    nt = mat.node_tree
    n = nt.nodes.get("__bake")
    if not n:
        n = nt.nodes.new('ShaderNodeTexImage'); n.name = "__bake"
    n.image = img
    for x in nt.nodes: x.select = False
    n.select = True; nt.nodes.active = n

baked = {}
for root, mats in unions.items():
    objs = sorted({o for m in mats for o in users[m.name]}, key=lambda o: o.name)
    # UV 펼치기 (그룹 전체를 한 UV 공간에 함께 배치)
    # 새 UV(BakeUV)에 펼침 — 이미지 무늬 재질은 원래 UV(렌더용)로 읽어야 무늬가 안 깨짐
    for o in objs:
        uvs = o.data.uv_layers
        if 'BakeUV' not in uvs:
            had = len(uvs) > 0
            nu = uvs.new(name='BakeUV')
            if not had: nu.active_render = True
        uvs.active = uvs['BakeUV']
    sel_only(objs)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    for m in mats:
        mobjs = users[m.name]
        area = world_area(mobjs, m)
        size = 2048 if area > 30 else (1024 if area > 2 else 512)
        img = bpy.data.images.new("bake_" + m.name, size, size, alpha=False)
        img.generated_color = (0.5, 0.5, 0.5, 1)
        # 선택 오브젝트의 다른 재질들엔 더미 이미지를 활성으로 둬서 베이크 오류 방지
        for om in {s.material for o in mobjs for s in o.material_slots if s.material}:
            set_active_img(om, img if om == m else dummy)
        sel_only(mobjs)
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=8, use_clear=True)
        img.pack()
        baked[m.name] = img
        print(f"baked {m.name:<20} objs={len(mobjs):3d} area={area:6.1f}m2 size={size}")

# 3) 베이크한 재질을 단순 PBR(이미지 → 기본색)로 교체
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
# 구운 무늬는 BakeUV 로 읽음 → BakeUV 만 남기고 렌더용으로 지정
for o in bpy.data.objects:
    if o.type == 'MESH' and 'BakeUV' in o.data.uv_layers:
        uvs = o.data.uv_layers
        uvs['BakeUV'].active_render = True
        for l in [l for l in uvs if l.name != 'BakeUV']: uvs.remove(l)
# 나머지 재질의 범프(노이즈) 노드는 웹에서 무시되므로 정리
for m in all_mats - set(proc):
    if not m.node_tree: continue
    for n in list(m.node_tree.nodes):
        if n.name == "__bake": m.node_tree.nodes.remove(n)

# 4) 모디파이어 적용(형태 확정) → 부모 해제 → 커터·카메라·조명·엠프티 삭제
sel_only(meshes)
bpy.ops.object.convert(target='MESH')
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.name not in cutters]
sel_only(meshes)
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
for o in list(bpy.data.objects):
    if o.type != 'MESH' or o.name in cutters:
        bpy.data.objects.remove(o, do_unlink=True)

# 5) 재질별로 분리 → (재질, 지붕여부)로 다시 합치기
meshes = list(bpy.data.objects)
sel_only(meshes)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='MATERIAL')
bpy.ops.object.mode_set(mode='OBJECT')
groups = collections.defaultdict(list)
ROOF_PREFIX = tuple(p.strip() for p in A.roof_prefix.split(',') if p.strip())
for o in bpy.data.objects:
    if not o.data.polygons:
        bpy.data.objects.remove(o, do_unlink=True); continue
    zs = [(o.matrix_world @ v.co).z for v in o.data.vertices]
    roof = (min(zs) >= A.roof_z or bool(o.get('roof'))   # 벽 윗선 근처 이상(천장·조명) 또는 생성기가 지붕으로 표시한 부품
            or (bool(ROOF_PREFIX) and o.name.startswith(ROOF_PREFIX)))
    mat = o.material_slots[0].material if o.material_slots else None
    groups[(mat.name if mat else "", roof)].append(o)
for (mname, roof), objs in groups.items():
    sel_only(objs)
    if len(objs) > 1: bpy.ops.object.join()
    j = vl.objects.active
    j.name = ("지붕_" if roof else "") + (mname or "무재질")
    if roof: j["roof"] = 1
# 6) 원점 맞춤: 홈플래너 도면 (0,0) = 블렌더 (origin-x, origin-y)
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
