// 세움 홈플래너 - 2D 평면 편집기 (HTML5 Canvas)
// 방 추가/이동/크기조절, 가구 배치/이동/회전, 팬/줌, 치수 표시
import { store } from './store.js';
import { ROOM_TYPES, catalogOf, rid, WINDOW_TYPES, opening, outlinePoints, outlineShape, outlineShapes } from './data.js';

const GRID = 100;          // 스냅 단위 (mm)
const HANDLE = 8;          // 핸들 픽셀 크기

export class Editor2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 0.05;       // px per mm
    this.ox = 80;            // pan offset px
    this.oy = 80;
    this.dpr = window.devicePixelRatio || 1;

    this.drag = null;        // 진행 중 드래그 상태
    this.hoverHandle = null;
    this.showFurniture = true;

    this._bind();
    this._resize();
    window.addEventListener('resize', () => { this._resize(); this.draw(); });
    store.subscribe(() => this.draw());
    // 첫 진입 시 화면 맞춤
    requestAnimationFrame(() => { this.fit(); });
  }

  // ---- 좌표 변환 ----
  toPx(mx, my) { return [mx * this.scale + this.ox, my * this.scale + this.oy]; }
  toMm(px, py) { return [(px - this.ox) / this.scale, (py - this.oy) / this.scale]; }
  snap(v) { return Math.round(v / GRID) * GRID; }

  _resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = r.width * this.dpr;
    this.canvas.height = r.height * this.dpr;
    this.cssW = r.width; this.cssH = r.height;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  fit() {
    const d = store.design;
    if (!d.rooms.length) { this.draw(); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of d.rooms) {
      minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.d);
    }
    const pad = 1200;
    const w = (maxX - minX) + pad * 2, h = (maxY - minY) + pad * 2;
    this.scale = Math.min(this.cssW / w, this.cssH / h);
    this.ox = -minX * this.scale + (this.cssW - (maxX - minX) * this.scale) / 2;
    this.oy = -minY * this.scale + (this.cssH - (maxY - minY) * this.scale) / 2;
    this.draw();
  }

  // 도면 전체를 화면 상태와 무관하게 고해상도 PNG(dataURL)로 렌더 (인쇄/내보내기용)
  toImage(w = 1600, h = 1100, mime = 'image/png', quality) {
    const d = store.design;
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const octx = off.getContext('2d');

    // 현재 상태 백업
    const saved = { ctx: this.ctx, scale: this.scale, ox: this.ox, oy: this.oy, cssW: this.cssW, cssH: this.cssH };
    const sel = [store.selectedRoom, store.selectedFurniture, store.selectedOpening];
    store.selectedRoom = store.selectedFurniture = store.selectedOpening = null;

    this.ctx = octx; this.cssW = w; this.cssH = h; this._export = true;
    octx.setTransform(1, 0, 0, 1, 0, 0);

    // 도면을 캔버스에 맞춤
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of d.rooms) {
      minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.d);
    }
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 1000; maxY = 1000; }
    const pad = 1500;
    const bw = (maxX - minX) + pad * 2, bh = (maxY - minY) + pad * 2;
    this.scale = Math.min(w / bw, h / bh);
    this.ox = -minX * this.scale + (w - (maxX - minX) * this.scale) / 2;
    this.oy = -minY * this.scale + (h - (maxY - minY) * this.scale) / 2;

    this.draw();
    const url = off.toDataURL(mime, quality);

    // 복원
    Object.assign(this, saved);
    this._export = false;
    [store.selectedRoom, store.selectedFurniture, store.selectedOpening] = sel;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.draw();
    return url;
  }

  // ---- 그리기 ----
  draw() {
    const ctx = this.ctx, d = store.design;
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    this._drawGrid();

    // 밑그림(참조 도면 PDF/이미지) - 방보다 아래에 깔기
    this._drawUnderlay();

    // 집 외곽(외벽) - 방보다 아래(틀)
    this._drawOutline();

    // 방
    for (const room of d.rooms) this._drawRoom(room);
    // 선택 방 핸들
    const sel = d.rooms.find((r) => r.id === store.selectedRoom);
    if (sel) this._drawHandles(sel);

    // 창호(개구부)
    for (const o of (d.openings || [])) this._drawOpening(o);

    // 가구
    if (this.showFurniture) for (const f of d.furniture) this._drawFurniture(f);

    // 축척 보정 중 클릭 점/선 표시
    if (this.calib) this._drawCalib();
    // 방 그리기 미리보기
    if (this.drag && this.drag.mode === 'drawnew') this._drawNewPreview(this.drag);

    // 선택 안내
    this._drawScaleBar();
  }

  // ---- 밑그림(참조 도면) ----
  _drawUnderlay() {
    if (this._export) return; // 인쇄/내보내기에는 밑그림 제외
    const u = store.design.underlay;
    if (!u || !u.src || u.hidden) return;
    let img = this._uImg;
    if (!img || img._key !== u.src) {
      img = this._uImg = new Image();
      img._key = u.src;
      img.onload = () => this.draw();
      img.src = u.src;
    }
    if (!img.complete || !img.naturalWidth) return;
    const [x, y] = this.toPx(u.x, u.y);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = (u.opacity != null ? u.opacity : 0.5);
    ctx.drawImage(img, x, y, u.w * this.scale, u.h * this.scale);
    ctx.restore();
  }

  _drawCalib() {
    const ctx = this.ctx;
    const pts = this.calib.pts.map((p) => this.toPx(p[0], p[1]));
    ctx.save();
    ctx.strokeStyle = '#c8102e'; ctx.fillStyle = '#c8102e'; ctx.lineWidth = 2;
    if (pts.length === 2) {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.stroke();
    }
    for (const p of pts) { ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  // 밑그림이 화면에 꽉 차도록 보기 이동
  focusUnderlay() {
    const u = store.design.underlay;
    if (!u) { this.fit(); return; }
    const pad = 600;
    const w = u.w + pad * 2, h = u.h + pad * 2;
    this.scale = Math.max(0.0008, Math.min(this.cssW / w, this.cssH / h));
    this.ox = -(u.x - pad) * this.scale;
    this.oy = -(u.y - pad) * this.scale;
    this.draw();
  }

  // 두 점으로 실제 거리(mm)를 입력해 밑그림 축척 맞추기
  startCalibrate() {
    if (!store.design.underlay) return;
    this.calib = { pts: [] };
    this.canvas.style.cursor = 'crosshair';
    this.draw();
  }

  _drawGrid() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = this._export ? '#ffffff' : '#f4f5f7';
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    const step = 1000 * this.scale; // 1m 격자
    if (step > 6) {
      ctx.strokeStyle = this._export ? '#eceef1' : '#e3e5e9';
      ctx.lineWidth = 1;
      const startX = this.ox % step, startY = this.oy % step;
      ctx.beginPath();
      for (let x = startX; x < this.cssW; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, this.cssH); }
      for (let y = startY; y < this.cssH; y += step) { ctx.moveTo(0, y); ctx.lineTo(this.cssW, y); }
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawRoom(room) {
    const ctx = this.ctx;
    const t = ROOM_TYPES[room.type] || ROOM_TYPES.hall;
    const [x, y] = this.toPx(room.x, room.y);
    const w = room.w * this.scale, h = room.d * this.scale;
    const selected = room.id === store.selectedRoom;

    // 바닥
    ctx.fillStyle = t.color;
    ctx.fillRect(x, y, w, h);
    // 벽 (면별로 그림 — 트인(open) 면은 점선 통로로 표시)
    const open = Array.isArray(room.open) ? room.open : [];
    const hov = this.wallEdit && this._hoverWall && this._hoverWall.roomId === room.id ? this._hoverWall.side : null;
    const drawWall = (x1, y1, x2, y2, side) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      if (side === hov) { ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 6; ctx.setLineDash([]); }
      else if (open.includes(side)) { ctx.strokeStyle = '#c2c7ce'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); }
      else { ctx.strokeStyle = selected ? '#c8102e' : '#5b5f66'; ctx.lineWidth = selected ? 4 : 3; ctx.setLineDash([]); }
      ctx.stroke(); ctx.setLineDash([]);
    };
    drawWall(x, y, x + w, y, 'n');
    drawWall(x, y + h, x + w, y + h, 's');
    drawWall(x, y, x, y + h, 'w');
    drawWall(x + w, y, x + w, y + h, 'e');

    // 라벨 + 면적
    const area = (room.w * room.d) / 1e6; // m²
    ctx.fillStyle = '#33373d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const big = Math.min(16, Math.max(10, w / 8));
    ctx.font = `600 ${big}px "Noto Sans KR", sans-serif`;
    if (w > 40 && h > 30) {
      ctx.fillText(room.name || t.label, x + w / 2, y + h / 2 - big * 0.5);
      ctx.font = `${big * 0.8}px "Noto Sans KR", sans-serif`;
      ctx.fillStyle = '#6b7079';
      ctx.fillText(area.toFixed(1) + 'm²', x + w / 2, y + h / 2 + big * 0.6);
    }

    // 치수선 (선택 시)
    if (selected) {
      ctx.fillStyle = '#c8102e';
      ctx.font = '11px "Noto Sans KR", sans-serif';
      ctx.fillText((room.w) + ' mm', x + w / 2, y - 10);
      ctx.save();
      ctx.translate(x - 12, y + h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText((room.d) + ' mm', 0, 0);
      ctx.restore();
    }
  }

  _drawHandles(room) {
    const ctx = this.ctx;
    const [x, y] = this.toPx(room.x, room.y);
    const w = room.w * this.scale, h = room.d * this.scale;
    const pts = this._handlePoints(x, y, w, h);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#c8102e';
    ctx.lineWidth = 2;
    for (const p of Object.values(pts)) {
      ctx.fillRect(p[0] - HANDLE / 2, p[1] - HANDLE / 2, HANDLE, HANDLE);
      ctx.strokeRect(p[0] - HANDLE / 2, p[1] - HANDLE / 2, HANDLE, HANDLE);
    }
  }

  _handlePoints(x, y, w, h) {
    return {
      nw: [x, y], n: [x + w / 2, y], ne: [x + w, y],
      e: [x + w, y + h / 2], se: [x + w, y + h],
      s: [x + w / 2, y + h], sw: [x, y + h], w: [x, y + h / 2],
    };
  }

  _drawFurniture(f) {
    const c = catalogOf(f.catalogId);
    if (!c) return;
    const ctx = this.ctx;
    const [cx, cy] = this.toPx(f.x, f.y);
    const w = c.w * this.scale, d = c.d * this.scale;
    const selected = f.id === store.selectedFurniture;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((f.rotation || 0) * Math.PI / 180);
    ctx.fillStyle = c.color;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(-w / 2, -d / 2, w, d);
    ctx.globalAlpha = 1;
    ctx.lineWidth = selected ? 2.5 : 1.2;
    ctx.strokeStyle = selected ? '#c8102e' : '#6b6b6b';
    ctx.strokeRect(-w / 2, -d / 2, w, d);
    // 방향 표시 (앞쪽)
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-w / 2, d / 2 - Math.min(d * 0.25, 6), w, Math.min(d * 0.25, 6));
    // 라벨
    if (w > 34) {
      ctx.fillStyle = '#2a2a2a';
      ctx.font = '10px "Noto Sans KR", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(c.name, 0, 0);
    }
    ctx.restore();
    // 회전 핸들
    if (selected) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((f.rotation || 0) * Math.PI / 180);
      const hy = -d / 2 - 18;
      ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -d / 2); ctx.lineTo(0, hy); ctx.stroke();
      ctx.fillStyle = '#c8102e';
      ctx.beginPath(); ctx.arc(0, hy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  _drawScaleBar() {
    const ctx = this.ctx;
    const mm = 1000;
    const px = mm * this.scale;
    const x = 16, y = this.cssH - 24;
    ctx.strokeStyle = '#33373d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + px, y);
    ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
    ctx.moveTo(x + px, y - 4); ctx.lineTo(x + px, y + 4);
    ctx.stroke();
    ctx.fillStyle = '#33373d'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('1 m', x + px + 6, y + 4);
  }

  // ---- 창호(개구부) ----
  // 개구부의 평면 기하 계산 (mm 단위 끝점 + 외향 방향)
  _openingGeom(o) {
    const room = store.design.rooms.find((r) => r.id === o.roomId);
    if (!room) return null;
    const half = o.w / 2;
    let cx, cy, horizontal, nx = 0, ny = 0;
    const span = (o.side === 'n' || o.side === 's') ? room.w : room.d;
    const pos = Math.max(half, Math.min(span - half, o.pos)); // 벽 안에 들어오도록
    if (o.side === 'n') { cx = room.x + pos; cy = room.y;          horizontal = true;  ny = -1; }
    else if (o.side === 's') { cx = room.x + pos; cy = room.y + room.d; horizontal = true;  ny = 1; }
    else if (o.side === 'w') { cx = room.x;          cy = room.y + pos; horizontal = false; nx = -1; }
    else { cx = room.x + room.w; cy = room.y + pos;                horizontal = false; nx = 1; }
    return { room, cx, cy, horizontal, nx, ny, half };
  }

  _drawOpening(o) {
    const g = this._openingGeom(o); if (!g) return;
    const ctx = this.ctx;
    const t = WINDOW_TYPES[o.winType] || {};
    const isDoor = t.glass === false;
    const selected = o.id === store.selectedOpening;
    const [pcx, pcy] = this.toPx(g.cx, g.cy);
    const len = o.w * this.scale;
    const thick = 9; // 화면상 벽 두께 표현

    ctx.save();
    ctx.translate(pcx, pcy);
    if (!g.horizontal) ctx.rotate(Math.PI / 2);

    // 벽 끊기 (흰 배경)
    ctx.fillStyle = '#f4f5f7';
    ctx.fillRect(-len / 2, -thick / 2 - 1, len, thick + 2);

    if (isDoor) {
      // 문: 문짝 + 열림 호
      ctx.strokeStyle = selected ? '#c8102e' : '#4a5560';
      ctx.lineWidth = selected ? 2.5 : 1.6;
      ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(-len / 2, len); ctx.stroke();
      ctx.beginPath(); ctx.arc(-len / 2, 0, len, 0, Math.PI / 2); ctx.stroke();
    } else {
      // 창: 평행 이중선(유리) + 분할
      ctx.strokeStyle = selected ? '#c8102e' : (o.color || '#4a5560');
      ctx.lineWidth = selected ? 2.5 : 1.8;
      ctx.beginPath();
      ctx.moveTo(-len / 2, -thick / 2); ctx.lineTo(len / 2, -thick / 2);
      ctx.moveTo(-len / 2, thick / 2);  ctx.lineTo(len / 2, thick / 2);
      ctx.stroke();
      // 끝막이
      ctx.beginPath();
      ctx.moveTo(-len / 2, -thick / 2); ctx.lineTo(-len / 2, thick / 2);
      ctx.moveTo(len / 2, -thick / 2);  ctx.lineTo(len / 2, thick / 2);
      ctx.stroke();
      // 분할선 (창짝 수)
      const panes = Math.max(1, t.panes || 1);
      ctx.lineWidth = 1;
      for (let i = 1; i < panes; i++) {
        const x = -len / 2 + (len * i) / panes;
        ctx.beginPath(); ctx.moveTo(x, -thick / 2); ctx.lineTo(x, thick / 2); ctx.stroke();
      }
    }
    ctx.restore();

    // 선택 시 라벨
    if (selected) {
      ctx.fillStyle = '#c8102e';
      ctx.font = '11px "Noto Sans KR", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(`${t.label || '창'} ${o.w}mm`, pcx + g.nx * 16, pcy + g.ny * 16);
    }
  }

  _hitOpening(px, py) {
    const d = store.design;
    for (let i = (d.openings || []).length - 1; i >= 0; i--) {
      const o = d.openings[i];
      const g = this._openingGeom(o); if (!g) continue;
      const [pcx, pcy] = this.toPx(g.cx, g.cy);
      const len = o.w * this.scale;
      const along = g.horizontal ? Math.abs(px - pcx) : Math.abs(py - pcy);
      const across = g.horizontal ? Math.abs(py - pcy) : Math.abs(px - pcx);
      if (along <= len / 2 + 4 && across <= 8) return o;
    }
    return null;
  }

  // ---- 히트 테스트 ----
  _hitHandle(room, px, py) {
    const [x, y] = this.toPx(room.x, room.y);
    const w = room.w * this.scale, h = room.d * this.scale;
    const pts = this._handlePoints(x, y, w, h);
    for (const [k, p] of Object.entries(pts)) {
      if (Math.abs(px - p[0]) <= HANDLE && Math.abs(py - p[1]) <= HANDLE) return k;
    }
    return null;
  }

  _hitFurnitureRotate(f, px, py) {
    const c = catalogOf(f.catalogId); if (!c) return false;
    const [cx, cy] = this.toPx(f.x, f.y);
    const d = c.d * this.scale;
    const ang = (f.rotation || 0) * Math.PI / 180;
    // 회전 핸들 위치 계산 (로컬 좌표 → 화면 좌표)
    const lx = 0, ly = -d / 2 - 18;
    const wx = cx + (lx * Math.cos(ang) - ly * Math.sin(ang));
    const wy = cy + (lx * Math.sin(ang) + ly * Math.cos(ang));
    return Math.hypot(px - wx, py - wy) <= 9;
  }

  _hitFurniture(px, py) {
    const d = store.design;
    for (let i = d.furniture.length - 1; i >= 0; i--) {
      const f = d.furniture[i];
      const c = catalogOf(f.catalogId); if (!c) continue;
      const [cx, cy] = this.toPx(f.x, f.y);
      const ang = -(f.rotation || 0) * Math.PI / 180;
      const dx = px - cx, dy = py - cy;
      const lx = dx * Math.cos(ang) - dy * Math.sin(ang);
      const ly = dx * Math.sin(ang) + dy * Math.cos(ang);
      const w = c.w * this.scale / 2, h = c.d * this.scale / 2;
      if (Math.abs(lx) <= w && Math.abs(ly) <= h) return f;
    }
    return null;
  }

  _hitRoom(px, py) {
    const d = store.design;
    for (let i = d.rooms.length - 1; i >= 0; i--) {
      const r = d.rooms[i];
      const [x, y] = this.toPx(r.x, r.y);
      const w = r.w * this.scale, h = r.d * this.scale;
      if (px >= x && px <= x + w && py >= y && py <= y + h) return r;
    }
    return null;
  }

  // ---- 입력 ----
  _bind() {
    const cv = this.canvas;
    cv.addEventListener('mousedown', (e) => this._down(e));
    window.addEventListener('mousemove', (e) => this._move(e));
    window.addEventListener('mouseup', (e) => this._up(e));
    cv.addEventListener('wheel', (e) => this._wheel(e), { passive: false });

    // 가구 라이브러리에서 드롭
    cv.addEventListener('dragover', (e) => { e.preventDefault(); });
    cv.addEventListener('drop', (e) => this._drop(e));

    // 집 외곽(다각형) 그리기: 더블클릭으로 완료, Esc로 취소
    cv.addEventListener('dblclick', () => { if (this.drawOutline && this.outlineDraft) this._finishOutlinePoly(false); });
    window.addEventListener('keydown', (e) => {
      if (!this.drawOutline || !this.outlineDraft) return;
      if (e.key === 'Escape') { this.outlineDraft = null; this.draw(); }
      else if (e.key === 'Enter') { this._finishOutlinePoly(false); }
      else if (e.key === 'Backspace') { e.preventDefault(); this.outlineDraft.pop(); if (!this.outlineDraft.length) this.outlineDraft = null; this.draw(); }
    });
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  _down(e) {
    const [px, py] = this._pos(e);
    const d = store.design;

    // 축척 보정 모드: 두 점을 찍고 실제 거리(mm) 입력
    if (this.calib) {
      const [mx, my] = this.toMm(px, py);
      this.calib.pts.push([mx, my]);
      if (this.calib.pts.length >= 2) {
        const [a, b] = this.calib.pts;
        const cur = Math.hypot(b[0] - a[0], b[1] - a[1]); // 현재 두 점 사이 거리(mm)
        const real = parseFloat(prompt('찍은 두 점 사이의 실제 거리(mm)를 입력하세요.\n예: 1000 = 1m', '1000'));
        if (real > 0 && cur > 0) {
          const factor = real / cur;
          store.liveUpdate((dd) => {
            const u = dd.underlay;
            u.x = a[0] + (u.x - a[0]) * factor;
            u.y = a[1] + (u.y - a[1]) * factor;
            u.w *= factor; u.h *= factor;
          });
          store.liveEnd();
        }
        this.calib = null;
        this.canvas.style.cursor = 'default';
      }
      this.draw();
      return;
    }

    // 스페이스 또는 가운데 버튼 → 팬
    if (e.button === 1 || e.altKey) {
      this.drag = { mode: 'pan', sx: px, sy: py, ox: this.ox, oy: this.oy };
      return;
    }

    // 벽 편집 모드: 클릭한 벽을 트기↔막기
    if (this.wallEdit) {
      const hit = this._hitWall(px, py);
      if (hit) this._toggleWall(hit.room, hit.side);
      return;
    }

    // 집 외곽 그리기: 클릭으로 모서리 점 추가 (직선 구간)
    if (this.drawOutline) { this._outlineClick(px, py); return; }

    // 방 그리기 모드: 도면 위에서 대각선 드래그로 방 생성
    if (this.drawRoom) {
      const [mx, my] = this.toMm(px, py);
      this.drag = { mode: 'drawnew', ax: mx, ay: my, cx: mx, cy: my };
      return;
    }

    // 선택된 방 핸들 우선
    const selRoom = d.rooms.find((r) => r.id === store.selectedRoom);
    if (selRoom) {
      const hk = this._hitHandle(selRoom, px, py);
      if (hk) {
        this.drag = { mode: 'resize', room: selRoom, handle: hk };
        return;
      }
    }
    // 선택된 가구 회전 핸들
    const selF = d.furniture.find((f) => f.id === store.selectedFurniture);
    if (selF && this._hitFurnitureRotate(selF, px, py)) {
      this.drag = { mode: 'rotate', f: selF };
      return;
    }

    // 창호 클릭 (벽 가장자리)
    const op = this._hitOpening(px, py);
    if (op) {
      store.select(null, null, op.id);
      this.drag = { mode: 'moveo', o: op };
      return;
    }

    // 가구 클릭
    const f = this._hitFurniture(px, py);
    if (f) {
      store.select(null, f.id);
      const [mx, my] = this.toMm(px, py);
      this.drag = { mode: 'movef', f, dx: mx - f.x, dy: my - f.y };
      return;
    }

    // 방 클릭
    const room = this._hitRoom(px, py);
    if (room) {
      store.select(room.id, null);
      const [mx, my] = this.toMm(px, py);
      this.drag = { mode: 'mover', room, dx: mx - room.x, dy: my - room.y };
      return;
    }

    // 빈 곳 → 선택 해제 + 팬
    store.select(null, null);
    this.drag = { mode: 'pan', sx: px, sy: py, ox: this.ox, oy: this.oy };
  }

  _move(e) {
    const [px, py] = this._pos(e);
    // 외곽 그리기 중: 마지막 점 → 커서 고무줄 미리보기
    if (this.drawOutline && this.outlineDraft) {
      const [mx, my] = this.toMm(px, py);
      this._outlineCursor = this._outlineSnap(mx, my);
      this.draw();
      return;
    }
    if (!this.drag) { this._updateCursor(px, py); return; }
    const drag = this.drag;

    if (drag.mode === 'pan') {
      this.ox = drag.ox + (px - drag.sx);
      this.oy = drag.oy + (py - drag.sy);
      this.draw();
      return;
    }

    if (drag.mode === 'drawnew') {
      const [mxx, myy] = this.toMm(px, py);
      drag.cx = mxx; drag.cy = myy;
      this.draw();
      return;
    }

    const [mx, my] = this.toMm(px, py);

    // 실제 편집이 시작되는 첫 이동에서만 되돌리기 스냅샷 기록
    if (!drag.snapped) { store.snapshot(); drag.snapped = true; }

    if (drag.mode === 'mover') {
      const sn = this._snapRoomMove(drag.room, this.snap(mx - drag.dx), this.snap(my - drag.dy));
      store.liveUpdate(() => { drag.room.x = sn.x; drag.room.y = sn.y; });
    } else if (drag.mode === 'movef') {
      store.liveUpdate(() => {
        drag.f.x = this.snap(mx - drag.dx);
        drag.f.y = this.snap(my - drag.dy);
      });
    } else if (drag.mode === 'moveo') {
      const room = store.design.rooms.find((r) => r.id === drag.o.roomId);
      if (room) {
        const along = (drag.o.side === 'n' || drag.o.side === 's') ? (mx - room.x) : (my - room.y);
        store.liveUpdate(() => { drag.o.pos = this.snap(along); });
      }
    } else if (drag.mode === 'resize') {
      this._resizeRoom(drag.room, drag.handle, mx, my);
    } else if (drag.mode === 'rotate') {
      const [cx, cy] = this.toPx(drag.f.x, drag.f.y);
      let ang = Math.atan2(py - cy, px - cx) * 180 / Math.PI + 90;
      ang = Math.round(ang / 15) * 15;
      store.liveUpdate(() => { drag.f.rotation = ((ang % 360) + 360) % 360; });
    }
  }

  _resizeRoom(room, handle, mx, my) {
    const MIN = 800;
    let { x, y, w, d } = room;
    const right = x + w, bottom = y + d;
    mx = this.snap(mx); my = this.snap(my);
    if (handle.includes('w')) { x = Math.min(mx, right - MIN); w = right - x; }
    if (handle.includes('e')) { w = Math.max(MIN, mx - x); }
    if (handle.includes('n')) { y = Math.min(my, bottom - MIN); d = bottom - y; }
    if (handle.includes('s')) { d = Math.max(MIN, my - y); }
    store.liveUpdate(() => { room.x = x; room.y = y; room.w = w; room.d = d; });
  }

  _up() {
    if (this.drag && this.drag.mode === 'drawnew') { this._finishDraw(this.drag); this.drag = null; return; }
    if (this.drag && ['mover', 'movef', 'resize', 'rotate', 'moveo'].includes(this.drag.mode)) {
      store.liveEnd();
    }
    this.drag = null;
  }

  // 집 외곽(외벽) 그리기 모드 on/off — 모서리를 클릭해 직선 구간(다각형)으로 그림
  setDrawOutline(on) {
    this.drawOutline = !!on;
    this.outlineDraft = null; this._outlineCursor = null;
    if (on) { this.drawRoom = null; this.wallEdit = false; this.calib = null; this._hoverWall = null; }
    this.canvas.style.cursor = on ? 'crosshair' : 'default';
    this.draw();
  }

  // 외곽 점 스냅: 격자(100mm) + 직전 점과 거의 수평/수직이면 직각으로 정렬
  _outlineSnap(mx, my) {
    let x = this.snap(mx), y = this.snap(my);
    const draft = this.outlineDraft;
    if (draft && draft.length) {
      const last = draft[draft.length - 1];
      const dx = x - last[0], dy = y - last[1];
      if (Math.abs(dx) < 700 && Math.abs(dx) <= Math.abs(dy)) x = last[0];      // 수직 벽
      else if (Math.abs(dy) < 700) y = last[1];                                 // 수평 벽
    }
    return [x, y];
  }

  // 외곽 그리기 클릭 처리 (점 추가 / 시작점 클릭 시 닫기)
  _outlineClick(px, py) {
    const [mx, my] = this.toMm(px, py);
    const pt = this._outlineSnap(mx, my);
    if (!this.outlineDraft) { this.outlineDraft = [pt]; }
    else {
      const f = this.outlineDraft[0];
      const [fx, fy] = this.toPx(f[0], f[1]);
      if (this.outlineDraft.length >= 3 && Math.hypot(px - fx, py - fy) < 16) { this._finishOutlinePoly(true); return; }
      this.outlineDraft.push(pt);
    }
    this.draw();
  }

  // 외곽 경로를 누적 추가 — 이전 벽을 지우지 않음 (여러 외벽 가능)
  // closed=true면 닫힌 다각형, 아니면 열린 벽선(완성 강제 안 함, 2점 이상이면 OK)
  _finishOutlinePoly(closed) {
    if (this.outlineDraft && this.outlineDraft.length >= 2) {
      const path = { points: this.outlineDraft.slice(), closed: !!closed && this.outlineDraft.length >= 3 };
      store.commit((dd) => {
        const cur = dd.outline;
        let paths;
        if (cur && Array.isArray(cur.paths)) paths = cur.paths.slice();
        else if (cur && Array.isArray(cur.points)) paths = [{ points: cur.points, closed: cur.closed !== false && cur.points.length >= 3 }];
        else if (cur && 'w' in cur) paths = [{ points: [[cur.x, cur.y], [cur.x + cur.w, cur.y], [cur.x + cur.w, cur.y + cur.d], [cur.x, cur.y + cur.d]], closed: true }];
        else paths = [];
        paths.push(path);
        dd.outline = { paths };
      });
    }
    this.outlineDraft = null; this._outlineCursor = null;
    this.draw();
  }

  // 방을 옮길 때 외곽/다른 방 모서리에 자동 정렬(스냅)
  _snapRoomMove(room, x, y) {
    const SNAP = 250; // mm 이내면 달라붙음
    const d = store.design;
    const xs = [], ys = [];
    if (d.outline) { xs.push(d.outline.x, d.outline.x + d.outline.w); ys.push(d.outline.y, d.outline.y + d.outline.d); }
    for (const r of d.rooms) { if (r.id === room.id) continue; xs.push(r.x, r.x + r.w); ys.push(r.y, r.y + r.d); }
    let nx = x, bx = SNAP;
    for (const gx of xs) {
      if (Math.abs(x - gx) < bx) { bx = Math.abs(x - gx); nx = gx; }
      if (Math.abs((x + room.w) - gx) < bx) { bx = Math.abs((x + room.w) - gx); nx = gx - room.w; }
    }
    let ny = y, by = SNAP;
    for (const gy of ys) {
      if (Math.abs(y - gy) < by) { by = Math.abs(y - gy); ny = gy; }
      if (Math.abs((y + room.d) - gy) < by) { by = Math.abs((y + room.d) - gy); ny = gy - room.d; }
    }
    return { x: nx, y: ny };
  }

  // 방 그리기 모드 on/off (type=방종류 키 또는 null)
  setDrawRoom(type) {
    this.drawRoom = type || null;
    if (this.drawRoom) { this.calib = null; this.wallEdit = false; this.drawOutline = false; this._hoverWall = null; }
    this.canvas.style.cursor = this.drawRoom ? 'crosshair' : 'default';
    this.draw();
  }

  // 벽 편집 모드 on/off — 2D에서 벽을 클릭해 트기↔막기
  setWallEdit(on) {
    this.wallEdit = !!on;
    if (on) { this.drawRoom = null; this.drawOutline = false; this.calib = null; }
    this._hoverWall = null;
    this.canvas.style.cursor = on ? 'pointer' : 'default';
    this.draw();
  }

  // 클릭/마우스 지점에서 가장 가까운 방 벽(면) 찾기 (px 기준)
  _hitWall(px, py) {
    let best = null, bestD = 12; // 12px 이내
    const distSeg = (x1, y1, x2, y2) => {
      const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
      let t = ((px - x1) * dx + (py - y1) * dy) / L2; t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    };
    for (const room of store.design.rooms) {
      const [x, y] = this.toPx(room.x, room.y);
      const w = room.w * this.scale, h = room.d * this.scale;
      const edges = [
        ['n', x, y, x + w, y], ['s', x, y + h, x + w, y + h],
        ['w', x, y, x, y + h], ['e', x + w, y, x + w, y + h],
      ];
      for (const [side, x1, y1, x2, y2] of edges) {
        const d = distSeg(x1, y1, x2, y2);
        if (d < bestD) { bestD = d; best = { room, side }; }
      }
    }
    return best;
  }

  // 같은 벽을 공유하는 맞닿은 방과 면 찾기
  _adjacentWall(room, side) {
    const TOL = 60; // mm
    const overlap = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > 50;
    for (const r of store.design.rooms) {
      if (r.id === room.id) continue;
      if (side === 'n' && Math.abs((r.y + r.d) - room.y) <= TOL && overlap(r.x, r.x + r.w, room.x, room.x + room.w)) return { room: r, side: 's' };
      if (side === 's' && Math.abs(r.y - (room.y + room.d)) <= TOL && overlap(r.x, r.x + r.w, room.x, room.x + room.w)) return { room: r, side: 'n' };
      if (side === 'w' && Math.abs((r.x + r.w) - room.x) <= TOL && overlap(r.y, r.y + r.d, room.y, room.y + room.d)) return { room: r, side: 'e' };
      if (side === 'e' && Math.abs(r.x - (room.x + room.w)) <= TOL && overlap(r.y, r.y + r.d, room.y, room.y + room.d)) return { room: r, side: 'w' };
    }
    return null;
  }

  // 벽 트기↔막기 (맞닿은 방의 면도 함께 토글 → 통로가 실제로 뚫림)
  _toggleWall(room, side) {
    const flip = (r, s) => {
      const open = Array.isArray(r.open) ? r.open : (r.open = []);
      const i = open.indexOf(s);
      if (i >= 0) open.splice(i, 1); else open.push(s);
    };
    const adj = this._adjacentWall(room, side);
    store.commit(() => { flip(room, side); if (adj) flip(adj.room, adj.side); });
  }

  // 드래그한 사각형으로 방 생성 (밑그림 따라 그리기)
  _finishDraw(drag) {
    const x0 = this.snap(Math.min(drag.ax, drag.cx));
    const y0 = this.snap(Math.min(drag.ay, drag.cy));
    const x1 = this.snap(Math.max(drag.ax, drag.cx));
    const y1 = this.snap(Math.max(drag.ay, drag.cy));
    const w = x1 - x0, dd = y1 - y0;
    if (w < 300 || dd < 300) { this.draw(); return; } // 너무 작으면 무시
    const type = this.drawRoom;
    const t = ROOM_TYPES[type] || ROOM_TYPES.living;
    store.commit((d) => {
      const room = { id: rid(), type, name: t.label, x: x0, y: y0, w, d: dd };
      d.rooms.push(room);
      store.selectedRoom = room.id; store.selectedFurniture = store.selectedOpening = null;
    });
  }

  // 두 점(mm) 사이 길이(치수) 라벨을 변 중앙에 표시
  _segLabel(a, p, color) {
    const len = Math.round(Math.hypot(p[0] - a[0], p[1] - a[1]));
    if (len < 1) return;
    const [ax, ay] = this.toPx(a[0], a[1]);
    const [bx, by] = this.toPx(p[0], p[1]);
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const ctx = this.ctx;
    ctx.save();
    ctx.font = '600 12px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = len + ' mm';
    const w = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(mx - w / 2, my - 9, w, 18);
    ctx.fillStyle = color;
    ctx.fillText(label, mx, my + 1);
    ctx.restore();
  }

  // 집 외곽(외벽) 2D 표시 — 직선 구간 벽 + 치수 + 그리는 중 미리보기
  _drawOutline() {
    const ctx = this.ctx;
    const t = Math.max(3, 200 * this.scale); // 외벽 두께 200mm
    for (const { pts, closed } of outlineShapes(store.design.outline)) {
      ctx.save();
      ctx.lineJoin = 'miter'; ctx.lineCap = 'round';
      ctx.strokeStyle = '#3a3f44'; ctx.lineWidth = t;
      ctx.beginPath();
      pts.forEach((p, i) => { const [x, y] = this.toPx(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      if (closed) ctx.closePath();
      ctx.stroke();
      ctx.restore();
      // 각 변 치수
      for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) this._segLabel(pts[i], pts[(i + 1) % pts.length], '#3a3f44');
    }
    // 그리는 중(draft) — 직선 + 치수 + 점
    const draft = this.outlineDraft;
    if (draft && draft.length) {
      ctx.save();
      ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.beginPath();
      draft.forEach((p, i) => { const [x, y] = this.toPx(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      if (this._outlineCursor) { const [cx, cy] = this.toPx(this._outlineCursor[0], this._outlineCursor[1]); ctx.lineTo(cx, cy); }
      ctx.stroke(); ctx.setLineDash([]);
      draft.forEach((p, i) => {
        const [x, y] = this.toPx(p[0], p[1]);
        ctx.fillStyle = (i === 0 && draft.length >= 3) ? '#c8102e' : '#fff';
        ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, i === 0 ? 6 : 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
      ctx.restore();
      // 놓인 구간 치수 + 현재(고무줄) 구간 길이 실시간 표시
      for (let i = 0; i < draft.length - 1; i++) this._segLabel(draft[i], draft[i + 1], '#c8102e');
      if (this._outlineCursor) this._segLabel(draft[draft.length - 1], this._outlineCursor, '#c8102e');
    }
  }

  _drawNewPreview(drag) {
    const x0 = this.snap(Math.min(drag.ax, drag.cx)), y0 = this.snap(Math.min(drag.ay, drag.cy));
    const x1 = this.snap(Math.max(drag.ax, drag.cx)), y1 = this.snap(Math.max(drag.ay, drag.cy));
    const [px, py] = this.toPx(x0, y0);
    const w = (x1 - x0) * this.scale, h = (y1 - y0) * this.scale;
    const isOutline = drag.mode === 'drawoutline';
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = isOutline ? 'rgba(58,63,68,0.12)' : (ROOM_TYPES[this.drawRoom] || ROOM_TYPES.living).color + 'aa';
    ctx.fillRect(px, py, w, h);
    ctx.strokeStyle = isOutline ? '#3a3f44' : '#c8102e';
    ctx.lineWidth = isOutline ? Math.max(3, 200 * this.scale) : 2; ctx.setLineDash([6, 4]);
    ctx.strokeRect(px, py, w, h);
    ctx.setLineDash([]);
    ctx.fillStyle = '#c8102e'; ctx.font = '12px sans-serif';
    ctx.fillText(`${x1 - x0}×${y1 - y0}`, px + 4, py + 14);
    ctx.restore();
  }

  _wheel(e) {
    e.preventDefault();
    const [px, py] = this._pos(e);
    const [mx, my] = this.toMm(px, py);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.scale = Math.max(0.008, Math.min(0.5, this.scale * factor));
    // 커서 기준 줌
    this.ox = px - mx * this.scale;
    this.oy = py - my * this.scale;
    this.draw();
  }

  _updateCursor(px, py) {
    const d = store.design;
    // 벽 편집 모드: 가까운 벽을 강조 표시
    if (this.wallEdit) {
      const hit = this._hitWall(px, py);
      const next = hit ? { roomId: hit.room.id, side: hit.side } : null;
      const cur = this._hoverWall;
      if ((next && (!cur || cur.roomId !== next.roomId || cur.side !== next.side)) || (!next && cur)) {
        this._hoverWall = next; this.draw();
      }
      this.canvas.style.cursor = hit ? 'pointer' : 'default';
      return;
    }
    const selRoom = d.rooms.find((r) => r.id === store.selectedRoom);
    let cur = 'default';
    if (selRoom) {
      const hk = this._hitHandle(selRoom, px, py);
      if (hk) cur = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }[hk];
    }
    if (cur === 'default') {
      if (this._hitOpening(px, py)) cur = 'move';
      else if (this._hitFurniture(px, py) || this._hitRoom(px, py)) cur = 'move';
    }
    this.canvas.style.cursor = cur;
  }

  _drop(e) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    const [px, py] = this._pos(e);
    const [mx, my] = this.toMm(px, py);

    // 창호 드롭: "win:<type>" → 가장 가까운 방의 가까운 벽에 부착
    if (raw.startsWith('win:')) {
      const winType = raw.slice(4);
      this._dropWindow(winType, mx, my);
      return;
    }
    // 가구 드롭
    store.commit((d) => {
      d.furniture.push({ id: 'f' + Date.now().toString(36), catalogId: raw, x: this.snap(mx), y: this.snap(my), rotation: 0 });
    });
  }

  // 창호를 드롭 지점에서 가장 가까운 방의 가장 가까운 벽면에 부착
  _dropWindow(winType, mx, my) {
    const d = store.design;
    if (!d.rooms.length) return;
    let best = null;
    for (const room of d.rooms) {
      // 점을 방 영역으로 클램프했을 때의 거리로 가까운 방 판정
      const cxClamp = Math.max(room.x, Math.min(room.x + room.w, mx));
      const cyClamp = Math.max(room.y, Math.min(room.y + room.d, my));
      const dist = Math.hypot(mx - cxClamp, my - cyClamp);
      // 4개 벽까지의 거리
      const edges = [
        { side: 'n', dd: Math.abs(my - room.y),          pos: mx - room.x },
        { side: 's', dd: Math.abs(my - (room.y + room.d)), pos: mx - room.x },
        { side: 'w', dd: Math.abs(mx - room.x),          pos: my - room.y },
        { side: 'e', dd: Math.abs(mx - (room.x + room.w)), pos: my - room.y },
      ];
      for (const ed of edges) {
        const score = dist + ed.dd;
        if (!best || score < best.score) best = { room, side: ed.side, pos: ed.pos, score };
      }
    }
    if (!best) return;
    store.commit((dd) => {
      const o = opening(best.room.id, best.side, this.snap(best.pos), winType);
      dd.openings.push(o);
      store.selectedOpening = o.id;
      store.selectedRoom = store.selectedFurniture = null;
    });
  }
}
