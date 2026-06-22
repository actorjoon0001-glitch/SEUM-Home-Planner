// 세움 홈플래너 - UI 구성 (라이브러리 패널, 속성 패널, 툴바 동작)
import { store } from './store.js';
import {
  ROOM_TYPES, FURNITURE_CATALOG, CATEGORIES, catalogOf,
  WINDOW_TYPES, WINDOW_CATALOG, EXTERIOR_MATERIALS, EXTERIOR_PALETTE,
  ROOF_TYPES, ROOF_PALETTE, PRODUCT_TYPES,
} from './data.js';
import { listTemplates, instantiateTemplate } from './templates.js';
import { cloud } from './cloud.js';
import { dxfToUnderlay } from './dxf.js';

let _editor = null; // 썸네일 생성용 (클라우드 저장 시 사용)
let _viewer = null; // 외장/지붕 자동 표시용

export function buildUI({ editor, viewer, onModeChange }) {
  _editor = editor;
  _viewer = viewer;
  buildLibrary();
  buildRoomPalette();
  buildToolbar({ editor, viewer, onModeChange });
  buildCloud();
  store.subscribe(() => renderProperties(editor));
  renderProperties(editor);
  handleShareLink();
}

// ---------------------------------------------------------------------------
// 좌측: 방 추가 팔레트 + 가구 라이브러리
// ---------------------------------------------------------------------------
function buildRoomPalette() {
  const wrap = document.getElementById('room-palette');
  wrap.innerHTML = '';
  const hint = wrap.previousElementSibling; // "클릭하면 방이 추가됩니다"
  let drawMode = false;
  let wallMode = false;
  let outlineMode = false;
  let drawType = 'living';
  const chips = {};

  const syncChips = () => {
    for (const [k, b] of Object.entries(chips)) b.classList.toggle('active', drawMode && k === drawType);
  };
  const setHint = () => {
    if (!hint) return;
    hint.textContent = outlineMode ? '도면 위에서 대각선으로 드래그해 집 외곽(외벽)을 그리세요'
      : drawMode ? '방 종류를 고르고, 외곽 안에서 대각선으로 드래그해 방을 그리세요'
      : wallMode ? '벽을 클릭하면 트기↔막기 (맞닿은 두 방이 함께 처리돼 통로가 뚫림)'
      : '클릭하면 방이 추가됩니다 (드래그로 옮기면 외곽·옆방에 자동 정렬)';
  };
  const setOutline = (on) => {
    outlineMode = on; if (on) { drawMode = false; wallMode = false; drawToggle.classList.remove('on'); wallToggle.classList.remove('on'); syncChips(); }
    outlineToggle.classList.toggle('on', on);
    if (_editor) _editor.setDrawOutline(on);
    setHint();
  };
  const setDraw = (on) => {
    drawMode = on; if (on) { wallMode = false; outlineMode = false; wallToggle.classList.remove('on'); outlineToggle.classList.remove('on'); }
    drawToggle.classList.toggle('on', on);
    if (_editor) _editor.setDrawRoom(on ? drawType : null);
    syncChips(); setHint();
  };
  const setWall = (on) => {
    wallMode = on; if (on) { drawMode = false; outlineMode = false; drawToggle.classList.remove('on'); outlineToggle.classList.remove('on'); syncChips(); }
    wallToggle.classList.toggle('on', on);
    if (_editor) _editor.setWallEdit(on);
    setHint();
  };

  // 편집 모드 토글: 집 외곽 / 방 그리기 / 벽 트기·막기
  const outlineToggle = document.createElement('button');
  outlineToggle.className = 'draw-toggle';
  outlineToggle.textContent = '🏠 집 외곽(외벽) 그리기';
  outlineToggle.onclick = () => setOutline(!outlineMode);
  wrap.appendChild(outlineToggle);

  const drawToggle = document.createElement('button');
  drawToggle.className = 'draw-toggle';
  drawToggle.textContent = '✏️ 방 그리기';
  drawToggle.onclick = () => setDraw(!drawMode);
  wrap.appendChild(drawToggle);

  const wallToggle = document.createElement('button');
  wallToggle.className = 'draw-toggle';
  wallToggle.textContent = '🧱 벽 트기 / 막기';
  wallToggle.onclick = () => setWall(!wallMode);
  wrap.appendChild(wallToggle);

  for (const [key, t] of Object.entries(ROOM_TYPES)) {
    const b = document.createElement('button');
    b.className = 'room-chip';
    b.style.background = t.color;
    b.textContent = t.label;
    b.title = `${t.label} 추가`;
    b.onclick = () => {
      if (drawMode) { drawType = key; if (_editor) _editor.setDrawRoom(key); syncChips(); }
      else addRoom(key);
    };
    chips[key] = b;
    wrap.appendChild(b);
  }
}

function addRoom(type) {
  // 기존 도면 우측 빈 곳에 배치
  const d = store.design;
  let maxX = 0, minY = 0;
  for (const r of d.rooms) maxX = Math.max(maxX, r.x + r.w);
  const t = ROOM_TYPES[type];
  store.commit((dd) => {
    const room = {
      id: 'r' + Date.now().toString(36),
      type, name: t.label,
      x: maxX + 600, y: 0, w: 3000, d: 3000,
    };
    dd.rooms.push(room);
    store.selectedRoom = room.id;
    store.selectedFurniture = null;
  });
}

function buildLibrary() {
  const tabs = document.getElementById('lib-tabs');
  const grid = document.getElementById('lib-grid');
  tabs.innerHTML = '';
  let active = CATEGORIES[0];

  const TABS = [...CATEGORIES, '창호'];

  const render = () => {
    grid.innerHTML = '';
    if (active === '창호') { renderWindows(grid); return; }
    for (const item of FURNITURE_CATALOG.filter((f) => f.cat === active)) {
      const card = document.createElement('div');
      card.className = 'lib-card';
      card.draggable = true;
      card.title = `${item.name} (${item.w}×${item.d}mm) — 도면으로 끌어다 놓으세요`;
      card.innerHTML = `
        <div class="lib-thumb" style="--c:${item.color}">${thumbSvg(item)}</div>
        <div class="lib-name">${item.name}</div>
        <div class="lib-dim">${(item.w/10|0)}×${(item.d/10|0)}cm</div>`;
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', item.id);
        e.dataTransfer.effectAllowed = 'copy';
      });
      card.addEventListener('dblclick', () => {
        // 더블클릭 → 화면 중앙에 추가
        const d = store.design;
        let cx = 4000, cy = 4000;
        if (d.rooms.length) {
          const r = d.rooms[0]; cx = r.x + r.w / 2; cy = r.y + r.d / 2;
        }
        store.commit((dd) => {
          dd.furniture.push({ id: 'f' + Date.now().toString(36), catalogId: item.id, x: cx, y: cy, rotation: 0 });
        });
      });
      grid.appendChild(card);
    }
  };

  for (const cat of TABS) {
    const t = document.createElement('button');
    t.className = 'lib-tab' + (cat === active ? ' active' : '');
    t.textContent = cat;
    t.onclick = () => {
      active = cat;
      [...tabs.children].forEach((c) => c.classList.toggle('active', c.textContent === cat));
      render();
    };
    tabs.appendChild(t);
  }
  render();
}

function thumbSvg(item) {
  const map = {
    sofa: '<rect x="3" y="14" width="26" height="12" rx="3"/><rect x="3" y="8" width="6" height="18" rx="2"/><rect x="23" y="8" width="6" height="18" rx="2"/>',
    bed: '<rect x="3" y="6" width="26" height="20" rx="2"/><rect x="6" y="9" width="9" height="7" rx="1.5" fill="#fff" opacity=".6"/><rect x="17" y="9" width="9" height="7" rx="1.5" fill="#fff" opacity=".6"/>',
    table: '<rect x="5" y="10" width="22" height="12" rx="2"/><rect x="6" y="22" width="2" height="6"/><rect x="24" y="22" width="2" height="6"/>',
    chair: '<rect x="9" y="14" width="14" height="12" rx="2"/><rect x="9" y="6" width="14" height="8" rx="2"/>',
    tv: '<rect x="3" y="7" width="26" height="15" rx="1.5"/><rect x="13" y="22" width="6" height="4"/>',
    rug: '<rect x="3" y="8" width="26" height="16" rx="1.5"/><rect x="6" y="11" width="20" height="10" rx="1" fill="#fff" opacity=".4"/>',
    plant: '<ellipse cx="16" cy="10" rx="8" ry="7"/><rect x="12" y="16" width="8" height="10" rx="1"/>',
    box: '<rect x="6" y="5" width="20" height="22" rx="2"/>',
  };
  return `<svg viewBox="0 0 32 32" fill="var(--c)">${map[item.kind] || map.box}</svg>`;
}

