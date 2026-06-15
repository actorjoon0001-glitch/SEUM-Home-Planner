// 세움 홈플래너 - 단지/평형 템플릿 라이브러리 (내장 프리셋)
// 상담 시작 시 자주 쓰는 도면을 바로 불러올 수 있도록 미리 정의.
// rooms 는 key 로 식별하고, openings 가 roomKey 로 참조 → instantiate 시 실제 id 생성.
import { normalize, rid, fid, WINDOW_TYPES } from './data.js';

const T = [
  {
    id: 'apt-59',
    title: '아파트 59㎡ (24평형)',
    category: '주택',
    tags: ['아파트', '24평'],
    base: {
      name: '아파트 59㎡ (24평형)',
      productType: '주택',
      ceilingHeight: 2300,
      exterior: { material: 'cement', color: '#cdc7ba' },
      roof: { type: 'flat', color: '#5b5b5b' },
      rooms: [
        { key: 'living',  type: 'living',   name: '거실',   x: 3300, y: 3000, w: 3900, d: 3600 },
        { key: 'kitchen', type: 'kitchen',  name: '주방',   x: 7200, y: 3000, w: 2400, d: 2700 },
        { key: 'main',    type: 'bedroom',  name: '안방',   x: 3300, y: 0,    w: 3300, d: 3000 },
        { key: 'bed1',    type: 'bedroom',  name: '침실1',  x: 0,    y: 0,    w: 3300, d: 3000 },
        { key: 'bath1',   type: 'bath',     name: '욕실',   x: 0,    y: 3000, w: 1800, d: 2100 },
        { key: 'ent',     type: 'entrance', name: '현관',   x: 1800, y: 3000, w: 1500, d: 2100 },
        { key: 'bal',     type: 'balcony',  name: '발코니', x: 3300, y: 6600, w: 4800, d: 1200 },
      ],
      openings: [
        { roomKey: 'living', side: 's', pos: 1900, winType: 'balcony' },
        { roomKey: 'main',   side: 'n', pos: 1650, winType: 'double' },
        { roomKey: 'bed1',   side: 'n', pos: 1650, winType: 'double' },
        { roomKey: 'ent',    side: 's', pos: 750,  winType: 'door' },
      ],
      furniture: [
        { catalogId: 'sofa2', x: 4200, y: 4400, rotation: 0 },
        { catalogId: 'tv',    x: 6800, y: 3300, rotation: 180 },
        { catalogId: 'dining4', x: 8000, y: 4200, rotation: 0 },
        { catalogId: 'bedQ',  x: 4900, y: 900,  rotation: 0 },
        { catalogId: 'bedS',  x: 1500, y: 800,  rotation: 0 },
      ],
    },
  },
  {
    id: 'apt-84',
    title: '아파트 84㎡ (34평형)',
    category: '주택',
    tags: ['아파트', '34평'],
    base: {
      name: '아파트 84㎡ (34평형)',
      productType: '주택',
      ceilingHeight: 2400,
      exterior: { material: 'ceramic', color: '#d8d2c6' },
      roof: { type: 'flat', color: '#4a4a4a' },
      rooms: [
        { key: 'living',  type: 'living',   name: '거실',     x: 3900, y: 3300, w: 4500, d: 4200 },
        { key: 'kitchen', type: 'kitchen',  name: '주방',     x: 8400, y: 3300, w: 3000, d: 2700 },
        { key: 'main',    type: 'bedroom',  name: '안방',     x: 3900, y: 0,    w: 3600, d: 3300 },
        { key: 'dress',   type: 'dress',    name: '드레스룸', x: 7500, y: 0,    w: 1800, d: 1650 },
        { key: 'mbath',   type: 'bath',     name: '안방욕실', x: 9300, y: 0,    w: 2100, d: 1650 },
        { key: 'bed1',    type: 'bedroom',  name: '침실1',    x: 0,    y: 0,    w: 3900, d: 3300 },
        { key: 'bed2',    type: 'bedroom',  name: '침실2',    x: 0,    y: 3300, w: 3900, d: 3000 },
        { key: 'bath',    type: 'bath',     name: '공용욕실', x: 0,    y: 6300, w: 2100, d: 1800 },
        { key: 'ent',     type: 'entrance', name: '현관',     x: 2100, y: 6300, w: 1800, d: 1800 },
        { key: 'util',    type: 'utility',  name: '다용도실', x: 8400, y: 6000, w: 3000, d: 1800 },
        { key: 'bal',     type: 'balcony',  name: '발코니',   x: 3900, y: 7500, w: 7500, d: 1200 },
      ],
      openings: [
        { roomKey: 'living', side: 's', pos: 2300, winType: 'balcony' },
        { roomKey: 'main',   side: 'n', pos: 1800, winType: 'double' },
        { roomKey: 'bed1',   side: 'n', pos: 1950, winType: 'double' },
        { roomKey: 'bed2',   side: 'w', pos: 1500, winType: 'sliding' },
        { roomKey: 'ent',    side: 's', pos: 900,  winType: 'door' },
      ],
      furniture: [
        { catalogId: 'sofa3', x: 4800, y: 4900, rotation: 0 },
        { catalogId: 'tv',    x: 7900, y: 3700, rotation: 180 },
        { catalogId: 'dining6', x: 9300, y: 4000, rotation: 0 },
        { catalogId: 'bedQ',  x: 4900, y: 1000, rotation: 0 },
        { catalogId: 'bedS',  x: 1300, y: 800,  rotation: 0 },
        { catalogId: 'fridge', x: 10800, y: 3600, rotation: 0 },
      ],
    },
  },
  {
    id: 'house-30',
    title: '단독주택 99㎡ (박공지붕)',
    category: '주택',
    tags: ['단독주택', '30평', '박공'],
    base: {
      name: '단독주택 99㎡ (박공지붕)',
      productType: '주택',
      ceilingHeight: 2600,
      exterior: { material: 'metal', color: '#3d4651' },
      roof: { type: 'gable', color: '#2e3b30' },
      rooms: [
        { key: 'living',  type: 'living',   name: '거실+주방', x: 0,    y: 3600, w: 6000, d: 4800 },
        { key: 'main',    type: 'bedroom',  name: '안방',      x: 6000, y: 4800, w: 3600, d: 3600 },
        { key: 'bed1',    type: 'bedroom',  name: '침실1',     x: 0,    y: 0,    w: 3000, d: 3600 },
        { key: 'bed2',    type: 'bedroom',  name: '침실2',     x: 3000, y: 0,    w: 3000, d: 3600 },
        { key: 'bath',    type: 'bath',     name: '욕실',      x: 6000, y: 3000, w: 2100, d: 1800 },
        { key: 'ent',     type: 'entrance', name: '현관',      x: 6000, y: 0,    w: 2400, d: 3000 },
        { key: 'util',    type: 'utility',  name: '다용도실',  x: 8100, y: 0,    w: 1800, d: 3000 },
        { key: 'attic',   type: 'attic',    name: '다락',      x: 8100, y: 3000, w: 1800, d: 1800 },
        { key: 'porch',   type: 'balcony',  name: '테라스',    x: 0,    y: 8400, w: 6000, d: 1500 },
      ],
      openings: [
        { roomKey: 'living', side: 's', pos: 3000, winType: 'balcony' },
        { roomKey: 'living', side: 'w', pos: 2400, winType: 'fixed' },
        { roomKey: 'main',   side: 'e', pos: 1800, winType: 'double' },
        { roomKey: 'bed1',   side: 'n', pos: 1500, winType: 'casement' },
        { roomKey: 'bed2',   side: 'n', pos: 1500, winType: 'casement' },
        { roomKey: 'ent',    side: 'n', pos: 1200, winType: 'door' },
      ],
      furniture: [
        { catalogId: 'sofa3', x: 1800, y: 5400, rotation: 0 },
        { catalogId: 'tv',    x: 800,  y: 4200, rotation: 90 },
        { catalogId: 'dining4', x: 4200, y: 5000, rotation: 0 },
        { catalogId: 'bedQ',  x: 7600, y: 5900, rotation: 0 },
        { catalogId: 'bedS',  x: 1500, y: 900,  rotation: 0 },
      ],
    },
  },
  {
    id: 'nongmak-20',
    title: '농막 20㎡ (6평형)',
    category: '농막',
    tags: ['농막', '6평', '20㎡'],
    base: {
      name: '농막 20㎡ (6평형)',
      productType: '농막',
      ceilingHeight: 2400,
      exterior: { material: 'wood', color: '#9c7244' },
      roof: { type: 'gable', color: '#3a3f44' },
      // 법정 연면적 20㎡ 이하 (거실·침실 겸용 + 주방 + 욕실), 데크는 면적 제외
      rooms: [
        { key: 'living',  type: 'living',   name: '거실·침실', x: 0,    y: 0,    w: 4000, d: 3500 },
        { key: 'bath',    type: 'bath',     name: '욕실',      x: 0,    y: 3500, w: 1700, d: 1500 },
        { key: 'kitchen', type: 'kitchen',  name: '주방',      x: 1700, y: 3500, w: 2300, d: 1500 },
        { key: 'deck',    type: 'balcony',  name: '데크',      x: 0,    y: 5000, w: 4000, d: 1500 },
      ],
      openings: [
        { roomKey: 'living',  side: 'n', pos: 2000, winType: 'double' },
        { roomKey: 'living',  side: 'w', pos: 1750, winType: 'fixed' },
        { roomKey: 'kitchen', side: 's', pos: 1150, winType: 'door' },
        { roomKey: 'bath',    side: 'w', pos: 750,  winType: 'casement' },
      ],
      furniture: [
        { catalogId: 'bedS',  x: 700,  y: 900,  rotation: 0 },
        { catalogId: 'sofa2', x: 2900, y: 800,  rotation: 0 },
        { catalogId: 'tv',    x: 3700, y: 2000, rotation: 90 },
        { catalogId: 'sink',  x: 2850, y: 4250, rotation: 0 },
        { catalogId: 'toilet',x: 1300, y: 4250, rotation: 0 },
        { catalogId: 'basin', x: 350,  y: 3900, rotation: 0 },
      ],
    },
  },
  {
    id: 'shelter-33',
    title: '체류형 쉼터 33㎡ (10평형)',
    category: '체류형 쉼터',
    tags: ['체류형쉼터', '10평', '33㎡', '농지'],
    base: {
      name: '체류형 쉼터 33㎡ (10평형)',
      productType: '체류형 쉼터',
      ceilingHeight: 2500,
      exterior: { material: 'metal', color: '#3d4651' },
      roof: { type: 'gable', color: '#2e3b30' },
      // 농지법 체류형 쉼터: 연면적 33㎡ 이하 (거실+주방 / 침실 / 욕실), 데크 별도
      rooms: [
        { key: 'living',  type: 'living',   name: '거실+주방', x: 0,    y: 0,    w: 3600, d: 4500 },
        { key: 'bed',     type: 'bedroom',  name: '침실',      x: 3600, y: 0,    w: 2700, d: 3000 },
        { key: 'bath',    type: 'bath',     name: '욕실',      x: 3600, y: 3000, w: 2700, d: 1500 },
        { key: 'deck',    type: 'balcony',  name: '데크',      x: 0,    y: 4500, w: 6300, d: 1500 },
      ],
      openings: [
        { roomKey: 'living', side: 's', pos: 1800, winType: 'balcony' },
        { roomKey: 'living', side: 'w', pos: 2250, winType: 'fixed' },
        { roomKey: 'living', side: 'n', pos: 600,  winType: 'door' },
        { roomKey: 'bed',    side: 'e', pos: 1350, winType: 'double' },
        { roomKey: 'bed',    side: 'n', pos: 1350, winType: 'double' },
        { roomKey: 'bath',   side: 'e', pos: 750,  winType: 'casement' },
      ],
      furniture: [
        { catalogId: 'sofa3',  x: 1100, y: 3300, rotation: 0 },
        { catalogId: 'tv',     x: 1800, y: 4200, rotation: 180 },
        { catalogId: 'dining4',x: 2700, y: 1200, rotation: 0 },
        { catalogId: 'sink',   x: 1200, y: 300,  rotation: 0 },
        { catalogId: 'fridge', x: 3100, y: 400,  rotation: 0 },
        { catalogId: 'bedQ',   x: 4950, y: 1100, rotation: 0 },
        { catalogId: 'toilet', x: 4100, y: 3300, rotation: 0 },
        { catalogId: 'basin',  x: 5900, y: 3300, rotation: 0 },
      ],
    },
  },
  {
    id: 'model-golf-10',
    title: '킨텍스 전시모델 10평 (골프존)',
    category: '주택',
    tags: ['전시모델', '10평', '골프존', '킨텍스'],
    base: {
      name: '킨텍스 전시모델 10평 (골프존)',
      productType: '주택',
      ceilingHeight: 2400,
      // T5 갈바듐 외장 + 평지붕 (㈜세움디자인하우징 도면 기준)
      exterior: { material: 'metal', color: '#3d4651' },
      roof: { type: 'flat', color: '#4a4a4a' },
      // 외곽 4,300×8,400 (벽 200) → 내부 폭 3,900. 남측 데크 별도.
      rooms: [
        { key: 'bath',    type: 'bath',     name: '욕실',      x: 0,    y: 0,    w: 1200, d: 1800 },
        { key: 'ent',     type: 'entrance', name: '현관',      x: 0,    y: 1800, w: 1200, d: 1200 },
        { key: 'kitchen', type: 'kitchen',  name: '주방',      x: 1200, y: 0,    w: 2700, d: 1200 },
        { key: 'dining',  type: 'living',   name: '다이닝',    x: 1200, y: 1200, w: 2700, d: 1800 },
        { key: 'golf',    type: 'living',   name: 'GOLF ZONE', x: 0,    y: 3000, w: 3900, d: 4500 },
        { key: 'deck',    type: 'balcony',  name: '데크',      x: 0,    y: 7500, w: 3900, d: 900  },
      ],
      openings: [
        { roomKey: 'ent',     side: 'w', pos: 600,  winType: 'door' },     // 현관문(폴딩 900)
        { roomKey: 'bath',    side: 's', pos: 600,  winType: 'door' },     // 욕실 포켓도어 800
        { roomKey: 'kitchen', side: 'n', pos: 1350, winType: 'fixed' },    // 주방 상단 픽스창
        { roomKey: 'dining',  side: 'e', pos: 900,  winType: 'fixed' },
        { roomKey: 'golf',    side: 's', pos: 1950, winType: 'sliding' },  // 데크 출입
        { roomKey: 'golf',    side: 'e', pos: 2250, winType: 'fixed' },
        { roomKey: 'golf',    side: 'w', pos: 2250, winType: 'fixed' },
      ],
      furniture: [
        { catalogId: 'toilet', x: 300,  y: 1450, rotation: 0 },
        { catalogId: 'basin',  x: 850,  y: 300,  rotation: 0 },
        { catalogId: 'sink',   x: 2400, y: 350,  rotation: 0 },
        { catalogId: 'fridge', x: 3550, y: 500,  rotation: 0 },
        { catalogId: 'dining4',x: 2550, y: 2100, rotation: 0 },
        { catalogId: 'tv',     x: 1950, y: 7350, rotation: 180 },  // 스크린(남측)
        { catalogId: 'sofa2',  x: 900,  y: 6600, rotation: 0 },
        { catalogId: 'rug',    x: 1950, y: 5000, rotation: 0 },
      ],
    },
  },
];

