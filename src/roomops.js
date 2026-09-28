// 방(공간) 공통 편집 연산 — 2D 편집기와 3D 뷰어가 함께 쓰는 순수 함수.
// store·DOM에 의존하지 않으며, 넘겨받은 design(d) 객체를 직접 변경한다.

// 방 하나를 90° 회전 — 가로·세로를 맞바꾸고 중심을 피벗 기준으로 이동.
//   그 방에 붙은 창/문(개구부), 트인 면(open), 방 안에 놓인 가구도 함께 돌린다.
//   dir=+1 시계, -1 반시계 (도면 좌표: y가 아래 방향).
//   pvx,pvy: 회전 중심(생략 시 방 자기 중심 = 제자리 회전, 여러 방을 함께 돌릴 땐 그룹 중심).
export function rotateRoom(room, d, dir, pvx, pvy) {
  const cx = room.x + room.w / 2, cy = room.y + room.d / 2;
  const oldW = room.w, oldD = room.d;
  if (pvx == null) pvx = cx;
  if (pvy == null) pvy = cy;
  const rot = (x, y) => dir > 0
    ? [pvx + (y - pvy), pvy - (x - pvx)]   // 시계
    : [pvx - (y - pvy), pvy + (x - pvx)];  // 반시계
  // 회전 후 좌표를 가장 가까운 변에 배정 → { side, pos }
  const classify = (nx, ny) => {
    const dN = Math.abs(ny - room.y), dS = Math.abs(ny - (room.y + room.d));
    const dW = Math.abs(nx - room.x), dE = Math.abs(nx - (room.x + room.w));
    const m = Math.min(dN, dS, dW, dE);
    if (m === dN) return { side: 'n', pos: Math.round(nx - room.x) };
    if (m === dS) return { side: 's', pos: Math.round(nx - room.x) };
    if (m === dW) return { side: 'w', pos: Math.round(ny - room.y) };
    return { side: 'e', pos: Math.round(ny - room.y) };
  };
  // 회전 전 월드 좌표 먼저 계산 (방 치수를 바꾸기 전에)
  const ops = (d.openings || []).filter((o) => o.roomId === room.id && !o.free && !o.onOutline);
  const preOps = ops.map((o) => {
    let px, py;
    if (o.side === 'n') { px = room.x + o.pos; py = room.y; }
    else if (o.side === 's') { px = room.x + o.pos; py = room.y + room.d; }
    else if (o.side === 'w') { px = room.x; py = room.y + o.pos; }
    else { px = room.x + room.w; py = room.y + o.pos; }
    return { o, p: rot(px, py) };
  });
  const openMid = { n: [cx, room.y], s: [cx, room.y + oldD], w: [room.x, cy], e: [room.x + oldW, cy] };
  const preOpen = (Array.isArray(room.open) ? room.open : []).map((s) => rot(openMid[s][0], openMid[s][1]));
  const furns = (d.furniture || []).filter((f) => f.x > room.x && f.x < room.x + oldW && f.y > room.y && f.y < room.y + oldD);
  const preF = furns.map((f) => ({ f, p: rot(f.x, f.y) }));
  // 방: 가로·세로 스왑 + 중심을 피벗 기준 회전 위치로 이동
  const [ncx, ncy] = rot(cx, cy);
  room.w = oldD; room.d = oldW;
  room.x = Math.round(ncx - room.w / 2); room.y = Math.round(ncy - room.d / 2);
  // 개구부 재배치
  for (const { o, p } of preOps) { const c = classify(p[0], p[1]); o.side = c.side; o.pos = c.pos; }
  // 트인 면 재배치
  if (preOpen.length) room.open = preOpen.map((p) => classify(p[0], p[1]).side);
  // 방 안 가구 회전
  for (const { f, p } of preF) {
    f.x = Math.round(p[0]); f.y = Math.round(p[1]);
    f.rotation = (((f.rotation || 0) + (dir > 0 ? 90 : -90)) % 360 + 360) % 360;
  }
}

// 방 여러 개를 90° 회전 — 1개면 제자리, 2개 이상이면 그룹 바운딩 중심 기준으로 함께 회전.
export function rotateRoomsInDesign(d, ids, dir) {
  const rooms = ids.map((id) => d.rooms.find((r) => r.id === id)).filter(Boolean);
  if (!rooms.length) return;
  if (rooms.length > 1) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of rooms) { minX = Math.min(minX, r.x); minY = Math.min(minY, r.y); maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.d); }
    const gcx = (minX + maxX) / 2, gcy = (minY + maxY) / 2;
    for (const r of rooms) rotateRoom(r, d, dir, gcx, gcy);
  } else {
    rotateRoom(rooms[0], d, dir);
  }
  syncOutlineToRooms(d);   // 지붕·외장이 회전한 몸통을 따라오게 외곽선 재계산
}

// 방 여러 개를 (dx,dy)만큼 함께 이동.
export function moveRoomsInDesign(d, ids, dx, dy) {
  for (const id of ids) {
    const r = d.rooms.find((x) => x.id === id);
    if (r) { r.x += dx; r.y += dy; }
  }
}