// 창호 라이브러리 카드
function renderWindows(grid) {
  for (const item of WINDOW_CATALOG) {
    const isDoor = item.glass === false;
    const card = document.createElement('div');
    card.className = 'lib-card';
    card.draggable = true;
    card.title = `${item.label} (${item.w}×${item.h}mm) — 벽(방 가장자리)으로 끌어다 놓으세요`;
    card.innerHTML = `
      <div class="lib-thumb">${winThumb(item, isDoor)}</div>
      <div class="lib-name">${item.label}</div>
      <div class="lib-dim">${(item.w/10|0)}×${(item.h/10|0)}cm</div>`;
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', 'win:' + item.id);
      e.dataTransfer.effectAllowed = 'copy';
    });
    card.addEventListener('dblclick', () => {
      // 더블클릭 → 첫 방의 북측 벽 중앙에 추가
      const d = store.design;
      if (!d.rooms.length) return;
      const r = d.rooms[0];
      store.commit((dd) => {
        dd.openings.push({
          id: 'o' + Date.now().toString(36),
          roomId: r.id, side: 'n', pos: Math.round(r.w / 2),
          winType: item.id, w: item.w, h: item.h, sill: item.sill, color: '#4a5560',
        });
        store.selectedOpening = dd.openings[dd.openings.length - 1].id;
        store.selectedRoom = store.selectedFurniture = null;
      });
    });
    grid.appendChild(card);
  }
}

function winThumb(item, isDoor) {
  if (isDoor) {
    return `<svg viewBox="0 0 32 32" fill="none" stroke="#4a5560" stroke-width="2">
      <rect x="8" y="4" width="16" height="24" rx="1"/><circle cx="20" cy="16" r="1.5" fill="#4a5560"/></svg>`;
  }
  const panes = Math.max(1, item.panes || 1);
  let bars = '';
  for (let i = 1; i < panes; i++) { const x = 4 + (24 * i) / panes; bars += `<line x1="${x}" y1="7" x2="${x}" y2="25"/>`; }
  return `<svg viewBox="0 0 32 32" fill="#bcd6e6" stroke="#4a5560" stroke-width="2">
    <rect x="4" y="7" width="24" height="18" rx="1"/>${bars}</svg>`;
}

// ---------------------------------------------------------------------------
// 우측: 선택 항목 속성 패널
// ---------------------------------------------------------------------------
function renderProperties(editor) {
  const panel = document.getElementById('prop-body');
  const d = store.design;
  const room = d.rooms.find((r) => r.id === store.selectedRoom);
  const furn = d.furniture.find((f) => f.id === store.selectedFurniture);

  const op = (d.openings || []).find((o) => o.id === store.selectedOpening);

  if (room) { panel.innerHTML = roomForm(room); bindRoomForm(room); return; }
  if (furn) { panel.innerHTML = furnForm(furn); bindFurnForm(furn); return; }
  if (op)   { panel.innerHTML = openingForm(op); bindOpeningForm(op); return; }

  // 선택 없음 → 도면 전체 정보 + 외장/지붕
  const totalArea = d.rooms.reduce((s, r) => s + r.w * r.d, 0) / 1e6;
  const ex = d.exterior || {};
  const roof = d.roof || {};
  const matOpts = Object.entries(EXTERIOR_MATERIALS)
    .map(([k, m]) => `<option value="${k}" ${k === ex.material ? 'selected' : ''}>${m.label}</option>`).join('');
  const roofOpts = Object.entries(ROOF_TYPES)
    .map(([k, t]) => `<option value="${k}" ${k === roof.type ? 'selected' : ''}>${t.label}</option>`).join('');
  // 창호 목록 (클릭하면 선택 → 편집 폼) — 속성란에서 바로 수정
  const sideKo = { n: '북', s: '남', e: '동', w: '서' };
  const ops = d.openings || [];
  const winListHtml = ops.length
    ? `<div class="win-list">${ops.map((o) => {
        const r = d.rooms.find((rr) => rr.id === o.roomId);
        const t = WINDOW_TYPES[o.winType] || {};
        return `<button class="win-item" data-id="${o.id}">
          <span class="wi-name">${t.label || '창호'}</span>
          <span class="wi-meta">${r ? esc(r.name) : '-'} · ${sideKo[o.side] || o.side} · ${o.w}×${o.h}</span>
        </button>`;
      }).join('')}</div>`
    : `<p class="hint">좌측 <b>창호</b> 탭에서 벽으로 드래그해 추가하세요.</p>`;
  panel.innerHTML = `
    <div class="prop-empty">
      <p class="ph">도면 정보</p>
      <label class="fld"><span>도면 이름</span><input id="p-name" value="${esc(d.name)}"></label>
      <label class="fld"><span>천장 높이 (mm)</span><input id="p-ceil" type="number" step="50" value="${d.ceilingHeight}"></label>
      <div class="info-row"><span>전체 면적</span><b>${totalArea.toFixed(1)} m² (${(totalArea/3.305).toFixed(1)}평)</b></div>
      <div class="info-row"><span>공간 · 가구 · 창호</span><b>${d.rooms.length} · ${d.furniture.length} · ${(d.openings||[]).length}</b></div>

      <p class="ph mt">외장재 · 색상</p>
      <label class="fld toggle"><span>3D 외관(외장재) 표시</span><input id="ex-show" type="checkbox"></label>
      <label class="fld"><span>외장재 종류</span><select id="ex-mat">${matOpts}</select></label>
      <label class="fld"><span>외장 색상</span><input id="ex-color" type="color" value="${ex.color || '#8d96a0'}"></label>
      <div class="swatches" id="ex-sw">${EXTERIOR_PALETTE.map((c) => `<button class="sw" style="background:${c}" data-c="${c}"></button>`).join('')}</div>

      <p class="ph mt">지붕</p>
      <label class="fld toggle"><span>3D 지붕 표시</span><input id="rf-show" type="checkbox"></label>
      <label class="fld"><span>지붕 형태</span><select id="rf-type">${roofOpts}</select></label>
      <label class="fld"><span>지붕 색상</span><input id="rf-color" type="color" value="${roof.color || '#3a3f44'}"></label>
      <div class="swatches" id="rf-sw">${ROOF_PALETTE.map((c) => `<button class="sw" style="background:${c}" data-c="${c}"></button>`).join('')}</div>

      <p class="ph mt">창호 (${ops.length})</p>
      ${winListHtml}

      <p class="hint">· 위 창호를 누르면 속성에서 종류·크기·위치를 바로 수정할 수 있어요.<br>· 자재·색상을 고르면 3D에서 <b>외관</b>이 자동으로 켜집니다.</p>
    </div>`;
  document.getElementById('p-name').onchange = (e) => store.commit((dd) => dd.name = e.target.value);
  document.getElementById('p-ceil').onchange = (e) => store.commit((dd) => dd.ceilingHeight = +e.target.value || 2400);
  document.getElementById('ex-mat').onchange = (e) => { store.commit((dd) => {
    dd.exterior.material = e.target.value;
    dd.exterior.color = EXTERIOR_MATERIALS[e.target.value].color;
  }); showExterior(); };
  document.getElementById('ex-color').oninput = (e) => { store.commit((dd) => dd.exterior.color = e.target.value); showExterior(); };
  document.getElementById('rf-type').onchange = (e) => { store.commit((dd) => dd.roof.type = e.target.value); showRoof(); };
  document.getElementById('rf-color').oninput = (e) => { store.commit((dd) => dd.roof.color = e.target.value); showRoof(); };
  document.querySelectorAll('#ex-sw .sw').forEach((b) => b.onclick = () => { store.commit((dd) => dd.exterior.color = b.dataset.c); showExterior(); });
  document.querySelectorAll('#rf-sw .sw').forEach((b) => b.onclick = () => { store.commit((dd) => dd.roof.color = b.dataset.c); showRoof(); });
  // 외관/지붕 표시 ON·OFF (현재 viewer 상태 반영, 끄기도 여기서 가능)
  const exShow = document.getElementById('ex-show');
  exShow.checked = !!(_viewer && _viewer.showExterior);
  exShow.onchange = (e) => applyOuter('showExterior', e.target.checked);
  const rfShow = document.getElementById('rf-show');
  rfShow.checked = !!(_viewer && _viewer.showRoof);
  rfShow.onchange = (e) => applyOuter('showRoof', e.target.checked);
  // 창호 목록 항목 클릭 → 해당 창 선택(편집 폼 표시)
  document.querySelectorAll('.win-item').forEach((b) => b.onclick = () => store.select(null, null, b.dataset.id));
}

