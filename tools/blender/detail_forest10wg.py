# FOREST10-WG 디테일 모델 — 도면 자동 모델(plan_to_blend.py 결과)에 카탈로그 실사 사진대로 외부·내부 디테일을 입힘
#
#   실행:  python tools/blender/detail_forest10wg.py -- 기본.blend 도면.json 출력.blend [--preview 폴더]
#   사진 판독 사양: tools/blender/briefs/FOREST10-WG.md
#   좌표: 블렌더 X = 도면 x/1000, Y = -도면 y/1000, 땅 Z=0 (바닥 윗면 0.30, 천장 2.70)
import bpy
_ = bpy.app.version
import bmesh, json, math, sys, os, argparse, re
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('base'); ap.add_argument('plan'); ap.add_argument('out')
ap.add_argument('--lib', default=os.path.join(os.path.dirname(__file__), '..', '..', 'models', 'src', 'seum-hwangto.blend'))
ap.add_argument('--preview', default='')
ap.add_argument('--shots', default='ext,ext2,liv,liv2,bed,kit')
ap.add_argument('--samples', type=int, default=40)
A = ap.parse_args(argv)

bpy.ops.wm.open_mainfile(filepath=os.path.abspath(A.base))
D = json.load(open(A.plan, encoding='utf-8'))
sc = bpy.context.scene
col = bpy.data.objects['외벽'].users_collection[0]
F, H = 0.30, 2.40
FL, CE = F, F + H            # 바닥 윗면, 천장 아랫면
TE, TI = 0.15, 0.10
X0, X1, Y0, Y1 = 0.0, 10.0, -3.5, 0.0
PX1, PX2 = 2.41, 8.26          # 침실 | 거실·주방 | 욕실 칸막이 중심
WHITE_TO = 3.0                 # 정면 화이트 골강판 구간 끝 (사진: 미닫이창 프레임 왼쪽까지)
EAST_GRAY = -2.6               # 동쪽 벽 남쪽 끝 그레이 패널 구간 (y < 이 값)


def hexrgb(h, a=1.0):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x ** 2.2 for x in c] + [a]


# ---------------------------------------------------------------- 재질
LIB = {}
want = ['오크장판', '편백루바_천장', 'PVC창틀_백색', '도어락_본체_유광블랙', '도어락_레버_새틴', '합성데크', '다운라이트_테두리']
with bpy.data.libraries.load(os.path.abspath(A.lib), link=False) as (src, dst):
    dst.materials = [n for n in want if n in src.materials]
for m in dst.materials:
    if m: LIB[m.name] = m

