// 세움 홈플래너 - 단지/평형 템플릿 라이브러리 (내장 프리셋)
// 상담 시작 시 자주 쓰는 도면을 바로 불러올 수 있도록 미리 정의.
// rooms 는 key 로 식별하고, openings 가 roomKey 로 참조 → instantiate 시 실제 id 생성.
import { normalize, rid, fid, WINDOW_TYPES } from './data.js';

const T = [
  {
    id: 'apt-59',
    title: '아파트 59㎡ (24평형)',
    tags: ['아파트', '24평'],
    base: {
      name: '아파트 59㎡ (24평형)',
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
    tags: ['아파트', '34평'],
    base: {
      name: '아파트 84㎡ (34평형)',
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
    tags: ['단독주택', '30평', '박공'],
    base: {
      name: '단독주택 99㎡ (박공지붕)',
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
];

// 템플릿 목록 (썸네일/표시용 메타)
export function listTemplates() {
  return T.map((t) => ({ id: t.id, title: t.title, tags: t.tags }));
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
