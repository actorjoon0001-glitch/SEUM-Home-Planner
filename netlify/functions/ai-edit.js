// 세움 홈플래너 — AI 도면 편집 프록시 (Claude API)
//   브라우저(3D 채팅창) → 이 함수 → Claude → 편집 명령(도구 호출) → 브라우저가 store 에 적용.
//   API 키는 서버(환경변수 ANTHROPIC_API_KEY)에만 두고 프론트에 절대 노출하지 않는다.
//   Netlify 대시보드 → Site settings → Environment variables 에 ANTHROPIC_API_KEY 등록.

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.SEUM_AI_MODEL || 'claude-sonnet-5';

const ROOM_TYPES = ['room', 'bath', 'utility', 'entrance', 'dress', 'deck', 'porch', 'sunroom',
  'living', 'bedroom', 'kitchen', 'attic', 'balcony', 'hall', 'pantry', 'study'];
const ROOM_LABELS = {
  room: '방', bath: '화장실', utility: '다용도실', entrance: '현관', dress: '드레스룸',
  deck: '데크', porch: '포치', sunroom: '썬룸', living: '거실', bedroom: '침실',
  kitchen: '주방', attic: '다락', balcony: '발코니', hall: '복도', pantry: '팬트리', study: '서재',
};
const WIN_TYPES = ['double', 'sliding', 'casement', 'casement2', 'fixed', 'foldWin', 'balcony',
  'door', 'swingDoor', 'doubleDoor', 'slideDoor', 'pocketDoor', 'pivotDoor', 'folding'];
const EXT_MATERIALS = ['metal', 'cement', 'ceramic', 'stucco', 'brick', 'wood', 'stone'];
const ROOF_TYPES = ['flat', 'gable', 'asymGable', 'hip', 'shed'];

const TOOLS = [
  {
    name: 'add_room', description: '새 공간(방)을 추가한다. 좌표·크기는 mm 단위(예: 3000 = 3m). x,y 는 좌상단 기준.',
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: {
        room_type: { type: 'string', enum: ROOM_TYPES, description: '공간 종류' },
        name: { type: 'string', description: '공간 이름(선택). 예: "아이방"' },
        x: { type: 'number' }, y: { type: 'number' },
        w: { type: 'number', description: '가로(mm)' }, d: { type: 'number', description: '세로(mm)' },
      },
      required: ['room_type', 'x', 'y', 'w', 'd'],
    },
  },
  {
    name: 'move_room', description: '기존 공간을 옮긴다(좌상단 절대좌표 mm).',
    input_schema: { type: 'object', additionalProperties: false, properties: { room_id: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' } }, required: ['room_id', 'x', 'y'] },
  },
  {
    name: 'resize_room', description: '공간의 가로·세로 크기를 바꾼다(mm).',
    input_schema: { type: 'object', additionalProperties: false, properties: { room_id: { type: 'string' }, w: { type: 'number' }, d: { type: 'number' } }, required: ['room_id', 'w', 'd'] },
  },
  {
    name: 'delete_room', description: '공간을 삭제한다.',
    input_schema: { type: 'object', additionalProperties: false, properties: { room_id: { type: 'string' } }, required: ['room_id'] },
  },
  {
    name: 'rename_room', description: '공간 이름을 바꾼다(빈 문자열이면 이름 제거).',
    input_schema: { type: 'object', additionalProperties: false, properties: { room_id: { type: 'string' }, name: { type: 'string' } }, required: ['room_id', 'name'] },
  },
  {
    name: 'add_opening', description: '공간 벽에 창문/문을 단다. side: n(위)/e(오른쪽)/s(아래)/w(왼쪽).',
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: {
        room_id: { type: 'string' }, side: { type: 'string', enum: ['n', 'e', 's', 'w'] },
        win_type: { type: 'string', enum: WIN_TYPES, description: '창/문 종류' },
      },
      required: ['room_id', 'side', 'win_type'],
    },
  },
  {
    name: 'set_exterior', description: '집 외장재(외벽 마감)를 바꾼다.',
    input_schema: { type: 'object', additionalProperties: false, properties: { material: { type: 'string', enum: EXT_MATERIALS }, color: { type: 'string', description: '색상 hex(선택), 예: #b7bdc4' } }, required: ['material'] },
  },
  {
    name: 'set_roof', description: '지붕 형태를 바꾼다. flat(평지붕)/gable(박공)/asymGable(비대칭 박공)/hip(우진각·모임)/shed(외쪽).',
    input_schema: { type: 'object', additionalProperties: false, properties: { roof_type: { type: 'string', enum: ROOF_TYPES }, color: { type: 'string', description: '색상 hex(선택)' } }, required: ['roof_type'] },
  },
  {
    name: 'add_floor', description: '현재 층을 복제해 위층(복층)을 추가한다.',
    input_schema: { type: 'object', additionalProperties: false, properties: {} },
  },
];