MATS = {}
def plain(name, color, rough=0.6, metal=0.0, emit=None, strength=4.0, alpha=1.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = hexrgb(color)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = hexrgb(emit); b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    m.diffuse_color = hexrgb(color)
    MATS[name] = m
    return m

def lib(src, name, color):
    if name in MATS: return MATS[name]
    m = LIB.get(src)
    m = m.copy() if m else plain(name + '_tmp', color)
    m.name = name; m.diffuse_color = hexrgb(color)
    MATS[name] = m
    return m

def _nodes(m):
    nt = m.node_tree; return nt, nt.nodes, nt.links, nt.nodes.get('Principled BSDF')

def _hcoord(N, Lk):
    """벽 가로 좌표 = x + y (벽이 X 방향이든 Y 방향이든 한쪽은 상수라 그대로 이어짐), 세로 = z"""
    tc = N.new('ShaderNodeTexCoord'); sx = N.new('ShaderNodeSeparateXYZ'); Lk.new(tc.outputs['Object'], sx.inputs['Vector'])
    ad = N.new('ShaderNodeMath'); ad.operation = 'ADD'; Lk.new(sx.outputs['X'], ad.inputs[0]); Lk.new(sx.outputs['Y'], ad.inputs[1])
    cb = N.new('ShaderNodeCombineXYZ'); Lk.new(ad.outputs[0], cb.inputs['X']); Lk.new(sx.outputs['Z'], cb.inputs['Y'])
    return cb, ad, sx, tc

def ribbed(name, color, pitch=0.076, rough=0.42, metal=0.3):
    """세로 골강판 — 골 간격 pitch(m), 골 음영을 색으로"""
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt, N, Lk, b = _nodes(m)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    cb, ad, sx, tc = _hcoord(N, Lk)
    mul = N.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 1 / pitch
    Lk.new(ad.outputs[0], mul.inputs[0])
    fr = N.new('ShaderNodeMath'); fr.operation = 'FRACT'; Lk.new(mul.outputs[0], fr.inputs[0])
    base = hexrgb(color)[:3]; sh = lambda k: [min(1.0, c * k) for c in base] + [1.0]
    ramp = N.new('ShaderNodeValToRGB'); el = ramp.color_ramp.elements
    stops = [(0.0, 0.80), (0.18, 1.0), (0.42, 1.0), (0.5, 0.72), (0.58, 0.9), (1.0, 0.80)]
    el[0].position, el[0].color = stops[0][0], sh(stops[0][1]); el[1].position, el[1].color = stops[-1][0], sh(stops[-1][1])
    for p, k in stops[1:-1]:
        e = el.new(p); e.color = sh(k)
    Lk.new(fr.outputs[0], ramp.inputs['Fac'])
    Lk.new(ramp.outputs['Color'], b.inputs['Base Color'])
    m.diffuse_color = hexrgb(color); MATS[name] = m
    return m

def brick_panel(name, color, mortar, bw=0.21, bh=0.07, rough=0.75, metal=0.15):
    """벽돌무늬(스톤 엠보) 강판 패널"""
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt, N, Lk, b = _nodes(m)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    cb, *_ = _hcoord(N, Lk)
    br = N.new('ShaderNodeTexBrick')
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Brick Width'].default_value = bw; br.inputs['Row Height'].default_value = bh
    br.inputs['Mortar Size'].default_value = 0.004; br.inputs['Mortar Smooth'].default_value = 0.3
    br.offset = 0.5; br.squash = 1.0
    c = hexrgb(color)
    br.inputs['Color1'].default_value = [x * 1.04 for x in c[:3]] + [1]
    br.inputs['Color2'].default_value = [x * 0.95 for x in c[:3]] + [1]
    br.inputs['Mortar'].default_value = hexrgb(mortar)
    br.inputs['Bias'].default_value = 0.0
    Lk.new(cb.outputs[0], br.inputs['Vector'])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 60.0; nz.inputs['Detail'].default_value = 6
    Lk.new(cb.outputs[0], nz.inputs['Vector'])
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 0.25
    Lk.new(br.outputs['Color'], mix.inputs['A']); Lk.new(nz.outputs['Color'], mix.inputs['B'])
    Lk.new(mix.outputs['Result'], b.inputs['Base Color'])
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.35
    Lk.new(br.outputs['Fac'], bump.inputs['Height']); Lk.new(bump.outputs['Normal'], b.inputs['Normal'])
    m.diffuse_color = hexrgb(color); MATS[name] = m
    return m

def tiles(name, color, grout, tw=0.6, th=0.3, floor=False, rough=0.35):
    """타일 — 벽(가로 x+y, 세로 z) 또는 바닥(x, y)"""
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt, N, Lk, b = _nodes(m)
    b.inputs['Roughness'].default_value = rough
    if floor:
        tc = N.new('ShaderNodeTexCoord'); vec = tc.outputs['Object']
    else:
        cb, *_ = _hcoord(N, Lk); vec = cb.outputs[0]
    br = N.new('ShaderNodeTexBrick'); br.offset = 0.0 if floor else 0.5
    br.inputs['Scale'].default_value = 1.0; br.inputs['Brick Width'].default_value = tw; br.inputs['Row Height'].default_value = th
    br.inputs['Mortar Size'].default_value = 0.003
    c = hexrgb(color)
    br.inputs['Color1'].default_value = c; br.inputs['Color2'].default_value = [x * 0.94 for x in c[:3]] + [1]
    br.inputs['Mortar'].default_value = hexrgb(grout)
    Lk.new(vec, br.inputs['Vector'])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 25.0
    Lk.new(vec, nz.inputs['Vector'])
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 0.12
    Lk.new(br.outputs['Color'], mix.inputs['A']); Lk.new(nz.outputs['Color'], mix.inputs['B'])
    Lk.new(mix.outputs['Result'], b.inputs['Base Color'])
    m.diffuse_color = hexrgb(color); MATS[name] = m
    return m

def stripes(name, color, dark, z0, period, frac=0.03, axis='Z', rough=0.5):
    """가로 줄눈(현관문 우드 패널) — axis 좌표 (z0 기준) period 마다 어두운 홈"""
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt, N, Lk, b = _nodes(m)
    b.inputs['Roughness'].default_value = rough
    tc = N.new('ShaderNodeTexCoord'); sx = N.new('ShaderNodeSeparateXYZ'); Lk.new(tc.outputs['Object'], sx.inputs['Vector'])
    sub = N.new('ShaderNodeMath'); sub.operation = 'SUBTRACT'; sub.inputs[1].default_value = z0
    Lk.new(sx.outputs[axis], sub.inputs[0])
    mul = N.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 1 / period; Lk.new(sub.outputs[0], mul.inputs[0])
    fr = N.new('ShaderNodeMath'); fr.operation = 'FRACT'; Lk.new(mul.outputs[0], fr.inputs[0])
    ramp = N.new('ShaderNodeValToRGB'); el = ramp.color_ramp.elements; ramp.color_ramp.interpolation = 'CONSTANT'
    el[0].position, el[0].color = 0.0, hexrgb(dark); el[1].position, el[1].color = frac, hexrgb(color)
    Lk.new(fr.outputs[0], ramp.inputs['Fac'])
    # 나뭇결
    wv = N.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'X'
    wv.inputs['Scale'].default_value = 3.0; wv.inputs['Distortion'].default_value = 6.0; wv.inputs['Detail'].default_value = 4
    Lk.new(tc.outputs['Object'], wv.inputs['Vector'])
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 0.18
    Lk.new(ramp.outputs['Color'], mix.inputs['A']); Lk.new(wv.outputs['Color'], mix.inputs['B'])
    Lk.new(mix.outputs['Result'], b.inputs['Base Color'])
    m.diffuse_color = hexrgb(color); MATS[name] = m
    return m

def wood(name, color, scale=4.0, rough=0.55):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt, N, Lk, b = _nodes(m)
    b.inputs['Roughness'].default_value = rough
    tc = N.new('ShaderNodeTexCoord')
    wv = N.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'Z'
    wv.inputs['Scale'].default_value = scale; wv.inputs['Distortion'].default_value = 2.5; wv.inputs['Detail'].default_value = 5
    Lk.new(tc.outputs['Object'], wv.inputs['Vector'])
    c = hexrgb(color)
    ramp = N.new('ShaderNodeValToRGB'); el = ramp.color_ramp.elements
    el[0].color = [x * 0.8 for x in c[:3]] + [1]; el[1].color = [min(1, x * 1.12) for x in c[:3]] + [1]
    Lk.new(wv.outputs['Fac'], ramp.inputs['Fac']); Lk.new(ramp.outputs['Color'], b.inputs['Base Color'])
    m.diffuse_color = c; MATS[name] = m
    return m

def checker(name, c1, c2, s=0.04):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt, N, Lk, b = _nodes(m)
    b.inputs['Roughness'].default_value = 0.9
    tc = N.new('ShaderNodeTexCoord'); ck = N.new('ShaderNodeTexChecker'); ck.inputs['Scale'].default_value = 1 / s
    ck.inputs['Color1'].default_value = hexrgb(c1); ck.inputs['Color2'].default_value = hexrgb(c2)
    Lk.new(tc.outputs['Object'], ck.inputs['Vector']); Lk.new(ck.outputs['Color'], b.inputs['Base Color'])
    m.diffuse_color = hexrgb(c1); MATS[name] = m
    return m

# 기본 모델 재질 다듬기
def recolor(name, color, rough=None, metal=None):
    m = bpy.data.materials.get(name)
    if not m: return
    b = m.node_tree.nodes.get('Principled BSDF')
    if b and not b.inputs['Base Color'].is_linked: b.inputs['Base Color'].default_value = hexrgb(color)
    if b and rough is not None: b.inputs['Roughness'].default_value = rough
    if b and metal is not None: b.inputs['Metallic'].default_value = metal
    m.diffuse_color = hexrgb(color)

recolor('창틀', '#2f3237', 0.4, 0.2)
recolor('창몰딩', '#2f3237')
recolor('후레싱', '#5b5e63', 0.5, 0.25)
recolor('징크', '#3d4146', 0.55, 0.25)   # 0.3 이상이면 웹에서 하늘 반사로 파랗게 보임
recolor('실내벽', '#efeeea', 0.85)
recolor('천장', '#f6f5f2', 0.9)
recolor('문틀', '#2f3237')
recolor('하부_스커트', '#34363a', 0.55, 0.35)
# 오크장판 → 사진처럼 밝은 그레이 오크
fm = bpy.data.materials.get('바닥_마루')
if fm:
    for n in fm.node_tree.nodes:
        if n.bl_idname == 'ShaderNodeRGB': n.outputs[0].default_value = hexrgb('#c9bfb1')
    fm.diffuse_color = hexrgb('#c9bfb1')

M = {
    'white_rib': ribbed('외장_골강판_화이트', '#e9e8e3'),
    'gray_panel': brick_panel('외장_패널_그레이', '#63666c', '#55575c', bw=0.16, bh=0.055),
    'trim': plain('외장_트림', '#6b6e73', 0.45, 0.4),
    'black': plain('외장_장식바', '#26272a', 0.4, 0.5),
    'skirt': bpy.data.materials.get('하부_스커트') or plain('하부_스커트', '#34363a', 0.55, 0.35),
    'block': plain('받침블록', '#b9b7b1', 0.95),
    'soffit': ribbed('처마밑', '#d9caa4', pitch=0.15, rough=0.6, metal=0.1),
    'deck': lib('합성데크', '데크', '#6b5444'),
    'deckframe': plain('데크_테두리', '#3a3b3e', 0.5, 0.4),
    'pvc_in': lib('PVC창틀_백색', '창틀_실내', '#f2f2ef'),
    'silver': plain('창틀_실버', '#9ea3a8', 0.35, 0.6),
    'door_wood': stripes('현관문_우드', '#8c6a4b', '#26272a', FL + 0.012, 0.408, frac=0.025),
    'door_in': plain('현관문_실내', '#3a3c40', 0.45, 0.2),
    'lock': lib('도어락_본체_유광블랙', '도어락', '#151515'),
    'idoor': plain('실내문', '#f1f0ec', 0.5),
    'iframe': plain('실내문틀', '#f4f3f0', 0.5),
    'chrome': plain('크롬', '#d6d8da', 0.15, 1.0),
    'lamp_w': plain('벽등_화이트', '#f3f3f1', 0.5),
    'glow': plain('조명_발광', '#fff1dc', 0.5, 0.0, emit='#ffe2b8', strength=6.0),
    'cove_glow': plain('간접등_발광', '#ffd9a0', 0.5, 0.0, emit='#ffc27a', strength=10.0),
    'wall_gray': plain('실내벽_그레이', '#b8b9b4', 0.85),
    'bath_tile': tiles('욕실_타일벽', '#d9d3c7', '#c9c3b7'),
    'slate': tiles('바닥_슬레이트', '#5a5e63', '#43464a', 0.3, 0.3, floor=True, rough=0.5),
    'pine': lib('편백루바_천장', '욕실_천장', '#d9b98a'),
    'slat': wood('슬랫_오크', '#c49b6c'),
    'slat_bg': plain('슬랫_배경', '#5f4b39', 0.8),
    'oak': wood('오크_상판', '#c8a277', scale=6.0),
    'white_mat': plain('가구_화이트', '#f3f2ee', 0.45),
    'sage': plain('주방_하부장', '#b7c1ad', 0.5),
    'quartz': plain('주방_상판', '#f0efeb', 0.25),
    'steel': plain('스텐', '#c3c6c9', 0.3, 0.9),
    'glass_black': plain('인덕션_유리', '#121314', 0.08, 0.0),
    'subway': tiles('주방_타일', '#f4f3ef', '#d8d6d0', 0.15, 0.075, rough=0.15),
    'fabric': plain('소파_패브릭', '#b4a998', 0.95),
    'metal_black': plain('철제_블랙', '#1f2022', 0.4, 0.6),
    'armwood': wood('팔걸이_우드', '#a0703f', scale=8.0),
    'rug': plain('러그', '#eceae4', 1.0),
    'brass': plain('황동', '#b8995c', 0.3, 0.9),
    'tint_glass': plain('유리_브론즈', '#8b6a4e', 0.05, 0.0, alpha=0.55),
    'stool': plain('스툴_시트', '#c9c7c2', 0.7),
    'bedding': plain('침구_화이트', '#f4f3f0', 0.95),
    'pillow': plain('베개_그레이', '#3f4145', 0.95),
    'runner': checker('러너_체크', '#1d3b2c', '#3c4a35', 0.05),
    'porcelain': plain('도기', '#f6f6f4', 0.12),
    'mirror': plain('거울', '#d8dde0', 0.02, 1.0),
    'fan': plain('실링팬', '#f4f4f2', 0.4),
}

# ---------------------------------------------------------------- 메시 헬퍼
def new_obj(name, me, mats):
    for m in mats: me.materials.append(m)
    o = bpy.data.objects.new(name, me); col.objects.link(o); return o

def box(name, x0, y0, z0, x1, y1, z1, mat, bevel=0.0, seg=2):
    x0, x1 = sorted((x0, x1)); y0, y1 = sorted((y0, y1)); z0, z1 = sorted((z0, z1))
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector(((x0 + x1) / 2 + v.co.x * (x1 - x0), (y0 + y1) / 2 + v.co.y * (y1 - y0), (z0 + z1) / 2 + v.co.z * (z1 - z0)))
    bm.to_mesh(me); bm.free()
    o = new_obj(name, me, [mat])
    if bevel > 0:
        md = o.modifiers.new('bevel', 'BEVEL'); md.width = bevel; md.segments = seg; md.limit_method = 'NONE'
    return o

def cyl(name, cx, cy, z0, z1, r, mat, n=32, rx=None, ry=None):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=n, radius1=1.0, radius2=1.0, depth=1.0)
    for v in bm.verts:
        v.co = Vector((cx + v.co.x * (rx or r), cy + v.co.y * (ry or r), (z0 + z1) / 2 + v.co.z * (z1 - z0)))
    bm.to_mesh(me); bm.free()
    o = new_obj(name, me, [mat])
    for p in o.data.polygons: p.use_smooth = len(p.vertices) == 4
    return o

