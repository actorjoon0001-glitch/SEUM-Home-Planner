// 세움 홈플래너 — AI 도면 편집 채팅 (Claude)
//   3D 화면에서 자연어로 도면을 고친다. 예: "안방에 창문 달아줘", "거실 오른쪽으로 1m 넓혀줘".
//   흐름: 사용자 입력 → Netlify 함수(ai-edit, 키 보관) → Claude → 편집 명령(ops) → store 에 적용.
//   API 키는 서버에만 있고 프론트엔드엔 없다.

import { store } from './store.js';
import { opening } from './data.js';

const ENDPOINT = (window.SEUM_CONFIG && window.SEUM_CONFIG.aiEndpoint) || '/.netlify/functions/ai-edit';
const OPEN_TYPES = ['balcony', 'deck', 'porch'];

let _n = 0;
const newRoomId = () => 'r' + Date.now().toString(36) + (_n++);

// 현재 도면을 모델이 이해할 요약(JSON)으로
function summarize() {
  const d = store.design || {};
  return {
    rooms: (d.rooms || []).map((r) => ({ id: r.id, type: r.type, name: r.name || '', x: r.x, y: r.y, w: r.w, d: r.d })),
    openings: (d.openings || []).map((o) => ({ id: o.id, roomId: o.roomId, side: o.side, winType: o.winType })),
    exterior: d.exterior || null,
    floors: Array.isArray(d.floors) ? d.floors.length : 1,
    activeFloor: d.activeFloor || 0,
  };
}

// AI 편집 명령(ops)을 도면에 적용 → store.commit 으로 되돌리기·3D 갱신 자동
function applyOps(ops) {
  let applied = 0;
  const roomOps = ops.filter((o) => o.name !== 'add_floor');
  if (roomOps.length) {
    store.commit((d) => {
      d.openings = d.openings || [];
      const find = (id) => (d.rooms || []).find((r) => r.id === id);
      for (const op of roomOps) {
        const p = op.input || {};
        try {
          switch (op.name) {
            case 'add_room': {
              const isOpen = OPEN_TYPES.includes(p.room_type);
              d.rooms.push({
                id: newRoomId(), type: p.room_type || 'room', name: p.name || '',
                x: Math.round(+p.x || 0), y: Math.round(+p.y || 0),
                w: Math.max(800, Math.round(+p.w || 3000)), d: Math.max(800, Math.round(+p.d || 3000)),
                open: isOpen ? ['n', 'e', 's', 'w'] : [],
              });
              applied++; break;
            }
            case 'move_room': { const r = find(p.room_id); if (r) { r.x = Math.round(+p.x); r.y = Math.round(+p.y); applied++; } break; }
            case 'resize_room': { const r = find(p.room_id); if (r) { r.w = Math.max(800, Math.round(+p.w)); r.d = Math.max(800, Math.round(+p.d)); applied++; } break; }
            case 'delete_room': { const i = d.rooms.findIndex((r) => r.id === p.room_id); if (i >= 0) { d.rooms.splice(i, 1); applied++; } break; }
            case 'rename_room': { const r = find(p.room_id); if (r) { r.name = p.name || ''; applied++; } break; }
            case 'add_opening': {
              const r = find(p.room_id);
              if (r) { const span = (p.side === 'n' || p.side === 's') ? r.w : r.d; d.openings.push(opening(r.id, p.side, span / 2, p.win_type || 'double')); applied++; }
              break;
            }
            case 'set_exterior': { d.exterior = d.exterior || {}; d.exterior.material = p.material; if (p.color) d.exterior.color = p.color; applied++; break; }
          }
        } catch (e) { /* 한 명령 실패해도 나머지 계속 */ }
      }
    });
  }
  for (const op of ops) if (op.name === 'add_floor') { try { store.addFloorFromCurrent(); applied++; } catch (e) {} }
  return applied;
}

const OP_LABEL = {
  add_room: '공간 추가', move_room: '공간 이동', resize_room: '크기 조절', delete_room: '공간 삭제',
  rename_room: '이름 변경', add_opening: '창/문 추가', set_exterior: '외장재 변경', add_floor: '위층 추가',
};

