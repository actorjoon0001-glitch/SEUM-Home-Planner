// 세움 홈플래너 - 2D 평면 편집기 (HTML5 Canvas)
// 방 추가/이동/크기조절, 가구 배치/이동/회전, 팬/줌, 치수 표시
import { store } from './store.js';
import { ROOM_TYPES, catalogOf, rid, WINDOW_TYPES, opening, openingOutline, outlinePoints, outlineShape, outlineShapes } from './data.js';

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

    // 벽 그리기 옵션 (Archisketch 스타일)
    this.snapMode = true;    // 격자/직각 스냅
    this.orthoMode = false;  // 직교(90°) 강제
    this.onOutlineChange = null; // 그리는 중 길이 입력 상자 위치/값 콜백

    // 텍스트 라벨(방 이름 등)
    this.labelMode = false;
    this.editingLabel = null;
    this.onLabelEdit = null; // (label, [px,py]) → UI가 입력창 표시

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

  // 화면 중심 기준 확대/축소 (하단 줌 버튼)
  zoomBy(factor) {
    const cx = this.cssW / 2, cy = this.cssH / 2;
    const [mx, my] = this.toMm(cx, cy);
    this.scale = Math.max(0.008, Math.min(0.5, this.scale * factor));
    this.ox = cx - mx * this.scale;
    this.oy = cy - my * this.scale;
    this.draw();
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

    // 텍스트 라벨 (방 이름 등)
    this._drawLabels();

    // 축척 보정 중 클릭 점/선 표시
    if (this.calib) this._drawCalib();
    // 측정 자
    if (this.measureMode) this._drawMeasures();
    // 삭제 모드 hover 강조
    if (this.eraseMode && this._eraseHover) this._drawEraseHover();
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
    const half = o.w / 2;
    // 외벽(외곽)에 부착된 개구부
    if (o.onOutline) {
      const shapes = outlineShapes(store.design.outline);
      const path = shapes[o.pathIndex]; if (!path) return null;
      const pts = path.pts, n = pts.length;
      const eMax = path.closed ? n : n - 1;
      if (o.edgeIndex < 0 || o.edgeIndex >= eMax) return null;
      const A = pts[o.edgeIndex], B = pts[(o.edgeIndex + 1) % n];
      const ex = B[0] - A[0], ey = B[1] - A[1], len = Math.hypot(ex, ey);
      if (len < 1) return null;
      const ux = ex / len, uy = ey / len;
      const pos = Math.max(half, Math.min(len - half, o.pos));
      return {
        cx: A[0] + ux * pos, cy: A[1] + uy * pos, half,
        angle: Math.atan2(uy, ux), horizontal: Math.abs(ux) >= Math.abs(uy),
        nx: uy, ny: -ux, ax: A[0], ay: A[1], ux, uy, edgeLen: len,
      };
    }
    const room = store.design.rooms.find((r) => r.id === o.roomId);
    if (!room) return null;
    let cx, cy, horizontal, nx = 0, ny = 0;
    const span = (o.side === 'n' || o.side === 's') ? room.w : room.d;
    const pos = Math.max(half, Math.min(span - half, o.pos)); // 벽 안에 들어오도록
    if (o.side === 'n') { cx = room.x + pos; cy = room.y;          horizontal = true;  ny = -1; }
    else if (o.side === 's') { cx = room.x + pos; cy = room.y + room.d; horizontal = true;  ny = 1; }
    else if (o.side === 'w') { cx = room.x;          cy = room.y + pos; horizontal = false; nx = -1; }
    else { cx = room.x + room.w; cy = room.y + pos;                horizontal = false; nx = 1; }
    return { room, cx, cy, horizontal, nx, ny, half, angle: horizontal ? 0 : Math.PI / 2 };
  }

  _drawOpening(o) {
    const g = this._openingGeom(o); if (!g) return;
    const ctx = this.ctx;
    const t = WINDOW_TYPES[o.winType] || {};
    const isDoor = t.glass === false;
    const selected = o.id === store.selectedOpening;
    const [pcx, pcy] = this.toPx(g.cx, g.cy);
    const len = o.w * this.scale;
    // 화면상 벽 두께 표현 — 외벽(200mm)은 더 두꺼우므로 그 폭을 덮도록 맞춤
    const thick = o.onOutline ? Math.max(9, 200 * this.scale + 4) : 9;

    ctx.save();
    ctx.translate(pcx, pcy);
    ctx.rotate(g.angle || 0);

    // 벽 끊기 (흰 배경)
    ctx.fillStyle = '#f4f5f7';
    ctx.fillRect(-len / 2, -thick / 2 - 1, len, thick + 2);

    if (isDoor) {
      ctx.strokeStyle = selected ? '#c8102e' : '#4a5560';
      ctx.lineWidth = selected ? 2.5 : 1.6;
      if (t.slide) {
        // 슬라이딩/포켓 도어 — 트랙 + 문짝(절반)
        ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0); ctx.stroke();
        ctx.lineWidth = selected ? 5 : 4;
        ctx.beginPath(); ctx.moveTo(-len / 2, -1.5); ctx.lineTo(0, -1.5); ctx.stroke();
        if (t.pocket) {                                    // 벽 속으로 들어가는 표시(점선)
          ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, -thick / 2); ctx.lineTo(len / 2, -thick / 2);
          ctx.moveTo(0, thick / 2);  ctx.lineTo(len / 2, thick / 2);
          ctx.stroke(); ctx.setLineDash([]);
        }
      } else if (t.fold) {
        // 폴딩 — 지그재그 패널
        const n = Math.max(2, t.panes || 4), pw = len / n;
        ctx.beginPath();
        for (let i = 0; i < n; i++) { const x0 = -len / 2 + i * pw; ctx.moveTo(x0, 0); ctx.lineTo(x0 + pw / 2, -pw * 0.5); ctx.lineTo(x0 + pw, 0); }
        ctx.stroke();
      } else if (t.double) {
        // 양개문 — 양쪽 문짝 + 열림 호 2개
        const half = len / 2;
        ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(-len / 2, half); ctx.stroke();
        ctx.beginPath(); ctx.arc(-len / 2, 0, half, 0, Math.PI / 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(len / 2, 0); ctx.lineTo(len / 2, half); ctx.stroke();
        ctx.beginPath(); ctx.arc(len / 2, 0, half, Math.PI / 2, Math.PI); ctx.stroke();
      } else {
        // 여닫이(단문) / 피벗 — 문짝 + 열림 호
        ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(-len / 2, len); ctx.stroke();
        ctx.beginPath(); ctx.arc(-len / 2, 0, len, 0, Math.PI / 2); ctx.stroke();
      }
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
      const dx = px - pcx, dy = py - pcy;
      const ca = Math.cos(g.angle || 0), sa = Math.sin(g.angle || 0);
      const along = Math.abs(dx * ca + dy * sa);
      const across = Math.abs(-dx * sa + dy * ca);
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
    cv.addEventListener('dblclick', (e) => {
      if (this.drawOutline && this.outlineDraft) { this._finishOutlinePoly(false); return; }
      const [px, py] = this._pos(e);
      const lb = this._hitLabel(px, py);      // 라벨 더블클릭 → 이름 수정
      if (lb) this._beginLabelEdit(lb);
    });
    window.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return; // 길이 입력 등 폼에선 무시
      if (!this.drawOutline || !this.outlineDraft) return;
      if (e.key === 'Escape') { this.outlineDraft = null; this._outlineCursor = null; this._emitOutline(); this.draw(); }
      else if (e.key === 'Enter') { this._finishOutlinePoly(false); }
      else if (e.key === 'Backspace') { e.preventDefault(); this.outlineDraft.pop(); if (!this.outlineDraft.length) this.outlineDraft = null; this._emitOutline(); this.draw(); }
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

    // 라벨 모드: 기존 라벨 클릭=편집, 빈 곳=새 라벨
    if (this.labelMode) {
      const existing = this._hitLabel(px, py);
      if (existing) this._beginLabelEdit(existing);
      else {
        const [mx, my] = this.toMm(px, py);
        this._beginLabelEdit({ id: 'lb' + Date.now().toString(36), x: this.snap(mx), y: this.snap(my), text: '', _new: true });
      }
      return;
    }

    // 삭제(지우개) 모드: 클릭한 대상 삭제 (벽 선은 한 칸)
    if (this.eraseMode) {
      const hit = this._eraseHitTest(px, py);
      if (hit) { this._eraseAt(hit); this._eraseHover = null; this.draw(); }
      return;
    }

    // 측정 모드: 두 점을 클릭해 거리 측정
    if (this.measureMode) {
      const pt = this._measureSnap(px, py);
      if (!this.measureStart) this.measureStart = pt;
      else { this.measures.push([this.measureStart, pt]); this.measureStart = null; }
      this.measureCursor = pt; this.draw();
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

    // 라벨 드래그(선택/이동 모드) — 라벨을 다른 항목보다 먼저 잡음
    const hitLabel = this._hitLabel(px, py);
    if (hitLabel) {
      const [mx, my] = this.toMm(px, py);
      this.drag = { mode: 'movelabel', label: hitLabel, dx: mx - hitLabel.x, dy: my - hitLabel.y };
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
    // 삭제 모드: 커서 아래 삭제 대상 하이라이트
    if (this.eraseMode) {
      this._eraseHover = this._eraseHitTest(px, py);
      this.canvas.style.cursor = this._eraseHover ? 'pointer' : 'crosshair';
      this.draw();
      return;
    }
    // 측정 모드: 스냅 커서 추적 (시작점 있으면 고무줄)
    if (this.measureMode) {
      this.measureCursor = this._measureSnap(px, py);
      this.draw();
      return;
    }
    // 외곽 그리기 중: 마지막 점 → 커서 고무줄 미리보기
    if (this.drawOutline && this.outlineDraft) {
      const [mx, my] = this.toMm(px, py);
      this._outlineCursor = this._outlineSnap(mx, my);
      this._emitOutline();
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

    if (drag.mode === 'movelabel') {
      store.liveUpdate(() => { drag.label.x = this.snap(mx - drag.dx); drag.label.y = this.snap(my - drag.dy); });
    } else if (drag.mode === 'mover') {
      const sn = this._snapRoomMove(drag.room, this.snap(mx - drag.dx), this.snap(my - drag.dy));
      store.liveUpdate(() => { drag.room.x = sn.x; drag.room.y = sn.y; });
    } else if (drag.mode === 'movef') {
      store.liveUpdate(() => {
        drag.f.x = this.snap(mx - drag.dx);
        drag.f.y = this.snap(my - drag.dy);
      });
    } else if (drag.mode === 'moveo') {
      if (drag.o.onOutline) {
        const g = this._openingGeom(drag.o);
        if (g) {
          const along = (mx - g.ax) * g.ux + (my - g.ay) * g.uy;
          store.liveUpdate(() => { drag.o.pos = this.snap(along); });
        }
      } else {
        const room = store.design.rooms.find((r) => r.id === drag.o.roomId);
        if (room) {
          const along = (drag.o.side === 'n' || drag.o.side === 's') ? (mx - room.x) : (my - room.y);
          store.liveUpdate(() => { drag.o.pos = this.snap(along); });
        }
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
    this._emitOutline();
    this.draw();
  }

  // 벽 두께 (mm) — 도면에 저장, 없으면 기본 200
  wallThickness() { return (store.design && store.design.wallThickness) || 200; }
  setWallThickness(mm) {
    const v = Math.max(50, Math.min(600, Math.round((+mm || 200) / 10) * 10));
    store.commit((d) => { d.wallThickness = v; });
    this.draw();
    return v;
  }
  setSnapMode(on) { this.snapMode = !!on; this.draw(); }
  setOrthoMode(on) { this.orthoMode = !!on; this.draw(); }

  // 외곽 점 스냅: (스냅 모드) 격자 100mm + 직전 점과 거의 수평/수직이면 직각 정렬
  //             (직교 모드) 직전 점 기준 무조건 수평/수직으로 강제
  _outlineSnap(mx, my) {
    let x = this.snapMode ? this.snap(mx) : Math.round(mx);
    let y = this.snapMode ? this.snap(my) : Math.round(my);
    const draft = this.outlineDraft;
    if (draft && draft.length) {
      const last = draft[draft.length - 1];
      const dx = x - last[0], dy = y - last[1];
      if (this.orthoMode) {
        if (Math.abs(dx) >= Math.abs(dy)) y = last[1]; else x = last[0];        // 강제 직교
      } else if (this.snapMode) {
        if (Math.abs(dx) < 700 && Math.abs(dx) <= Math.abs(dy)) x = last[0];    // 수직 벽
        else if (Math.abs(dy) < 700) y = last[1];                              // 수평 벽
      }
    }
    return [x, y];
  }

  // 길이 직접 입력 → 현재 커서 방향으로 정확한 mm 거리에 점을 찍음
  commitOutlineLength(mm) {
    const len = +mm;
    if (!this.drawOutline || !this.outlineDraft || !this.outlineDraft.length || !this._outlineCursor || !(len > 0)) return false;
    const last = this.outlineDraft[this.outlineDraft.length - 1];
    let dx = this._outlineCursor[0] - last[0], dy = this._outlineCursor[1] - last[1];
    const d = Math.hypot(dx, dy);
    if (d < 1) return false;               // 방향이 없으면 무시
    const nx = Math.round(last[0] + (dx / d) * len);
    const ny = Math.round(last[1] + (dy / d) * len);
    this.outlineDraft.push([nx, ny]);
    this._outlineCursor = [nx, ny];
    this.draw();
    return true;
  }

  // 그리는 중 상태를 UI(길이 입력 상자)에 알림
  _emitOutline() {
    if (!this.onOutlineChange) return;
    const draft = this.outlineDraft;
    if (this.drawOutline && draft && draft.length && this._outlineCursor) {
      const last = draft[draft.length - 1], cur = this._outlineCursor;
      const lenMm = Math.round(Math.hypot(cur[0] - last[0], cur[1] - last[1]));
      const [ax, ay] = this.toPx(last[0], last[1]);
      const [bx, by] = this.toPx(cur[0], cur[1]);
      this.onOutlineChange({ active: true, lengthMm: lenMm, x: (ax + bx) / 2, y: (ay + by) / 2 });
    } else {
      this.onOutlineChange({ active: false });
    }
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
    this._outlineCursor = pt;
    this._emitOutline();
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
    this._emitOutline();
    this.draw();
  }

  // 방을 옮길 때 외곽/다른 방 모서리에 자동 정렬(스냅)
  _snapRoomMove(room, x, y) {
    const SNAP = 250; // mm 이내면 달라붙음
    const d = store.design;
    const xs = [], ys = [];
    for (const { pts } of outlineShapes(d.outline)) for (const p of pts) { xs.push(p[0]); ys.push(p[1]); }
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

  // 측정 모드 on/off — 두 점 클릭으로 거리 측정 (임시 표시, 저장 안 됨)
  setMeasure(on) {
    this.measureMode = !!on;
    this.measureStart = null; this.measureCursor = null;
    this.measures = on ? [] : null;
    if (on) { this.drawRoom = null; this.wallEdit = false; this.drawOutline = false; this.calib = null; }
    this.canvas.style.cursor = on ? 'crosshair' : 'default';
    this.draw();
  }

  // 지우개(삭제) 모드 on/off — 벽 선은 한 칸씩, 방·가구·창호는 통째로 클릭 삭제
  setErase(on) {
    this.eraseMode = !!on;
    this._eraseHover = null;
    if (on) { this.drawRoom = null; this.drawOutline = false; this.wallEdit = false; this.measureMode = false; this.calib = null; this.outlineDraft = null; }
    this.canvas.style.cursor = on ? 'crosshair' : 'default';
    this.draw();
  }

  // 편집 가능한 외곽 경로 목록 (좌표는 [x,y] 배열로 정규화)
  _outlineEditPaths(d) {
    const cur = d.outline;
    const P = (pt) => (Array.isArray(pt) ? [pt[0], pt[1]] : [pt.x, pt.y]);
    if (cur && Array.isArray(cur.paths)) return cur.paths.map((p) => ({ points: (p.points || []).map(P), closed: !!p.closed }));
    if (cur && Array.isArray(cur.points)) return [{ points: cur.points.map(P), closed: cur.closed !== false && cur.points.length >= 3 }];
    if (cur && ('w' in cur)) { const { x, y, w, d: dd } = cur; return [{ points: [[x, y], [x + w, y], [x + w, y + dd], [x, y + dd]], closed: true }]; }
    return [];
  }

  // 커서에 가장 가까운 외곽 변 {pathIndex, edgeIndex} (임계 픽셀 내)
  _nearestOutlineEdge(px, py) {
    const paths = this._outlineEditPaths(store.design);
    let best = null, bd = Math.max(10, this.wallThickness() * this.scale / 2 + 6);
    paths.forEach((path, pi) => {
      const pts = path.points, n = pts.length, eMax = path.closed ? n : n - 1;
      for (let e = 0; e < eMax; e++) {
        const a = this.toPx(pts[e][0], pts[e][1]);
        const c = this.toPx(pts[(e + 1) % n][0], pts[(e + 1) % n][1]);
        const dd = this._distToSeg(px, py, a[0], a[1], c[0], c[1]).dist;
        if (dd < bd) { bd = dd; best = { pathIndex: pi, edgeIndex: e }; }
      }
    });
    return best;
  }

  // 삭제 대상 히트테스트 — 라벨 > 가구 > 창호 > 벽 선 > 방
  _eraseHitTest(px, py) {
    const lb = this._hitLabel(px, py); if (lb) return { kind: 'label', id: lb.id };
    const f = this._hitFurniture(px, py); if (f) return { kind: 'furniture', id: f.id };
    const o = this._hitOpening(px, py); if (o) return { kind: 'opening', id: o.id };
    const edge = this._nearestOutlineEdge(px, py); if (edge) return { kind: 'edge', ...edge };
    const r = this._hitRoom(px, py); if (r) return { kind: 'room', id: r.id };
    return null;
  }

  // 외곽 변 1개 삭제 — 닫힌 폴리곤은 열리고, 열린 선은 분할됨
  _eraseEdge(pathIndex, edgeIndex) {
    store.commit((d) => {
      const paths = this._outlineEditPaths(d);
      const path = paths[pathIndex];
      if (!path) return;
      const pts = path.points, n = pts.length;
      const pieces = [];
      if (path.closed) {
        const rot = [];
        for (let k = 1; k <= n; k++) rot.push(pts[(edgeIndex + k) % n]); // 제거된 변의 두 끝점이 양끝
        pieces.push({ points: rot, closed: false });
      } else {
        const left = pts.slice(0, edgeIndex + 1);
        const right = pts.slice(edgeIndex + 1);
        if (left.length >= 2) pieces.push({ points: left, closed: false });
        if (right.length >= 2) pieces.push({ points: right, closed: false });
      }
      paths.splice(pathIndex, 1, ...pieces);
      d.outline = { paths: paths.filter((p) => p.points.length >= 2) };
    });
  }

  _eraseAt(hit) {
    if (!hit) return;
    if (hit.kind === 'edge') { this._eraseEdge(hit.pathIndex, hit.edgeIndex); return; }
    store.commit((d) => {
      if (hit.kind === 'room') d.rooms = d.rooms.filter((r) => r.id !== hit.id);
      else if (hit.kind === 'furniture') d.furniture = d.furniture.filter((f) => f.id !== hit.id);
      else if (hit.kind === 'opening') d.openings = (d.openings || []).filter((o) => o.id !== hit.id);
      else if (hit.kind === 'label') d.labels = (d.labels || []).filter((l) => l.id !== hit.id);
    });
    if (store.selectedRoom === hit.id || store.selectedFurniture === hit.id || store.selectedOpening === hit.id) store.select(null, null);
  }

  // 삭제 모드에서 hover 대상 강조(빨강)
  _drawEraseHover() {
    const h = this._eraseHover; if (!h) return;
    const ctx = this.ctx, d = store.design;
    ctx.save();
    ctx.strokeStyle = '#e01e37'; ctx.fillStyle = 'rgba(224,30,55,0.16)'; ctx.lineCap = 'round';
    if (h.kind === 'edge') {
      const path = this._outlineEditPaths(d)[h.pathIndex];
      if (path) {
        const n = path.points.length;
        const a = this.toPx(path.points[h.edgeIndex][0], path.points[h.edgeIndex][1]);
        const c = this.toPx(path.points[(h.edgeIndex + 1) % n][0], path.points[(h.edgeIndex + 1) % n][1]);
        ctx.lineWidth = Math.max(6, this.wallThickness() * this.scale + 4);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
      }
    } else if (h.kind === 'room') {
      const r = d.rooms.find((x) => x.id === h.id);
      if (r) { const [x, y] = this.toPx(r.x, r.y); ctx.lineWidth = 2; ctx.fillRect(x, y, r.w * this.scale, r.d * this.scale); ctx.strokeRect(x, y, r.w * this.scale, r.d * this.scale); }
    } else if (h.kind === 'label') {
      const lb = (d.labels || []).find((x) => x.id === h.id);
      if (lb) { ctx.font = '600 13px sans-serif'; const w = ctx.measureText(lb.text || '라벨').width + 14; const [x, y] = this.toPx(lb.x, lb.y); ctx.lineWidth = 2; this._roundRect(x - w / 2, y - 13, w, 26, 7); ctx.fill(); ctx.stroke(); }
    }
    ctx.restore();
  }

  // ---- 텍스트 라벨 (방 이름 등) ----
  setLabelMode(on) {
    this.labelMode = !!on;
    if (on) { this.drawRoom = null; this.drawOutline = false; this.wallEdit = false; this.measureMode = false; this.eraseMode = false; this.calib = null; this.outlineDraft = null; }
    this.canvas.style.cursor = on ? 'text' : 'default';
    this.draw();
  }

  _roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  _hitLabel(px, py) {
    const ctx = this.ctx;
    ctx.save(); ctx.font = '600 13px sans-serif';
    let hit = null;
    const labels = store.design.labels || [];
    for (let i = labels.length - 1; i >= 0; i--) {
      const lb = labels[i];
      const [x, y] = this.toPx(lb.x, lb.y);
      const w = ctx.measureText(lb.text || '라벨').width + 14;
      if (px >= x - w / 2 && px <= x + w / 2 && py >= y - 13 && py <= y + 13) { hit = lb; break; }
    }
    ctx.restore();
    return hit;
  }

  _drawLabels() {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = '600 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const lb of store.design.labels || []) {
      if (this.editingLabel && lb.id === this.editingLabel.id) continue; // 편집 중엔 입력창이 대신
      const [x, y] = this.toPx(lb.x, lb.y);
      const w = ctx.measureText(lb.text).width + 14;
      ctx.fillStyle = 'rgba(255,255,255,0.82)'; ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = 1;
      this._roundRect(x - w / 2, y - 13, w, 26, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#20242a'; ctx.fillText(lb.text, x, y);
    }
    ctx.restore();
  }

  _beginLabelEdit(label) {
    this.editingLabel = label;
    this.draw();
    if (this.onLabelEdit) this.onLabelEdit(label, this.toPx(label.x, label.y));
  }

  commitLabel(text) {
    const lb = this.editingLabel; if (!lb) return;
    const t = (text || '').trim();
    store.commit((d) => {
      d.labels = d.labels || [];
      if (lb._new) { if (t) d.labels.push({ id: lb.id, x: lb.x, y: lb.y, text: t }); }
      else {
        const ex = d.labels.find((l) => l.id === lb.id);
        if (ex) { if (t) ex.text = t; else d.labels = d.labels.filter((l) => l.id !== lb.id); }
      }
    });
    this.editingLabel = null;
    this.draw();
  }

  cancelLabel() { this.editingLabel = null; this.draw(); }

  // 측정 점 스냅 — 방/외곽 꼭짓점에 붙거나 격자(100mm)
  _measureSnap(px, py) {
    let best = null, bd = 12;
    const test = (c) => { const [cx, cy] = this.toPx(c[0], c[1]); const dd = Math.hypot(px - cx, py - cy); if (dd < bd) { bd = dd; best = c; } };
    for (const r of store.design.rooms) { test([r.x, r.y]); test([r.x + r.w, r.y]); test([r.x, r.y + r.d]); test([r.x + r.w, r.y + r.d]); }
    for (const { pts } of outlineShapes(store.design.outline)) for (const p of pts) test(p);
    if (best) return [best[0], best[1]];
    const [mx, my] = this.toMm(px, py);
    return [this.snap(mx), this.snap(my)];
  }

  _drawMeasures() {
    const ctx = this.ctx;
    const one = (a, b, color) => {
      const [ax, ay] = this.toPx(a[0], a[1]), [bx, by] = this.toPx(b[0], b[1]);
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = color;
      for (const [x, y] of [[ax, ay], [bx, by]]) { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      this._segLabel(a, b, color);
    };
    for (const [a, b] of (this.measures || [])) one(a, b, '#2c6e49');
    if (this.measureStart && this.measureCursor) one(this.measureStart, this.measureCursor, '#c8102e');
    else if (this.measureCursor) { // 시작 전 스냅 커서 표시
      const [x, y] = this.toPx(this.measureCursor[0], this.measureCursor[1]);
      ctx.save(); ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  }

  // 방 그리기 모드 on/off (type=방종류 키 또는 null)
  setDrawRoom(type) {
    this.drawRoom = type || null;
    if (this.drawRoom) { this.calib = null; this.wallEdit = false; this.drawOutline = false; this.measureMode = false; this._hoverWall = null; }
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

  // 집 외곽(외벽) 2D 표시 — 닫힌 공간은 강화마루 바닥 + 면적, 벽 + 치수
  _drawOutline() {
    const ctx = this.ctx;
    const t = Math.max(3, this.wallThickness() * this.scale); // 외벽 두께(도면 설정)
    for (const { pts, closed } of outlineShapes(store.design.outline)) {
      const px = pts.map((p) => this.toPx(p[0], p[1]));
      if (closed && pts.length >= 3) this._fillLaminate(px);   // 강화마루 바닥(기본)
      ctx.save();
      ctx.lineJoin = 'miter'; ctx.lineCap = 'round';
      ctx.strokeStyle = '#3a3f44'; ctx.lineWidth = t;
      ctx.beginPath();
      px.forEach((p, i) => { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
      if (closed) ctx.closePath();
      ctx.stroke();
      ctx.restore();
      // 각 변 치수
      for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) this._segLabel(pts[i], pts[(i + 1) % pts.length], '#3a3f44');
      if (closed && pts.length >= 3) this._outlineAreaLabel(pts);
    }
    // 그리는 중(draft) — 형광펜 스타일(두껍고 반투명한 퍼플) + 치수 + 점
    const draft = this.outlineDraft;
    if (draft && draft.length) {
      const HL = '#6c5ce7';                                    // 형광 퍼플
      const pxs = draft.map((p) => this.toPx(p[0], p[1]));
      const cur = this._outlineCursor ? this.toPx(this._outlineCursor[0], this._outlineCursor[1]) : null;
      const path = () => { ctx.beginPath(); pxs.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); if (cur) ctx.lineTo(cur[0], cur[1]); };
      ctx.save();
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      // 형광펜 halo (두껍고 반투명)
      ctx.strokeStyle = 'rgba(108,92,231,0.40)';
      ctx.lineWidth = Math.max(9, Math.min(this.wallThickness() * this.scale, 24));
      path(); ctx.stroke();
      // 중심선 (방향 명확히)
      ctx.strokeStyle = HL; ctx.lineWidth = 2;
      path(); ctx.stroke();
      // 꼭짓점 점 (시작점은 닫기 후보라 강조)
      pxs.forEach((p, i) => {
        ctx.fillStyle = (i === 0 && draft.length >= 3) ? HL : '#fff';
        ctx.strokeStyle = HL; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p[0], p[1], i === 0 ? 6 : 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
      ctx.restore();
      // 놓인 구간 치수 + 현재(고무줄) 구간 길이 실시간 표시
      for (let i = 0; i < draft.length - 1; i++) this._segLabel(draft[i], draft[i + 1], HL);
      if (this._outlineCursor) this._segLabel(draft[draft.length - 1], this._outlineCursor, HL);
    }
  }

  // 닫힌 공간 내부를 강화마루(오크) 질감으로 채움 — px: 화면좌표 꼭짓점 배열
  _fillLaminate(px) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    px.forEach((p, i) => { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.closePath();
    ctx.clip();
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const [x, y] of px) { if (x < minx) minx = x; if (y < miny) miny = y; if (x > maxx) maxx = x; if (y > maxy) maxy = y; }
    ctx.fillStyle = '#d9b489';                              // 강화마루 베이스(라이트 오크)
    ctx.fillRect(minx, miny, maxx - minx, maxy - miny);
    const plank = Math.max(9, 190 * this.scale);            // 판재 폭 ≈190mm
    ctx.strokeStyle = 'rgba(140,100,60,0.22)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = miny; y <= maxy; y += plank) { ctx.moveTo(minx, y); ctx.lineTo(maxx, y); }
    ctx.stroke();
    ctx.restore();
  }

  // 닫힌 공간 중앙에 면적 라벨
  _outlineAreaLabel(pts) {
    const a = Math.abs(this._polyAreaMm(pts)) / 1e6;
    if (a < 0.01) return;
    const c = this._polyCentroid(pts);
    const [cx, cy] = this.toPx(c[0], c[1]);
    const ctx = this.ctx;
    ctx.save();
    ctx.font = '600 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const txt = `${a.toFixed(1)} m² (${(a / 3.305).toFixed(1)}평)`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.strokeText(txt, cx, cy);
    ctx.fillStyle = '#5b4a36'; ctx.fillText(txt, cx, cy);
    ctx.restore();
  }

  _polyAreaMm(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; }
    return s / 2;
  }
  _polyCentroid(pts) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const cr = p[0] * q[1] - q[0] * p[1];
      a += cr; cx += (p[0] + q[0]) * cr; cy += (p[1] + q[1]) * cr;
    }
    a *= 0.5;
    if (Math.abs(a) < 1e-6) { let sx = 0, sy = 0; for (const p of pts) { sx += p[0]; sy += p[1]; } return [sx / pts.length, sy / pts.length]; }
    return [cx / (6 * a), cy / (6 * a)];
  }

  // 방 그리기 미리보기 — 형광펜 스타일(반투명 퍼플) + 가로·세로 치수
  _drawNewPreview(drag) {
    const x0 = this.snap(Math.min(drag.ax, drag.cx)), y0 = this.snap(Math.min(drag.ay, drag.cy));
    const x1 = this.snap(Math.max(drag.ax, drag.cx)), y1 = this.snap(Math.max(drag.ay, drag.cy));
    const [px, py] = this.toPx(x0, y0);
    const w = (x1 - x0) * this.scale, h = (y1 - y0) * this.scale;
    const ctx = this.ctx;
    const HL = '#6c5ce7';
    ctx.save();
    ctx.fillStyle = 'rgba(108,92,231,0.12)';
    ctx.fillRect(px, py, w, h);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(108,92,231,0.40)';         // 형광펜 halo
    ctx.lineWidth = Math.max(8, Math.min(this.wallThickness() * this.scale, 22));
    ctx.strokeRect(px, py, w, h);
    ctx.strokeStyle = HL; ctx.lineWidth = 2;           // 중심선
    ctx.strokeRect(px, py, w, h);
    ctx.restore();
    // 가로·세로 치수 (퍼플)
    if (x1 - x0 > 0) this._segLabel([x0, y0], [x1, y0], HL);
    if (y1 - y0 > 0) this._segLabel([x1, y0], [x1, y1], HL);
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
    // 방 드롭: "room:<type>" → 외벽 안에 떨어뜨리면 그 안에 맞춰 배치
    if (raw.startsWith('room:')) {
      this._dropRoom(raw.slice(5), mx, my);
      return;
    }
    // 가구 드롭
    store.commit((d) => {
      d.furniture.push({ id: 'f' + Date.now().toString(36), catalogId: raw, x: this.snap(mx), y: this.snap(my), rotation: 0 });
    });
  }

  // 방을 드롭 — 닫힌 외벽 안이면 그 안에 들어가도록 맞추고, 외곽/옆방에 스냅
  _dropRoom(type, mx, my) {
    const t = ROOM_TYPES[type] || ROOM_TYPES.living;
    let w = 3000, d = 3000;
    let x = mx - w / 2, y = my - d / 2;
    const poly = this._outlineContaining(mx, my);
    if (poly) {
      const bb = this._polyBBox(poly);
      const m = 100; // 외벽 안쪽 여백
      w = Math.min(w, Math.max(800, bb.w - m * 2));
      d = Math.min(d, Math.max(800, bb.h - m * 2));
      x = Math.min(Math.max(mx - w / 2, bb.x + m), bb.x + bb.w - m - w);
      y = Math.min(Math.max(my - d / 2, bb.y + m), bb.y + bb.h - m - d);
    }
    x = this.snap(x); y = this.snap(y); w = this.snap(w); d = this.snap(d);
    const sn = this._snapRoomMove({ id: '', w, d }, x, y);
    store.commit((dd) => {
      const room = { id: rid(), type, name: t.label, x: sn.x, y: sn.y, w, d };
      dd.rooms.push(room);
      store.selectedRoom = room.id; store.selectedFurniture = store.selectedOpening = null;
    });
  }

  // 점이 들어있는 닫힌 외곽(다각형) 좌표 반환
  _outlineContaining(mx, my) {
    for (const { pts, closed } of outlineShapes(store.design.outline)) {
      if (closed && pts.length >= 3 && this._pointInPoly(mx, my, pts)) return pts;
    }
    return null;
  }
  _polyBBox(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  _pointInPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  // 창호를 드롭 지점에서 가장 가까운 방의 가장 가까운 벽면에 부착
  // 점 → 선분 거리와 변을 따라간 거리(mm) 반환
  _distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    return { dist: Math.hypot(px - cx, py - cy), along: t * Math.sqrt(len2) };
  }

  _dropWindow(winType, mx, my) {
    const d = store.design;
    // 1) 가장 가까운 방 벽 후보
    let roomBest = null;
    for (const room of d.rooms) {
      const segs = [
        { side: 'n', ax: room.x, ay: room.y, bx: room.x + room.w, by: room.y },
        { side: 's', ax: room.x, ay: room.y + room.d, bx: room.x + room.w, by: room.y + room.d },
        { side: 'w', ax: room.x, ay: room.y, bx: room.x, by: room.y + room.d },
        { side: 'e', ax: room.x + room.w, ay: room.y, bx: room.x + room.w, by: room.y + room.d },
      ];
      for (const s of segs) {
        const r = this._distToSeg(mx, my, s.ax, s.ay, s.bx, s.by);
        const pos = (s.side === 'n' || s.side === 's') ? (mx - room.x) : (my - room.y);
        if (!roomBest || r.dist < roomBest.dist) roomBest = { room, side: s.side, pos, dist: r.dist };
      }
    }
    // 2) 가장 가까운 외벽(외곽) 변 후보 — 방 없이 외벽에 바로 부착 가능
    let outBest = null;
    outlineShapes(d.outline).forEach((path, pi) => {
      const pts = path.pts, n = pts.length;
      const eMax = path.closed ? n : n - 1;
      for (let ei = 0; ei < eMax; ei++) {
        const A = pts[ei], B = pts[(ei + 1) % n];
        const r = this._distToSeg(mx, my, A[0], A[1], B[0], B[1]);
        if (!outBest || r.dist < outBest.dist) outBest = { pathIndex: pi, edgeIndex: ei, pos: r.along, dist: r.dist };
      }
    });
    // 3) 더 가까운 쪽에 부착 — 방 벽과 외벽이 겹칠 땐 방 벽을 우선(50mm 편향),
    //    바깥 외벽 쪽에 떨어뜨리면 외벽에 직접 부착
    const useOutline = outBest && (!roomBest || outBest.dist + 50 < roomBest.dist);
    if (!useOutline && !roomBest) return;
    store.commit((dd) => {
      const o = useOutline
        ? openingOutline(outBest.pathIndex, outBest.edgeIndex, this.snap(outBest.pos), winType)
        : opening(roomBest.room.id, roomBest.side, this.snap(roomBest.pos), winType);
      dd.openings.push(o);
      store.selectedOpening = o.id;
      store.selectedRoom = store.selectedFurniture = null;
    });
  }
}