// 외장/지붕 표시 상태를 한 곳에서 제어 — 플로팅 버튼 + 패널 토글을 함께 동기화
const OUTER_CTRL = { showExterior: ['view-ext', 'ex-show'], showRoof: ['view-roof', 'rf-show'] };
function applyOuter(flag, on) {
  if (!_viewer) return;
  _viewer[flag] = on;
  _viewer.dirty = true;
  const [btnId, chkId] = OUTER_CTRL[flag];
  const btn = document.getElementById(btnId); if (btn) btn.classList.toggle('on', on);
  const chk = document.getElementById(chkId); if (chk) chk.checked = on;
}
// 자재/색상을 바꾸면 외관을 자동으로 켜서 변화가 바로 보이게 함
function showExterior() { applyOuter('showExterior', true); }
function showRoof() { applyOuter('showRoof', true); }

function openingForm(o) {
  const typeOpts = Object.entries(WINDOW_TYPES)
    .map(([k, t]) => `<option value="${k}" ${k === o.winType ? 'selected' : ''}>${t.label}</option>`).join('');
  const sideOpts = [['n', '북(상)'], ['s', '남(하)'], ['e', '동(우)'], ['w', '서(좌)']]
    .map(([k, l]) => `<option value="${k}" ${k === o.side ? 'selected' : ''}>${l}</option>`).join('');
  const room = (store.design.rooms || []).find((r) => r.id === o.roomId);
  return `
    <button class="mini" id="o-back">← 창호 목록</button>
    <p class="ph">창호 속성${room ? ` · ${esc(room.name)}` : ''}</p>
    <label class="fld"><span>종류</span><select id="o-type">${typeOpts}</select></label>
    <label class="fld"><span>부착 벽면</span><select id="o-side">${sideOpts}</select></label>
    <div class="grid2">
      <label class="fld"><span>폭 W (mm)</span><input id="o-w" type="number" step="100" value="${o.w}"></label>
      <label class="fld"><span>높이 H (mm)</span><input id="o-h" type="number" step="100" value="${o.h}"></label>
    </div>
    <div class="grid2">
      <label class="fld"><span>하단 높이 (mm)</span><input id="o-sill" type="number" step="50" value="${o.sill}"></label>
      <label class="fld"><span>벽 위치 (mm)</span><input id="o-pos" type="number" step="100" value="${Math.round(o.pos)}"></label>
    </div>
    <label class="fld"><span>창틀 색상</span><input id="o-color" type="color" value="${o.color || '#4a5560'}"></label>
    <div class="btn-row">
      <button class="mini" id="o-dup">복제</button>
      <button class="mini danger" id="o-del">삭제</button>
    </div>
    <p class="hint">창은 도면에서 벽을 따라 드래그해 위치를 옮길 수 있습니다.</p>`;
}

function bindOpeningForm(o) {
  const upd = (m) => store.commit(() => m());
  document.getElementById('o-back').onclick = () => store.select(null, null, null);
  document.getElementById('o-type').onchange = (e) => upd(() => {
    o.winType = e.target.value;
    const t = WINDOW_TYPES[e.target.value];
    o.w = t.w; o.h = t.h; o.sill = t.sill;
  });
  document.getElementById('o-side').onchange = (e) => upd(() => o.side = e.target.value);
  document.getElementById('o-w').onchange = (e) => upd(() => o.w = Math.max(300, +e.target.value || 300));
  document.getElementById('o-h').onchange = (e) => upd(() => o.h = Math.max(300, +e.target.value || 300));
  document.getElementById('o-sill').onchange = (e) => upd(() => o.sill = Math.max(0, +e.target.value || 0));
  document.getElementById('o-pos').onchange = (e) => upd(() => o.pos = +e.target.value || 0);
  document.getElementById('o-color').oninput = (e) => upd(() => o.color = e.target.value);
  document.getElementById('o-dup').onclick = () => store.commit((d) => {
    const copy = { ...o, id: 'o' + Date.now().toString(36), pos: o.pos + 1200 };
    d.openings.push(copy); store.selectedOpening = copy.id;
  });
  document.getElementById('o-del').onclick = () => store.commit((d) => {
    d.openings = d.openings.filter((x) => x.id !== o.id); store.selectedOpening = null;
  });
}

function roomForm(room) {
  const opts = Object.entries(ROOM_TYPES)
    .map(([k, t]) => `<option value="${k}" ${k === room.type ? 'selected' : ''}>${t.label}</option>`).join('');
  const area = (room.w * room.d / 1e6).toFixed(2);
  return `
    <p class="ph">공간 속성</p>
    <label class="fld"><span>이름</span><input id="r-name" value="${esc(room.name)}"></label>
    <label class="fld"><span>종류</span><select id="r-type">${opts}</select></label>
    <div class="grid2">
      <label class="fld"><span>가로 W (mm)</span><input id="r-w" type="number" step="100" value="${room.w}"></label>
      <label class="fld"><span>세로 D (mm)</span><input id="r-d" type="number" step="100" value="${room.d}"></label>
    </div>
    <div class="grid2">
      <label class="fld"><span>X 위치</span><input id="r-x" type="number" step="100" value="${room.x}"></label>
      <label class="fld"><span>Y 위치</span><input id="r-y" type="number" step="100" value="${room.y}"></label>
    </div>
    <div class="info-row"><span>면적</span><b>${area} m² (${(area/3.305).toFixed(1)}평)</b></div>
    <div class="fld"><span>벽 (눌러서 트기 ↔ 막기)</span>
      <div class="wall-toggle" id="r-walls">
        ${[['n','북'],['s','남'],['w','서'],['e','동']].map(([s,l]) =>
          `<button class="wt${(room.open||[]).includes(s) ? ' off' : ''}" data-s="${s}">${l}</button>`).join('')}
      </div>
    </div>
    <p class="hint small">거실·주방처럼 트인 공간은 맞닿은 두 방의 해당 면을 모두 '트기'로 (3D에서 벽 사라짐)</p>
    <div class="btn-row">
      <button class="mini" id="r-dup">복제</button>
      <button class="mini danger" id="r-del">삭제</button>
    </div>
    <p class="hint">도면에서 모서리·변의 핸들을 끌어 넓히거나 좁힐 수 있습니다.</p>`;
}

function bindRoomForm(room) {
  const upd = (key, val) => store.commit(() => { room[key] = val; });
  document.getElementById('r-name').onchange = (e) => upd('name', e.target.value);
  document.getElementById('r-type').onchange = (e) => upd('type', e.target.value);
  for (const k of ['w', 'd', 'x', 'y']) {
    document.getElementById('r-' + k).onchange = (e) => upd(k, Math.max(0, +e.target.value || 0));
  }
  document.querySelectorAll('#r-walls .wt').forEach((btn) => btn.onclick = () => store.commit(() => {
    const s = btn.dataset.s;
    const open = Array.isArray(room.open) ? room.open : (room.open = []);
    const i = open.indexOf(s);
    if (i >= 0) open.splice(i, 1); else open.push(s); // 막기 ↔ 트기 토글
  }));
  document.getElementById('r-dup').onclick = () => store.commit((d) => {
    const copy = { ...room, id: 'r' + Date.now().toString(36), x: room.x + 400, y: room.y + 400 };
    if (Array.isArray(room.open)) copy.open = room.open.slice();
    d.rooms.push(copy); store.selectedRoom = copy.id;
  });
  document.getElementById('r-del').onclick = () => store.commit((d) => {
    d.rooms = d.rooms.filter((r) => r.id !== room.id); store.selectedRoom = null;
  });
}

function furnForm(f) {
  const c = catalogOf(f.catalogId) || {};
  return `
    <p class="ph">가구 속성</p>
    <div class="info-row"><span>이름</span><b>${esc(c.name || '')}</b></div>
    <div class="info-row"><span>크기</span><b>${c.w}×${c.d}×${c.h}mm</b></div>
    <label class="fld"><span>회전 (°)</span><input id="f-rot" type="number" step="15" value="${f.rotation || 0}"></label>
    <div class="grid2">
      <label class="fld"><span>X 위치</span><input id="f-x" type="number" step="50" value="${f.x}"></label>
      <label class="fld"><span>Y 위치</span><input id="f-y" type="number" step="50" value="${f.y}"></label>
    </div>
    <div class="btn-row">
      <button class="mini" id="f-rotl">⟲ 90°</button>
      <button class="mini" id="f-rotr">⟳ 90°</button>
      <button class="mini" id="f-dup">복제</button>
      <button class="mini danger" id="f-del">삭제</button>
    </div>`;
}