def multi_box(name, rects, mat):
    """여러 상자를 한 오브젝트로 (슬랫 등)"""
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    for (x0, y0, z0, x1, y1, z1) in rects:
        r = bmesh.ops.create_cube(bm, size=1.0)
        for v in r['verts']:
            v.co = Vector(((x0 + x1) / 2 + v.co.x * abs(x1 - x0), (y0 + y1) / 2 + v.co.y * abs(y1 - y0), (z0 + z1) / 2 + v.co.z * abs(z1 - z0)))
    bm.to_mesh(me); bm.free()
    return new_obj(name, me, [mat])

def rot_z(o, ang, pivot):
    o.data.transform(Matrix.Translation(Vector(pivot)) @ Matrix.Rotation(ang, 4, 'Z') @ Matrix.Translation(-Vector(pivot)))

def mat_index(o, m):
    for i, s in enumerate(o.data.materials):
        if s == m: return i
    o.data.materials.append(m); return len(o.data.materials) - 1

# ---------------------------------------------------------------- 1) 외벽 마감 — 화이트 골강판 / 그레이 벽돌무늬 패널
def split(o, planes):
    bm = bmesh.new(); bm.from_mesh(o.data)
    for co, no in planes:
        g = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=g, plane_co=co, plane_no=no)
    bm.to_mesh(o.data); bm.free()

EXT_NAMES = {'외장_사이딩_X', '외장_사이딩_Y'}
for wn in ('외벽', '외벽_상부'):
    o = bpy.data.objects[wn]
    split(o, [((WHITE_TO, 0, 0), (1, 0, 0)), ((0, EAST_GRAY, 0), (0, 1, 0))])
    iw, ig = mat_index(o, M['white_rib']), mat_index(o, M['gray_panel'])
    for p in o.data.polygons:
        mn = o.data.materials[p.material_index].name
        if mn not in EXT_NAMES: continue
        n, c = p.normal, p.center
        if abs(n.z) > 0.7:
            p.material_index = iw; continue
        if abs(n.y) >= abs(n.x):       # 남·북 벽
            p.material_index = ig if c.x > WHITE_TO else iw
        elif n.x < 0:                    # 서쪽 벽
            p.material_index = iw
        else:                            # 동쪽 벽
            p.material_index = ig if c.y < EAST_GRAY else iw
for o in [ob for ob in col.objects if ob.name.startswith('박공벽')]:
    iw = mat_index(o, M['white_rib'])
    for p in o.data.polygons:
        if o.data.materials[p.material_index].name in EXT_NAMES: p.material_index = iw