function systemPrompt() {
  const rooms = ROOM_TYPES.map((k) => `${k}(${ROOM_LABELS[k]})`).join(', ');
  return [
    '너는 한국형 단독주택 3D 홈플래너의 도면 편집 도우미다. 영업사원이 고객 상담 중 자연어로 도면을 고친다.',
    '사용자 메시지를 이해해서 제공된 도구(tool)를 호출해 도면을 편집하라. 한 요청에 여러 도구를 순서대로 호출해도 된다.',
    '좌표계: 평면도 좌상단이 (0,0), x=가로(오른쪽+), y=세로(아래+), 단위는 mm(1m=1000). 방은 좌상단 x,y 와 가로 w·세로 d 로 표현.',
    `공간 종류: ${rooms}.`,
    '규칙:',
    '- 사용자가 특정 공간을 가리키면 현재 도면 목록에서 room_id 로 찾아 그 id 를 도구에 넣어라. 이름이 없으면 종류·위치로 추정.',
    '- "넓혀줘/줄여줘/옮겨줘"는 현재 값 기준 상대 계산해서 절대값으로 도구 호출. (예: 3000→오른쪽 1m 확장이면 w=4000)',
    '- 새 방은 기존 방들과 겹치지 않게 적당한 빈 자리에 배치. 크기 지정 없으면 방 3000x3000, 화장실 2000x2000 정도 기본값.',
    '- 애매하면 실행하지 말고 한 문장으로 짧게 되물어라.',
    '항상 마지막에 무엇을 했는지 한국어 한두 문장으로 짧게 설명하라.',
  ].join('\n');
}

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'POST only' }) };
  if (!KEY) return { statusCode: 200, headers: cors, body: JSON.stringify({ error: 'AI 기능이 아직 설정되지 않았어요. (관리자: Netlify 환경변수 ANTHROPIC_API_KEY 등록 필요)' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: '잘못된 요청' }) }; }
  const { design, message, history } = body;
  if (!message || !String(message).trim()) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: '메시지가 비어 있어요' }) };

  // 현재 도면 요약 + 이번 요청을 사용자 메시지로 구성
  const summary = JSON.stringify(design || {});
  const messages = [];
  for (const h of (Array.isArray(history) ? history.slice(-6) : [])) {
    if (h && h.role && h.text) messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text });
  }
  messages.push({ role: 'user', content: `현재 도면(JSON):\n${summary}\n\n요청: ${message}` });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2048, system: systemPrompt(), tools: TOOLS, messages }),
    });
    const data = await r.json();
    if (!r.ok) return { statusCode: 200, headers: cors, body: JSON.stringify({ error: (data && data.error && data.error.message) || `AI 오류(${r.status})` }) };

    const ops = [];
    let text = '';
    for (const block of (data.content || [])) {
      if (block.type === 'text') text += block.text;
      else if (block.type === 'tool_use') ops.push({ name: block.name, input: block.input || {} });
    }
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ops, text: text.trim() }) };
  } catch (e) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ error: 'AI 연결 실패: ' + String((e && e.message) || e) }) };
  }
};
