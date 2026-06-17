// 세움 홈플래너 - 3D 뷰어 (Three.js)
// 2D 도면을 실시간 3D로 변환. 고객 상담 시 회전/줌으로 공간을 보여줍니다.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { store } from './store.js';
import { ROOM_TYPES, catalogOf, ATTIC_HEIGHT, EXTERIOR_MATERIALS, ROOF_TYPES, WINDOW_TYPES } from './data.js';
import * as TEX from './textures.js';

const WALL_T = 100; // 벽 두께 mm

export class Viewer3D {
  constructor(container) {
    this.container = container;
    this.active = false;
    this.dirty = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#eef1f4');

    this.camera = new THREE.PerspectiveCamera(50, 1, 100, 200000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2.05;

    this._lights();

    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);

    this.showRoof = false;
    this.showExterior = false;

    store.subscribe(() => { this.dirty = true; });
    window.addEventListener('resize', () => this._resize());
    this._animate();
  }

  _lights() {
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#9aa1ab', 0.9));
    const sun = new THREE.DirectionalLight('#fff6e8', 1.1);
    sun.position.set(8000, 14000, 6000);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = 16000;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    sun.shadow.camera.far = 60000;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight('#dce6ff', 0.35);
    fill.position.set(-6000, 8000, -4000);
    this.scene.add(fill);
  }

  setActive(on) {
    this.active = on;
    if (on) {
      this._resize();
      if (this.dirty) this.rebuild();
    }
  }

  _resize() {
    const r = this.container.getBoundingClientRect();
    if (r.width === 0) return;
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
  }