# ---------------------------------------------------------------- 2) 실내 벽 마감 — 침실·거실 남쪽 벽 연그레이, 화장실·샤워실 타일
def inner_finish(o):
    ig, it = mat_index(o, M['wall_gray']), mat_index(o, M['bath_tile'])
    for p in o.data.polygons:
        if o.data.materials[p.material_index].name != '실내벽' or abs(p.normal.z) > 0.7: continue
        c, n = p.center, p.normal
        if c.x > PX2 + 0.03 and (c.y > -1.29 or c.y < -2.21):
            p.material_index = it
        elif c.x < PX1:
            p.material_index = ig
        elif c.y < -3.3 and PX1 < c.x < 6.92 and n.y > 0.7:
            p.material_index = ig
for wn in ('외벽', '칸막이'):
    if wn in bpy.data.objects: inner_finish(bpy.data.objects[wn])

# 바닥·천장
for o in list(col.objects):
    if o.name.startswith('바닥_'):
        if any(k in o.name for k in ('현관', '화장실', '샤워실')):
            o.data.materials[0] = M['slate']
        elif '세면대' in o.name:
            o.data.materials[0] = bpy.data.materials['바닥_마루']
    if o.name.startswith('천장_') and any(k in o.name for k in ('화장실', '샤워실', '세면대')):
        o.data.materials[0] = M['pine']

# ---------------------------------------------------------------- 3) 하부 — 차콜 스커트 띠 + 콘크리트 받침블록 (사진처럼 바닥이 떠 보이게)
if '하부' in bpy.data.objects:
    bpy.data.objects.remove(bpy.data.objects['하부'], do_unlink=True)
SK0, SK1 = F - 0.17, F - 0.05
box('하부_스커트', X0 - 0.01, Y0 - 0.01, SK0, X1 + 0.01, Y0 + 0.02, SK1, M['skirt'])
box('하부_스커트', X0 - 0.01, Y1 - 0.02, SK0, X1 + 0.01, Y1 + 0.01, SK1, M['skirt'])
box('하부_스커트', X0 - 0.01, Y0, SK0, X0 + 0.02, Y1, SK1, M['skirt'])
box('하부_스커트', X1 - 0.02, Y0, SK0, X1 + 0.01, Y1, SK1, M['skirt'])
box('하부_밑판', X0 + 0.02, Y0 + 0.02, SK0 + 0.02, X1 - 0.02, Y1 - 0.02, SK0 + 0.04, M['skirt'])
for x in (0.25, 2.2, 4.2, 6.2, 8.2, 9.75):
    for y in (-0.2, -3.3):
        box('받침블록', x - 0.2, y - 0.1, 0.0, x + 0.2, y + 0.1, SK0, M['block'])

# ---------------------------------------------------------------- 4) 외부 트림·장식
TO = 0.015       # 벽면에서 튀어나온 두께
SOF = 2.75       # 처마밑 높이(벽 노출 끝)
for yy, sgn in ((Y0, -1), (Y1, 1)):        # 화이트/그레이 경계 트림 (남·북)
    box('외장_트림', WHITE_TO - 0.04, yy, F - 0.05, WHITE_TO + 0.04, yy + sgn * TO, SOF, M['trim'])
box('외장_트림', X1, EAST_GRAY - 0.04, F - 0.05, X1 + TO, EAST_GRAY + 0.04, SOF, M['trim'])
# 미닫이창 둘레 박스 프레임 (사진: 창 좌우·위 그레이 띠)
lw = next(o for o in D['openings'] if o['winType'] in ('balcony', 'slide'))
lr = next(r for r in D['rooms'] if r['id'] == lw['roomId'])
cx = (lr['x'] + lw['pos']) / 1000; hw = lw['w'] / 2000; ztop = F + (lw.get('sill') or 0) / 1000 + lw['h'] / 1000
box('외장_트림', cx - hw - 0.11, Y0, F - 0.05, cx - hw - 0.01, Y0 - TO, SOF, M['trim'])
box('외장_트림', cx + hw + 0.01, Y0, F - 0.05, cx + hw + 0.11, Y0 - TO, SOF, M['trim'])
box('외장_트림', cx - hw - 0.11, Y0, ztop + 0.01, cx + hw + 0.11, Y0 - TO, SOF, M['trim'])
# 처마 아래 벽 상단 띠
for yy, sgn in ((Y0, -1), (Y1, 1)):
    box('외장_상단띠', X0 - 0.02, yy, SOF - 0.06, X1 + 0.02, yy + sgn * TO, SOF, M['trim'])
# 장식 세로 바
for x in (0.32, 9.60):
    box('외장_장식바', x - 0.015, Y0, SOF - 0.25 - 0.95, x + 0.015, Y0 - 0.03, SOF - 0.25, M['black'])
# 현관 옆 벽등 (흰 큐브)
box('외부벽등', 6.62, Y0, 2.15, 6.72, Y0 - 0.07, 2.30, M['lamp_w'], bevel=0.008)
box('외부벽등_발광', 6.635, Y0 - 0.01, 2.145, 6.705, Y0 - 0.06, 2.152, M['glow'])
# 두꺼운 처마 후레싱 띠 (사진의 굵은 회색 처마선)
for yy, d in ((Y0 - 0.45, -1), (Y1 + 0.45, 1)):
    o = box('지붕_후레싱띠', X0 - 0.37, yy, 2.64, X1 + 0.37, yy + d * 0.03, 2.90, bpy.data.materials['후레싱']); o['roof'] = 1

# ---------------------------------------------------------------- 5) 데크 (현관 앞, 블록 위)
DX0, DX1, DY0, DY1, DT = 5.6, 9.2, -4.4, -3.52, 0.24
y = DY0 + 0.005; i = 0
while y + 0.14 <= DY1 + 1e-6:
    box('데크판', DX0 + 0.005, y, DT - 0.025, DX1 - 0.005, y + 0.14, DT, M['deck']); y += 0.146; i += 1
box('데크테', DX0, DY0, DT - 0.13, DX1, DY0 + 0.04, DT - 0.025, M['deckframe'])
box('데크테', DX0, DY0, DT - 0.13, DX0 + 0.04, DY1, DT - 0.025, M['deckframe'])
box('데크테', DX1 - 0.04, DY0, DT - 0.13, DX1, DY1, DT - 0.025, M['deckframe'])
for x in (DX0 + 0.2, (DX0 + DX1) / 2, DX1 - 0.2):
    box('받침블록', x - 0.2, DY0 + 0.05, 0.0, x + 0.2, DY0 + 0.25, DT - 0.13, M['block'])

# 사각 테두리 부재(상·하·좌·우)가 모서리에서 겹치면 렌더에서 검게 깨짐 → 좌·우 기둥을 상·하 사이로 줄임
def unoverlap_frames():
    names = {o.name for o in col.objects}
    for o in list(col.objects):
        m = re.match(r'^(.*)_상(\.\d+)?$', o.name)
        if not m: continue
        base, suf = m.group(1), m.group(2) or ''
        zs = [v.co.z for v in o.data.vertices]; fw = max(zs) - min(zs); top = min(zs)
        bot = bpy.data.objects.get(base + '_하' + suf)
        bz = max(v.co.z for v in bot.data.vertices) if bot else None
        for side in ('_좌', '_우'):
            s_ = bpy.data.objects.get(base + side + suf)
            if not s_: continue
            for v in s_.data.vertices:
                if v.co.z > top: v.co.z = top
                if bz is not None and v.co.z < bz: v.co.z = bz
            s_.data.update()