function bindFurnForm(f) {
  const upd = (m) => store.commit(() => m());
  document.getElementById('f-rot').onchange = (e) => upd(() => f.rotation = ((+e.target.value % 360) + 360) % 360);
  document.getElementById('f-x').onchange = (e) => upd(() => f.x = +e.target.value || 0);
  document.getElementById('f-y').onchange = (e) => upd(() => f.y = +e.target.value || 0);
  document.getElementById('f-rotl').onclick = () => upd(() => f.rotation = (((f.rotation || 0) - 90) % 360 + 360) % 360);
  document.getElementById('f-rotr').onclick = () => upd(() => f.rotation = (((f.rotation || 0) + 90) % 360 + 360) % 360);
  document.getElementById('f-dup').onclick = () => store.commit((d) => {
    const copy = { ...f, id: 'f' + Date.now().toString(36), x: f.x + 400, y: f.y + 400 };
    d.furniture.push(copy); store.selectedFurniture = copy.id;
  });
  document.getElementById('f-del').onclick = () => store.commit((d) => {
    d.furniture = d.furniture.filter((x) => x.id !== f.id); store.selectedFurniture = null;
  });
}

// ---------------------------------------------------------------------------
// 상단 툴바
// ---------------------------------------------------------------------------
function buildToolbar({ editor, viewer, onModeChange }) {
  const $ = (id) => document.getElementById(id);

  $('tb-2d').onclick = () => onModeChange('2d');
  $('tb-3d').onclick = () => onModeChange('3d');

  $('tb-fit').onclick = () => { editor.fit(); viewer._needCam = true; viewer.dirty = true; };
  $('tb-undo').onclick = () => store.undo();
  $('tb-redo').onclick = () => store.redo();
  // 되돌릴/다시할 게 없으면 버튼 흐리게(비활성) — 직관적 피드백
  const refreshUndo = () => {
    $('tb-undo').disabled = !store.canUndo();
    $('tb-redo').disabled = !store.canRedo();
  };
  store.subscribe(refreshUndo);
  refreshUndo();

  $('tb-new').onclick = () => { if (confirm('빈 새 도면을 시작할까요? 저장하지 않은 변경은 사라집니다.')) { store.newDesign(); editor.fit(); viewer._needCam = true; viewer.dirty = true; } };

  $('tb-save').onclick = () => {
    const name = prompt('저장할 도면 이름', store.design.name);
    if (name) { store.saveAs(name); flash(`'${name}' 저장됨`); }
  };

  $('tb-open').onclick = () => openLoadDialog();
  $('tb-templates').onclick = () => openTemplateDialog();
  $('tb-underlay').onclick = () => openUnderlayDialog(editor);
  $('tb-cloud').onclick = () => openCloudDialog();

  $('tb-export').onclick = () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (store.design.name || 'seum-design') + '.json';
    a.click();
  };

  $('tb-import').onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json';
    inp.onchange = () => {
      const file = inp.files[0]; if (!file) return;
      const rd = new FileReader();
      rd.onload = () => { try { store.importJSON(rd.result); flash('불러오기 완료'); } catch (e) { alert('불러오기 실패: ' + e.message); } };
      rd.readAsText(file);
    };
    inp.click();
  };

  $('tb-shot').onclick = () => {
    const a = document.createElement('a');
    a.href = viewer.active ? viewer.toImage() : editor.toImage();
    a.download = (store.design.name || 'seum') + (viewer.active ? '-3D' : '-도면') + '.png';
    a.click();
  };

  $('tb-print').onclick = () => printDesign(editor, viewer);

  $('tb-roof').onclick = (e) => {
    viewer.controls.maxPolarAngle = viewer.controls.maxPolarAngle > 1.4 ? Math.PI / 2.05 : Math.PI;
    e.currentTarget.classList.toggle('on');
  };

  // 외장재 / 지붕 표시 토글 (3D) — 패널 체크박스와 동기화
  $('view-ext').onclick = () => applyOuter('showExterior', !viewer.showExterior);
  $('view-roof').onclick = () => applyOuter('showRoof', !viewer.showRoof);

  // 3D 카메라 프리셋
  $('view-iso').onclick = () => viewer.view('iso');
  $('view-top').onclick = () => viewer.view('top');
  $('view-front').onclick = () => viewer.view('front');

  // 키보드 단축키
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); store.undo(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); store.redo(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (store.selectedRoom) store.commit((d) => { d.rooms = d.rooms.filter((r) => r.id !== store.selectedRoom); store.selectedRoom = null; });
      else if (store.selectedFurniture) store.commit((d) => { d.furniture = d.furniture.filter((f) => f.id !== store.selectedFurniture); store.selectedFurniture = null; });
      else if (store.selectedOpening) store.commit((d) => { d.openings = d.openings.filter((o) => o.id !== store.selectedOpening); store.selectedOpening = null; });
    }
  });
}

function openLoadDialog() {
  const list = store.savedList();
  if (!list.length) { alert('저장된 도면이 없습니다.'); return; }
  const dlg = document.getElementById('load-dialog');
  const body = document.getElementById('load-list');
  body.innerHTML = '';
  for (const e of list.slice().reverse()) {
    const row = document.createElement('div');
    row.className = 'load-row';
    row.innerHTML = `<span>${esc(e.name)}</span><small>${new Date(e.savedAt).toLocaleString('ko-KR')}</small>`;
    row.onclick = () => { store.loadSaved(e.name); dlg.close(); flash(`'${e.name}' 불러옴`); };
    body.appendChild(row);
  }
  dlg.showModal();
  document.getElementById('load-close').onclick = () => dlg.close();
}

// ---------------------------------------------------------------------------
// 공통 모달 헬퍼 (동적 생성)
// ---------------------------------------------------------------------------
function modal(title, contentEl) {
  let dlg = document.getElementById('seum-modal');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'seum-modal';
    dlg.className = 'dialog';
    document.body.appendChild(dlg);
  }
  dlg.innerHTML = `<div class="dialog-head"><span id="m-title"></span><button id="m-close">✕</button></div><div id="m-body" class="m-body"></div>`;
  dlg.querySelector('#m-title').textContent = title;
  dlg.querySelector('#m-body').appendChild(contentEl);
  dlg.querySelector('#m-close').onclick = () => dlg.close();
  if (!dlg.open) dlg.showModal();
  return dlg;
}

// ---------------------------------------------------------------------------
// 기본 도면 라이브러리 (세움 제품: 주택 / 체류형 쉼터 / 농막)
// ---------------------------------------------------------------------------
const PRODUCT_ICON = { '주택': '🏠', '체류형 쉼터': '🏕️', '농막': '🛖' };

