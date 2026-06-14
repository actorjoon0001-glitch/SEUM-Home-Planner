// 세움 홈플래너 - 2D 평면 편집기 (HTML5 Canvas)
// 방 추가/이동/크기조절, 가구 배치/이동/회전, 팬/줌, 치수 표시
import { store } from './store.js';
import { ROOM_TYPES, catalogOf, rid } from './data.js';

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

  // ---- 그리기 ----
  draw() {
    const ctx = this.ctx, d = store.design;
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    this._drawGrid();

    // 방
    for (const room of d.rooms) this._drawRoom(room);
    // 선택 방 핸들
    const sel = d.rooms.find((r) => r.id === store.selectedRoom);
    if (sel) this._drawHandles(sel);

    // 가구
    if (this.showFurniture) for (const f of d.furniture) this._drawFurniture(f);

    // 선택 안내
    this._drawScaleBar();
  }

  _drawGrid() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#f4f5f7';
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    const step = 1000 * this.scale; // 1m 격자
    if (step > 6) {
      ctx.strokeStyle = '#e3e5e9';
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
    // 벽 (테두리)
    ctx.lineWidth = selected ? 4 : 3;
    ctx.strokeStyle = selected ? '#c8102e' : '#5b5f66';
    ctx.strokeRect(x, y, w, h);

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
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  _down(e) {
    const [px, py] = this._pos(e);
    const d = store.design;

    // 스페이스 또는 가운데 버튼 → 팬
    if (e.button === 1 || e.altKey) {
      this.drag = { mode: 'pan', sx: px, sy: py, ox: this.ox, oy: this.oy };
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
    if (!this.drag) { this._updateCursor(px, py); return; }
    const drag = this.drag;

    if (drag.mode === 'pan') {
      this.ox = drag.ox + (px - drag.sx);
      this.oy = drag.oy + (py - drag.sy);
      this.draw();
      return;
    }

    const [mx, my] = this.toMm(px, py);

    // 실제 편집이 시작되는 첫 이동에서만 되돌리기 스냅샷 기록
    if (!drag.snapped) { store.snapshot(); drag.snapped = true; }

    if (drag.mode === 'mover') {
      store.liveUpdate(() => {
        drag.room.x = this.snap(mx - drag.dx);
        drag.room.y = this.snap(my - drag.dy);
      });
    } else if (drag.mode === 'movef') {
      store.liveUpdate(() => {
        drag.f.x = this.snap(mx - drag.dx);
        drag.f.y = this.snap(my - drag.dy);
      });
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
    if (this.drag && ['mover', 'movef', 'resize', 'rotate'].includes(this.drag.mode)) {
      store.liveEnd();
    }
    this.drag = null;
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
    const selRoom = d.rooms.find((r) => r.id === store.selectedRoom);
    let cur = 'default';
    if (selRoom) {
      const hk = this._hitHandle(selRoom, px, py);
      if (hk) cur = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }[hk];
    }
    if (cur === 'default') {
      if (this._hitFurniture(px, py) || this._hitRoom(px, py)) cur = 'move';
    }
    this.canvas.style.cursor = cur;
  }

  _drop(e) {
    e.preventDefault();
    const catalogId = e.dataTransfer.getData('text/plain');
    if (!catalogId) return;
    const [px, py] = this._pos(e);
    const [mx, my] = this.toMm(px, py);
    store.commit((d) => {
      d.furniture.push({ id: 'f' + Date.now().toString(36), catalogId, x: this.snap(mx), y: this.snap(my), rotation: 0 });
    });
  }
}