export function initAiChat(opts = {}) {
  const flash = opts.flash || (() => {});
  if (document.getElementById('ai-chat-btn')) return;

  // 스타일 주입
  const st = document.createElement('style');
  st.textContent = `
  #ai-chat-btn{position:fixed;right:18px;bottom:18px;z-index:60;width:54px;height:54px;border-radius:50%;
    border:none;background:#111;color:#fff;font-size:22px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.28)}
  #ai-chat-btn:hover{background:#c8102e}
  #ai-panel{position:fixed;right:18px;bottom:84px;z-index:60;width:340px;max-width:calc(100vw - 36px);
    height:460px;max-height:calc(100vh - 120px);display:none;flex-direction:column;background:#fff;
    border:1px solid #e3e3e3;border-radius:14px;box-shadow:0 10px 34px rgba(0,0,0,.22);overflow:hidden}
  #ai-panel.on{display:flex}
  #ai-panel .aih{padding:11px 14px;background:#111;color:#fff;font-weight:700;font-size:14px;display:flex;justify-content:space-between;align-items:center}
  #ai-panel .aih .x{cursor:pointer;opacity:.8}#ai-panel .aih .x:hover{opacity:1}
  #ai-log{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#fafafa}
  #ai-log .m{max-width:85%;padding:8px 11px;border-radius:12px;font-size:13px;line-height:1.45;white-space:pre-wrap;word-break:break-word}
  #ai-log .u{align-self:flex-end;background:#111;color:#fff;border-bottom-right-radius:3px}
  #ai-log .a{align-self:flex-start;background:#fff;border:1px solid #eee;border-bottom-left-radius:3px}
  #ai-log .sys{align-self:center;color:#999;font-size:12px}
  #ai-inbar{display:flex;gap:6px;padding:10px;border-top:1px solid #eee;background:#fff}
  #ai-inbar input{flex:1;border:1px solid #ddd;border-radius:9px;padding:9px 11px;font-size:13px;outline:none}
  #ai-inbar input:focus{border-color:#c8102e}
  #ai-inbar button{border:none;background:#c8102e;color:#fff;border-radius:9px;padding:0 14px;font-weight:700;cursor:pointer}
  #ai-inbar button:disabled{background:#ccc}
  `;
  document.head.appendChild(st);

  const btn = document.createElement('button');
  btn.id = 'ai-chat-btn'; btn.textContent = '🤖'; btn.title = 'AI 도면 편집';
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'ai-panel';
  panel.innerHTML = `
    <div class="aih"><span>🤖 AI 도면 편집</span><span class="x" id="ai-x">✕</span></div>
    <div id="ai-log"></div>
    <div id="ai-inbar"><input id="ai-in" placeholder="예: 안방에 창문 달아줘" autocomplete="off"><button id="ai-send">전송</button></div>`;
  document.body.appendChild(panel);

  const log = panel.querySelector('#ai-log');
  const input = panel.querySelector('#ai-in');
  const send = panel.querySelector('#ai-send');
  const history = [];
  let busy = false;

  const add = (role, text) => {
    const el = document.createElement('div');
    el.className = 'm ' + (role === 'user' ? 'u' : role === 'sys' ? 'sys' : 'a');
    el.textContent = text; log.appendChild(el); log.scrollTop = log.scrollHeight;
    return el;
  };
  const openPanel = (on) => {
    panel.classList.toggle('on', on);
    if (on) { input.focus(); if (!log.children.length) add('a', '무엇을 바꿔드릴까요? 예)\n• 오른쪽에 3x3 방 추가해줘\n• 거실 창문 크게\n• 외장재 벽돌로 바꿔줘'); }
  };
  btn.onclick = () => openPanel(!panel.classList.contains('on'));
  panel.querySelector('#ai-x').onclick = () => openPanel(false);

  async function submit() {
    const msg = input.value.trim();
    if (!msg || busy) return;
    input.value = ''; add('user', msg);
    history.push({ role: 'user', text: msg });
    busy = true; send.disabled = true;
    const thinking = add('sys', '…생각 중');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design: summarize(), message: msg, history: history.slice(0, -1) }),
      });
      const data = await res.json();
      thinking.remove();
      if (data.error) { add('a', '⚠️ ' + data.error); }
      else {
        const ops = data.ops || [];
        const applied = ops.length ? applyOps(ops) : 0;
        let reply = data.text || '';
        if (applied) { const names = [...new Set(ops.map((o) => OP_LABEL[o.name] || o.name))].join(', '); reply = (reply ? reply + '\n' : '') + `✅ 적용: ${names} (${applied}건)`; flash('AI가 도면을 수정했어요 — 되돌리려면 Ctrl+Z'); }
        else if (!reply) reply = '적용할 변경이 없었어요.';
        add('a', reply);
        history.push({ role: 'assistant', text: (data.text || '').slice(0, 500) });
      }
    } catch (e) {
      thinking.remove(); add('a', '⚠️ 연결 실패: ' + String((e && e.message) || e));
    } finally { busy = false; send.disabled = false; input.focus(); }
  }
  send.onclick = submit;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
}