  // 도면 중심/크기 계산
  _bounds() {
    const d = store.design;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of d.rooms) {
      minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.d);
    }
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 8000; maxY = 8000; }
    return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cz: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
  }

  // 평면 좌표(mm) → 3D 좌표 (중심 원점). x→x, y(plan)→z
  _p(x, y, b) { return [x - b.cx, y - b.cz]; }

  rebuild() {
    this.dirty = false;
    // 기존 제거
    this.modelGroup.clear();
    const d = store.design;
    const b = this._bounds();
    const H = d.ceilingHeight || 2400;

    // 바닥 그라운드
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(b.w + 8000, b.h + 8000),
      new THREE.MeshStandardMaterial({ color: '#dfe3e8' })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;
    this.modelGroup.add(ground);

    for (const room of d.rooms) this._buildRoom(room, b, H);
    for (const o of (d.openings || [])) this._buildOpening(o, b);
    for (const f of d.furniture) this._buildFurniture(f, b);

    // 외장재 + 지붕 (토글)
    if (this.showExterior) this._buildExterior(d, b, H);
    if (this.showRoof) this._buildRoof(d, b, H);

    if (this._firstFrame === undefined) { this._firstFrame = false; this.resetCamera(b); }
    else if (this._needCam) { this._needCam = false; this.resetCamera(b); }
  }

  resetCamera(b) {
    b = b || this._bounds();
    const dist = Math.max(b.w, b.h) * 1.1 + 5000;
    this.camera.position.set(dist * 0.65, dist * 0.8, dist * 0.85);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  _buildRoom(room, b, ceilH) {
    const t = ROOM_TYPES[room.type] || ROOM_TYPES.hall;
    const isAttic = room.type === 'attic';
    const isOpen = room.type === 'balcony';
    const wallH = isAttic ? ATTIC_HEIGHT : ceilH;
    const [px, pz] = this._p(room.x, room.y, b);

    // 바닥 (방 종류별 마루/타일 질감)
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(room.w, 60, room.d),
      TEX.floorMaterial(room.type, t.color, room.w, room.d)
    );
    floor.position.set(px + room.w / 2, 30, pz + room.d / 2);
    floor.receiveShadow = true;
    this.modelGroup.add(floor);

    if (isOpen) return; // 발코니는 벽 생략(난간 느낌)

    // 개방형 공간: 지정된 면(open)은 벽 생략 → 거실·주방 트인 구조 표현
    // 그 외 벽은 창/문 개구부 자리를 비워(실제로 뚫어) 생성
    const open = Array.isArray(room.open) ? room.open : [];
    for (const side of ['n', 's', 'w', 'e']) {
      if (!open.includes(side)) this._buildWall(room, side, wallH, b);
    }

    // 다락은 경사 지붕 표현
    if (isAttic) {
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(room.w, room.d) * 0.62, 900, 4),
        new THREE.MeshStandardMaterial({ color: '#caa987' })
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.set(px + room.w / 2, wallH + 60 + 450, pz + room.d / 2);
      roof.castShadow = true;
      this.modelGroup.add(roof);
    }
  }

  // 한 벽면(room+side)에 있는 개구부들을 축 좌표로 정리 (a..c2, sill, top)
  _collectOps(room, side, L) {
    return (store.design.openings || [])
      .filter((o) => o.roomId === room.id && o.side === side)
      .map((o) => {
        const half = (o.w || 900) / 2;
        const c = Math.max(half, Math.min(L - half, o.pos));
        return { a: c - half, c2: c + half, sill: Math.max(0, o.sill || 0), top: (o.sill || 0) + (o.h || 1200) };
      })
      .sort((p, q) => p.a - q.a);
  }

  // 개구부를 제외한 벽 솔리드 사각형 목록 [a, b, yLo, yHi]
  // ext: 모서리 메움을 위해 양 끝을 늘리는 길이
  _wallRects(L, ops, wallH, ext) {
    const yBase = 60, wallTop = yBase + wallH;
    const rects = [];
    let cursor = -ext;
    for (const o of ops) {
      const top = Math.min(wallTop, yBase + o.top);
      if (o.a > cursor) rects.push([cursor, o.a, yBase, wallTop]);     // 개구부 사이 꽉 찬 벽
      if (top < wallTop) rects.push([o.a, o.c2, top, wallTop]);        // 상부 인방
      if (o.sill > 0) rects.push([o.a, o.c2, yBase, yBase + o.sill]);  // 하부(창 밑) 벽
      cursor = Math.max(cursor, o.c2);
    }
    if (cursor < L + ext) rects.push([cursor, L + ext, yBase, wallTop]);
    return rects;
  }

  // 내벽: 개구부 자리를 비워(뚫어) 벽을 분할 생성
  _buildWall(room, side, wallH, b) {
    const [px, pz] = this._p(room.x, room.y, b);
    const horiz = (side === 'n' || side === 's');
    const L = horiz ? room.w : room.d;
    const ops = this._collectOps(room, side, L);
    const rects = this._wallRects(L, ops, wallH, WALL_T / 2);
    const mat = TEX.wallMaterial('#f6f5f2');
    for (const [a, bEnd, yLo, yHi] of rects) {
      const len = bEnd - a, h = yHi - yLo;
      if (len < 1 || h < 1) continue;
      let cx, cz, w, dep;
      if (horiz) { cx = px + (a + bEnd) / 2; cz = (side === 'n') ? pz : pz + room.d; w = len; dep = WALL_T; }
      else       { cz = pz + (a + bEnd) / 2; cx = (side === 'w') ? px : px + room.w; w = WALL_T; dep = len; }
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), mat);
      m.position.set(cx, (yLo + yHi) / 2, cz); m.castShadow = true; m.receiveShadow = true;
      this.modelGroup.add(m);
    }
  }

  // 창호: 벽면에 끼워지는 창틀 + 유리(또는 문짝)
  _buildOpening(o, b) {
    const room = store.design.rooms.find((r) => r.id === o.roomId);
    if (!room) return;
    const t = WINDOW_TYPES[o.winType] || {};
    const isDoor = t.glass === false;
    const span = (o.side === 'n' || o.side === 's') ? room.w : room.d;
    const pos = Math.max(o.w / 2, Math.min(span - o.w / 2, o.pos));

    // 벽면 중심 좌표 (3D)
    let wx, wz, horizontal;
    if (o.side === 'n')      { [wx, wz, horizontal] = [room.x + pos, room.y, true]; }
    else if (o.side === 's') { [wx, wz, horizontal] = [room.x + pos, room.y + room.d, true]; }
    else if (o.side === 'w') { [wx, wz, horizontal] = [room.x, room.y + pos, false]; }
    else                     { [wx, wz, horizontal] = [room.x + room.w, room.y + pos, false]; }
    const [cx, cz] = this._p(wx, wz, b);
    const cy = (o.sill || 0) + (o.h || 1200) / 2 + 60;

    const g = new THREE.Group();
    g.position.set(cx, cy, cz);
    if (!horizontal) g.rotation.y = Math.PI / 2;

    const frameMat = new THREE.MeshStandardMaterial({ color: o.color || '#4a5560', roughness: 0.6, metalness: 0.3 });
    const W = o.w, Hh = o.h, FT = 70; // 프레임 두께
    // 외곽 프레임 (위/아래/좌/우)
    const addFrame = (w, h, x, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, WALL_T + 40), frameMat);
      m.position.set(x, y, 0); m.castShadow = true; g.add(m);
    };
    addFrame(W, FT, 0, Hh / 2 - FT / 2);
    addFrame(W, FT, 0, -Hh / 2 + FT / 2);
    addFrame(FT, Hh, -W / 2 + FT / 2, 0);
    addFrame(FT, Hh, W / 2 - FT / 2, 0);

    if (isDoor) {
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(W - FT * 2, Hh - FT, WALL_T - 10),
        new THREE.MeshStandardMaterial({ color: '#6b5640', roughness: 0.7 })
      );
      door.position.y = -FT / 2; door.castShadow = true; g.add(door);
    } else {
      // 유리 (반투명)
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(W - FT * 2, Hh - FT * 2, 20),
        new THREE.MeshStandardMaterial({ color: '#bcd6e6', transparent: true, opacity: 0.4, roughness: 0.1, metalness: 0.2 })
      );
      g.add(glass);
      // 창짝 분할 세로 프레임(멀리언) — 폴딩은 패널마다 두꺼운 프레임
      const panes = Math.max(1, t.panes || 1);
      const mullW = t.fold ? FT : FT * 0.7;
      for (let i = 1; i < panes; i++) {
        const x = -W / 2 + (W * i) / panes;
        const mull = new THREE.Mesh(new THREE.BoxGeometry(mullW, Hh - FT * 2, WALL_T), frameMat);
        mull.position.set(x, 0, 0); g.add(mull);
      }
    }
    this.modelGroup.add(g);
  }

  // 외장재: 건물 외곽에 면한 "기존 벽체"에 외장 마감을 입힘 (별도 테두리 쉘 X)
  // 각 방의 4면 중 바깥(다른 방이 없는 쪽)에 면한 벽에만 마감 패널을 덧댐.
  _buildExterior(d, b, ceilH) {
    const ex = d.exterior || {};
    const mDef = EXTERIOR_MATERIALS[ex.material] || EXTERIOR_MATERIALS.cement;
    const col = ex.color || mDef.color;
    const T = 120;            // 벽 바깥에 덧대는 외장 마감 두께
    const EPS = 60;           // 벽 바로 바깥 지점으로 외곽 여부 판정

    // 발코니(개방)는 외벽이 없으므로 외곽 판정 대상에서 제외
    const rooms = d.rooms.filter((r) => r.type !== 'balcony');
    const inAnyRoom = (x, y) => rooms.some((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.d);

    const mat = (len, h) => TEX.exteriorMaterial(ex.material, col, len, h, mDef.roughness, mDef.metalness);
    // 한 외벽에 외장 마감을 입힘 — 창/문 개구부 자리는 비워(뚫어) 둠
    const cladEdge = (r, side, wallH) => {
      const [px, pz] = this._p(r.x, r.y, b);
      const horiz = (side === 'n' || side === 's');
      const L = horiz ? r.w : r.d;
      const ops = this._collectOps(r, side, L);
      const rects = this._wallRects(L, ops, wallH, T); // 끝을 T 늘려 모서리 메움
      for (const [a, bEnd, yLo, yHi] of rects) {
        const len = bEnd - a, h = yHi - yLo;
        if (len < 1 || h < 1) continue;
        let cx, cz, w, dep;
        if (horiz) { cx = px + (a + bEnd) / 2; cz = (side === 'n') ? pz - T / 2 : pz + r.d + T / 2; w = len; dep = T; }
        else       { cz = pz + (a + bEnd) / 2; cx = (side === 'w') ? px - T / 2 : px + r.w + T / 2; w = T; dep = len; }
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), mat(len, h));
        m.position.set(cx, (yLo + yHi) / 2, cz); m.castShadow = true; m.receiveShadow = true;
        this.modelGroup.add(m);
      }
    };

    for (const r of rooms) {
      const open = Array.isArray(r.open) ? r.open : [];
      const wallH = r.type === 'attic' ? ATTIC_HEIGHT : ceilH;
      const cx = r.x + r.w / 2, cz = r.y + r.d / 2;
      // 바깥(다른 방이 없는 쪽)에 면하고 트지 않은 벽에만 외장 적용
      if (!open.includes('n') && !inAnyRoom(cx, r.y - EPS)) cladEdge(r, 'n', wallH);
      if (!open.includes('s') && !inAnyRoom(cx, r.y + r.d + EPS)) cladEdge(r, 's', wallH);
      if (!open.includes('w') && !inAnyRoom(r.x - EPS, cz)) cladEdge(r, 'w', wallH);
      if (!open.includes('e') && !inAnyRoom(r.x + r.w + EPS, cz)) cladEdge(r, 'e', wallH);
    }
  }

  // 지붕: 형태별 생성 (평지붕/박공/비대칭박공/우진각/외쪽)
  _buildRoof(d, b, ceilH) {
    const roof = d.roof || { type: 'gable', color: '#3a3f44' };
    const type = ROOF_TYPES[roof.type] ? roof.type : 'gable';
    const rise = ROOF_TYPES[type].rise;
    const gap = 250, eave = 500; // 처마 내밀기
    const W = b.w + gap * 2 + eave * 2;
    const D = b.h + gap * 2 + eave * 2;
    const mat = TEX.roofMaterial(roof.color || '#3a3f44', W, D); // 슁글 질감
    const baseY = ceilH + 180 + 60;
    const grp = new THREE.Group();
    grp.position.set(0, baseY, 0);

    if (type === 'flat') {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 160, D), mat);
      slab.position.y = 80; slab.castShadow = true; grp.add(slab);
    } else if (type === 'hip') {
      // 우진각: 사각뿔
      const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(W, D) / 2, rise, 4), mat);
      cone.rotation.y = Math.PI / 4;
      cone.scale.set(W / Math.hypot(W, D) * Math.SQRT2 * 0.5 + 0.5, 1, D / Math.hypot(W, D) * Math.SQRT2 * 0.5 + 0.5);
      cone.position.y = rise / 2; cone.castShadow = true; grp.add(cone);
    } else {
      // 박공/비대칭박공/외쪽: 용마루 위치(ridgeT: 0~1) 로 단면 결정
      // 용마루는 W(가로) 방향과 직교, D 길이로 길게 뻗음
      let ridgeT = 0.5;
      if (type === 'asymGable') ridgeT = 0.32;
      if (type === 'shed') ridgeT = 1.0;
      const ridgeX = -W / 2 + W * ridgeT;
      // 단면(프로파일)을 ExtrudeGeometry 로 D 방향(용마루 방향)으로 압출
      const shape = new THREE.Shape();
      shape.moveTo(-W / 2, 0);
      shape.lineTo(W / 2, 0);
      if (type === 'shed') {
        shape.lineTo(W / 2, rise);          // 외쪽: 우측이 높은 한쪽 경사
      } else {
        shape.lineTo(ridgeX, rise);         // 박공/비대칭: 용마루 정점
      }
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false });
      geo.translate(0, 0, -D / 2);
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true; grp.add(m);
    }
    this.modelGroup.add(grp);
  }

  _buildFurniture(f, b) {
    const c = catalogOf(f.catalogId); if (!c) return;
    const [px, pz] = this._p(f.x, f.y, b);
    const g = new THREE.Group();
    g.position.set(px, 60, pz);
    g.rotation.y = -(f.rotation || 0) * Math.PI / 180;
    const mat = (col) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 });
    // finish: 'fabric'|'wood' → 질감 텍스처, 그 외(undefined) → 단색
    const finMat = (col, w, dd, finish) => {
      const tx = finish ? TEX.furnitureMaterial(finish, col, w, dd) : null;
      return tx || mat(col);
    };

    const addBox = (w, h, dd, y, col, z = 0, x = 0, finish) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), finMat(col, w, dd, finish));
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
      g.add(m); return m;
    };

    // 수납 가구(옷장/책장/화장대)는 원목 결, 그 외 box(가전·욕실)는 단색
    const woodBox = ['wardrobe', 'shelf', 'dresser'].includes(c.id);

    switch (c.kind) {
      case 'sofa': {
        addBox(c.w, c.h * 0.45, c.d, c.h * 0.225, c.color, 0, 0, 'fabric');            // 좌석
        addBox(c.w, c.h * 0.7, c.d * 0.25, c.h * 0.35, c.color, -c.d * 0.37, 0, 'fabric'); // 등받이
        addBox(c.w * 0.12, c.h * 0.55, c.d, c.h * 0.27, c.color, 0, -c.w / 2 + c.w * 0.06, 'fabric');
        addBox(c.w * 0.12, c.h * 0.55, c.d, c.h * 0.27, c.color, 0, c.w / 2 - c.w * 0.06, 'fabric');
        break;
      }
      case 'bed': {
        addBox(c.w, c.h * 0.5, c.d, c.h * 0.25, c.color, 0, 0, 'fabric');              // 매트리스 베이스
        addBox(c.w, c.h * 0.35, c.d * 0.85, c.h * 0.62, '#ece4d8', c.d * 0.06, 0, 'fabric'); // 이불
        addBox(c.w, c.h * 0.9, c.d * 0.12, c.h * 0.45, '#bfa988', -c.d / 2 + c.d * 0.05, 0, 'wood'); // 헤드보드
        addBox(c.w * 0.42, c.h * 0.18, c.d * 0.22, c.h * 0.58, '#f7f3ec', -c.d / 2 + c.d * 0.18, -c.w * 0.22, 'fabric');
        addBox(c.w * 0.42, c.h * 0.18, c.d * 0.22, c.h * 0.58, '#f7f3ec', -c.d / 2 + c.d * 0.18, c.w * 0.22, 'fabric');
        break;
      }
      case 'table': {
        addBox(c.w, c.h * 0.08, c.d, c.h - c.h * 0.04, c.color, 0, 0, 'wood');       // 상판
        const legC = '#6f5a3f', lh = c.h * 0.92, ly = lh / 2;
        const ox = c.w / 2 - 60, oz = c.d / 2 - 60;
        addBox(60, lh, 60, ly, legC, oz, ox); addBox(60, lh, 60, ly, legC, oz, -ox);
        addBox(60, lh, 60, ly, legC, -oz, ox); addBox(60, lh, 60, ly, legC, -oz, -ox);
        break;
      }
      case 'chair': {
        addBox(c.w, 60, c.d, c.h * 0.45, c.color, 0, 0, 'fabric');
        addBox(c.w, c.h * 0.5, 60, c.h * 0.72, c.color, -c.d / 2 + 30, 0, 'fabric');
        break;
      }
      case 'tv': {
        addBox(c.w, c.h, c.d, c.h / 2 + 350, c.color);                // 패널
        addBox(c.w * 0.3, 40, 250, 20, '#444');                        // 받침
        break;
      }
      case 'rug': {
        const m = addBox(c.w, 12, c.d, 6, c.color, 0, 0, 'fabric'); m.castShadow = false;
        break;
      }
      case 'plant': {
        addBox(c.w * 0.6, c.h * 0.25, c.d * 0.6, c.h * 0.12, '#9c7b52', 0, 0, 'wood');
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(c.w * 0.55, 12, 10), mat(c.color));
        leaf.position.y = c.h * 0.62; leaf.scale.y = 1.4; leaf.castShadow = true;
        g.add(leaf);
        break;
      }
      default: // box
        addBox(c.w, c.h, c.d, c.h / 2, c.color, 0, 0, woodBox ? 'wood' : undefined);
    }
    this.modelGroup.add(g);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    if (!this.active) return;
    if (this.dirty) this.rebuild();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // 현재 3D 화면을 PNG dataURL 로 캡처 (인쇄/저장용). 3D 미진입 시에도 한 번 렌더해서 캡처
  toImage() {
    const wasActive = this.active;
    if (!wasActive) {
      // 숨겨진 상태면 임시 크기 부여 후 렌더
      this.renderer.setSize(1200, 800, false);
      this.camera.aspect = 1200 / 800;
      this.camera.updateProjectionMatrix();
      this.rebuild();
    }
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    if (!wasActive) this._resize();
    return url;
  }

  // 외부에서 카메라 프리셋
  view(type) {
    const b = this._bounds();
    const d = Math.max(b.w, b.h) * 1.1 + 5000;
    if (type === 'top') this.camera.position.set(0, d * 1.4, 1);
    else if (type === 'front') this.camera.position.set(0, d * 0.4, d);
    else this.camera.position.set(d * 0.65, d * 0.8, d * 0.85);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
}