unoverlap_frames()

# ---------------------------------------------------------------- 6) 창호 투톤(바깥 차콜·안 흰색), 실내 몰딩, 문 재질
rooms = {r['id']: r for r in D['rooms']}
def frame_of(o):
    r = rooms[o['roomId']]; s, pos = o['side'], o['pos']
    if s in 'ns':
        c = Vector(((r['x'] + pos) / 1000, -(r['y'] + (0 if s == 'n' else r['d'])) / 1000, 0))
        u = Vector((1, 0, 0)); n = Vector((0, 1, 0)) if s == 'n' else Vector((0, -1, 0))
    else:
        c = Vector(((r['x'] + (0 if s == 'w' else r['w'])) / 1000, -(r['y'] + pos) / 1000, 0))
        u = Vector((0, -1, 0)); n = Vector((-1, 0, 0)) if s == 'w' else Vector((1, 0, 0))
    ext = (c + n * 0.08)
    exterior = not (X0 < ext.x < X1 and Y0 < ext.y < Y1)
    return c, u, n, exterior

DOORS = {'door', 'swingDoor', 'doubleDoor', 'slideDoor', 'glassSlide', 'pocketDoor', 'pivotDoor', 'folding', 'foldSwing', 'balcony', 'slide'}
for k, op in enumerate(D['openings']):
    c, u, n, ext = frame_of(op)
    t = op['winType']; w = op['w'] / 1000; z0 = F + (op.get('sill') or 0) / 1000; z1 = z0 + op['h'] / 1000
    objs = [o for o in col.objects if o.name.startswith(f'개구부{k:02d}_')]
    for o in objs:
        mn = o.data.materials[0].name if o.data.materials else ''
        if ext:
            if mn in ('창틀', '문틀'):
                iw = mat_index(o, M['pvc_in'] if t != 'door' else bpy.data.materials['문틀'])
                isv = mat_index(o, M['silver']) if t in ('balcony', 'slide') else None
                for p in o.data.polygons:
                    d = p.normal.dot(n)
                    if d < -0.5: p.material_index = iw
                    elif d > 0.5 and isv is not None: p.material_index = isv
            if mn == '문짝' and t == 'door':
                o.data.materials[0] = M['door_wood']; ii = mat_index(o, M['door_in'])
                for p in o.data.polygons:
                    if p.normal.dot(n) < -0.5: p.material_index = ii
            if '도어락' in o.name: o.data.materials[0] = M['lock']
        else:
            if mn == '문짝': o.data.materials[0] = M['idoor']
            if mn == '문틀': o.data.materials[0] = M['iframe']
        if '레버' in o.name: o.data.materials[0] = M['chrome']
    # 실내 몰딩(케이싱) — 안쪽 벽면에 흰 테두리
    is_door = t in DOORS
    def casing(v_face, sgn):
        cw, ct = 0.07, 0.012
        def part(u0, u1, z_0, z_1):
            pts = [c + u * uu + n * (v_face + sgn * vv) + Vector((0, 0, zz)) for uu, vv, zz in
                   ((u0, 0, z_0), (u1, 0, z_0), (u1, ct, z_0), (u0, ct, z_0), (u0, 0, z_1), (u1, 0, z_1), (u1, ct, z_1), (u0, ct, z_1))]
            me = bpy.data.meshes.new('몰딩'); bm = bmesh.new()
            vs = [bm.verts.new(p) for p in pts]
            for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
                bm.faces.new([vs[i] for i in f])
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
            new_obj(f'실내몰딩{k:02d}', me, [M['iframe']])
        zb = F if is_door else z0 - cw
        part(-w / 2 - cw, -w / 2, zb if is_door else z0, z1); part(w / 2, w / 2 + cw, zb if is_door else z0, z1)
        part(-w / 2 - cw, w / 2 + cw, z1, z1 + cw)
        if not is_door: part(-w / 2 - cw, w / 2 + cw, z0 - cw, z0)
    if ext: casing(-TE, -1)
    else:
        casing(-TI / 2, -1); casing(TI / 2, 1)

# ---------------------------------------------------------------- 7) 조명 — 다운라이트·간접등·벽등 (블렌더 라이트 = 웹 조명)
def light(name, kind, pos, energy, color, rot=(0, 0, 0), size=None, spot=None):
    L = bpy.data.lights.new(name, kind); L.energy = energy; L.color = color
    if kind == 'SPOT': L.spot_size = spot or math.radians(110); L.spot_blend = 0.8
    if kind == 'AREA':
        L.shape = 'RECTANGLE'; L.size, L.size_y = size
    if kind in ('POINT', 'SPOT'): L.shadow_soft_size = 0.05
    o = bpy.data.objects.new(name, L); col.objects.link(o); o.location = pos; o.rotation_euler = rot
    return o

WARM = (1.0, 0.86, 0.72)
DL = [(3.3, -1.0), (4.8, -1.0), (6.3, -1.0), (7.6, -1.0), (3.3, -2.6), (4.8, -2.6), (6.3, -2.6), (7.6, -2.75),
      (1.2, -0.9), (1.2, -1.85), (1.2, -2.8), (9.06, -0.7), (9.06, -1.75), (9.06, -2.85)]
for i, (x, y) in enumerate(DL):
    cyl('다운라이트_테두리', x, y, CE - 0.006, CE, 0.075, M['white_mat'], n=32)
    cyl('다운라이트_발광', x, y, CE - 0.008, CE - 0.005, 0.06, M['glow'], n=32)
    light(f'LT_DL{i + 1}', 'SPOT', (x, y, CE - 0.02), 110 if i < 11 else 60, WARM)

def cove(name, x0, y0, x1, y1, lid):
    """천장 쪽 간접조명 몰딩 — 흰 박스 + 위쪽 LED 띠 + 위로 비추는 면광원"""
    box(name, x0, y0, CE - 0.16, x1, y1, CE - 0.10, M['white_mat'])
    if abs(x1 - x0) > abs(y1 - y0):
        box(name + '_LED', x0 + 0.02, (y0 + y1) / 2 - 0.02, CE - 0.10, x1 - 0.02, (y0 + y1) / 2 + 0.02, CE - 0.095, M['cove_glow'])
        light(lid, 'AREA', ((x0 + x1) / 2, (y0 + y1) / 2, CE - 0.09), 90 * abs(x1 - x0) / 5, (1.0, 0.78, 0.5), rot=(math.pi, 0, 0), size=(abs(x1 - x0), 0.05))
    else:
        box(name + '_LED', (x0 + x1) / 2 - 0.02, y0 + 0.02, CE - 0.10, (x0 + x1) / 2 + 0.02, y1 - 0.02, CE - 0.095, M['cove_glow'])
        light(lid, 'AREA', ((x0 + x1) / 2, (y0 + y1) / 2, CE - 0.09), 90 * abs(y1 - y0) / 5, (1.0, 0.78, 0.5), rot=(math.pi, 0, 0), size=(0.05, abs(y1 - y0)))