async function openTemplateDialog() {
  const body = document.createElement('div');
  const builtin = listTemplates();
  const ptypeOpts = PRODUCT_TYPES.map((p) =>
    `<option value="${esc(p)}"${(store.design.productType || '') === p ? ' selected' : ''}>${p}</option>`).join('');
  body.innerHTML = `<p class="m-sub">기본 도면을 선택하면 현재 화면에 불러와 바로 수정할 수 있습니다.</p>
    <div class="tpl-add">
      <div class="tpl-add-btns">
        <button class="mini primary" id="tpl-add-btn">➕ 현재 도면을 기본 도면으로 추가</button>
        <button class="mini" id="tpl-file-btn">📁 파일 등록 (.json · PDF · 이미지 · DXF)</button>
      </div>
      <div class="tpl-add-form" id="tpl-add-form" style="display:none">
        <input id="tpl-add-title" placeholder="기본 도면 이름" value="${esc(store.design.name || '')}">
        <select id="tpl-add-ptype">${ptypeOpts}</select>
        <button class="mini primary" id="tpl-add-save">추가</button>
        <button class="mini" id="tpl-add-cancel">취소</button>
      </div>
    </div>
    <div class="cl-filter" id="tpl-filter"></div>
    <div id="tpl-local-wrap" style="display:none">
      <p class="m-sub" style="margin-top:6px">📌 내 기본 도면 <span style="color:var(--muted)">(이 기기에 저장)</span></p>
      <div class="tpl-grid" id="tpl-local"></div>
    </div>
    <div class="tpl-grid" id="tpl-builtin"></div>
    <div id="tpl-cloud-wrap" style="display:none">
      <p class="m-sub" style="margin-top:14px">☁ 영업팀 공용 기본 도면</p>
      <div class="tpl-grid" id="tpl-cloud"></div>
    </div>`;
  const dlg = modal('기본 도면 라이브러리', body);

  let cloudTpls = [];
  let filter = '';

  const matches = (cat) => !filter || cat === filter;

  const renderBuiltin = () => {
    const grid = body.querySelector('#tpl-builtin');
    grid.innerHTML = '';
    for (const t of builtin) {
      if (!matches(t.category)) continue;
      const card = document.createElement('button');
      card.className = 'tpl-card';
      card.innerHTML = `<div class="tpl-ico">${PRODUCT_ICON[t.category] || '🏠'}</div><div class="tpl-name">${esc(t.title)}</div>
        <div class="tpl-tags">${t.tags.map((x) => `#${esc(x)}`).join(' ')}</div>`;
      card.onclick = () => {
        if (!confirm(`'${t.title}' 기본 도면을 불러올까요? 현재 작업은 사라집니다.`)) return;
        const d = instantiateTemplate(t.id);
        if (d) { store.loadInto(d); dlg.close(); flash(`'${t.title}' 불러옴`); }
      };
      grid.appendChild(card);
    }
  };

  const renderLocal = () => {
    const wrap = body.querySelector('#tpl-local-wrap');
    const grid = body.querySelector('#tpl-local');
    const shown = store.localTemplates().filter((t) => matches((t.productType || '').trim()));
    wrap.style.display = shown.length ? '' : 'none';
    grid.innerHTML = '';
    for (const t of shown) {
      const ptype = (t.productType || '').trim();
      const thumb = t.data && t.data.underlay && t.data.underlay.src;
      const card = document.createElement('div');
      card.className = 'tpl-card';
      card.innerHTML = `<button class="tpl-del" title="삭제">✕</button>
        <div class="tpl-thumb">${thumb ? `<img src="${thumb}" alt="">` : `<span class="tpl-ico">${PRODUCT_ICON[ptype] || '📌'}</span>`}</div>
        <div class="tpl-name">${esc(t.title)}</div>
        <div class="tpl-tags">${thumb ? '밑그림 도면' : '내 기본 도면'}${ptype ? ` · ${esc(ptype)}` : ''}</div>`;
      card.onclick = () => {
        if (!confirm(`'${t.title}' 기본 도면을 불러올까요? 현재 작업은 사라집니다.`)) return;
        store.loadInto(t.data); dlg.close();
        if (thumb && _editor && _editor.focusUnderlay) _editor.focusUnderlay();
        flash(`'${t.title}' 불러옴`);
      };
      card.querySelector('.tpl-del').onclick = (e) => {
        e.stopPropagation();
        if (!confirm(`'${t.title}'을(를) 내 기본 도면에서 삭제할까요?`)) return;
        store.removeLocalTemplate(t.id); renderLocal();
      };
      grid.appendChild(card);
    }
  };

  const renderCloud = () => {
    const wrap = body.querySelector('#tpl-cloud-wrap');
    const cg = body.querySelector('#tpl-cloud');
    const shown = cloudTpls.filter((t) => matches((t.data?.productType || '').trim()));
    wrap.style.display = shown.length ? '' : 'none';
    cg.innerHTML = '';
    for (const t of shown) {
      const thumb = t.data?.thumb;
      const ptype = (t.data?.productType || '').trim();
      const card = document.createElement('button');
      card.className = 'tpl-card';
      card.innerHTML = `<div class="tpl-thumb">${thumb ? `<img src="${thumb}" alt="">` : `<span class="tpl-ico">${PRODUCT_ICON[ptype] || '☁'}</span>`}</div><div class="tpl-name">${esc(t.name)}</div><div class="tpl-tags">${ptype ? esc(ptype) : '공용 기본 도면'}</div>`;
      card.onclick = () => {
        store.loadInto(t.data, { cloudId: null });
        dlg.close(); flash(`'${t.name}' 불러옴`);
      };
      cg.appendChild(card);
    }
  };

  const renderFilter = () => {
    const bar = body.querySelector('#tpl-filter');
    const cats = ['', ...PRODUCT_TYPES];
    bar.innerHTML = cats.map((c) =>
      `<button class="chip${filter === c ? ' on' : ''}" data-c="${esc(c)}">${c ? `${PRODUCT_ICON[c] || ''} ${esc(c)}` : '전체'}</button>`
    ).join('');
    bar.querySelectorAll('.chip').forEach((ch) => ch.onclick = () => {
      filter = ch.dataset.c;
      renderFilter(); renderLocal(); renderBuiltin(); renderCloud();
    });
  };

  // 현재 도면을 내 기본 도면으로 추가
  const addForm = body.querySelector('#tpl-add-form');
  body.querySelector('#tpl-add-btn').onclick = () => { addForm.style.display = 'flex'; body.querySelector('#tpl-add-title').focus(); };
  body.querySelector('#tpl-add-cancel').onclick = () => { addForm.style.display = 'none'; };
  body.querySelector('#tpl-add-save').onclick = () => {
    const title = body.querySelector('#tpl-add-title').value.trim();
    const productType = body.querySelector('#tpl-add-ptype').value;
    if (!title) { body.querySelector('#tpl-add-title').focus(); return; }
    try {
      store.addLocalTemplate({ title, productType });
      addForm.style.display = 'none';
      filter = ''; renderFilter(); renderLocal();
      flash(`'${title}' 기본 도면에 추가됨`);
    } catch (e) { alert('저장 공간이 부족합니다. 기존 내 기본 도면을 정리해 주세요.'); }
  };
  // 기존에 가진 도면 파일을 골라 내 기본 도면으로 등록 (여러 개 가능)
  // .json=편집 도면, PDF/이미지=밑그림 배경 도면, CAD=변환 안내
  body.querySelector('#tpl-file-btn').onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json,application/pdf,image/*,.dxf,.dwg';
    inp.multiple = true;
    inp.onchange = async () => {
      const files = [...(inp.files || [])]; if (!files.length) return;
      let ok = 0; const fails = []; const cad = [];
      const addUnderlay = (title, dataURL, w0, h0) => {
        store.addLocalTemplate({ title, keepUnderlay: true, design: {
          name: title, productType: '', ceilingHeight: 2400,
          exterior: { material: 'metal', color: '#8d96a0' },
          roof: { type: 'gable', color: '#3a3f44' },
          rooms: [], openings: [], furniture: [],
          underlay: { src: dataURL, x: 0, y: 0, w: w0, h: h0, opacity: 0.5, hidden: false },
        } });
      };
      for (const file of files) {
        const name = file.name;
        const isDwg = /\.dwg$/i.test(name);          // .dwg 는 바이너리라 미지원
        const isDxf = /\.dxf$/i.test(name);
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(name);
        const isImg = /^image\//.test(file.type) || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
        const isJson = file.type === 'application/json' || /\.json$/i.test(name);
        const title = name.replace(/\.[^.]+$/, '');
        try {
          if (isDwg) { cad.push(name); continue; }
          if (isJson) {
            const d = JSON.parse(await file.text());
            store.addLocalTemplate({ title: (d.name && d.name.trim()) || title, productType: d.productType || '', design: d });
            ok++;
          } else if (isDxf) {
            flash(`'${name}' DXF 변환 중...`);
            const r = dxfToUnderlay(await file.text());
            if (!r) { fails.push(name); continue; }
            addUnderlay(title, r.dataURL, r.w, r.h); ok++;
          } else if (isPdf || isImg) {
            flash(`'${name}' 변환 중...`);
            let dataURL, iw, ih;
            if (isPdf) ({ dataURL, iw, ih } = await pdfToImage(file));
            else { dataURL = await fileToDataURL(file); ({ iw, ih } = await imageSize(dataURL)); }
            ({ dataURL, iw, ih } = await downscaleDataURL(dataURL, 1800, 0.75)); // 저장 용량 절약
            addUnderlay(title, dataURL, 12000, 12000 * (ih / iw)); ok++;
          } else { fails.push(name); }
        } catch (e) { fails.push(name); }
      }
      filter = ''; renderFilter(); renderLocal();
      let msg = ok ? `${ok}개 등록` : '';
      if (fails.length) msg += `${msg ? ', ' : ''}${fails.length}개 실패`;
      flash(msg || '등록된 파일 없음');
      if (cad.length) alert(`.dwg 파일(${cad.join(', ')})은 브라우저에서 바로 열 수 없습니다.\n캐드에서 'DXF로 저장' 후 등록하시면 됩니다. (DXF는 지원)`);
    };
    inp.click();
  };

  renderFilter();
  renderLocal();
  renderBuiltin();

  // 클라우드 공용 기본 도면 (설정+가능 시)
  if (cloud.configured()) {
    try {
      await cloud.init();
      cloudTpls = await cloud.listTemplates();
      renderCloud();
    } catch (e) { /* 클라우드 미가용 → 내장 도면만 */ }
  }
}

