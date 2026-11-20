# 블렌더 디테일 모델 공용 도구 — 재질(절차적 무늬)·기본 도형·가구·창호·조명·렌더
#   detail_<모델>.py 에서  from detail_kit import *  후  kit_init(기본.blend, 라이브러리.blend)
#   좌표: 블렌더 X = 도면 x/1000, Y = -도면 y/1000, Z 위 (m)
import bpy
import bmesh, math, os, re
from mathutils import Vector, Matrix

S = {'col': None}
MATS, LIB = {}, {}


def kit_init(base_path, lib_path, lib_mats=('오크장판', '편백루바_천장', 'PVC창틀_백색', '도어락_본체_유광블랙', '합성데크')):
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(base_path))
    S['col'] = bpy.data.objects['외벽'].users_collection[0]
    if os.path.exists(lib_path):
        with bpy.data.libraries.load(os.path.abspath(lib_path), link=False) as (src, dst):
            dst.materials = [n for n in lib_mats if n in src.materials]
        for m in dst.materials:
            if m: LIB[m.name] = m
    return S['col']


def hexrgb(h, a=1.0):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x ** 2.2 for x in c] + [a]


# ---------------------------------------------------------------- 재질
def plain(name, color, rough=0.6, metal=0.0, emit=None, strength=4.0, alpha=1.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = hexrgb(color)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = hexrgb(emit); b.inputs['Emission Strength'].default_value = strength
    if alpha < 1: b.inputs['Alpha'].default_value = alpha
    m.diffuse_color = hexrgb(color); MATS[name] = m
    return m

def lib(src, name, color, tint=None):
    if name in MATS: return MATS[name]
    m = LIB.get(src)
    m = m.copy() if m else plain(name + '_tmp', color)
    m.name = name; m.diffuse_color = hexrgb(color)
    if tint:
        for n in m.node_tree.nodes:
            if n.bl_idname == 'ShaderNodeRGB': n.outputs[0].default_value = hexrgb(tint)
    MATS[name] = m
    return m

def _new(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; return m, nt.nodes, nt.links, nt.nodes.get('Principled BSDF')

def _hcoord(N, Lk):
    """벽 가로 좌표 = x + y, 세로 = z (벽 방향과 상관없이 무늬가 이어짐)"""
    tc = N.new('ShaderNodeTexCoord'); sx = N.new('ShaderNodeSeparateXYZ'); Lk.new(tc.outputs['Object'], sx.inputs['Vector'])
    ad = N.new('ShaderNodeMath'); ad.operation = 'ADD'; Lk.new(sx.outputs['X'], ad.inputs[0]); Lk.new(sx.outputs['Y'], ad.inputs[1])
    cb = N.new('ShaderNodeCombineXYZ'); Lk.new(ad.outputs[0], cb.inputs['X']); Lk.new(sx.outputs['Z'], cb.inputs['Y'])
    return cb, ad, sx

def _ramp_stops(N, base, stops):
    ramp = N.new('ShaderNodeValToRGB'); el = ramp.color_ramp.elements
    sh = lambda k: [min(1.0, c * k) for c in base] + [1.0]
    el[0].position, el[0].color = stops[0][0], sh(stops[0][1]); el[1].position, el[1].color = stops[-1][0], sh(stops[-1][1])
    for p, k in stops[1:-1]:
        e = el.new(p); e.color = sh(k)
    return ramp

def ribbed(name, color, pitch=0.076, rough=0.42, metal=0.25, horizontal=False, band=None):
    """골강판·메탈사이딩 — horizontal=False 세로 골(가로 좌표), True 가로 판(z).
       band=(z, 색): 그 높이 아래는 다른 색 (하단 블랙 띠 등)"""
    if name in MATS: return MATS[name]
    m, N, Lk, b = _new(name)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    cb, ad, sx = _hcoord(N, Lk)
    mul = N.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 1 / pitch
    Lk.new(sx.outputs['Z'] if horizontal else ad.outputs[0], mul.inputs[0])
    fr = N.new('ShaderNodeMath'); fr.operation = 'FRACT'; Lk.new(mul.outputs[0], fr.inputs[0])
    stops = ([(0.0, 0.55), (0.04, 0.85), (0.08, 1.06), (0.6, 1.0), (1.0, 0.9)] if horizontal else
             [(0.0, 0.80), (0.18, 1.0), (0.42, 1.0), (0.5, 0.72), (0.58, 0.9), (1.0, 0.80)])
    rA = _ramp_stops(N, hexrgb(color)[:3], stops); Lk.new(fr.outputs[0], rA.inputs['Fac'])
    out = rA.outputs['Color']
    if band:
        rB = _ramp_stops(N, hexrgb(band[1])[:3], stops); Lk.new(fr.outputs[0], rB.inputs['Fac'])
        lt = N.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = band[0]
        Lk.new(sx.outputs['Z'], lt.inputs[0])
        mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'
        Lk.new(lt.outputs[0], mx.inputs['Factor']); Lk.new(out, mx.inputs['A']); Lk.new(rB.outputs['Color'], mx.inputs['B'])
        out = mx.outputs['Result']
    Lk.new(out, b.inputs['Base Color'])
    m.diffuse_color = hexrgb(color); MATS[name] = m
    return m

def bricks(name, c1, c2, mortar, accent=None, bw=0.215, bh=0.072, rough=0.85, metal=0.0, mortar_size=0.009):
    """벽돌 — c1·c2 사이 색 섞임 + accent(회색 벽돌 등) 일부 + 줄눈"""
    if name in MATS: return MATS[name]
    m, N, Lk, b = _new(name)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    cb, *_ = _hcoord(N, Lk)
    br = N.new('ShaderNodeTexBrick'); br.offset = 0.5; br.squash = 1.0
    br.inputs['Scale'].default_value = 1.0; br.inputs['Brick Width'].default_value = bw; br.inputs['Row Height'].default_value = bh
    br.inputs['Mortar Size'].default_value = mortar_size; br.inputs['Mortar Smooth'].default_value = 0.2
    br.inputs['Bias'].default_value = 0.0
    br.inputs['Color1'].default_value = hexrgb(c1); br.inputs['Color2'].default_value = hexrgb(c2)
    br.inputs['Mortar'].default_value = hexrgb(mortar)
    Lk.new(cb.outputs[0], br.inputs['Vector'])
    out = br.outputs['Color']
    if accent:   # 벽돌마다 무작위로 회색·짙은 벽돌 섞기 — 벽돌 칸 좌표로 화이트노이즈
        sep = N.new('ShaderNodeSeparateXYZ'); Lk.new(cb.outputs[0], sep.inputs['Vector'])
        row = N.new('ShaderNodeMath'); row.operation = 'FLOOR'
        dz = N.new('ShaderNodeMath'); dz.operation = 'DIVIDE'; dz.inputs[1].default_value = bh
        Lk.new(sep.outputs['Y'], dz.inputs[0]); Lk.new(dz.outputs[0], row.inputs[0])
        off = N.new('ShaderNodeMath'); off.operation = 'MULTIPLY'; off.inputs[1].default_value = bw * 0.5
        md = N.new('ShaderNodeMath'); md.operation = 'MODULO'; md.inputs[1].default_value = 2.0
        Lk.new(row.outputs[0], md.inputs[0]); Lk.new(md.outputs[0], off.inputs[0])
        ax = N.new('ShaderNodeMath'); ax.operation = 'ADD'; Lk.new(sep.outputs['X'], ax.inputs[0]); Lk.new(off.outputs[0], ax.inputs[1])
        dx = N.new('ShaderNodeMath'); dx.operation = 'DIVIDE'; dx.inputs[1].default_value = bw
        Lk.new(ax.outputs[0], dx.inputs[0])
        col_ = N.new('ShaderNodeMath'); col_.operation = 'FLOOR'; Lk.new(dx.outputs[0], col_.inputs[0])
        cc = N.new('ShaderNodeCombineXYZ'); Lk.new(col_.outputs[0], cc.inputs['X']); Lk.new(row.outputs[0], cc.inputs['Y'])
        wn = N.new('ShaderNodeTexWhiteNoise'); wn.noise_dimensions = '3D'; Lk.new(cc.outputs[0], wn.inputs['Vector'])
        gt = N.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 1.0 - accent[1]
        Lk.new(wn.outputs['Value'], gt.inputs[0])
        mf = N.new('ShaderNodeMath'); mf.operation = 'MULTIPLY'; Lk.new(gt.outputs[0], mf.inputs[0]); Lk.new(br.outputs['Fac'], mf.inputs[1])
        inv = N.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0; Lk.new(br.outputs['Fac'], inv.inputs[1])
        mf2 = N.new('ShaderNodeMath'); mf2.operation = 'MULTIPLY'; Lk.new(gt.outputs[0], mf2.inputs[0]); Lk.new(inv.outputs[0], mf2.inputs[1])
        mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs['B'].default_value = hexrgb(accent[0])
        Lk.new(mf2.outputs[0], mx.inputs['Factor']); Lk.new(out, mx.inputs['A'])
        out = mx.outputs['Result']
        # 벽돌마다 밝기 차이
        br2 = N.new('ShaderNodeMath'); br2.operation = 'MULTIPLY_ADD'; br2.inputs[1].default_value = 0.35; br2.inputs[2].default_value = 0.82
        Lk.new(wn.outputs['Value'], br2.inputs[0])
        mx2 = N.new('ShaderNodeMix'); mx2.data_type = 'RGBA'; mx2.blend_type = 'MULTIPLY'; mx2.inputs['Factor'].default_value = 1.0
        cvt = N.new('ShaderNodeCombineColor'); [Lk.new(br2.outputs[0], cvt.inputs[i]) for i in range(3)]
        Lk.new(out, mx2.inputs['A']); Lk.new(cvt.outputs[0], mx2.inputs['B']); out = mx2.outputs['Result']
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 40.0; nz.inputs['Detail'].default_value = 6
    Lk.new(cb.outputs[0], nz.inputs['Vector'])
    mx3 = N.new('ShaderNodeMix'); mx3.data_type = 'RGBA'; mx3.blend_type = 'MULTIPLY'; mx3.inputs['Factor'].default_value = 0.12
    Lk.new(out, mx3.inputs['A']); Lk.new(nz.outputs['Color'], mx3.inputs['B'])
    Lk.new(mx3.outputs['Result'], b.inputs['Base Color'])
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.4
    Lk.new(br.outputs['Fac'], bump.inputs['Height']); Lk.new(bump.outputs['Normal'], b.inputs['Normal'])
    m.diffuse_color = hexrgb(c1); MATS[name] = m
    return m

def tiles(name, color, grout, tw=0.6, th=0.3, floor=False, rough=0.35, vein=None):
    if name in MATS: return MATS[name]
    m, N, Lk, b = _new(name)
    b.inputs['Roughness'].default_value = rough
    if floor:
        tc = N.new('ShaderNodeTexCoord'); vec = tc.outputs['Object']
    else:
        cb, *_ = _hcoord(N, Lk); vec = cb.outputs[0]
    br = N.new('ShaderNodeTexBrick'); br.offset = 0.0 if floor else 0.5
    br.inputs['Scale'].default_value = 1.0; br.inputs['Brick Width'].default_value = tw; br.inputs['Row Height'].default_value = th
    br.inputs['Mortar Size'].default_value = 0.003
    c = hexrgb(color)
    br.inputs['Color1'].default_value = c; br.inputs['Color2'].default_value = [x * 0.95 for x in c[:3]] + [1]
    br.inputs['Mortar'].default_value = hexrgb(grout)
    Lk.new(vec, br.inputs['Vector'])
    out = br.outputs['Color']
    if vein:     # 대리석 결
        wv = N.new('ShaderNodeTexWave'); wv.inputs['Scale'].default_value = 1.6; wv.inputs['Distortion'].default_value = 14.0
        wv.inputs['Detail'].default_value = 8; wv.inputs['Detail Scale'].default_value = 2.0
        Lk.new(vec, wv.inputs['Vector'])
        rp = N.new('ShaderNodeValToRGB'); el = rp.color_ramp.elements
        el[0].position, el[0].color = 0.0, hexrgb(vein); el[1].position, el[1].color = 0.08, (1, 1, 1, 1)
        Lk.new(wv.outputs['Fac'], rp.inputs['Fac'])
        mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1.0
        Lk.new(out, mx.inputs['A']); Lk.new(rp.outputs['Color'], mx.inputs['B']); out = mx.outputs['Result']
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 25.0
    Lk.new(vec, nz.inputs['Vector'])
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 0.1
    Lk.new(out, mix.inputs['A']); Lk.new(nz.outputs['Color'], mix.inputs['B'])
    Lk.new(mix.outputs['Result'], b.inputs['Base Color'])
    m.diffuse_color = hexrgb(color); MATS[name] = m
    return m

def wood(name, color, scale=4.0, rough=0.55, direction='Z', distortion=2.5):
    if name in MATS: return MATS[name]
    m, N, Lk, b = _new(name)
    b.inputs['Roughness'].default_value = rough
    tc = N.new('ShaderNodeTexCoord')
    wv = N.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = direction
    wv.inputs['Scale'].default_value = scale; wv.inputs['Distortion'].default_value = distortion; wv.inputs['Detail'].default_value = 5
    Lk.new(tc.outputs['Object'], wv.inputs['Vector'])
    c = hexrgb(color)
    ramp = N.new('ShaderNodeValToRGB'); el = ramp.color_ramp.elements
    el[0].color = [x * 0.8 for x in c[:3]] + [1]; el[1].color = [min(1, x * 1.12) for x in c[:3]] + [1]
    Lk.new(wv.outputs['Fac'], ramp.inputs['Fac']); Lk.new(ramp.outputs['Color'], b.inputs['Base Color'])
    m.diffuse_color = c; MATS[name] = m
    return m

def recolor(name, color, rough=None, metal=None):
    m = bpy.data.materials.get(name)
    if not m: return None
    b = m.node_tree.nodes.get('Principled BSDF')
    if b and not b.inputs['Base Color'].is_linked: b.inputs['Base Color'].default_value = hexrgb(color)
    if b and rough is not None: b.inputs['Roughness'].default_value = rough
    if b and metal is not None: b.inputs['Metallic'].default_value = metal
    m.diffuse_color = hexrgb(color); MATS[name] = m
    return m


# ---------------------------------------------------------------- 도형
def new_obj(name, me, mats):
    for m in mats: me.materials.append(m)
    o = bpy.data.objects.new(name, me); S['col'].objects.link(o); return o

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
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    for (x0, y0, z0, x1, y1, z1) in rects:
        r = bmesh.ops.create_cube(bm, size=1.0)
        for v in r['verts']:
            v.co = Vector(((x0 + x1) / 2 + v.co.x * abs(x1 - x0), (y0 + y1) / 2 + v.co.y * abs(y1 - y0), (z0 + z1) / 2 + v.co.z * abs(z1 - z0)))
    bm.to_mesh(me); bm.free()
    return new_obj(name, me, [mat])

def prism_xz(name, pts, y0, y1, mat, mats=None):
    """xz 평면 다각형(pts=[(x,z),...])을 y0~y1 두께로 세움 (박공·사다리꼴 벽)"""
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    a = [bm.verts.new((x, y0, z)) for x, z in pts]; b = [bm.verts.new((x, y1, z)) for x, z in pts]
    bm.faces.new(a); bm.faces.new(list(reversed(b)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n; bm.faces.new([a[i], b[i], b[j], a[j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    return new_obj(name, me, mats or [mat])

def prism_yz(name, pts, x0, x1, mat):
    """yz 평면 다각형(pts=[(y,z),...])을 x0~x1 두께로"""
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    a = [bm.verts.new((x0, y, z)) for y, z in pts]; b = [bm.verts.new((x1, y, z)) for y, z in pts]
    bm.faces.new(a); bm.faces.new(list(reversed(b)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n; bm.faces.new([a[i], b[i], b[j], a[j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    return new_obj(name, me, [mat])

def slab(name, p0, u, v, t, mat):
    """평행사변형 판: 꼭짓점 p0, 변 u·v, 두께 벡터 t"""
    p0, u, v, t = Vector(p0), Vector(u), Vector(v), Vector(t)
    pts = [p0, p0 + u, p0 + u + v, p0 + v, p0 + t, p0 + u + t, p0 + u + v + t, p0 + v + t]
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    vs = [bm.verts.new(p) for p in pts]
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    return new_obj(name, me, [mat])

def mat_index(o, m):
    for i, s in enumerate(o.data.materials):
        if s == m: return i
    o.data.materials.append(m); return len(o.data.materials) - 1

def split(o, planes):
    bm = bmesh.new(); bm.from_mesh(o.data)
    for co, no in planes:
        g = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=g, plane_co=co, plane_no=no)
    bm.to_mesh(o.data); bm.free()

def cut(target, cutters):
    """target 에서 cutters(오브젝트들)를 빼고 cutters 삭제"""
    for c in cutters:
        md = target.modifiers.new('cut', 'BOOLEAN'); md.operation = 'DIFFERENCE'; md.object = c; md.solver = 'EXACT'
        bpy.context.view_layer.objects.active = target
        bpy.ops.object.modifier_apply(modifier=md.name)
    for c in cutters: bpy.data.objects.remove(c, do_unlink=True)

def remove(pred):
    for o in list(S['col'].objects):
        if pred(o): bpy.data.objects.remove(o, do_unlink=True)


class Place:
    """가구 배치 — 로컬(뒷면 y=0, 앞쪽 -y, 가운데 x=0)로 만들고 도면 회전(0=뒤가 북쪽벽)대로 돌려 (bx,by)에 둠"""
    def __init__(self, bx, by, rot=0):
        self.M = Matrix.Translation(Vector((bx, by, 0))) @ Matrix.Rotation(math.radians(-rot), 4, 'Z')
        self.objs = []
    def box(self, name, x0, y0, z0, x1, y1, z1, mat, **kw):
        o = box(name, x0, y0, z0, x1, y1, z1, mat, **kw); o.data.transform(self.M); self.objs.append(o); return o
    def cyl(self, name, cx, cy, z0, z1, r, mat, **kw):
        o = cyl(name, cx, cy, z0, z1, r, mat, **kw); o.data.transform(self.M); self.objs.append(o); return o


# ---------------------------------------------------------------- 가구
def sofa(P, w, d, fl, fab, frame, legs=True):
    P.box('소파_좌방석', -w / 2 + 0.12, -d + 0.06, fl + 0.20, w / 2 - 0.12, -0.22, fl + 0.44, fab, bevel=0.04, seg=3)
    P.box('소파_등받이', -w / 2 + 0.02, -0.26, fl + 0.20, w / 2 - 0.02, -0.02, fl + 0.80, fab, bevel=0.05, seg=3)
    for s in (-1, 1):
        P.box('소파_팔걸이', s * (w / 2 - 0.13), -d + 0.02, fl + 0.20, s * (w / 2 - 0.01), -0.04, fl + 0.62, fab, bevel=0.04, seg=3)
    P.box('소파_베이스', -w / 2 + 0.03, -d + 0.04, fl + 0.06, w / 2 - 0.03, -0.04, fl + 0.20, fab, bevel=0.02)
    if legs:
        for x in (-w / 2 + 0.1, w / 2 - 0.1):
            for y in (-d + 0.1, -0.1):
                P.cyl('소파_다리', x, y, fl, fl + 0.06, 0.02, frame, n=12)

def bed(P, w, l, fl, sheet, cover, pillow, frame=None, runner=None):
    if frame: P.box('침대_프레임', -w / 2 - 0.03, -l - 0.03, fl + 0.05, w / 2 + 0.03, -0.02, fl + 0.30, frame, bevel=0.01)
    P.box('침대_매트리스', -w / 2, -l, fl + 0.28, w / 2, -0.04, fl + 0.50, sheet, bevel=0.05, seg=3)
    P.box('침대_이불', -w / 2 - 0.05, -l - 0.05, fl + 0.30, w / 2 + 0.05, -0.55, fl + 0.55, cover, bevel=0.04, seg=3)
    for x in (-w / 4, w / 4):
        P.box('침대_베개', x - w / 4 + 0.05, -0.48, fl + 0.50, x + w / 4 - 0.05, -0.08, fl + 0.66, pillow, bevel=0.06, seg=3)
    if runner:
        P.box('침대_러너', -w / 2 - 0.055, -l + 0.30, fl + 0.551, w / 2 + 0.055, -l + 0.70, fl + 0.556, runner)

def bar_stool(P, x, y, fl, seat, chrome):
    P.cyl('바스툴_받침', x, y, fl, fl + 0.02, 0.2, chrome, n=32)
    P.cyl('바스툴_기둥', x, y, fl + 0.02, fl + 0.62, 0.025, chrome, n=16)
    P.box('바스툴_시트', x - 0.19, y - 0.17, fl + 0.62, x + 0.19, y + 0.17, fl + 0.68, seat, bevel=0.03, seg=3)
    P.box('바스툴_등', x - 0.18, y + 0.13, fl + 0.68, x + 0.18, y + 0.17, fl + 0.78, chrome)
    P.box('바스툴_발판', x - 0.17, y - 0.20, fl + 0.30, x + 0.17, y - 0.17, fl + 0.32, chrome)

def toilet(P, fl, porcelain, chrome):
    P.box('양변기_수조', -0.20, -0.20, fl + 0.40, 0.20, -0.01, fl + 0.78, porcelain, bevel=0.02)
    P.cyl('양변기_몸통', 0, -0.42, fl, fl + 0.40, 0.18, porcelain, n=40, rx=0.19, ry=0.26)
    P.cyl('양변기_시트', 0, -0.44, fl + 0.40, fl + 0.43, 0.18, porcelain, n=40, rx=0.20, ry=0.28)

def wall_basin(P, fl, porcelain, chrome, w=0.5):
    P.box('세면대', -w / 2, -0.42, fl + 0.70, w / 2, -0.01, fl + 0.86, porcelain, bevel=0.03, seg=3)
    P.cyl('세면대_수전', 0, -0.07, fl + 0.86, fl + 1.02, 0.014, chrome, n=16)
    P.box('세면대_수전', -0.01, -0.07, fl + 1.0, 0.01, -0.18, fl + 1.02, chrome)

def shower(P, fl, chrome, white, glass, w=0.9, gx=None):
    P.box('샤워_레일', -0.015, -0.04, fl + 0.95, 0.015, -0.01, fl + 1.95, chrome)
    P.box('샤워_암', -0.012, -0.30, fl + 1.93, 0.012, -0.04, fl + 1.96, chrome)
    P.cyl('샤워_헤드', 0, -0.30, fl + 1.90, fl + 1.93, 0.12, white, n=40)
    P.box('샤워_수전', -0.22, -0.08, fl + 0.95, 0.22, -0.01, fl + 1.06, white, bevel=0.01)
    if gx is not None:   # 유리 칸막이 (로컬 x=gx 에 세로판)
        P.box('샤워_유리', gx - 0.005, -w, fl + 0.02, gx + 0.005, -0.0, fl + 2.0, glass)
        P.box('샤워_유리틀', gx - 0.012, -w, fl + 0.0, gx + 0.012, -w + 0.025, fl + 2.0, chrome)

def wardrobe(P, w, d, fl, h, body, doors):
    P.box('붙박이장', -w / 2, -d + 0.02, fl, w / 2, 0, fl + h, body)
    n = max(1, round(w / 0.45)); dw = w / n
    for i in range(n):
        P.box('붙박이장_문', -w / 2 + i * dw + 0.002, -d, fl + 0.003, -w / 2 + (i + 1) * dw - 0.002, -d + 0.02, fl + h - 0.003, doors, bevel=0.002)

def fan(cx, cy, z_top, z_hub, body, blade, n=3, r=0.65):
    cyl('실링팬', cx, cy, z_hub, z_top, 0.018, body, n=16)
    cyl('실링팬', cx, cy, z_hub - 0.10, z_hub, 0.09, body, n=32)
    for a in range(n):
        o = box('실링팬_날개', cx + 0.08, cy - 0.06, z_hub - 0.065, cx + r, cy + 0.06, z_hub - 0.05, blade, bevel=0.01)
        o.data.transform(Matrix.Translation(Vector((cx, cy, 0))) @ Matrix.Rotation(math.radians(a * 360 / n + 20), 4, 'Z') @ Matrix.Translation(-Vector((cx, cy, 0))))

def slat_wall(name, axis, fixed, a0, a1, z0, z1, sign, slat, bg, w=0.02, gap=0.015, depth=0.015, horizontal=False):
    """슬랫 벽 — axis='x'(벽이 x 방향으로 뻗음, y=fixed) / 'y'(x=fixed). sign: 벽면에서 방 쪽 방향(+1/-1)"""
    rects = []
    if axis == 'x':
        box(name + '_배경', a0, fixed, z0, a1, fixed + sign * 0.008, z1, bg)
        y0, y1 = fixed + sign * 0.008, fixed + sign * (0.008 + depth)
        if horizontal:
            z = z0 + 0.005
            while z + w <= z1: rects.append((a0, y0, z, a1, y1, z + w)); z += w + gap
        else:
            x = a0 + 0.005
            while x + w <= a1: rects.append((x, y0, z0, x + w, y1, z1)); x += w + gap
    else:
        box(name + '_배경', fixed, a0, z0, fixed + sign * 0.008, a1, z1, bg)
        x0, x1 = fixed + sign * 0.008, fixed + sign * (0.008 + depth)
        if horizontal:
            z = z0 + 0.005
            while z + w <= z1: rects.append((x0, a0, z, x1, a1, z + w)); z += w + gap
        else:
            y = a0 + 0.005
            while y + w <= a1: rects.append((x0, y, z0, x1, y + w, z1)); y += w + gap
    return multi_box(name, rects, slat)


# ---------------------------------------------------------------- 창호 (기본 모델 개구부 다듬기)
DOORS = {'door', 'swingDoor', 'doubleDoor', 'slideDoor', 'glassSlide', 'pocketDoor', 'pivotDoor', 'folding', 'foldSwing', 'balcony', 'slide'}

def unoverlap_frames():
    """사각 테두리 부재가 모서리에서 겹치면 렌더에서 검게 깨짐 → 좌·우 기둥을 상·하 사이로 줄임"""
    for o in list(S['col'].objects):
        m = re.match(r'^(.*)_상(\.\d+)?$', o.name)
        if not m: continue
        base, suf = m.group(1), m.group(2) or ''
        zs = [v.co.z for v in o.data.vertices]; top = min(zs)
        bot = bpy.data.objects.get(base + '_하' + suf)
        bz = max(v.co.z for v in bot.data.vertices) if bot else None
        for side in ('_좌', '_우'):
            s_ = bpy.data.objects.get(base + side + suf)
            if not s_: continue
            for v in s_.data.vertices:
                if v.co.z > top: v.co.z = top
                if bz is not None and v.co.z < bz: v.co.z = bz
            s_.data.update()

def opening_frame(D, op, box_xy):
    rooms = {r['id']: r for r in D['rooms']}
    r = rooms[op['roomId']]; s, pos = op['side'], op['pos']
    if s in 'ns':
        c = Vector(((r['x'] + pos) / 1000, -(r['y'] + (0 if s == 'n' else r['d'])) / 1000, 0))
        u = Vector((1, 0, 0)); n = Vector((0, 1, 0)) if s == 'n' else Vector((0, -1, 0))
    else:
        c = Vector(((r['x'] + (0 if s == 'w' else r['w'])) / 1000, -(r['y'] + pos) / 1000, 0))
        u = Vector((0, -1, 0)); n = Vector((-1, 0, 0)) if s == 'w' else Vector((1, 0, 0))
    return c, u, n, not box_xy(c + n * 0.08)

def casing_parts(tag, c, u, n, w, z0, z1, v_face, sgn, mat, is_door, F, cw=0.07, ct=0.012):
    def part(u0, u1, z_0, z_1):
        pts = [c + u * uu + n * (v_face + sgn * vv) + Vector((0, 0, zz)) for uu, vv, zz in
               ((u0, 0, z_0), (u1, 0, z_0), (u1, ct, z_0), (u0, ct, z_0), (u0, 0, z_1), (u1, 0, z_1), (u1, ct, z_1), (u0, ct, z_1))]
        me = bpy.data.meshes.new('몰딩'); bm = bmesh.new()
        vs = [bm.verts.new(p) for p in pts]
        for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
            bm.faces.new([vs[i] for i in f])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
        new_obj(tag, me, [mat])
    zb = F if is_door else z0
    part(-w / 2 - cw, -w / 2, zb, z1); part(w / 2, w / 2 + cw, zb, z1)
    part(-w / 2 - cw, w / 2 + cw, z1, z1 + cw)
    if not is_door: part(-w / 2 - cw, w / 2 + cw, z0 - cw, z0)

def finish_openings(D, F, box_xy, M, TE=0.15, TI=0.10):
    """M: pvc_in, ext_frame(선택: 바깥 프레임 색), door_ext(현관문 바깥), door_in, idoor, iframe, casing, chrome, lock"""
    unoverlap_frames()
    col = S['col']
    for k, op in enumerate(D['openings']):
        c, u, n, ext = opening_frame(D, op, box_xy)
        t = op['winType']; w = op['w'] / 1000; z0 = F + (op.get('sill') or 0) / 1000; z1 = z0 + op['h'] / 1000
        for o in [o for o in col.objects if o.name.startswith(f'개구부{k:02d}_')]:
            mn = o.data.materials[0].name if o.data.materials else ''
            if ext:
                if mn in ('창틀', '문틀'):
                    iw = mat_index(o, M['pvc_in'] if t != 'door' else bpy.data.materials['문틀'])
                    for p in o.data.polygons:
                        if p.normal.dot(n) < -0.5: p.material_index = iw
                if mn == '문짝' and t == 'door':
                    o.data.materials[0] = M['door_ext']; ii = mat_index(o, M['door_in'])
                    for p in o.data.polygons:
                        if p.normal.dot(n) < -0.5: p.material_index = ii
                if '도어락' in o.name: o.data.materials[0] = M['lock']
            else:
                if mn == '문짝': o.data.materials[0] = M['idoor']
                if mn == '문틀' and t != 'glassSlide': o.data.materials[0] = M['iframe']
            if '레버' in o.name: o.data.materials[0] = M['chrome']
        is_door = t in DOORS
        if ext: casing_parts(f'실내몰딩{k:02d}', c, u, n, w, z0, z1, -TE, -1, M['casing'], is_door, F)
        elif t not in ('pocketDoor',):
            casing_parts(f'실내몰딩{k:02d}', c, u, n, w, z0, z1, -TI / 2, -1, M['casing'], is_door, F)
            casing_parts(f'실내몰딩{k:02d}', c, u, n, w, z0, z1, TI / 2, 1, M['casing'], is_door, F)


def add_window(tag, c, u, n, w, h, z0, wall, frame_ext, frame_in, glass, trim=None, TE=0.15, panes=1):
    """벽 오브젝트(wall)에 창 구멍 + 틀·유리 (c: 벽 바깥면 위 중심, u: 벽 방향, n: 바깥 법선)"""
    def bx(name, u0, u1, v0, v1, za, zb, mat):
        p = lambda uu, vv, zz: c + u * uu + n * vv + Vector((0, 0, zz))
        return slab(f'{tag}_{name}', p(u0, v0, za), u * (u1 - u0), Vector((0, 0, zb - za)), n * (v1 - v0), mat)
    cutter = bx('cut', -w / 2, w / 2, -TE - 0.05, 0.05, z0, z0 + h, frame_ext)
    cut(wall, [cutter])
    fw = 0.06; z1 = z0 + h
    parts = [bx('틀_상', -w / 2, w / 2, -0.10, -0.03, z1 - fw, z1, frame_ext), bx('틀_하', -w / 2, w / 2, -0.10, -0.03, z0, z0 + fw, frame_ext),
             bx('틀_좌', -w / 2, -w / 2 + fw, -0.10, -0.03, z0 + fw, z1 - fw, frame_ext), bx('틀_우', w / 2 - fw, w / 2, -0.10, -0.03, z0 + fw, z1 - fw, frame_ext)]
    ii = None
    for o in parts:
        ii = mat_index(o, frame_in)
        for p in o.data.polygons:
            if p.normal.dot(n) < -0.5: p.material_index = ii
    iw = (w - 2 * fw) / panes
    for i in range(panes):
        a = -w / 2 + fw + i * iw
        bx(f'유리{i}', a + 0.01, a + iw - 0.01, -0.07, -0.06, z0 + fw, z1 - fw, glass)
        if i: bx('틀_중간', a - 0.02, a + 0.02, -0.10, -0.03, z0 + fw, z1 - fw, frame_ext)
    if trim:
        bx('몰딩_상', -w / 2 - 0.06, w / 2 + 0.06, 0.0, 0.02, z1, z1 + 0.06, trim)
        bx('몰딩_좌', -w / 2 - 0.06, -w / 2, 0.0, 0.02, z0, z1, trim); bx('몰딩_우', w / 2, w / 2 + 0.06, 0.0, 0.02, z0, z1, trim)
        bx('창대', -w / 2 - 0.08, w / 2 + 0.08, -0.03, 0.06, z0 - 0.035, z0, trim)


# ---------------------------------------------------------------- 조명
def light(name, kind, pos, energy, color, rot=(0, 0, 0), size=None, spot=None):
    L = bpy.data.lights.new(name, kind); L.energy = energy; L.color = color
    if kind == 'SPOT': L.spot_size = spot or math.radians(110); L.spot_blend = 0.8
    if kind == 'AREA':
        L.shape = 'RECTANGLE'; L.size, L.size_y = size
    if kind in ('POINT', 'SPOT'): L.shadow_soft_size = 0.05
    o = bpy.data.objects.new(name, L); S['col'].objects.link(o); o.location = pos; o.rotation_euler = rot
    return o

def downlight(i, x, y, ce, rim, glow, energy=110, color=(1.0, 0.86, 0.72)):
    cyl('다운라이트_테두리', x, y, ce - 0.006, ce, 0.075, rim, n=32)
    cyl('다운라이트_발광', x, y, ce - 0.008, ce - 0.005, 0.06, glow, n=32)
    light(f'LT_DL{i}', 'SPOT', (x, y, ce - 0.02), energy, color)

def cove(name, x0, y0, x1, y1, z_top, lid, body, glow, energy_per_m=18):
    box(name, x0, y0, z_top - 0.16, x1, y1, z_top - 0.10, body)
    L = max(abs(x1 - x0), abs(y1 - y0))
    if abs(x1 - x0) > abs(y1 - y0):
        box(name + '_LED', x0 + 0.02, (y0 + y1) / 2 - 0.02, z_top - 0.10, x1 - 0.02, (y0 + y1) / 2 + 0.02, z_top - 0.095, glow)
        light(lid, 'AREA', ((x0 + x1) / 2, (y0 + y1) / 2, z_top - 0.09), energy_per_m * L, (1.0, 0.78, 0.5), rot=(math.pi, 0, 0), size=(L, 0.05))
    else:
        box(name + '_LED', (x0 + x1) / 2 - 0.02, y0 + 0.02, z_top - 0.10, (x0 + x1) / 2 + 0.02, y1 - 0.02, z_top - 0.095, glow)
        light(lid, 'AREA', ((x0 + x1) / 2, (y0 + y1) / 2, z_top - 0.09), energy_per_m * L, (1.0, 0.78, 0.5), rot=(math.pi, 0, 0), size=(0.05, L))


# ---------------------------------------------------------------- 마무리·렌더
def backdrop(center, shots):
    sc = bpy.context.scene
    bk = bpy.data.collections.get('Backdrop') or bpy.data.collections.new('Backdrop')
    if bk.name not in sc.collection.children: sc.collection.children.link(bk)
    for o in list(bk.objects): bpy.data.objects.remove(o, do_unlink=True)
    g = bpy.data.meshes.new('Ground'); bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=35); bm.to_mesh(g); bm.free()
    go = bpy.data.objects.new('Ground', g); bk.objects.link(go); go.location = (center[0], center[1], -0.001)
    g.materials.append(plain('잔디', '#6f8650', 0.95))
    sun = bpy.data.objects.new('LT_Sun', bpy.data.lights.new('LT_Sun', 'SUN')); bk.objects.link(sun)
    sun.data.energy = 3.5; sun.rotation_euler = (math.radians(48), 0, math.radians(-30)); sun.data.angle = math.radians(2)
    wd = bpy.data.worlds.get('sky') or bpy.data.worlds.new('sky'); sc.world = wd; wd.use_nodes = True
    bg = wd.node_tree.nodes.get('Background'); bg.inputs['Color'].default_value = (0.58, 0.72, 0.92, 1); bg.inputs['Strength'].default_value = 0.8
    remove(lambda o: o.type == 'CAMERA' or o.name in ('sun', 'ground'))
    for k, (loc, tgt, lens) in shots.items():
        cam = bpy.data.objects.new(f'CAM_{k}', bpy.data.cameras.new(f'CAM_{k}')); bk.objects.link(cam)
        cam.location = loc; cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = lens
        cam.data.clip_start = 0.05
    sc.camera = bpy.data.objects[f'CAM_{next(iter(shots))}']

def save_and_preview(out, preview, shots, samples=40, outside=('ext', 'ext2')):
    sc = bpy.context.scene
    for o in S['col'].objects:
        if o.type == 'MESH':
            for p in o.data.polygons:
                if len(p.vertices) > 4: p.use_smooth = False
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out))
    tris = 0
    for o in S['col'].objects:
        if o.type == 'MESH':
            o.data.calc_loop_triangles(); tris += len(o.data.loop_triangles)
    print(f'saved {out}: objects={len(S["col"].objects)} tris={tris}')
    if not preview: return
    os.makedirs(preview, exist_ok=True)
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples
    sc.cycles.use_denoising = True; sc.cycles.max_bounces = 6
    sc.render.resolution_x, sc.render.resolution_y = 1100, 680
    sc.view_settings.view_transform = 'AgX'
    for k in shots:
        sc.camera = bpy.data.objects[f'CAM_{k}']
        sc.view_settings.exposure = 0.0 if k in outside else 0.9
        sc.render.filepath = os.path.join(os.path.abspath(preview), f'{k}.png')
        bpy.ops.render.render(write_still=True)
        print('preview', k)
