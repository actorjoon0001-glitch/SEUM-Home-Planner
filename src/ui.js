// 세움 홈플래너 - UI 구성 (라이브러리 패널, 속성 패널, 툴바 동작)
import { store } from './store.js';
import { ROOM_TYPES, FURNITURE_CATALOG, CATEGORIES, catalogOf } from './data.js';

export function buildUI({ editor, viewer, onModeChange }) {
  buildLibrary();
  buildRoomPalette();
  buildToolbar({ editor, viewer, onModeChange });
  store.subscribe(() => renderProperties(editor));
  renderProperties(editor);
}

// ---------------------------------------------------------------------------
// 좌측: 방 추가 팔레트 + 가구 라이브러리
// ---------------------------------------------------------------------------
function buildRoomPalette() {
  const wrap = document.getElementById('room-palette');
  wrap.innerHTML = '';
  for (const [key, t] of Object.entries(ROOM_TYPES)) {
    const b = document.createElement('button');
    b.className = 'room-chip';
    b.style.background = t.color;
    b.textContent = t.label;
    b.title = `${t.label} 추가`;
    b.onclick = () => addRoom(key);
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

  const render = () => {
    grid.innerHTML = '';
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

  for (const cat of CATEGORIES) {
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

// ---------------------------------------------------------------------------
// 우측: 선택 항목 속성 패널
// ---------------------------------------------------------------------------
function renderProperties(editor) {
  const panel = document.getElementById('prop-body');
  const d = store.design;
  const room = d.rooms.find((r) => r.id === store.selectedRoom);
  const furn = d.furniture.find((f) => f.id === store.selectedFurniture);

  if (room) { panel.innerHTML = roomForm(room); bindRoomForm(room); return; }
  if (furn) { panel.innerHTML = furnForm(furn); bindFurnForm(furn); return; }

  // 선택 없음 → 도면 전체 정보
  const totalArea = d.rooms.reduce((s, r) => s + r.w * r.d, 0) / 1e6;
  panel.innerHTML = `
    <div class="prop-empty">
      <p class="ph">도면 정보</p>
      <label class="fld"><span>도면 이름</span><input id="p-name" value="${esc(d.name)}"></label>
      <label class="fld"><span>천장 높이 (mm)</span><input id="p-ceil" type="number" step="50" value="${d.ceilingHeight}"></label>
      <div class="info-row"><span>전체 면적</span><b>${totalArea.toFixed(1)} m² (${(totalArea/3.305).toFixed(1)}평)</b></div>
      <div class="info-row"><span>공간 수</span><b>${d.rooms.length}개</b></div>
      <div class="info-row"><span>가구/가전</span><b>${d.furniture.length}개</b></div>
      <p class="hint">· 좌측에서 방을 추가하거나, 가구를 도면으로 드래그하세요.<br>· 방을 클릭하면 크기를 조절할 수 있습니다.</p>
    </div>`;
  document.getElementById('p-name').onchange = (e) => store.commit((dd) => dd.name = e.target.value);
  document.getElementById('p-ceil').onchange = (e) => store.commit((dd) => dd.ceilingHeight = +e.target.value || 2400);
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
  document.getElementById('r-dup').onclick = () => store.commit((d) => {
    const copy = { ...room, id: 'r' + Date.now().toString(36), x: room.x + 400, y: room.y + 400 };
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

  $('tb-new').onclick = () => { if (confirm('새 도면을 시작할까요? 저장하지 않은 변경은 사라집니다.')) store.newDesign(); };

  $('tb-save').onclick = () => {
    const name = prompt('저장할 도면 이름', store.design.name);
    if (name) { store.saveAs(name); flash(`'${name}' 저장됨`); }
  };

  $('tb-open').onclick = () => openLoadDialog();

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
    const cv = viewer.renderer.domElement;
    if (!viewer.active) { alert('3D 보기에서 캡처할 수 있습니다.'); return; }
    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = (store.design.name || 'seum') + '-3D.png';
    a.click();
  };

  $('tb-roof').onclick = (e) => {
    viewer.controls.maxPolarAngle = viewer.controls.maxPolarAngle > 1.4 ? Math.PI / 2.05 : Math.PI;
    e.target.classList.toggle('on');
  };

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
function flash(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 1800);
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