// ---------------------------------------------------------------------------
// 밑그림(참조 도면): PDF/이미지를 배경에 깔고 그 위에 방을 그려 편집 도면으로 변환
// ---------------------------------------------------------------------------
function openUnderlayDialog(editor) {
  const body = document.createElement('div');
  // 밑그림 변경은 undo 히스토리에 큰 이미지가 쌓이지 않도록 liveUpdate 로 처리
  const apply = (mut) => { store.liveUpdate(mut); store.liveEnd(); };

  function render() {
    const u = store.design.underlay;
    if (!u) {
      body.innerHTML = `
        <p class="m-sub">갖고 계신 도면 <b>PDF·이미지·DXF</b>(캐드)를 배경으로 깔고, 그 위에 방을 그려 편집 가능한 도면으로 만드세요. <span style="color:var(--muted)">(.dwg는 캐드에서 DXF로 저장 후)</span></p>
        <label class="fld"><span>도면 파일 선택 (PDF / PNG / JPG / DXF)</span><input id="ul-file" type="file" accept="application/pdf,image/*,.dxf"></label>
        <p id="ul-msg" class="hint"></p>
        <ol class="hint" style="padding-left:18px;line-height:1.8">
          <li>파일을 고르면 화면 배경에 깔립니다.</li>
          <li><b>축척 맞추기</b> → 도면에서 길이를 아는 곳(예: 벽 한 변)의 양끝 두 점을 클릭하고 실제 mm 입력 → 크기가 실제와 맞춰집니다.</li>
          <li>좌측 <b>공간 추가 → ✏️ 도면 위에 방 그리기</b>를 켜고, 밑그림 위에서 <b>드래그</b>해 방을 따라 그립니다. (방 종류 먼저 선택)</li>
          <li>그린 방은 자동으로 2D·3D 편집 도면이 됩니다. 다 그리면 <b>밑그림 제거</b> 후 "📐 기본 도면으로 저장".</li>
        </ol>`;
      body.querySelector('#ul-file').onchange = (e) => loadFile(e.target.files[0]);
      return;
    }
    body.innerHTML = `
      <p class="m-sub">밑그림이 깔려 있습니다. <b>축척 맞추기</b>로 크기를 실제와 맞춘 뒤 방을 그려 따라 그리세요.</p>
      <label class="fld"><span>투명도</span><input id="ul-op" type="range" min="0.1" max="1" step="0.05" value="${u.opacity != null ? u.opacity : 0.5}"></label>
      <label class="fld"><span>가로 실제 크기(mm)</span><input id="ul-w" type="number" value="${Math.round(u.w)}" step="100"></label>
      <div class="btn-row">
        <button class="mini" id="ul-cal" style="flex:1;background:#c8102e;color:#fff;border-color:#c8102e">📏 축척 맞추기 (두 점)</button>
        <button class="mini" id="ul-focus" style="flex:1">화면 맞춤</button>
      </div>
      <div class="btn-row">
        <button class="mini" id="ul-hide" style="flex:1">${u.hidden ? '밑그림 보이기' : '밑그림 숨기기'}</button>
        <button class="mini" id="ul-replace" style="flex:1">다른 파일</button>
        <button class="mini danger" id="ul-del" style="flex:1">밑그림 제거</button>
      </div>
      <p id="ul-msg" class="hint"></p>`;
    body.querySelector('#ul-op').oninput = (e) => store.liveUpdate((d) => { d.underlay.opacity = parseFloat(e.target.value); });
    body.querySelector('#ul-op').onchange = () => store.liveEnd();
    body.querySelector('#ul-w').onchange = (e) => {
      const neww = parseFloat(e.target.value);
      if (neww > 0) apply((d) => { const f = neww / d.underlay.w; d.underlay.h *= f; d.underlay.w = neww; });
    };
    body.querySelector('#ul-cal').onclick = () => {
      editor.startCalibrate();
      closeModal();
      flash('밑그림 위에서 길이를 아는 두 점을 차례로 클릭하세요');
    };
    body.querySelector('#ul-focus').onclick = () => editor.focusUnderlay();
    body.querySelector('#ul-hide').onclick = () => { apply((d) => { d.underlay.hidden = !d.underlay.hidden; }); render(); };
    body.querySelector('#ul-replace').onclick = () => { apply((d) => { d.underlay = null; }); render(); };
    body.querySelector('#ul-del').onclick = () => {
      if (!confirm('밑그림을 제거할까요? (그려둔 방은 그대로 남습니다)')) return;
      apply((d) => { d.underlay = null; });
      render();
    };
  }

  async function loadFile(file) {
    if (!file) return;
    const msg = body.querySelector('#ul-msg');
    try {
      msg.style.color = ''; msg.textContent = '불러오는 중...';
      let dataURL, iw, ih, w0, h0;
      if (/\.dxf$/i.test(file.name)) {
        const r = dxfToUnderlay(await file.text());
        if (!r) throw new Error('DXF에서 도형을 찾지 못했습니다 (.dwg는 DXF로 저장 후 시도)');
        dataURL = r.dataURL; w0 = r.w; h0 = r.h;
      } else if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        ({ dataURL, iw, ih } = await pdfToImage(file));
        w0 = 12000; h0 = w0 * (ih / iw); // 기본 12m, '축척 맞추기'로 보정
      } else {
        dataURL = await fileToDataURL(file);
        ({ iw, ih } = await imageSize(dataURL));
        w0 = 12000; h0 = w0 * (ih / iw);
      }
      apply((d) => { d.underlay = { src: dataURL, x: 0, y: 0, w: w0, h: h0, opacity: 0.5, hidden: false }; });
      editor.focusUnderlay();
      render();
      flash('밑그림 불러옴 — 이제 "축척 맞추기"로 크기를 맞추세요');
    } catch (e) {
      msg.style.color = '#c8102e';
      msg.textContent = '불러오기 실패: ' + e.message;
    }
  }

  render();
  modal('밑그림 (참조 도면)', body);
}