cove('간접몰딩_거실', PX1 + 0.05, Y0 + TE, PX2 - 0.05, Y0 + TE + 0.14, 'LT_COVE1')
cove('간접몰딩_침실', PX1 - 0.05 - 0.14, Y0 + TE, PX1 - 0.05, Y1 - TE, 'LT_COVE2')

# 실링팬 (거실 중앙)
FX, FY = 5.0, -1.6
cyl('실링팬', FX, FY, CE - 0.10, CE, 0.018, M['fan'], n=16)
cyl('실링팬', FX, FY, CE - 0.20, CE - 0.10, 0.10, M['fan'], n=32)
cyl('실링팬', FX, FY, CE - 0.215, CE - 0.20, 0.07, M['glow'], n=32)
for a in range(3):
    b = box('실링팬_날개', FX + 0.08, FY - 0.055, CE - 0.165, FX + 0.62, FY + 0.055, CE - 0.153, M['fan'], bevel=0.01)
    rot_z(b, math.radians(a * 120 + 15), (FX, FY, 0))

# ---------------------------------------------------------------- 8) 거실 서쪽 우드 슬랫 벽 + 바테이블 + 벽등
WX = PX1 + TI / 2                  # 칸막이 거실쪽 면
door_y0 = -1.25                    # 침실 문 + 몰딩 남쪽 끝
box('슬랫_배경', WX, Y0 + TE, FL, WX + 0.008, door_y0, CE, M['slat_bg'])
rects = []; yy = door_y0 - 0.012
while yy - 0.02 > Y0 + TE + 0.005:
    rects.append((WX + 0.008, yy - 0.02, FL, WX + 0.023, yy, CE)); yy -= 0.035
multi_box('슬랫_오크', rects, M['slat'])
TX0, TX1, TY0, TY1, TZ = WX + 0.03, WX + 0.42, -3.15, -1.40, FL + 0.93
box('바테이블_상판', TX0, TY0, TZ, TX1, TY1, TZ + 0.035, M['oak'], bevel=0.004)
for yy in (TY0 + 0.01, TY1 - 0.05):
    box('바테이블_프레임', TX0 + 0.02, yy, FL, TX1 - 0.02, yy + 0.04, TZ, M['white_mat'])
box('바테이블_프레임', TX0 + 0.02, TY0 + 0.01, TZ - 0.05, TX1 - 0.02, TY1 - 0.01, TZ, M['white_mat'])
for sy in (-1.85, -2.65):                   # 바스툴
    sx = TX1 + 0.32
    box('스툴_시트', sx - 0.2, sy - 0.2, FL + 0.62, sx + 0.2, sy + 0.2, FL + 0.68, M['stool'], bevel=0.025, seg=3)
    box('스툴_등받이', sx + 0.14, sy - 0.19, FL + 0.68, sx + 0.2, sy + 0.19, FL + 0.86, M['stool'], bevel=0.025, seg=3)
    for dx in (-0.16, 0.16):
        for dy in (-0.16, 0.16):
            cyl('스툴_다리', sx + dx, sy + dy, FL, FL + 0.62, 0.011, M['white_mat'], n=12)
    box('스툴_발판', sx - 0.16, sy - 0.17, FL + 0.25, sx + 0.16, sy + 0.17, FL + 0.265, M['white_mat'])
for i, sy in enumerate((-1.7, -2.9)):        # 블랙 큐브 벽등
    box('벽등_블랙', WX + 0.023, sy - 0.05, FL + 1.85, WX + 0.12, sy + 0.05, FL + 1.95, M['metal_black'], bevel=0.004)
    box('벽등_발광', WX + 0.03, sy - 0.04, FL + 1.948, WX + 0.11, sy + 0.04, FL + 1.952, M['glow'])
    box('벽등_발광', WX + 0.03, sy - 0.04, FL + 1.848, WX + 0.11, sy + 0.04, FL + 1.852, M['glow'])
    light(f'LT_WALL{i + 1}', 'POINT', (WX + 0.15, sy, FL + 1.9), 12, (1.0, 0.8, 0.6))

# ---------------------------------------------------------------- 9) 주방 (북쪽 벽)
KX0, KX1 = 5.2, PX2 - TI / 2
NY = Y1 - TE                       # 북쪽 벽 안쪽 면
KD = 0.6; KZ = FL + 0.85
WX0, WX1 = 6.7 - 0.7 - 0.07, 6.7 + 0.7 + 0.07   # 싱크 위 창 (+몰딩)
box('주방_걸레받이', KX0 + 0.02, NY - KD + 0.06, FL, KX1, NY, FL + 0.1, M['metal_black'])
box('주방_몸통', KX0, NY - KD + 0.02, FL + 0.1, KX1, NY, KZ - 0.04, M['sage'])
nd = round((KX1 - KX0) / 0.5); dw = (KX1 - KX0) / nd
for i in range(nd):
    box('주방_하부장', KX0 + i * dw + 0.002, NY - KD, FL + 0.103, KX0 + (i + 1) * dw - 0.002, NY - KD + 0.02, KZ - 0.043, M['sage'], bevel=0.002)
top = box('주방_상판', KX0 - 0.02, NY - KD - 0.025, KZ - 0.04, KX1, NY, KZ, M['quartz'], bevel=0.003)
cut = box('_cut', 6.37, NY - 0.52, KZ - 0.25, 7.03, NY - 0.10, KZ + 0.05, M['steel'])
md = top.modifiers.new('sink', 'BOOLEAN'); md.operation = 'DIFFERENCE'; md.object = cut; md.solver = 'EXACT'
bpy.context.view_layer.objects.active = top
for mm in list(top.modifiers):
    if mm.type == 'BOOLEAN': bpy.ops.object.modifier_apply(modifier=mm.name)
bpy.data.objects.remove(cut, do_unlink=True)
SB = KZ - 0.2   # 싱크볼 바닥
box('싱크볼', 6.37, NY - 0.52, SB, 7.03, NY - 0.10, SB + 0.01, M['steel'])
for r in ((6.37, NY - 0.52, 6.38, NY - 0.10), (7.02, NY - 0.52, 7.03, NY - 0.10), (6.37, NY - 0.52, 7.03, NY - 0.51), (6.37, NY - 0.11, 7.03, NY - 0.10)):
    box('싱크볼', r[0], r[1], SB, r[2], r[3], KZ, M['steel'])
cyl('수전', 6.85, NY - 0.06, KZ, KZ + 0.30, 0.016, M['chrome'], n=16)
box('수전', 6.85 - 0.012, NY - 0.06, KZ + 0.28, 6.85 + 0.012, NY - 0.26, KZ + 0.30, M['chrome'])
box('인덕션', 5.45, NY - 0.52, KZ, 6.05, NY - 0.08, KZ + 0.006, M['glass_black'], bevel=0.002)
for cx_ in (5.6, 5.9):
    cyl('인덕션_링', cx_, NY - 0.3, KZ + 0.006, KZ + 0.0065, 0.09, plain('인덕션_표시', '#4a4d52', 0.3), n=32)
