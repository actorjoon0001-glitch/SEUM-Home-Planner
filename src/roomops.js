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
}

// 방 여러 개를 (dx,dy)만큼 함께 이동.
export function moveRoomsInDesign(d, ids, dx, dy) {
  for (const id of ids) {
    const r = d.rooms.find((x) => x.id === id);
    if (r) { r.x += dx; r.y += dy; }
  }
}