function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('파일 읽기 실패'));
    r.readAsDataURL(file);
  });
}
function imageSize(dataURL) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res({ iw: img.naturalWidth, ih: img.naturalHeight });
    img.onerror = () => rej(new Error('이미지 형식 오류'));
    img.src = dataURL;
  });
}
// 라이브러리 저장 용량 절약을 위해 큰 이미지를 줄이고 JPEG 로 재인코딩
function downscaleDataURL(dataURL, maxDim, quality) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const cw = Math.max(1, Math.round(img.naturalWidth * scale));
      const ch = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      c.getContext('2d').drawImage(img, 0, 0, cw, ch);
      res({ dataURL: c.toDataURL('image/jpeg', quality), iw: cw, ih: ch });
    };
    img.onerror = () => rej(new Error('이미지 변환 실패'));
    img.src = dataURL;
  });
}
// PDF 1페이지를 이미지(dataURL)로 변환 (pdf.js, CDN 동적 로드)
async function pdfToImage(file) {
  const pdfjs = await import('https://esm.sh/pdfjs-dist@4.7.76/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs';
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width; canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return { dataURL: canvas.toDataURL('image/jpeg', 0.85), iw: canvas.width, ih: canvas.height };
}

// ---------------------------------------------------------------------------
// 클라우드 (Supabase): 로그인 / 저장 / 목록 / 공유 링크
// ---------------------------------------------------------------------------
function buildCloud() {
  // 로그인 상태가 바뀌면 버튼 라벨 갱신
  cloud.onChange(() => updateCloudBtn());
  if (cloud.configured()) cloud.init().then(() => updateCloudBtn());
  updateCloudBtn();
}

function updateCloudBtn() {
  const btn = document.getElementById('tb-cloud');
  if (!btn) return;
  if (!cloud.configured()) { btn.textContent = '☁ 클라우드'; btn.title = '클라우드 미설정'; return; }
  btn.textContent = cloud.user ? `☁ ${cloud.user.email.split('@')[0]}` : '☁ 로그인';
}

async function openCloudDialog() {
  const body = document.createElement('div');
  if (!cloud.configured()) {
    body.innerHTML = `<p class="m-sub">클라우드가 아직 설정되지 않았습니다.</p>
      <p class="hint">관리자가 <code>config.js</code>에 Supabase URL/anon key를 넣으면 활성화됩니다. (설정 방법: <code>supabase/README.md</code>)<br><br>그 전까지는 <b>내보내기/가져오기(.json)</b>와 <b>브라우저 저장</b>으로 도면을 주고받을 수 있습니다.</p>`;
    modal('클라우드', body);
    return;
  }
  await cloud.init();
  if (!cloud.user) { renderLogin(body); modal('클라우드 로그인', body); return; }
  renderCloudHome(body);
  modal('클라우드', body);
}

function renderLogin(body) {
  body.innerHTML = `
    <p class="m-sub">영업사원 계정으로 로그인하세요.</p>
    <label class="fld"><span>이메일</span><input id="cl-email" type="email" autocomplete="username"></label>
    <label class="fld"><span>비밀번호</span><input id="cl-pw" type="password" autocomplete="current-password"></label>
    <div class="btn-row">
      <button class="mini" id="cl-signin" style="flex:2;background:#c8102e;color:#fff;border-color:#c8102e">로그인</button>
      <button class="mini" id="cl-signup">회원가입</button>
    </div>
    <p id="cl-msg" class="hint" style="color:#c8102e"></p>`;
  const msg = body.querySelector('#cl-msg');
  const email = () => body.querySelector('#cl-email').value.trim();
  const pw = () => body.querySelector('#cl-pw').value;
  body.querySelector('#cl-signin').onclick = async () => {
    msg.textContent = '로그인 중...';
    try { await cloud.signIn(email(), pw()); reopenCloud(); flash('로그인됨'); }
    catch (e) { msg.textContent = '로그인 실패: ' + e.message; }
  };
  body.querySelector('#cl-signup').onclick = async () => {
    msg.textContent = '가입 중...';
    try { await cloud.signUp(email(), pw()); msg.style.color = '#2a7'; msg.textContent = '가입 완료. 로그인해 주세요. (이메일 확인이 필요할 수 있음)'; }
    catch (e) { msg.style.color = '#c8102e'; msg.textContent = '가입 실패: ' + e.message; }
  };
}

function renderCloudHome(body) {
  body.innerHTML = `
    <div class="cl-bar">
      <span class="m-sub">${esc(cloud.user.email)}</span>
      <button class="mini" id="cl-out" style="flex:0 0 auto">로그아웃</button>
    </div>
    <div class="btn-row">
      <button class="mini" id="cl-save" style="flex:1;background:#c8102e;color:#fff;border-color:#c8102e">현재 도면 클라우드 저장</button>
      <button class="mini" id="cl-save-tpl" style="flex:1">📐 기본 도면으로 저장</button>
    </div>
    <div class="cl-tabs">
      <button class="cl-tab active" data-t="mine">내 도면</button>
      <button class="cl-tab" data-t="shared">공유 도면</button>
    </div>
    <div id="cl-list" class="cl-list"><p class="hint">불러오는 중...</p></div>`;
  body.querySelector('#cl-out').onclick = async () => { await cloud.signOut(); reopenCloud(); };
  body.querySelector('#cl-save').onclick = () => openSaveForm(body);
  body.querySelector('#cl-save-tpl').onclick = () => openSaveForm(body, { asTemplate: true });
  const tabs = body.querySelectorAll('.cl-tab');
  tabs.forEach((tb) => tb.onclick = () => {
    tabs.forEach((x) => x.classList.toggle('active', x === tb));
    loadCloudList(body, tb.dataset.t);
  });
  loadCloudList(body, 'mine');
}

async function loadCloudList(body, which, filter = '') {
  const list = body.querySelector('#cl-list');
  list.innerHTML = `<p class="hint">불러오는 중...</p>`;
  try {
    let rows = which === 'mine' ? await cloud.listMine() : await cloud.listShared();
    if (!rows.length) { list.innerHTML = `<p class="hint">도면이 없습니다.</p>`; return; }

    // 고객(폴더) 필터 바 (내 도면에서만)
    list.innerHTML = '';
    if (which === 'mine') {
      const customers = [...new Set(rows.map((r) => (r.data?.customer || '').trim()).filter(Boolean))].sort();
      const bar = document.createElement('div');
      bar.className = 'cl-filter';
      bar.innerHTML = `<button class="chip${!filter ? ' on' : ''}" data-c="">전체</button>` +
        customers.map((c) => `<button class="chip${filter === c ? ' on' : ''}" data-c="${esc(c)}">📁 ${esc(c)}</button>`).join('') +
        (rows.some((r) => !(r.data?.customer || '').trim()) ? `<button class="chip${filter === '__none' ? ' on' : ''}" data-c="__none">미분류</button>` : '');
      bar.querySelectorAll('.chip').forEach((ch) => ch.onclick = () => loadCloudList(body, which, ch.dataset.c));
      list.appendChild(bar);
      if (filter === '__none') rows = rows.filter((r) => !(r.data?.customer || '').trim());
      else if (filter) rows = rows.filter((r) => (r.data?.customer || '').trim() === filter);
    }

    if (!rows.length) { list.insertAdjacentHTML('beforeend', `<p class="hint">해당 폴더에 도면이 없습니다.</p>`); return; }

    for (const r of rows) {
      const cust = (r.data?.customer || '').trim();
      const thumb = r.data?.thumb;
      const row = document.createElement('div');
      row.className = 'cl-row';
      const ptype = (r.data?.productType || '').trim();
      const badges = `${ptype ? `<span class="bdg pt">${PRODUCT_ICON[ptype] || ''} ${esc(ptype)}</span>` : ''}${cust ? `<span class="bdg fld">📁 ${esc(cust)}</span>` : ''}${r.is_shared ? '<span class="bdg">공유</span>' : ''}${r.is_template ? '<span class="bdg tpl">기본도면</span>' : ''}`;
      row.innerHTML = `
        <div class="cl-row-top">
          <div class="cl-thumb">${thumb ? `<img src="${thumb}" alt="">` : '<span>도면</span>'}</div>
          <div class="cl-row-main"><b>${esc(r.name)}</b> ${badges}<small>${new Date(r.updated_at).toLocaleString('ko-KR')}</small></div>
        </div>
        <div class="cl-row-act">
          <button class="mini" data-a="open">열기</button>
          <button class="mini" data-a="link">공유링크</button>
          ${which === 'mine' ? '<button class="mini danger" data-a="del">삭제</button>' : ''}
        </div>`;
      row.querySelector('[data-a=open]').onclick = () => {
        // 목록에서 이미 data 를 받았으므로 추가 요청 없이 바로 로드
        store.loadInto(r.data, { cloudId: which === 'mine' ? r.id : null });
        flash(`'${r.name}' 불러옴`); closeModal();
      };
      row.querySelector('[data-a=link]').onclick = async () => {
        const link = cloud.shareLink(r.id);
        try { await navigator.clipboard.writeText(link); flash('공유 링크 복사됨'); }
        catch (e) { prompt('공유 링크', link); }
        if (which === 'mine' && !r.is_shared) flash('※ 고객 열람하려면 저장 시 "공유"를 켜세요');
      };
      const del = row.querySelector('[data-a=del]');
      if (del) del.onclick = async () => {
        if (!confirm(`'${r.name}' 삭제할까요?`)) return;
        try { await cloud.removeDesign(r.id); loadCloudList(body, which, filter); flash('삭제됨'); }
        catch (e) { alert('실패: ' + e.message); }
      };
      list.appendChild(row);
    }
  } catch (e) {
    list.innerHTML = `<p class="hint" style="color:#c8102e">목록 오류: ${esc(e.message)}<br>DB 스키마(supabase/schema.sql)가 적용됐는지 확인하세요.</p>`;
  }
}

function openSaveForm(body, { asTemplate = false } = {}) {
  const d = store.design;
  const wrap = document.createElement('div');
  wrap.className = 'cl-saveform';
  const ptOptions = ['', ...PRODUCT_TYPES].map((p) =>
    `<option value="${esc(p)}"${(d.productType || '') === p ? ' selected' : ''}>${p || '미지정'}</option>`
  ).join('');
  wrap.innerHTML = `
    <p class="m-sub">${asTemplate ? '현재 도면을 영업팀 공용 <b>기본 도면</b>으로 등록합니다.' : '현재 도면을 클라우드에 저장합니다.'}</p>
    <label class="fld"><span>도면 이름</span><input id="cs-name" value="${esc(d.name)}"></label>
    <label class="fld"><span>제품 종류</span><select id="cs-ptype">${ptOptions}</select></label>
    <label class="fld"><span>고객명 / 분류 (폴더)</span><input id="cs-cust" list="cs-cust-list" value="${esc(d.customer || '')}" placeholder="예: 홍길동 고객 / 송절단지"></label>
    <datalist id="cs-cust-list"></datalist>
    <label class="ck"><input type="checkbox" id="cs-shared"> 영업사원 간 공유 (동료 목록·고객 링크 열람 허용)</label>
    <label class="ck"><input type="checkbox" id="cs-tpl"${asTemplate ? ' checked' : ''}> 기본 도면으로 등록 (영업팀 공용 라이브러리)</label>
    <div class="btn-row">
      <button class="mini" id="cs-go" style="flex:2;background:#c8102e;color:#fff;border-color:#c8102e">저장</button>
      <button class="mini" id="cs-cancel">취소</button>
    </div>
    <p id="cs-msg" class="hint"></p>`;
  const list = body.querySelector('#cl-list');
  list.replaceChildren(wrap);
  // 기존 고객명들을 자동완성으로 제공
  cloud.listMine().then((rows) => {
    const names = [...new Set(rows.map((r) => r.data?.customer).filter(Boolean))];
    wrap.querySelector('#cs-cust-list').innerHTML = names.map((n) => `<option value="${esc(n)}">`).join('');
  }).catch(() => {});
  wrap.querySelector('#cs-cancel').onclick = () => loadCloudList(body, 'mine');
  wrap.querySelector('#cs-go').onclick = async () => {
    const msg = wrap.querySelector('#cs-msg');
    msg.textContent = '저장 중...';
    try {
      store.design.customer = wrap.querySelector('#cs-cust').value.trim();
      store.design.productType = wrap.querySelector('#cs-ptype').value;
      // 썸네일 생성 (작은 JPEG)
      try { store.design.thumb = _editor.toImage(360, 240, 'image/jpeg', 0.6); } catch (e) {}
      const isTemplate = wrap.querySelector('#cs-tpl').checked;
      // 기본 도면(템플릿)에는 용량 큰 밑그림을 제외해 깔끔하게 저장
      const data = isTemplate && store.design.underlay ? { ...store.design, underlay: null } : store.design;
      const saved = await cloud.saveDesign({
        id: store.cloudId || undefined,
        name: wrap.querySelector('#cs-name').value || '무제 도면',
        data,
        isShared: wrap.querySelector('#cs-shared').checked,
        isTemplate,
      });
      store.cloudId = saved.id;
      store.design.name = saved.name;
      flash('클라우드에 저장됨');
      loadCloudList(body, 'mine');
    } catch (e) { msg.style.color = '#c8102e'; msg.textContent = '저장 실패: ' + e.message; }
  };
}

function reopenCloud() {
  closeModal();
  setTimeout(openCloudDialog, 50);
}
function closeModal() {
  const dlg = document.getElementById('seum-modal');
  if (dlg && dlg.open) dlg.close();
}

// 공유 링크(?id=)로 진입 시 해당 도면 자동 로드
async function handleShareLink() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id || !cloud.configured()) return;
  try {
    await cloud.init();
    const row = await cloud.getDesign(id);
    store.loadInto(row.data, { cloudId: cloud.user && row.owner === cloud.user.id ? id : null });
    flash(`'${row.name}' (공유 도면) 불러옴`);
  } catch (e) {
    console.warn('공유 링크 로드 실패:', e);
  }
}