# 백스플래시 타일 + 상부장
UZ = FL + 1.30
box('주방_타일', KX0, NY - 0.008, KZ, WX0, NY, UZ, M['subway'])
box('주방_타일', WX1, NY - 0.008, KZ, KX1, NY, UZ, M['subway'])
box('주방_타일', WX0, NY - 0.008, KZ, WX1, NY, F + 1.1 - 0.07, M['subway'])
for (ux0, ux1, uz0) in ((KX0, WX0, UZ), (WX0, WX1, F + 1.1 + 0.6 + 0.08), (WX1, KX1, UZ)):
    box('주방_상부장', ux0, NY - 0.33, uz0, ux1, NY, CE, M['white_mat'])
    nu = max(1, round((ux1 - ux0) / 0.45)); uw = (ux1 - ux0) / nu
    for i in range(nu):
        box('주방_상부장문', ux0 + i * uw + 0.002, NY - 0.35, uz0 + 0.002, ux0 + (i + 1) * uw - 0.002, NY - 0.33, CE - 0.002, M['white_mat'], bevel=0.002)
box('주방_후드', 5.40, NY - 0.40, UZ - 0.05, 6.10, NY - 0.02, UZ, M['steel'])
box('식기건조대', WX0 + 0.1, NY - 0.30, F + 1.1 + 0.62, WX1 - 0.1, NY - 0.18, F + 1.1 + 0.64, M['steel'])

# ---------------------------------------------------------------- 10) 거실 소파·러그·트롤리
SX0, SX1, SY0, SY1 = 2.75, 4.75, NY - 0.82, NY - 0.02
box('소파_좌방석', SX0 + 0.06, SY0 + 0.02, FL + 0.30, SX1 - 0.06, SY1 - 0.16, FL + 0.46, M['fabric'], bevel=0.035, seg=3)
for i in range(2):
    xa = SX0 + 0.08 + i * (SX1 - SX0 - 0.16) / 2
    box('소파_등쿠션', xa + 0.01, SY1 - 0.24, FL + 0.44, xa + (SX1 - SX0 - 0.16) / 2 - 0.01, SY1 - 0.03, FL + 0.80, M['fabric'], bevel=0.05, seg=3)
box('소파_프레임', SX0 + 0.04, SY0 + 0.02, FL + 0.26, SX1 - 0.04, SY1 - 0.02, FL + 0.30, M['metal_black'])
for x in (SX0 + 0.04, SX1 - 0.07):
    for y in (SY0 + 0.04, SY1 - 0.06):
        box('소파_다리', x, y, FL, x + 0.025, y + 0.025, FL + 0.26, M['metal_black'])
    box('소파_팔걸이기둥', x, SY0 + 0.06, FL + 0.30, x + 0.025, SY0 + 0.085, FL + 0.62, M['metal_black'])
    box('소파_팔걸이', x - 0.015, SY0 + 0.04, FL + 0.62, x + 0.04, SY1 - 0.08, FL + 0.65, M['armwood'], bevel=0.008)
box('러그', 3.3, -2.95, FL, 5.3, -1.35, FL + 0.012, M['rug'], bevel=0.004)
TX, TY = 4.3, -2.15
cyl('트롤리_상판', TX, TY, FL + 0.50, FL + 0.508, 0.22, M['tint_glass'], n=40, rx=0.30, ry=0.20)
cyl('트롤리_하판', TX, TY, FL + 0.18, FL + 0.19, 0.22, M['armwood'], n=40, rx=0.30, ry=0.20)
for a in range(4):
    ang = math.radians(45 + a * 90)
    cyl('트롤리_기둥', TX + math.cos(ang) * 0.27, TY + math.sin(ang) * 0.17, FL + 0.05, FL + 0.52, 0.008, M['brass'], n=10)

# ---------------------------------------------------------------- 11) 침실 — 퀸 침대(머리 남쪽 벽)
BX0, BX1, BY0, BY1 = 0.48, 2.02, Y0 + TE + 0.02, Y0 + TE + 2.07
box('침대_받침', BX0 + 0.02, BY0, FL, BX1 - 0.02, BY1, FL + 0.28, M['bedding'], bevel=0.02)
box('침대_매트리스', BX0, BY0, FL + 0.28, BX1, BY1, FL + 0.50, M['bedding'], bevel=0.05, seg=3)
box('침대_이불', BX0 - 0.06, BY0 + 0.45, FL + 0.30, BX1 + 0.06, BY1 + 0.06, FL + 0.55, M['bedding'], bevel=0.04, seg=3)
for x in (0.88, 1.62):
    b = box('침대_베개', x - 0.3, BY0 + 0.06, FL + 0.50, x + 0.3, BY0 + 0.44, FL + 0.66, M['pillow'], bevel=0.06, seg=3)
box('침대_러너', BX0 - 0.065, BY1 - 0.75, FL + 0.551, BX1 + 0.065, BY1 - 0.35, FL + 0.556, M['runner'])
box('침대_러너', BX0 - 0.07, BY1 - 0.75, FL + 0.25, BX0 - 0.065, BY1 - 0.35, FL + 0.556, M['runner'])
box('침대_러너', BX1 + 0.065, BY1 - 0.75, FL + 0.25, BX1 + 0.07, BY1 - 0.35, FL + 0.556, M['runner'])

# ---------------------------------------------------------------- 12) 현관 신발장
EX1 = PX2 - TI / 2
box('신발장', EX1 - 0.36, -3.33, FL + 0.08, EX1, -2.30, FL + 0.86, M['white_mat'])
for i in range(3):
    ya = -3.33 + i * 1.03 / 3
    box('신발장_문', EX1 - 0.375, ya + 0.002, FL + 0.083, EX1 - 0.36, ya + 1.03 / 3 - 0.002, FL + 0.857, M['white_mat'], bevel=0.002)
box('신발장_니치', EX1 - 0.36, -3.33, FL + 0.86, EX1, -2.30, FL + 0.88, M['oak'])        # 오픈 선반 바닥
box('신발장_니치', EX1 - 0.02, -3.33, FL + 0.88, EX1, -2.30, FL + 1.16, M['oak'])        # 뒤판
box('신발장_니치', EX1 - 0.36, -3.33, FL + 0.88, EX1, -3.31, FL + 1.16, M['oak'])        # 옆판
box('신발장_니치', EX1 - 0.36, -2.32, FL + 0.88, EX1, -2.30, FL + 1.16, M['oak'])
box('신발장_상판', EX1 - 0.37, -3.34, FL + 1.16, EX1, -2.29, FL + 1.19, M['oak'])
box('신발장_걸레받이', EX1 - 0.34, -3.32, FL, EX1, -2.31, FL + 0.08, M['metal_black'])

# ---------------------------------------------------------------- 13) 세면 알코브 — 우드 슬랫 + 달걀형 LED 거울 + 하부장·볼 세면대
AX = X1 - TE; AY0, AY1 = -2.21 + TI / 2, -1.29 - TI / 2
rects = []; yy = AY1 - 0.005
while yy - 0.02 > AY0:
    rects.append((AX - 0.023, yy - 0.02, FL, AX - 0.008, yy, CE)); yy -= 0.035