// 방들의 footprint(합집합)로부터 집 외곽선 경로를 계산 — 개방형(발코니·데크·포치)은 제외.
//   떨어진 여러 덩어리(쌍둥이 두 동 등)를 각각 하나의 닫힌 경로로 추적한다.
//   반환: [{ closed:true, points:[[x,y]...] }, ...] 또는 null.
export function computeOutlinePaths(rooms) {
  const OPEN = ['balcony', 'deck', 'porch'];
  rooms = (rooms || []).filter((r) => !OPEN.includes(r.type));
  if (rooms.length < 1) return null;
  const xs = [...new Set(rooms.flatMap((r) => [r.x, r.x + r.w]))].sort((a, b) => a - b);
  const ys = [...new Set(rooms.flatMap((r) => [r.y, r.y + r.d]))].sort((a, b) => a - b);
  const cov = (i, j) => {
    if (i < 0 || j < 0 || i >= xs.length - 1 || j >= ys.length - 1) return false;
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    return rooms.some((r) => cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.d);
  };
  const segs = [];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    if (!cov(i, j)) continue;
    const x0 = xs[i], x1 = xs[i + 1], y0 = ys[j], y1 = ys[j + 1];
    if (!cov(i, j - 1)) segs.push([[x0, y0], [x1, y0]]);
    if (!cov(i + 1, j)) segs.push([[x1, y0], [x1, y1]]);
    if (!cov(i, j + 1)) segs.push([[x1, y1], [x0, y1]]);
    if (!cov(i - 1, j)) segs.push([[x0, y1], [x0, y0]]);
  }
  if (!segs.length) return null;
  const key = (p) => p[0] + ',' + p[1];
  const outMap = new Map();
  for (const s of segs) { const k = key(s[0]); if (!outMap.has(k)) outMap.set(k, []); outMap.get(k).push(s); }
  const usedAll = new Set();
  const paths = [];
  for (const seed of segs) {
    if (usedAll.has(seed)) continue;
    const poly = []; let cur = seed;
    for (let guard = 0; guard < segs.length + 5 && cur && !usedAll.has(cur); guard++) {
      poly.push(cur[0]); usedAll.add(cur);
      const outs = (outMap.get(key(cur[1])) || []).filter((s) => !usedAll.has(s));
      if (!outs.length) break;
      const dir = [Math.sign(cur[1][0] - cur[0][0]), Math.sign(cur[1][1] - cur[0][1])];
      cur = outs.find((o) => Math.sign(o[1][0] - o[0][0]) === dir[0] && Math.sign(o[1][1] - o[0][1]) === dir[1]) || outs[0];
      if (cur && key(cur[0]) === key(seed[0])) break;
    }
    const pts = [];
    for (let k = 0; k < poly.length; k++) {
      const a = poly[(k - 1 + poly.length) % poly.length], b = poly[k], c = poly[(k + 1) % poly.length];
      if (!((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]))) pts.push([b[0], b[1]]);
    }
    if (pts.length >= 3) paths.push({ closed: true, points: pts });
  }
  return paths.length ? paths : null;
}

// 경로 무게중심 (대략) — 건물별 지붕 매칭용.
function pathCentroid(pts) {
  let sx = 0, sy = 0; for (const p of pts) { sx += p[0]; sy += p[1]; }
  return [sx / pts.length, sy / pts.length];
}

// 방을 옮기거나 회전한 뒤, 이미 외곽선이 있으면 방 footprint 에 맞춰 다시 계산한다.
//   → 지붕·외장이 몸통(벽·바닥)을 따라오게 함.
//   건물별 지붕(roof.shapes)은 무게중심이 가장 가까운 새 경로로 다시 매칭해
//   '6평=평지붕 / 4평=박공' 같은 설정이 건물에 그대로 붙어 있게 유지한다.
export function syncOutlineToRooms(d) {
  if (!d.outline) return;   // 외곽선(지붕)이 없으면 만들지 않음 — 사용자 의도 존중
  const oldPaths = (d.outline.paths && Array.isArray(d.outline.paths))
    ? d.outline.paths.map((p) => (p.points || p.pts || []))
    : (Array.isArray(d.outline) ? d.outline.map((p) => (p.points || p.pts || [])) : []);
  const oldShapes = (d.roof && Array.isArray(d.roof.shapes)) ? d.roof.shapes : null;
  const paths = computeOutlinePaths(d.rooms);
  if (!paths) return;
  // 건물별 지붕 재매칭 (무게중심 최근접)
  if (oldShapes && oldPaths.length) {
    const oldCentroids = oldPaths.map((pts) => pathCentroid(pts));
    const newShapes = paths.map((np) => {
      const c = pathCentroid(np.points);
      let best = -1, bestD = Infinity;
      for (let i = 0; i < oldCentroids.length; i++) {
        const dd = Math.hypot(c[0] - oldCentroids[i][0], c[1] - oldCentroids[i][1]);
        if (dd < bestD) { bestD = dd; best = i; }
      }
      return best >= 0 ? oldShapes[best] : undefined;
    });
    d.roof = { ...d.roof, shapes: newShapes };
  }
  d.outline = { paths };
}
