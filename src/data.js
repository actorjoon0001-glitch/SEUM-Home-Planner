// 세움 홈플래너 - 데이터 모델 / 기본 도면 / 라이브러리 정의
// 모든 치수 단위는 mm (밀리미터) 입니다.

// ---------------------------------------------------------------------------
// 방(공간) 종류 정의
// ---------------------------------------------------------------------------
export const ROOM_TYPES = {
  living:   { label: '거실',     color: '#cfe3d4', wall: '#9bbfa6' },
  bedroom:  { label: '침실',     color: '#d6e2f0', wall: '#a8c0dd' },
  kitchen:  { label: '주방',     color: '#f3e3c9', wall: '#d8c19a' },
  bath:     { label: '욕실',     color: '#cfe7ec', wall: '#9fcdd6' },
  utility:  { label: '다용도실', color: '#e6e0ef', wall: '#c2b6d6' },
  attic:    { label: '다락',     color: '#efe0d6', wall: '#d6b89f' },
  dress:    { label: '드레스룸', color: '#f0dfe8', wall: '#d6aec3' },
  entrance: { label: '현관',     color: '#e2e2e2', wall: '#bdbdbd' },
  balcony:  { label: '발코니',   color: '#dcefe1', wall: '#b3d6bd' },
  hall:     { label: '복도',     color: '#ededed', wall: '#c7c7c7' },
  pantry:   { label: '팬트리',   color: '#efe7d2', wall: '#d4c79f' },
  study:    { label: '서재',     color: '#dde7d6', wall: '#aec3a0' },
};

// 다락은 천장이 낮음 → 3D 표현 시 사용
export const ATTIC_HEIGHT = 1500;

// ---------------------------------------------------------------------------
// 외장재 (집 외부 마감) - 세움은 집짓는 회사이므로 외장재 선택이 중요
// metalness/roughness 로 3D 질감 표현, color 는 기본색(사용자가 변경 가능)
// ---------------------------------------------------------------------------
export const EXTERIOR_MATERIALS = {
  metal:    { label: '메탈사이딩',   color: '#8d96a0', roughness: 0.35, metalness: 0.75 },
  cement:   { label: '시멘트사이딩', color: '#b8b2a7', roughness: 0.85, metalness: 0.05 },
  ceramic:  { label: '세라믹사이딩', color: '#d8d2c6', roughness: 0.5,  metalness: 0.1 },
  stucco:   { label: '스타코',       color: '#ece7dd', roughness: 0.95, metalness: 0.0 },
  brick:    { label: '벽돌',         color: '#a8654b', roughness: 0.9,  metalness: 0.0 },
  wood:     { label: '목재 사이딩',  color: '#9c7244', roughness: 0.8,  metalness: 0.0 },
  stone:    { label: '석재',         color: '#7d7a73', roughness: 0.85, metalness: 0.05 },
};

// 외장재 추천 색상 팔레트 (빠른 선택용)
export const EXTERIOR_PALETTE = [
  '#2f3640', '#5a6470', '#8d96a0', '#b8b2a7', '#d8d2c6',
  '#ece7dd', '#ffffff', '#a8654b', '#9c7244', '#3d4a3e', '#6b3f3a',
];

// ---------------------------------------------------------------------------
// 지붕 형태
// ---------------------------------------------------------------------------
export const ROOF_TYPES = {
  flat:      { label: '평지붕',        rise: 0 },
  gable:     { label: '박공지붕',      rise: 1800 },
  asymGable: { label: '비대칭 박공',   rise: 2000 },  // 용마루가 한쪽으로 치우침
  hip:       { label: '우진각(모임)',  rise: 1700 },
  shed:      { label: '외쪽(외경사)',  rise: 1600 },
};

export const ROOF_PALETTE = ['#3a3f44', '#5b3b34', '#6b4f3a', '#2e3b30', '#8d8d8d', '#1f2937', '#7a4a2b'];

// ---------------------------------------------------------------------------
// 창호 (창문/문) - 도면 가장자리(벽)에 배치
// kind: 3D/2D 표현, w/h/sill 기본값(mm). 배치 후 개별 조정 가능
// ---------------------------------------------------------------------------
export const WINDOW_TYPES = {
  double:   { label: '2중창',          w: 1500, h: 1400, sill: 800,  panes: 2, slide: false, glass: true },
  sliding:  { label: '미닫이창',       w: 1800, h: 1400, sill: 800,  panes: 2, slide: true,  glass: true },
  casement: { label: '여닫이창',       w: 900,  h: 1300, sill: 900,  panes: 1, slide: false, glass: true },
  fixed:    { label: '고정창(픽스)',   w: 1200, h: 1500, sill: 700,  panes: 1, slide: false, glass: true },
  balcony:  { label: '발코니 대형창',  w: 2700, h: 2200, sill: 50,   panes: 3, slide: true,  glass: true },
  door:     { label: '현관문',         w: 1000, h: 2100, sill: 0,    panes: 1, slide: false, glass: false },
};