// ---------------------------------------------------------------------------
// 인쇄: 도면 + 3D 외관 + 면적표 + 외장/지붕/창호 사양을 견적 도면 형태로 출력
// ---------------------------------------------------------------------------
function printDesign(editor, viewer) {
  const d = store.design;
  let planImg = '', threeImg = '';
  try { planImg = editor.toImage(1700, 1150); } catch (e) {}
  try { threeImg = viewer.toImage(); } catch (e) {}

  const totalArea = d.rooms.reduce((s, r) => s + r.w * r.d, 0) / 1e6;
  const sideLabel = { n: '북(상)', s: '남(하)', e: '동(우)', w: '서(좌)' };

  const roomRows = d.rooms.map((r) => {
    const t = ROOM_TYPES[r.type] || {};
    const a = r.w * r.d / 1e6;
    return `<tr><td>${esc(r.name)}</td><td>${t.label || ''}</td><td>${r.w}×${r.d}</td><td>${a.toFixed(2)} m² (${(a/3.305).toFixed(1)}평)</td></tr>`;
  }).join('');

  const openRows = (d.openings || []).map((o) => {
    const t = WINDOW_TYPES[o.winType] || {};
    const room = d.rooms.find((rr) => rr.id === o.roomId);
    return `<tr><td>${t.label || ''}</td><td>${esc(room ? room.name : '-')} / ${sideLabel[o.side] || ''}</td><td>${o.w}×${o.h}</td><td>하단 ${o.sill}mm</td></tr>`;
  }).join('') || `<tr><td colspan="4" style="color:#888">등록된 창호 없음</td></tr>`;

  const ex = d.exterior || {}, roof = d.roof || {};
  const exMat = (EXTERIOR_MATERIALS[ex.material] || {}).label || '-';
  const roofT = (ROOF_TYPES[roof.type] || {}).label || '-';
  const sw = (c) => `<span style="display:inline-block;width:14px;height:14px;border:1px solid #999;border-radius:3px;background:${c};vertical-align:middle;margin-right:6px"></span>`;

  const today = new Date().toLocaleDateString('ko-KR');
  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>${esc(d.name)} — 세움 홈플래너</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Noto Sans KR", sans-serif; color: #222; margin: 24px; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #c8102e; padding-bottom: 10px; margin-bottom: 16px; }
  .head .logo { font-weight: 800; font-size: 26px; letter-spacing: 2px; color: #c8102e; }
  .head h1 { font-size: 18px; margin: 4px 0 0; }
  .head .meta { text-align: right; font-size: 12px; color: #666; }
  .imgs { display: flex; gap: 12px; margin-bottom: 16px; }
  .imgbox { flex: 1; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
  .imgbox .cap { background: #f4f5f7; font-size: 12px; font-weight: 600; padding: 6px 10px; border-bottom: 1px solid #ddd; }
  .imgbox img { width: 100%; display: block; }
  .cols { display: flex; gap: 16px; }
  h2 { font-size: 14px; border-left: 4px solid #c8102e; padding-left: 8px; margin: 14px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f4f5f7; }
  .spec td:first-child { color: #666; width: 90px; }
  .tot { font-weight: 700; }
  .foot { margin-top: 18px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 8px; }
  @media print { body { margin: 10mm; } .imgbox { break-inside: avoid; } @page { size: A4; } }
</style></head><body>
  <div class="head">
    <div><div class="logo">SEUM</div><h1>${esc(d.name)}</h1></div>
    <div class="meta">세움 홈플래너 견적 도면<br>출력일: ${today}</div>
  </div>
  <div class="imgs">
    ${planImg ? `<div class="imgbox"><div class="cap">평면도</div><img src="${planImg}"></div>` : ''}
    ${threeImg ? `<div class="imgbox"><div class="cap">3D 투시도</div><img src="${threeImg}"></div>` : ''}
  </div>
  <div class="cols">
    <div style="flex:1.4">
      <h2>공간 구성</h2>
      <table><thead><tr><th>이름</th><th>종류</th><th>크기(mm)</th><th>면적</th></tr></thead>
      <tbody>${roomRows}<tr class="tot"><td colspan="3">합계 (${d.rooms.length}개 공간)</td><td>${totalArea.toFixed(2)} m² (${(totalArea/3.305).toFixed(1)}평)</td></tr></tbody></table>
    </div>
    <div style="flex:1">
      <h2>외장 · 지붕 사양</h2>
      <table class="spec"><tbody>
        <tr><td>외장재</td><td>${exMat}</td></tr>
        <tr><td>외장 색상</td><td>${sw(ex.color)}${ex.color || '-'}</td></tr>
        <tr><td>지붕 형태</td><td>${roofT}</td></tr>
        <tr><td>지붕 색상</td><td>${sw(roof.color)}${roof.color || '-'}</td></tr>
        <tr><td>천장 높이</td><td>${d.ceilingHeight} mm</td></tr>
      </tbody></table>
    </div>
  </div>
  <h2>창호 내역</h2>
  <table><thead><tr><th>종류</th><th>위치(방/벽면)</th><th>크기(mm)</th><th>비고</th></tr></thead><tbody>${openRows}</tbody></table>
  <div class="foot">본 도면은 상담용 참고 자료이며 실제 시공 시 치수·사양은 변경될 수 있습니다. · 세움 홈플래너</div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };<\/script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('팝업이 차단되었습니다. 팝업을 허용해 주세요.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ---------------------------------------------------------------------------
function flash(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 1800);
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
