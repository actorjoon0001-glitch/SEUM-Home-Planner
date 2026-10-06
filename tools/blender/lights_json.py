# 블렌더 조명 → 홈플래너 조명 파일(.lights.json)
#
#   다운라이트(스폿)·간접등(면광원)·벽등/펜던트(점광원)를 웹 3D 에서 실제 조명으로 켜기 위한 목록.
#   좌표는 GLB 와 같은 기준(원점 이동 후, m, 블렌더 Z-up) — 웹에서 glTF 축(x, z, -y)으로 바꿔 씀.
#   가까운 같은 종류 조명은 하나로 합쳐 개수를 줄임 (웹은 조명이 많으면 느려짐)
#
#   단독 실행:  python lights_json.py -- 입력.blend 출력.lights.json --origin-x -4.25 --origin-y 4.5 --origin-z 0.25
#   blend_to_planner_glb.py 는 변환할 때 이 파일을 자동으로 함께 만듦
import json, math

SKIP_NAMES = ('LT_Sun',)        # 렌더용 태양·보조광
MERGE_R = {'SPOT': 0.9, 'POINT': 0.6, 'AREA': 0.0}
BUDGET = {'SPOT': 24, 'POINT': 12, 'AREA': 4}


def collect(bpy, ox=0.0, oy=0.0, oz=0.0, exclude=()):
    from mathutils import Vector
    out = []
    for o in bpy.data.objects:
        if o.type != 'LIGHT' or o.hide_render or o.name in SKIP_NAMES: continue
        if any(c.name in exclude for c in o.users_collection): continue
        L = o.data
        if L.type == 'SUN' or L.energy <= 0: continue
        M = o.matrix_world
        p = M.translation
        if L.type == 'POINT' and L.energy >= 500 and p.z > 5: continue    # 장면 밖 큰 보조광
        d = (M.to_3x3() @ Vector((0, 0, -1))).normalized()
        e = dict(name=o.name, type=L.type, w=round(L.energy, 2), color=[round(c, 3) for c in L.color],
                 pos=[round(p.x - ox, 4), round(p.y - oy, 4), round(p.z - oz, 4)], dir=[round(v, 4) for v in d])
        if L.type == 'SPOT':
            e.update(angle=round(L.spot_size / 2, 4), blend=round(L.spot_blend, 3))
        if L.type == 'AREA':
            sx = L.size; sy = L.size_y if L.shape in ('RECTANGLE', 'ELLIPSE') else L.size
            sc = M.to_scale()
            e.update(w_size=round(sx * sc.x, 4), h_size=round(sy * sc.y, 4),
                     ux=[round(v, 4) for v in (M.to_3x3() @ Vector((1, 0, 0))).normalized()])
        out.append(e)
    return merge(out)


def merge(lights):
    res = []
    for t in ('SPOT', 'POINT', 'AREA'):
        L = sorted([l for l in lights if l['type'] == t], key=lambda l: -l['w'])
        groups = []
        for l in L:
            for g in groups:
                h = g[0]
                if MERGE_R[t] and math.dist(h['pos'], l['pos']) < MERGE_R[t] and sum(a * b for a, b in zip(h['dir'], l['dir'])) > 0.9:
                    g.append(l); break
            else:
                groups.append([l])
        # 예산 초과면 가까운 그룹끼리 더 합침
        while len(groups) > BUDGET[t]:
            best = None
            for i in range(len(groups)):
                for j in range(i + 1, len(groups)):
                    d = math.dist(groups[i][0]['pos'], groups[j][0]['pos'])
                    if best is None or d < best[0]: best = (d, i, j)
            _, i, j = best
            groups[i] += groups.pop(j)
        for g in groups:
            if len(g) == 1: res.append(g[0]); continue
            W = sum(l['w'] for l in g)
            c = dict(g[0])
            c['name'] = g[0]['name'] + f'+{len(g) - 1}'
            c['w'] = round(W, 2)
            c['pos'] = [round(sum(l['pos'][k] * l['w'] for l in g) / W, 4) for k in range(3)]
            c['color'] = [round(sum(l['color'][k] * l['w'] for l in g) / W, 3) for k in range(3)]
            res.append(c)
    return res


def write(bpy, path, **kw):
    lights = collect(bpy, **kw)
    with open(path, 'w') as f: json.dump({'version': 1, 'units': 'm, blender z-up', 'lights': lights}, f, ensure_ascii=False, indent=0)
    from collections import Counter
    print('조명 파일:', path, dict(Counter(l['type'] for l in lights)))
    return lights


if __name__ == '__main__':
    import bpy, sys, argparse
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--origin-x', type=float, default=0.0)
    ap.add_argument('--origin-y', type=float, default=0.0)
    ap.add_argument('--origin-z', type=float, default=0.0)
    ap.add_argument('--exclude-collection', default='')
    A = ap.parse_args(argv)
    bpy.ops.wm.open_mainfile(filepath=A.src)
    write(bpy, A.out, ox=A.origin_x, oy=A.origin_y, oz=A.origin_z,
          exclude=tuple(c.strip() for c in A.exclude_collection.split(',') if c.strip()))