// 창호 라이브러리 카드용 목록
export const WINDOW_CATALOG = Object.entries(WINDOW_TYPES).map(([id, t]) => ({ id, ...t }));

// ---------------------------------------------------------------------------
// 가구 / 가전 라이브러리 (한샘 라이브러리 패널 참고)
// kind: 3D 렌더링 형태를 결정
// ---------------------------------------------------------------------------
export const FURNITURE_CATALOG = [
  // 가구
  { id: 'sofa3',   cat: '가구', name: '3인 소파',     kind: 'sofa',     w: 2200, d: 950,  h: 800,  color: '#b9b2a6' },
  { id: 'sofa2',   cat: '가구', name: '2인 소파',     kind: 'sofa',     w: 1500, d: 950,  h: 800,  color: '#c8c2b6' },
  { id: 'bedQ',    cat: '가구', name: '퀸 침대',      kind: 'bed',      w: 1600, d: 2100, h: 600,  color: '#d8cfc4' },
  { id: 'bedS',    cat: '가구', name: '싱글 침대',    kind: 'bed',      w: 1100, d: 2000, h: 600,  color: '#ddd5cb' },
  { id: 'dining6', cat: '가구', name: '6인 식탁',     kind: 'table',    w: 1800, d: 900,  h: 750,  color: '#a98e6b' },
  { id: 'dining4', cat: '가구', name: '4인 식탁',     kind: 'table',    w: 1200, d: 800,  h: 750,  color: '#b89a74' },
  { id: 'chair',   cat: '가구', name: '의자',         kind: 'chair',    w: 480,  d: 520,  h: 900,  color: '#8d8d8d' },
  { id: 'wardrobe',cat: '가구', name: '옷장',         kind: 'box',      w: 1500, d: 600,  h: 2200, color: '#c9b79c' },
  { id: 'desk',    cat: '가구', name: '책상',         kind: 'table',    w: 1400, d: 700,  h: 740,  color: '#b89a74' },
  { id: 'shelf',   cat: '가구', name: '책장/수납장',  kind: 'box',      w: 900,  d: 350,  h: 1800, color: '#cbbca3' },
  { id: 'dresser', cat: '가구', name: '화장대',       kind: 'box',      w: 1000, d: 450,  h: 1300, color: '#ddc9d4' },

  // 주방/가전
  { id: 'fridge',  cat: '가전', name: '냉장고',       kind: 'box',      w: 900,  d: 800,  h: 1850, color: '#d9dde0' },
  { id: 'tv',      cat: '가전', name: 'TV',           kind: 'tv',       w: 1300, d: 80,   h: 750,  color: '#202225' },
  { id: 'washer',  cat: '가전', name: '세탁기',       kind: 'box',      w: 650,  d: 700,  h: 950,  color: '#e3e6e8' },
  { id: 'sink',    cat: '가전', name: '싱크대',       kind: 'box',      w: 2400, d: 600,  h: 850,  color: '#d7d2c8' },
  { id: 'cooktop', cat: '가전', name: '아일랜드',     kind: 'box',      w: 1500, d: 800,  h: 900,  color: '#c7c2b8' },

  // 욕실
  { id: 'toilet',  cat: '욕실', name: '양변기',       kind: 'box',      w: 400,  d: 700,  h: 800,  color: '#eef0f1' },
  { id: 'basin',   cat: '욕실', name: '세면대',       kind: 'box',      w: 600,  d: 500,  h: 850,  color: '#eef0f1' },
  { id: 'bathtub', cat: '욕실', name: '욕조',         kind: 'box',      w: 1600, d: 750,  h: 600,  color: '#eaf0f2' },

  // 소품/조명
  { id: 'rug',     cat: '소품', name: '러그',         kind: 'rug',      w: 2000, d: 1400, h: 20,   color: '#cdbfae' },
  { id: 'plant',   cat: '소품', name: '화분',         kind: 'plant',    w: 450,  d: 450,  h: 1200, color: '#5b8c5a' },
  { id: 'lamp',    cat: '소품', name: '스탠드 조명',  kind: 'plant',    w: 350,  d: 350,  h: 1600, color: '#d8cbb0' },
];

export const CATEGORIES = ['가구', '가전', '욕실', '소품'];