// 템플릿 목록 (썸네일/표시용 메타)
export function listTemplates() {
  return T.map((t) => ({ id: t.id, title: t.title, tags: t.tags, category: t.category || '주택' }));
}

// 템플릿을 실제 편집 가능한 도면 객체로 인스턴스화 (새 id 부여)
export function instantiateTemplate(id) {
  const t = T.find((x) => x.id === id);
  if (!t) return null;
  const b = t.base;
  const keyToId = {};
  const rooms = b.rooms.map((r) => {
    const nid = rid();
    keyToId[r.key] = nid;
    return { id: nid, type: r.type, name: r.name, x: r.x, y: r.y, w: r.w, d: r.d };
  });
  const openings = (b.openings || []).map((o) => ({
    id: 'o' + Math.random().toString(36).slice(2, 9),
    roomId: keyToId[o.roomKey], side: o.side, pos: o.pos, winType: o.winType,
    w: undefined, h: undefined, sill: undefined, color: '#4a5560',
  })).map((o) => fillWin(o));
  const furniture = (b.furniture || []).map((f) => ({ id: fid(), catalogId: f.catalogId, x: f.x, y: f.y, rotation: f.rotation || 0 }));
  return normalize({
    name: b.name,
    productType: b.productType || '',
    ceilingHeight: b.ceilingHeight,
    exterior: { ...b.exterior },
    roof: { ...b.roof },
    rooms, openings, furniture,
  });
}

// 창호 기본 치수 채우기 (WINDOW_TYPES 참조)
function fillWin(o) {
  const t = WINDOW_TYPES[o.winType] || WINDOW_TYPES.double;
  return { ...o, w: t.w, h: t.h, sill: t.sill };
}