box('슬랫_배경', AX - 0.008, AY0, FL, AX, AY1, CE, M['slat_bg'])
multi_box('슬랫_오크', rects, M['slat'])
AYc = (AY0 + AY1) / 2
box('세면_하부장', AX - 0.48, AY0 + 0.03, FL + 0.08, AX - 0.023, AY1 - 0.03, FL + 0.78, M['white_mat'], bevel=0.003)
box('세면_상판', AX - 0.50, AY0 + 0.02, FL + 0.78, AX - 0.023, AY1 - 0.02, FL + 0.81, M['quartz'])
box('세면_볼', AX - 0.42, AYc - 0.22, FL + 0.81, AX - 0.12, AYc + 0.22, FL + 0.95, M['porcelain'], bevel=0.02, seg=3)
cyl('세면_수전', AX - 0.07, AYc, FL + 0.81, FL + 1.10, 0.014, M['chrome'], n=16)
box('세면_수전', AX - 0.07, AYc - 0.01, FL + 1.08, AX - 0.20, AYc + 0.01, FL + 1.10, M['chrome'])
def ellipse_plate(name, cx, cy, cz, rw, rh, thick, mat, n=48):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    top = [bm.verts.new((cx, cy + math.cos(a) * rw, cz + math.sin(a) * rh * (1.0 + 0.12 * math.sin(a)))) for a in [i * 2 * math.pi / n for i in range(n)]]
    bot = [bm.verts.new((cx - thick, v.co.y, v.co.z)) for v in top]
    bm.faces.new(top); bm.faces.new(list(reversed(bot)))
    for i in range(n):
        j = (i + 1) % n; bm.faces.new([top[i], bot[i], bot[j], top[j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    return new_obj(name, me, [mat])
ellipse_plate('거울_LED', AX - 0.026, AYc, FL + 1.50, 0.30, 0.43, 0.006, M['cove_glow'])
ellipse_plate('거울', AX - 0.035, AYc, FL + 1.50, 0.28, 0.41, 0.012, M['mirror'])
light('LT_WALL3', 'POINT', (AX - 0.25, AYc, FL + 1.5), 10, (1.0, 0.8, 0.6))

# ---------------------------------------------------------------- 14) 화장실 양변기 / 샤워실 수전
TYc = -0.72
box('양변기_수조', AX - 0.20, TYc - 0.20, FL + 0.40, AX - 0.01, TYc + 0.20, FL + 0.78, M['porcelain'], bevel=0.02)
cyl('양변기_몸통', AX - 0.42, TYc, FL, FL + 0.40, 0.18, M['porcelain'], n=40, rx=0.26, ry=0.19)
cyl('양변기_시트', AX - 0.44, TYc, FL + 0.40, FL + 0.43, 0.18, M['porcelain'], n=40, rx=0.28, ry=0.20)
box('휴지걸이', AX - 0.02, TYc + 0.33, FL + 0.70, AX, TYc + 0.47, FL + 0.82, M['chrome'])
SY = -2.85
box('샤워_레일', AX - 0.04, SY - 0.015, FL + 0.95, AX - 0.01, SY + 0.015, FL + 1.95, M['chrome'])
box('샤워_암', AX - 0.30, SY - 0.012, FL + 1.93, AX - 0.04, SY + 0.012, FL + 1.96, M['chrome'])
cyl('샤워_헤드', AX - 0.30, SY, FL + 1.90, FL + 1.93, 0.12, M['white_mat'], n=40)
box('샤워_수전', AX - 0.08, SY - 0.22, FL + 0.95, AX - 0.01, SY + 0.22, FL + 1.06, M['white_mat'], bevel=0.01)
cyl('샤워_핸드', AX - 0.12, SY + 0.08, FL + 1.35, FL + 1.55, 0.02, M['white_mat'], n=16)

# ---------------------------------------------------------------- 정리 + 저장
for o in col.objects:
    if o.type == 'MESH':
        for p in o.data.polygons:
            if len(p.vertices) > 4: p.use_smooth = False
# 렌더 배경(변환 때 제외)
bk = bpy.data.collections.get('Backdrop') or bpy.data.collections.new('Backdrop')
if bk.name not in sc.collection.children: sc.collection.children.link(bk)
for o in list(bk.objects): bpy.data.objects.remove(o, do_unlink=True)
g = bpy.data.meshes.new('Ground'); bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=30); bm.to_mesh(g); bm.free()
go = bpy.data.objects.new('Ground', g); bk.objects.link(go); go.location = (5, -2, -0.001)
g.materials.append(plain('잔디', '#6f8650', 0.95))
pv = bpy.data.meshes.new('Path'); bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1); bm.to_mesh(pv); bm.free()
po = bpy.data.objects.new('Paving', pv); bk.objects.link(po); po.scale = (3.0, 1.6, 1); po.location = (7.4, -5.3, 0.0005)
pv.materials.append(plain('판석', '#b3aca0', 0.9))
sun = bpy.data.objects.new('LT_Sun', bpy.data.lights.new('LT_Sun', 'SUN')); bk.objects.link(sun)
sun.data.energy = 3.5; sun.rotation_euler = (math.radians(48), 0, math.radians(-30)); sun.data.angle = math.radians(2)
wd = bpy.data.worlds.get('sky') or bpy.data.worlds.new('sky'); sc.world = wd; wd.use_nodes = True
bg = wd.node_tree.nodes.get('Background'); bg.inputs['Color'].default_value = (0.58, 0.72, 0.92, 1); bg.inputs['Strength'].default_value = 0.8
for o in list(col.objects):
    if o.type in ('CAMERA',) or o.name in ('sun', 'ground'): bpy.data.objects.remove(o, do_unlink=True)

SHOTS = {
    'ext':  ((3.2, -12.5, 2.4), (5.2, -1.8, 1.3), 30),
    'ext2': ((15.5, -9.0, 4.2), (5.0, -1.7, 1.2), 32),
    'liv':  ((7.7, -1.75, 1.45), (2.4, -1.6, 1.25), 16),
    'liv2': ((3.7, -3.05, 1.5), (8.2, -1.0, 1.15), 16),
    'bed':  ((2.2, -0.35, 1.7), (0.6, -3.3, 0.7), 16),
    'kit':  ((4.4, -3.1, 1.55), (8.0, -0.3, 1.0), 18),
}
for k, (loc, tgt, lens) in SHOTS.items():
    cam = bpy.data.objects.new(f'CAM_{k}', bpy.data.cameras.new(f'CAM_{k}')); bk.objects.link(cam)
    cam.location = loc; cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = lens
    cam.data.clip_start = 0.05
sc.camera = bpy.data.objects['CAM_ext']
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(A.out))
tris = 0
for o in col.objects:
    if o.type == 'MESH':
        o.data.calc_loop_triangles(); tris += len(o.data.loop_triangles)
print(f'saved {A.out}: objects={len(col.objects)} tris={tris}')

if A.preview:
    os.makedirs(A.preview, exist_ok=True)
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = A.samples
    sc.cycles.use_denoising = True; sc.cycles.max_bounces = 6
    sc.render.resolution_x, sc.render.resolution_y = 1100, 680
    sc.view_settings.view_transform = 'AgX'
    for k in A.shots.split(','):
        sc.camera = bpy.data.objects[f'CAM_{k}']
        inside = k not in ('ext', 'ext2')
        sc.view_settings.exposure = 0.9 if inside else 0.0
        sc.render.filepath = os.path.join(os.path.abspath(A.preview), f'{k}.png')
        bpy.ops.render.render(write_still=True)
        print('preview', k)