// ---------------------------------------------------------------------------
// 기본 도면 (한샘 스크린샷의 아파트 평면 느낌으로 구성한 예시)
// 좌표: 평면도 기준 좌상단이 (0,0), x=가로, y=세로(깊이)
// ---------------------------------------------------------------------------
export function createDefaultDesign() {
  const rooms = [
    { id: rid(), type: 'living',   name: '거실',     x: 4200, y: 3600, w: 4800, d: 4200 },
    { id: rid(), type: 'kitchen',  name: '주방',     x: 9000, y: 3600, w: 3000, d: 2600 },
    { id: rid(), type: 'bedroom',  name: '안방',     x: 4200, y: 0,    w: 3600, d: 3600 },
    { id: rid(), type: 'dress',    name: '드레스룸', x: 7800, y: 0,    w: 1800, d: 1800 },
    { id: rid(), type: 'bath',     name: '안방욕실', x: 9600, y: 0,    w: 2400, d: 1800 },
    { id: rid(), type: 'bedroom',  name: '침실1',    x: 0,    y: 0,    w: 4200, d: 3300 },
    { id: rid(), type: 'bedroom',  name: '침실2',    x: 0,    y: 3300, w: 4200, d: 3000 },
    { id: rid(), type: 'bath',     name: '공용욕실', x: 0,    y: 6300, w: 2400, d: 1800 },
    { id: rid(), type: 'utility',  name: '다용도실', x: 9000, y: 6200, w: 3000, d: 1800 },
    { id: rid(), type: 'entrance', name: '현관',     x: 2400, y: 6300, w: 1800, d: 1800 },
    { id: rid(), type: 'balcony',  name: '발코니',   x: 4200, y: 7800, w: 7800, d: 1200 },
  ];
  const byName = (n) => rooms.find((r) => r.name === n);
  return {
    name: '새 도면 - 세움 주택',
    ceilingHeight: 2400,
    exterior: { material: 'metal', color: EXTERIOR_MATERIALS.metal.color },
    roof: { type: 'gable', color: '#3a3f44' },
    rooms,
    openings: [
      opening(byName('거실').id, 's', 2400, 'balcony'),
      opening(byName('안방').id, 'n', 1800, 'double'),
      opening(byName('주방').id, 'e', 1300, 'double'),
      opening(byName('현관').id, 'w', 900,  'door'),
      opening(byName('침실1').id, 'n', 2100, 'double'),
    ],
    furniture: [
      placed('sofa3', 4900, 5200, 0),
      placed('tv',    8400, 4000, 180),
      placed('dining4', 9700, 4200, 0),
      placed('bedQ',  5200, 1100, 0),
      placed('bedS',  1400, 800,  0),
      placed('fridge',11000, 3800, 0),
      placed('rug',   5600, 5400, 0),
    ],
  };
}

// 가구 인스턴스 생성 (라이브러리 id + 위치/회전)
export function placed(catalogId, x, y, rotation = 0) {
  return { id: fid(), catalogId, x, y, rotation };
}

// 창호(개구부) 인스턴스 생성
// roomId: 부착 방, side: 'n'|'e'|'s'|'w', pos: 벽 시작점에서 중심까지 거리(mm), winType: WINDOW_TYPES 키
export function opening(roomId, side, pos, winType = 'double') {
  const t = WINDOW_TYPES[winType] || WINDOW_TYPES.double;
  return {
    id: 'o' + (Date.now().toString(36)) + (_o++),
    roomId, side, pos, winType,
    w: t.w, h: t.h, sill: t.sill, color: '#4a5560',
  };
}

// 저장본/구버전 도면 보정 (새 필드 기본값 채움)
export function normalize(design) {
  if (!design.exterior) design.exterior = { material: 'metal', color: EXTERIOR_MATERIALS.metal.color };
  if (!design.roof) design.roof = { type: 'gable', color: '#3a3f44' };
  if (!Array.isArray(design.openings)) design.openings = [];
  if (!Array.isArray(design.furniture)) design.furniture = [];
  if (!Array.isArray(design.rooms)) design.rooms = [];
  return design;
}

// 라이브러리에서 정의 조회
export function catalogOf(catalogId) {
  return FURNITURE_CATALOG.find((f) => f.id === catalogId);
}

// 고유 id 생성기
let _r = 0, _f = 0, _o = 0;
function rid() { return 'r' + (Date.now().toString(36)) + (_r++); }
function fid() { return 'f' + (Date.now().toString(36)) + (_f++); }
function oid() { return 'o' + (Date.now().toString(36)) + (_o++); }
export { rid, fid, oid };
