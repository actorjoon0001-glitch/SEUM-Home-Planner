// 세움 홈플래너 - 단지/평형 템플릿 라이브러리 (내장 프리셋)
// 상담 시작 시 자주 쓰는 도면을 바로 불러올 수 있도록 미리 정의.
// rooms 는 key 로 식별하고, openings 가 roomKey 로 참조 → instantiate 시 실제 id 생성.
import { normalize, rid, fid, WINDOW_TYPES, model3dSig, FURNITURE_CATALOG, OPEN_ROOM_TYPES } from './data.js';

// ---------------------------------------------------------------------------
// 실물 모델(블렌더) 제품 옵션 — tools/blender/plan_to_blend.py 로 만든 모델 공용
//   parts = GLB 부품 이름(재질 이름, 천장 위 부품은 '지붕_' 접두). 첫 항목(orig)=블렌더 원래 마감
//   remap(dark/light): 구운 질감 명암(나뭇결·판 이음·골)은 살리고 색만 / color: 단색 부품
// ---------------------------------------------------------------------------
const RM = (id, label, dark, light) => ({ id, label, dark, light });
const CL = (id, label, color) => ({ id, label, color });
const WALL_CHOICES = {
  wood: [RM('oak', '내추럴 오크', '#7a5a3a', '#d9b98b'), RM('walnut', '월넛', '#2b1a12', '#704b33'), RM('white', '화이트', '#bfbab0', '#f5f3ee'),
    RM('gray', '그레이', '#4b4f54', '#a0a5ab'), RM('charcoal', '차콜', '#17181a', '#46494e')],
  metal: [RM('white', '화이트', '#b9b9b5', '#f2f2ef'), RM('beige', '베이지', '#9a8d77', '#e3d9c6'), RM('gray', '그레이', '#53575d', '#a7abb1'),
    RM('navy', '네이비', '#1c2430', '#4d596c'), RM('charcoal', '차콜', '#1a1c1f', '#4a4d52'), RM('brown', '브라운', '#3b2a1f', '#7d5c45')],
};
const PAINT = { black: CL('black', '블랙', '#161618'), charcoal: CL('charcoal', '차콜', '#2f3033'), gray: CL('gray', '그레이', '#6b6f75'),
  white: CL('white', '화이트', '#e9e9e6'), brown: CL('brown', '브라운', '#4b3628'), bronze: CL('bronze', '브론즈', '#4a3a2c'),
  green: CL('green', '그린', '#2e3b30'), red: CL('red', '레드', '#6e2a22'), navy: CL('navy', '네이비', '#243044') };
const pick = (orig, ids) => [{ id: 'orig', label: orig[0], swatch: orig[1] }, ...ids.map((k) => PAINT[k]).filter((c) => c.label !== orig[0])];
function genOptionSets(o) {
  const wall = WALL_CHOICES[o.wallKind].filter((c) => c.label !== o.wall[0]);
  const sets = [
    { key: 'wall', label: o.wallLabel, parts: ['외장_사이딩_X', '외장_사이딩_Y', '지붕_외장_사이딩_X', '지붕_외장_사이딩_Y'],
      choices: [{ id: 'orig', label: o.wall[0], swatch: o.wall[1] }, ...wall] },
    { key: 'trim', label: '코너·창 몰딩', parts: ['외장_코너', '지붕_외장_코너', '창몰딩', '지붕_창몰딩', '하부_스커트'],
      choices: pick(o.trim || ['차콜', '#2a2b2e'], ['black', 'white', 'gray', 'bronze']) },
    o.flat
      ? { key: 'roof', label: '지붕 후레싱', parts: ['후레싱', '지붕_후레싱'], choices: pick(o.roof, ['black', 'charcoal', 'gray', 'white']) }
      : { key: 'roof', label: '지붕 (징크)', parts: ['징크', '지붕_징크', '후레싱', '지붕_후레싱'], choices: pick(o.roof, ['charcoal', 'black', 'gray', 'brown', 'green', 'red']) },
    { key: 'window', label: '창틀', parts: ['창틀'], choices: pick(o.window, ['black', 'white', 'gray', 'brown']) },
    { key: 'door', label: '현관·방문', parts: ['문짝'], choices: pick(o.door, ['black', 'white', 'gray', 'brown']) },
  ];
  if (o.deck) sets.push({ key: 'deck', label: '데크', parts: ['데크'], choices: [{ id: 'orig', label: '다크브라운', swatch: '#55493e' },
    RM('teak', '티크', '#6b4a2f', '#b98a5c'), RM('gray', '그레이', '#4d4c4a', '#8f8c86'), RM('charcoal', '차콜', '#222222', '#4d4b48')] });
  if (o.steel) sets.push({ key: 'steel', label: '난간·기둥', parts: ['철골', '기둥', '지붕_철골', '지붕_기둥'], choices: pick(o.steel, ['black', 'white', 'gray', 'bronze']) });
  return sets;
}

// 쌍둥이 10평 — 기본형·ㄱ자형·2층형 공통 제품 옵션 (같은 블렌더 재질)
const TWIN_OPTS = [
  { key: 'wall', label: '외장 (우드 사이딩)', parts: ['TD_WoodSiding', '지붕_TD_WoodSiding'],
    choices: [{ id: 'orig', label: '우드', swatch: '#a0703f' }, ...WALL_CHOICES.wood] },
  { key: 'roof', label: '지붕 (징크)', parts: ['TD_Zinc', '지붕_TD_Zinc', 'TD_SeamCap', '지붕_TD_SeamCap', 'TD_ZincTrim', '지붕_TD_ZincTrim'],
    choices: pick(['차콜', '#2a2b2d'], ['black', 'gray', 'brown', 'green', 'red']) },
  { key: 'window', label: '창틀·프레임', parts: ['TD_WinFrame', '지붕_TD_WinFrame', 'TD_FrameBlack', '지붕_TD_FrameBlack', 'TD_WinSurround', '지붕_TD_WinSurround'],
    choices: pick(['블랙', '#1c1f24'], ['charcoal', 'white', 'gray', 'bronze']) },
  { key: 'trim', label: '몰딩·물받이', parts: ['TD_TrimGray', '지붕_TD_TrimGray', 'TD_Gutter', '지붕_TD_Gutter'],
    choices: pick(['차콜', '#2a2b2e'], ['black', 'white', 'gray', 'bronze']) },
  { key: 'deck', label: '데크', parts: ['TD_DeckEmboss', '지붕_TD_DeckEmboss'],
    choices: [{ id: 'orig', label: '우드', swatch: '#8a6a4a' }, RM('teak', '티크', '#6b4a2f', '#b98a5c'),
      RM('gray', '그레이', '#4d4c4a', '#8f8c86'), RM('charcoal', '차콜', '#222222', '#4d4b48')] },
];
// ㄱ자형·2층형은 두 동 모두 평지붕(실버 지붕판 + 골판) — 지붕 옵션만 평지붕 부품으로
const TWIN_OPTS_FLAT = TWIN_OPTS.map((o) => o.key !== 'roof' ? o : { ...o, label: '지붕 (평지붕)',
  parts: ['TD_RoofSheetSilver', '지붕_TD_RoofSheetSilver', 'TD_RoofCorrugated', '지붕_TD_RoofCorrugated'],
  choices: pick(['실버', '#b9bcbf'], ['charcoal', 'black', 'gray', 'white', 'brown']) });
const TWIN_SUM = {
  base: '6평동(거실·주방·욕실) + 4평동(방)을 나란히 두고 가운데 데크(5평)로 잇는 기본 배치 — 실내 10평',
  L: '6평동을 90° 돌려 4평동과 ㄱ자로 배치 — 두 동이 데크를 감싸 마당처럼 아늑, 거실·방이 데크를 마주봄',
  up: '4평동 위에 6평동을 올린 2층 구조 — 같은 실내 10평을 땅 면적은 줄여서, 외부 계단·2층 테라스',
};

const T = [
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
      // 욕실·현관만 벽으로 구획, 나머지(거실·주방·골프존)는 개방형(open 면으로 벽 생략).
      rooms: [
        { key: 'bath', type: 'bath',     name: '욕실',         x: 0,    y: 0,    w: 1200, d: 1800 },
        { key: 'ent',  type: 'entrance', name: '현관',         x: 0,    y: 1800, w: 1200, d: 1200 },
        { key: 'ldk',  type: 'kitchen',  name: '주방·다이닝',  x: 1200, y: 0,    w: 2700, d: 3000, open: ['s'] },
        { key: 'golf', type: 'living',   name: 'GOLF ZONE',    x: 0,    y: 3000, w: 3900, d: 4500, open: ['n'] },
        { key: 'deck', type: 'balcony',  name: '데크',         x: 0,    y: 7500, w: 3900, d: 900  },
      ],
      openings: [
        { roomKey: 'ent',  side: 'w', pos: 600,  winType: 'door' },     // 현관문(폴딩 900)
        { roomKey: 'bath', side: 's', pos: 600,  winType: 'door' },     // 욕실 포켓도어 800
        { roomKey: 'ldk',  side: 'n', pos: 1350, winType: 'fixed' },    // 주방 상단 픽스창
        { roomKey: 'ldk',  side: 'e', pos: 2400, winType: 'fixed' },
        { roomKey: 'golf', side: 's', pos: 1950, winType: 'sliding' },  // 데크 출입
        { roomKey: 'golf', side: 'e', pos: 2250, winType: 'fixed' },
        { roomKey: 'golf', side: 'w', pos: 2250, winType: 'fixed' },
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
  {
    // 세움 황토찜질방 (계획안-A) — 단일 개방형 찜질방 + 전면 포치
    //  · 본체 3,000×4,000: 황토미장+황토보드 바닥(건식보일러), 편백루바 천장, 좌우 1400×800 이중창
    //  · 포치 3,000×1,900(남측) · 외쪽지붕(shed, T100 징크 백색) · 외장 스마트사이딩(황토색)+검정메탈 포인트
    id: 'seum-hwangto',
    // 온라인 카탈로그(seum-catalog) 대표 사진·모델명
    photo: 'models/thumbs/seum-hwangto.jpg', code: 'CUBE-H3-BW',
    title: '세움 황토찜질방 (3,000×4,000)',
    category: '농막',
    showroom: '본점',
    tags: ['세움도면', '황토찜질방', '찜질방', '3000x4000', '외쪽지붕', '포치', '본점'],
    base: {
      // 계획안-B (블렌더 실물 모델): 캐스터+하부프레임 위 바닥 350 · 우드톤 강판사이딩 · 징크 박공지붕(용마루 앞뒤)
      name: '세움 황토찜질방 (3,000×4,000)',
      productType: '농막',
      ceilingHeight: 2400,
      foundationHeight: 350,
      exterior: { material: 'wood', color: '#975227', dir: 'v' },
      roof: { type: 'gable', color: '#3b3837' },
      // 3D 실물 모델 — 블렌더에서 만든 GLB(미터, 도면 원점 = 본체 북서쪽 모서리)
      //   fit·roofType·ridge·창문배치가 그대로일 때만 실물로 표시 (바꾸면 자동 생성 모델)
      //   optionSets: 제품 옵션 — parts(GLB 노드 이름)에 고른 색을 입힘. 첫 항목(orig)=블렌더 원래 마감
      //     remap: 블렌더에서 구운 질감의 명암(나뭇결·이음)은 살리고 색만 dark→light 로 / color: 단색 부품
      model3d: {
        url: 'models/seum-hwangto.glb', fit: [3000, 5900], label: '계획안-B', roofType: 'gable', ridge: 'z',
        optionSets: [
          { key: 'wall', label: '외장 (우드패턴 강판)', parts: ['우드톤_강판사이딩_X', '우드톤_강판사이딩_Y', '지붕_우드톤_강판사이딩_X'], choices: [
            { id: 'orig', label: '우드톤', swatch: '#975227' },
            { id: 'oak', label: '내추럴 오크', dark: '#7a5a3a', light: '#d9b98b' },
            { id: 'walnut', label: '월넛', dark: '#2b1a12', light: '#704b33' },
            { id: 'white', label: '화이트', dark: '#bfbab0', light: '#f5f3ee' },
            { id: 'gray', label: '그레이', dark: '#4b4f54', light: '#a0a5ab' },
            { id: 'charcoal', label: '차콜', dark: '#17181a', light: '#46494e' },
          ] },
          { key: 'accent', label: '포인트 띠', parts: ['흰색_가로사이딩', '흰색사이딩_판'], choices: [
            { id: 'orig', label: '화이트', swatch: '#e4e3de' },
            { id: 'ivory', label: '아이보리', dark: '#cbc2ae', light: '#f0e9d8' },
            { id: 'gray', label: '그레이', dark: '#6b6f75', light: '#a9adb2' },
            { id: 'charcoal', label: '차콜', dark: '#1d1e21', light: '#4b4d52' },
          ] },
          { key: 'roof', label: '지붕 (징크)', parts: ['지붕_징크_차콜', '지붕_차콜메탈'], choices: [
            { id: 'orig', label: '차콜', swatch: '#3b3837' },
            { id: 'black', label: '블랙', color: '#18181a' },
            { id: 'gray', label: '그레이', color: '#6f7377' },
            { id: 'brown', label: '브라운', color: '#4b3a2f' },
            { id: 'red', label: '레드', color: '#6e2a22' },
          ] },
          { key: 'frame', label: '난간·프레임', parts: ['각관_분체도장_차콜', '지붕_각관_분체도장_차콜'], choices: [
            { id: 'orig', label: '차콜', swatch: '#333336' },
            { id: 'black', label: '블랙', color: '#141416' },
            { id: 'white', label: '화이트', color: '#e8e8e5' },
            { id: 'bronze', label: '브론즈', color: '#4a3a2c' },
          ] },
          { key: 'window', label: '창틀', parts: ['PVC창틀_백색'], choices: [
            { id: 'orig', label: '화이트', swatch: '#ececec' },
            { id: 'black', label: '블랙', color: '#1c1d20' },
            { id: 'gray', label: '그레이', color: '#5f6368' },
            { id: 'brown', label: '브라운', color: '#4b3628' },
          ] },
          { key: 'deck', label: '데크', parts: ['합성데크'], choices: [
            { id: 'orig', label: '다크브라운', swatch: '#55493e' },
            { id: 'teak', label: '티크', dark: '#6b4a2f', light: '#b98a5c' },
            { id: 'gray', label: '그레이', dark: '#4d4c4a', light: '#8f8c86' },
            { id: 'charcoal', label: '차콜', dark: '#222222', light: '#4d4b48' },
          ] },
        ],
      },
      rooms: [
        { key: 'jjim',  type: 'room',  name: '황토찜질방', x: 0, y: 0,    w: 3000, d: 4000 },
        { key: 'porch', type: 'porch', name: '포치',       x: 0, y: 4000, w: 3000, d: 1900, rail: ['w', 'e'] },
      ],
      openings: [
        { roomKey: 'jjim', side: 'w', pos: 2000, winType: 'double',    w: 1800, h: 900,  sill: 1000, color: '#ececec' },
        { roomKey: 'jjim', side: 'e', pos: 2000, winType: 'double',    w: 1800, h: 900,  sill: 1000, color: '#ececec' },
        { roomKey: 'jjim', side: 's', pos: 1500, winType: 'swingDoor', w: 900,  h: 2100, color: '#2b2b2b' },
      ],
      furniture: [],
    },
  },
  {
    // 세움 15평 단독 (㈜세움 디자인하우징 실시공도면 1층, 계약 26.01.01, 경기도)
    //  · 본채 7,000×7,000 ≈ 49㎡(약 15평): 좌 주방·다이닝+거실(개방), 우 욕실/현관(3연동중문·신발장)/침실
    //  · 데크 4평 1,500×9,000(동측) · 포치 4평 7,000×2,000(남측) — 면적 별도
    //  · 벽체 280t 메탈사이딩 / 지붕 T260 징크 / 강화마루
    id: 'seum-15',
    // 온라인 카탈로그(seum-catalog) 대표 사진·모델명
    photo: 'models/thumbs/seum-15.jpg', code: 'STAY15-BK',
    title: '세움 15평 단독 (7,000×7,000)',
    category: '주택',
    showroom: '본점',
    tags: ['세움도면', '15평', '49㎡', '단독주택', '7000x7000', '데크', '포치'],
    base: {
      name: '세움 15평 단독 (7,000×7,000)',
      productType: '주택',
      ceilingHeight: 2400,
      foundationHeight: 310,   // 블렌더 시뮬레이션 기준 바닥 높이(콘크리트 기초 위 마루)
      exterior: { material: 'wood', color: '#9c6b43', dir: 'v' },
      roof: { type: 'gable', color: '#3c3d40', ridge: 'x' },
      // 3D 실물 모델 — 대표님이 디테일 잡은 블렌더 시뮬레이션(가구·조명·소품 포함)
      //   ownFurniture: 모델에 가구가 이미 있으므로 도면 기본 가구는 3D에서 숨김(상담 중 추가한 가구만 표시)
      model3d: { url: 'models/seum-15.glb', fit: [8500, 9000], roofType: 'gable', ridge: 'x', label: '시뮬레이션', ownFurniture: true,
        optionSets: [
          { key: 'wall', label: '외장 (우드 사이딩)', parts: ['Ext_Wood', '지붕_Ext_Wood'],
            choices: [{ id: 'orig', label: '우드', swatch: '#9c6b43' }, ...WALL_CHOICES.wood] },
          { key: 'accent', label: '포인트 (블랙 사이딩)', parts: ['Ext_Black', '지붕_Ext_Black'],
            choices: [{ id: 'orig', label: '블랙', swatch: '#232427' }, ...WALL_CHOICES.metal.filter((c) => c.id !== 'brown')] },
          { key: 'roof', label: '지붕·후레싱', parts: ['Roof_DarkGray', '지붕_Roof_DarkGray', 'Metal_Flashing', '지붕_Metal_Flashing'],
            choices: pick(['다크그레이', '#3c3d40'], ['black', 'charcoal', 'gray', 'brown', 'green', 'red']) },
          { key: 'steel', label: '난간·기둥·철물', parts: ['Metal_Black', '지붕_Metal_Black'],
            choices: pick(['블랙', '#1f1f22'], ['charcoal', 'white', 'gray', 'bronze']) },
          { key: 'window', label: '창틀', parts: ['I_FrameDarkGray', '지붕_I_FrameDarkGray'],
            choices: pick(['다크그레이', '#333537'], ['black', 'white', 'gray', 'brown']) },
          { key: 'deck', label: '데크', parts: ['Deck_Composite', 'Deck_Porch'],
            choices: [{ id: 'orig', label: '우드', swatch: '#8a6a4a' }, RM('teak', '티크', '#6b4a2f', '#b98a5c'),
              RM('gray', '그레이', '#4d4c4a', '#8f8c86'), RM('charcoal', '차콜', '#222222', '#4d4b48')] },
        ] },
      // 2D 도면 — 시공 도면(1층 평면도) 기준: 외벽 280t · 칸막이 120t
      wallThickness: 280,
      wallThicknessInt: 120,
      rooms: [
        // 좌측 — 주방·다이닝(위) + 거실(아래) 개방형 LDK (안목 4,020)
        { key: 'kit', type: 'kitchen', name: '주방·다이닝', x: 0,    y: 0,    w: 4360, d: 3210, open: ['s', 'e'] },
        { key: 'liv', type: 'living',  name: '거실',        x: 0,    y: 3210, w: 4360, d: 3790, open: ['n'] },
        // 우측 — 욕실(안목 1,400) / 복도·현관(1,350, 3연동 중문) / 침실(3,450)
        { key: 'bath', type: 'bath',     name: '욕실', x: 4360, y: 0,    w: 2640, d: 1740 },
        { key: 'hall', type: 'hall',     name: '복도', x: 4360, y: 1740, w: 1140, d: 1470, open: ['w'] },
        { key: 'ent',  type: 'entrance', name: '현관', x: 5500, y: 1740, w: 1500, d: 1470 },
        { key: 'bed',  type: 'bedroom',  name: '침실', x: 4360, y: 3210, w: 2640, d: 3790 },
        // 데크(동측) · 포치(남측) — 면적 별도(개방)
        { key: 'deck',  type: 'deck',  name: '데크', x: 7000, y: 0,    w: 1500, d: 9000 },
        { key: 'porch', type: 'porch', name: '포치', x: 0,    y: 7000, w: 7000, d: 2000 },
      ],
      openings: [
        // 주방·다이닝 — 북측 1500×700 이중창 · 서측 700×1800 픽스창
        { roomKey: 'kit', side: 'n', pos: 1880, winType: 'double', w: 1500, h: 700,  sill: 1300 },
        { roomKey: 'kit', side: 'w', pos: 2450, winType: 'fixed',  w: 700,  h: 1800, sill: 300 },
        // 거실 — 서측 2000×1000 픽스창 + 남측 포치로 3000 폴딩도어
        { roomKey: 'liv', side: 'w', pos: 1890, winType: 'fixed',   w: 2000, h: 1000, sill: 1100 },
        { roomKey: 'liv', side: 's', pos: 2190, winType: 'folding', w: 3000, h: 2100 },
        // 욕실 — 동측 600×500 이중창 · 복도 쪽 욕실문 700
        { roomKey: 'bath', side: 'e', pos: 980,  winType: 'double',    w: 600,  h: 500,  sill: 1400 },
        { roomKey: 'bath', side: 's', pos: 740,  winType: 'swingDoor', w: 700,  h: 2000, flipV: true },
        // 현관 — 복도 쪽 3연동 중문 + 데크 쪽 단열문
        { roomKey: 'ent',  side: 'w', pos: 735,  winType: 'slideDoor', w: 1350, h: 2100 },
        { roomKey: 'ent',  side: 'e', pos: 610,  winType: 'swingDoor', w: 900,  h: 2100 },
        // 침실 — 복도 쪽 문(북측) + 남측 2000×1200 이중창 + 데크 쪽 2000×1000 픽스창
        { roomKey: 'bed',  side: 'n', pos: 640,  winType: 'swingDoor', w: 900,  h: 2100 },
        { roomKey: 'bed',  side: 's', pos: 1110, winType: 'double',    w: 2000, h: 1200, sill: 900 },
        { roomKey: 'bed',  side: 'e', pos: 2160, winType: 'fixed',     w: 2000, h: 1000, sill: 900 },
      ],
      furniture: [
        // 3D 실물 모델(블렌더 시뮬레이션)의 가구 — 도면 벽(외벽 280t) 안쪽에 맞춤
        // 주방(북측) — 일자 상판(세탁기·전자레인지 수납 포함) · 인덕션 · 양문형 냉장고
        { catalogId: 'sink',      x: 1755, y: 580,  w: 2950, d: 600, rotation: 0 },
        { catalogId: 'induction', x: 680,  y: 555,  w: 600,  d: 450, rotation: 0 },
        { catalogId: 'fridge',    x: 3785, y: 605,  w: 1030, d: 650, rotation: 0 },
        // 다이닝 — 식탁 1600×850 + 의자 4개
        { catalogId: 'dining4',   x: 1130, y: 2200, w: 1600, d: 850, rotation: 0 },
        { catalogId: 'chair',     x: 730,  y: 1590, w: 450,  d: 500, rotation: 0 },
        { catalogId: 'chair',     x: 1530, y: 1590, w: 450,  d: 500, rotation: 0 },
        { catalogId: 'chair',     x: 730,  y: 2810, w: 450,  d: 500, rotation: 180 },
        { catalogId: 'chair',     x: 1530, y: 2810, w: 450,  d: 500, rotation: 180 },
        // 거실 — 3인 소파(서측 벽) · 러그 · TV 거실장(침실 칸막이 쪽)
        { catalogId: 'sofa3',     x: 745,  y: 5115, w: 2540, d: 930, rotation: 270 },
        { catalogId: 'rug',       x: 1960, y: 4890, w: 1450, d: 1900, rotation: 0 },
        { catalogId: 'tvstand',   x: 4060, y: 5050, w: 2400, d: 420, rotation: 90 },
        // 욕실 — 양변기 · 세면대
        { catalogId: 'toilet',    x: 4800, y: 610,  w: 440,  d: 660, rotation: 0 },
        { catalogId: 'basin',     x: 5700, y: 490,  w: 520,  d: 420, rotation: 0 },
        // 현관 — 신발장(침실 벽 쪽)
        { catalogId: 'shelf',     x: 6135, y: 2975, w: 1150, d: 350, rotation: 180 },
        // 침실 — 침대(머리 남쪽) · 협탁 · 옷장
        { catalogId: 'bedQ',      x: 5980, y: 5740, w: 1480, d: 1960, rotation: 180 },
        { catalogId: 'shelf',     x: 5064, y: 6520, w: 440,  d: 400, rotation: 180 },
        { catalogId: 'wardrobe',  x: 6170, y: 3575, w: 1100, d: 610, rotation: 180 },
      ],
    },
  },
  {
    // 세움 체류형 쉼터 10평 (33㎡, 마곡 박람회 전시 모델) — 고천리 실시공 도면(작업 26.04.16~) 기준
    //  · 외곽 약 7,930×6,230 중 실내 33㎡(10평): 욕실 / 주방·다이닝(아일랜드) / 거실(ㄱ자 간접등) / 방
    //  · 남측 폴딩도어+출입문 → 합성데크 포치(철제난간·태양광 데크등) · 지붕 평지붕(처마없음) 럭스틸밤색
    //  · 외장 루버강판 네츄럴우드(세로) · 창호 전체 검정/브론즈 · 데크 진밤색
    id: 'seum-shelter-10',
    // 온라인 카탈로그(seum-catalog) 대표 사진·모델명
    photo: 'models/thumbs/seum-shelter-10.jpg', code: 'FOREST10-E',
    title: '세움 체류형 쉼터 10평 (33㎡)',
    category: '체류형 쉼터',
    showroom: '마곡 박람회',
    tags: ['세움도면', '체류형쉼터', '10평', '33㎡', '마곡박람회', '폴딩도어', '데크', '루버강판'],
    base: {
      name: '세움 체류형 쉼터 10평 (33㎡)',
      productType: '체류형 쉼터',
      ceilingHeight: 2400,
      foundationHeight: 300,
      exterior: { material: 'wood', color: '#9c7244', dir: 'v' },   // 루버강판믹스 네츄럴우드(세로)
      roof: { type: 'flat', color: '#3a2e26', fascia: '#3a2e26' },  // 처마없는 평지붕/럭스틸밤색
      // 3D 실물 모델 — 블렌더로 디테일 작업한 마곡 박람회 시뮬레이션 (가구·조명 포함)
      model3d: { url: 'models/seum-shelter-10.glb', fit: [7930, 6230], roofType: 'flat', ridge: 'z', label: '시뮬레이션', ownFurniture: true,
        flatParts: ['Ext_WoodLouver', '지붕_Ext_WoodLouver'],   // 루버 날개가 가늘어 구운 무늬가 조각나 보임 → 단색 + 날개 형상으로
        optionSets: [
          { key: 'wall', label: '외장 (우드 루버강판)', parts: ['Ext_WoodLouver', '지붕_Ext_WoodLouver', 'Ext_LouverGroove', '지붕_Ext_LouverGroove'],
            choices: [{ id: 'orig', label: '우드톤', swatch: '#9c7244' }, ...WALL_CHOICES.wood] },
          { key: 'trim', label: '몰딩·트림', parts: ['Ext_TrimBeige', '지붕_Ext_TrimBeige'],
            choices: pick(['베이지', '#b39a74'], ['black', 'charcoal', 'white', 'gray', 'bronze']) },
          { key: 'roof', label: '지붕·후레싱', parts: ['Roof_MetalGray', '지붕_Roof_MetalGray', 'Cope_DarkGray', '지붕_Cope_DarkGray'],
            choices: pick(['다크그레이', '#3c3d40'], ['black', 'charcoal', 'gray', 'brown', 'white']) },
          { key: 'window', label: '창틀·프레임', parts: ['Frame_Black', '지붕_Frame_Black'],
            choices: pick(['블랙', '#1c1f24'], ['charcoal', 'white', 'gray', 'bronze']) },
          { key: 'base', label: '하부 스커트', parts: ['Ext_BaseMetal', '지붕_Ext_BaseMetal'],
            choices: pick(['블랙', '#1b1b1d'], ['charcoal', 'gray', 'white']) },
          { key: 'deck', label: '데크', parts: ['Deck_DarkWalnut', '지붕_Deck_DarkWalnut'],
            choices: [{ id: 'orig', label: '다크월넛', swatch: '#4a3526' }, RM('teak', '티크', '#6b4a2f', '#b98a5c'),
              RM('gray', '그레이', '#4d4c4a', '#8f8c86'), RM('charcoal', '차콜', '#222222', '#4d4b48')] },
        ] },
      // 실물 모델(블렌더) 배치: 외곽 7,930×6,230
      //  상단 → 방(좌 2,590) · 욕실(중, 깊이 1,760) + 앞 복도 · 주방·다이닝(우 3,060)
      //  하단 → 데크(좌 4,515) · 거실(우 3,415) — 주방·복도와 개방, 데크와 폴딩도어
      rooms: [
        { key: 'bed',  type: 'bedroom', name: '방',         x: 0,    y: 0,    w: 2590, d: 3115 },
        { key: 'bath', type: 'bath',    name: '욕실',       x: 2590, y: 0,    w: 2280, d: 1760 },
        { key: 'hall', type: 'hall',    name: '복도',       x: 2590, y: 1760, w: 2280, d: 1355, open: ['e'] },
        { key: 'kit',  type: 'kitchen', name: '주방·다이닝', x: 4870, y: 0,    w: 3060, d: 3115, open: ['s', 'w'] },
        { key: 'porch', type: 'porch',  name: '데크(포치)',  x: 0,    y: 3115, w: 4515, d: 3115, rail: ['s', 'w'] },
        { key: 'liv',   type: 'living',  name: '거실',       x: 4515, y: 3115, w: 3415, d: 3115, open: ['n'] },
      ],
      openings: [
        // 거실 — 서측 데크로 폴딩도어 2,500 + 남측 2m 이동창(바닥까지)
        { roomKey: 'liv',  side: 'w', pos: 1485, winType: 'foldSwing', w: 2500, h: 2100, color: '#1c1f24' },
        { roomKey: 'liv',  side: 's', pos: 1650, winType: 'sliding',   w: 2000, h: 2100, sill: 0, color: '#1c1f24' },
        // 주방 — 북측 가로창
        { roomKey: 'kit',  side: 'n', pos: 1945, winType: 'fixed',  w: 1000, h: 600,  sill: 1100, color: '#1c1f24' },
        // 욕실 — 복도 쪽 문 / 복도 — 데크 쪽 고정창
        { roomKey: 'bath', side: 's', pos: 510,  winType: 'swingDoor', w: 700, h: 2000, color: '#1c1f24' },
        { roomKey: 'hall', side: 's', pos: 935,  winType: 'fixed',     w: 700, h: 1800, sill: 300, color: '#1c1f24' },
        // 방 — 서측 창 + 데크 쪽 고정창 + 복도 쪽 문
        { roomKey: 'bed',  side: 'w', pos: 1900, winType: 'double',    w: 1600, h: 1000, sill: 1000, color: '#1c1f24' },
        { roomKey: 'bed',  side: 's', pos: 1380, winType: 'fixed',     w: 1200, h: 900,  sill: 1100, color: '#1c1f24' },
        { roomKey: 'bed',  side: 'e', pos: 2350, winType: 'swingDoor', w: 800,  h: 2100, color: '#1c1f24' },
      ],
      furniture: [
        // 3D 실물 모델(블렌더)의 가구 위치·크기 그대로 (중심 x·y, 폭 w·깊이 d mm)
        // 방 — 서랍장
        { catalogId: 'shelf',   x: 1400, y: 420,  w: 1040, d: 360, rotation: 0 },
        // 욕실 — 양변기 · 세면대
        { catalogId: 'toilet',  x: 3050, y: 560,  w: 400,  d: 650, rotation: 0 },
        { catalogId: 'basin',   x: 3750, y: 390,  w: 480,  d: 260, rotation: 0 },
        // 주방 — 냉장고 · ㄱ자 상판(뒤쪽 하부장 + 오른쪽 싱크) · 인덕션 · 아일랜드 바 · 바 의자
        { catalogId: 'fridge',  x: 5280, y: 565,  w: 650,  d: 610, rotation: 0 },
        { catalogId: 'kbase12', x: 6390, y: 540,  w: 1400, d: 620, rotation: 0 },
        { catalogId: 'sink',    x: 7390, y: 1020, w: 1580, d: 620, rotation: 90 },
        { catalogId: 'induction', x: 5950, y: 520, w: 500, d: 480, rotation: 0 },
        { catalogId: 'cooktop', x: 6700, y: 2170, w: 2000, d: 760, rotation: 0 },
        { catalogId: 'chair',   x: 6600, y: 2830, w: 480,  d: 560, rotation: 180 },
        // 데크 — 테이블 + 의자 4개
        { catalogId: 'dining4', x: 3050, y: 5080, w: 800,  d: 800, rotation: 0 },
        { catalogId: 'chair',   x: 3050, y: 4400, w: 480,  d: 520, rotation: 0 },
        { catalogId: 'chair',   x: 3050, y: 5760, w: 480,  d: 520, rotation: 180 },
        { catalogId: 'chair',   x: 2370, y: 5080, w: 480,  d: 520, rotation: 270 },
        { catalogId: 'chair',   x: 3730, y: 5080, w: 480,  d: 520, rotation: 90 },
        // 데크 벽등 2개
        { catalogId: 'sconce', x: 1150, y: 3115, rotation: 0, wallNormal: [0, 1] },
        { catalogId: 'sconce', x: 3380, y: 3115, rotation: 0, wallNormal: [0, 1] },
      ],
    },
  },
  {
    // 세움 쌍둥이 10평 (6평동 + 중앙 데크 + 4평동) — 브리즈웨이(중앙 데크 연결)형
    //  · 6평동: 6.2×3.2M 농막(S-1500) 개방형 원룸(거실·침실)
    //  · 4평동: 거실·주방 + 욕실 + 현관 (외곽 4,100×3,200 ≈ 13.1㎡)
    //  · 중앙 데크 2,600×3,200: 두 동을 잇는 통로형 데크(지붕이 덮음). 판매평수 10평(데크 별도)
    //  · 외장 세로 메탈사이딩(우드 VS-04-010 / 블랙 VS-04-003), 지붕 T260 징크 처마 200
    id: 'twin-10',
    // 온라인 카탈로그(seum-catalog) 대표 사진·모델명
    photo: 'models/thumbs/twin-10.jpg', code: 'FOREST10-BK',
    title: '세움 쌍둥이 10평 (6평+4평 · 중앙데크)',
    category: '농막',
    showroom: '본점',
    tags: ['쌍둥이', '10평', '6평', '4평', '데크', '브리즈웨이', '농막'],
    base: {
      name: '세움 쌍둥이 10평 (6평+4평 · 중앙데크)',
      productType: '농막',
      ceilingHeight: 2400,
      wallThickness: 280, wallThicknessInt: 120,   // 시공 도면: 외벽 280t · 칸막이 120t (4평동 외벽 200t 은 방별 wallT)
      exterior: { material: 'wood', color: '#a0703f', dir: 'v' },
      roof: { type: 'gable', color: '#2a2b2d', ridge: 'z' },   // 6평동 징크 박공(앞뒤로 긴 용마루) · 4평동 평지붕
      // 3D 실물 모델 — 블렌더로 디테일 작업한 본점 쌍둥이 시뮬레이션 (가구·조명·데크 그늘막 포함)
      model3d: { url: 'models/twin-10.glb', fit: [8800, 6300], roofType: 'gable', ridge: 'z', label: '시뮬레이션', ownFurniture: true,
        optionSets: TWIN_OPTS,
        family: 'twin', variant: '기본형', summary: TWIN_SUM.base },
      // 시공 도면(1층 평면도) 기준 배치: 6평동 2,700×6,300 · 중앙 데크 2,900(5평) · 4평동(S-1500) 3,200×6,200
      //  6평동: 북측 욕실(안목 1,400) / 칸막이 120 / 거실·주방(안목 4,220) — 외벽 280
      //  4평동: 외벽 200, 데크 쪽 폴딩도어 3200(+여닫이), 남·북 픽스창 1800×1400, 동측 단창 2000×600
      rooms: [
        { key: 'A_bath', type: 'bath',    name: '욕실',             x: 0,    y: 0,    w: 2700, d: 1740 },
        { key: 'A_liv',  type: 'living',  name: '거실·주방(6평동)', x: 0,    y: 1740, w: 2700, d: 4560 },
        { key: 'deck',   type: 'deck',    name: '데크',             x: 2700, y: 0,    w: 2900, d: 6300 },
        { key: 'B_bed',  type: 'bedroom', name: '방(4평동)',        x: 5600, y: 100,  w: 3200, d: 6200, wallT: 200 },
      ],
      openings: [
        // 6평동 — 서측 욕실창 600×500 · 거실창 1500×900, 남측 주방창 900×600, 데크 쪽 단열문 900×2100 · 이중창 2000×2100
        { roomKey: 'A_bath', side: 'w', pos: 1300, winType: 'double',    w: 600,  h: 500,  sill: 1600 },
        { roomKey: 'A_liv',  side: 'w', pos: 2010, winType: 'double',    w: 1500, h: 900,  sill: 1100 },
        { roomKey: 'A_liv',  side: 's', pos: 1450, winType: 'double',    w: 900,  h: 600,  sill: 1100 },
        { roomKey: 'A_liv',  side: 'e', pos: 660,  winType: 'swingDoor', w: 900,  h: 2100 },
        { roomKey: 'A_liv',  side: 'e', pos: 2260, winType: 'sliding',   w: 2000, h: 2100, sill: 0 },
        { roomKey: 'A_bath', side: 's', pos: 2150, winType: 'swingDoor', w: 700,  h: 2000 },
        // 4평동 — 데크 쪽 폴딩도어 3200, 남·북 픽스창 1800×1400, 동측 단창 2000×600
        { roomKey: 'B_bed',  side: 'w', pos: 3100, winType: 'foldSwing', w: 3200, h: 2100 },
        { roomKey: 'B_bed',  side: 'n', pos: 1600, winType: 'fixed',     w: 1800, h: 1400, sill: 700 },
        { roomKey: 'B_bed',  side: 's', pos: 1600, winType: 'fixed',     w: 1800, h: 1400, sill: 700 },
        { roomKey: 'B_bed',  side: 'e', pos: 3100, winType: 'fixed',     w: 2000, h: 600,  sill: 1500 },
      ],
      furniture: [
        // 3D 실물 모델(블렌더)의 가구 위치·크기 그대로
        // 6평동 욕실 — 세면대 · 양변기
        { catalogId: 'basin',  x: 1400, y: 370,  w: 480,  d: 420, rotation: 0 },
        { catalogId: 'toilet', x: 2100, y: 480,  w: 400,  d: 640, rotation: 0 },
        // 6평동 주방(남측) — 냉장고 · 싱크 상판 · 인덕션
        { catalogId: 'fridge', x: 600,  y: 5810, w: 600,  d: 640, rotation: 180 },
        { catalogId: 'sink',   x: 1745, y: 5840, w: 1610, d: 620, rotation: 180 },
        { catalogId: 'induction2', x: 2280, y: 5830, w: 360, d: 500, rotation: 180 },
        // 데크 — 테이블 + 의자 4개, 화분 2개
        { catalogId: 'dining4', x: 4150, y: 2900, w: 1430, d: 820, rotation: 0 },
        { catalogId: 'chair',  x: 3790, y: 2200, w: 500,  d: 520, rotation: 0 },
        { catalogId: 'chair',  x: 4510, y: 2200, w: 500,  d: 520, rotation: 0 },
        { catalogId: 'chair',  x: 3790, y: 3600, w: 500,  d: 520, rotation: 180 },
        { catalogId: 'chair',  x: 4510, y: 3600, w: 500,  d: 520, rotation: 180 },
        { catalogId: 'plant',  x: 3600, y: 400,  w: 320,  d: 320, rotation: 0 },
        { catalogId: 'plant',  x: 4700, y: 350,  w: 320,  d: 320, rotation: 0 },
        // 4평동 — 싱글 침대(머리 동쪽) · 낮은 수납장 · 서랍장
        { catalogId: 'bedS',   x: 7613, y: 860,  w: 1120, d: 2045, rotation: 90 },
        { catalogId: 'tvstand', x: 6960, y: 5917, w: 2390, d: 465, rotation: 180 },
        { catalogId: 'shelf',  x: 8410, y: 5912, w: 450,  d: 475, rotation: 180 },
      ],
    },
  },
  {
    // 쌍둥이 10평 ㄱ자형 — 6평동을 90° 돌려 북쪽에, 4평동은 동쪽 그대로 → 두 동이 데크를 ㄱ자로 감쌈 (블렌더 모델 기준)
    id: 'twin-10-L',
    // 온라인 카탈로그(seum-catalog) 대표 사진·모델명 — 카탈로그에 없는 변형이라 3D 렌더 사진
    photo: 'models/thumbs/twin-10-L.jpg', code: 'FOREST10-BK', codeNote: 'ㄱ자 변형',
    title: '세움 쌍둥이 10평 ㄱ자형 (6평+4평 · 데크 감싸기)',
    category: '농막',
    showroom: '본점',
    tags: ['쌍둥이', '10평', 'ㄱ자', '6평', '4평', '데크', '농막'],
    base: {
      name: '세움 쌍둥이 10평 ㄱ자형',
      productType: '농막',
      ceilingHeight: 2400,
      wallThickness: 280, wallThicknessInt: 120,
      exterior: { material: 'wood', color: '#a0703f', dir: 'v' },
      roof: { type: 'flat', color: '#2a2b2d' },
      model3d: { url: 'models/twin-10-L.glb', fit: [9510, 9080], roofType: 'flat', label: '시뮬레이션', ownFurniture: true,
        optionSets: TWIN_OPTS_FLAT, family: 'twin', variant: 'ㄱ자형', summary: TWIN_SUM.L },
      rooms: [
        // 6평동(가로 6,310×2,710): 서쪽 거실·주방 / 동쪽 욕실
        { key: 'A_liv',  type: 'living',  name: '거실·주방(6평동)', x: 0,    y: 0,    w: 4610, d: 2710 },
        { key: 'A_bath', type: 'bath',    name: '욕실',             x: 4610, y: 0,    w: 1700, d: 2710 },
        { key: 'deck',   type: 'deck',    name: '데크',             x: 0,    y: 2710, w: 6310, d: 6370 },
        { key: 'B_bed',  type: 'bedroom', name: '방(4평동)',        x: 6310, y: 2690, w: 3200, d: 6200, wallT: 200 },
      ],
      openings: [
        // 6평동 — 북측 거실창 1500×900 · 욕실창 600×500, 서측 주방창 900×600, 데크 쪽 이중창 2000×2100 · 단열문 900, 욕실문 700
        { roomKey: 'A_liv',  side: 'n', pos: 2610, winType: 'double',    w: 1500, h: 900,  sill: 1100 },
        { roomKey: 'A_bath', side: 'n', pos: 750,  winType: 'double',    w: 600,  h: 500,  sill: 1600 },
        { roomKey: 'A_liv',  side: 'w', pos: 1460, winType: 'double',    w: 900,  h: 600,  sill: 1100 },
        { roomKey: 'A_liv',  side: 's', pos: 2160, winType: 'sliding',   w: 2000, h: 2100, sill: 0 },
        { roomKey: 'A_liv',  side: 's', pos: 4035, winType: 'swingDoor', w: 900,  h: 2100 },
        { roomKey: 'A_bath', side: 'w', pos: 2085, winType: 'swingDoor', w: 700,  h: 2000, flipV: true },
        // 4평동 — 기본형과 같음
        { roomKey: 'B_bed',  side: 'w', pos: 3100, winType: 'foldSwing', w: 3200, h: 2100 },
        { roomKey: 'B_bed',  side: 'n', pos: 1600, winType: 'fixed',     w: 1800, h: 1400, sill: 700 },
        { roomKey: 'B_bed',  side: 's', pos: 1600, winType: 'fixed',     w: 1800, h: 1400, sill: 700 },
        { roomKey: 'B_bed',  side: 'e', pos: 3100, winType: 'fixed',     w: 2000, h: 600,  sill: 1500 },
      ],
      furniture: [
        // 6평동 — 욕실(세면대·양변기) · 주방(냉장고·싱크·인덕션, 서쪽 벽)
        { catalogId: 'basin',  x: 5940, y: 1410, w: 480,  d: 420, rotation: 90 },
        { catalogId: 'toilet', x: 5830, y: 2105, w: 400,  d: 640, rotation: 90 },
        { catalogId: 'fridge', x: 500,  y: 610,  w: 600,  d: 640, rotation: 270 },
        { catalogId: 'sink',   x: 450,  y: 1760, w: 1600, d: 580, rotation: 270 },
        { catalogId: 'induction2', x: 480, y: 2290, w: 360, d: 500, rotation: 270 },
        // 데크 — 테이블 + 의자 4개
        { catalogId: 'dining4', x: 3310, y: 5610, w: 1430, d: 820, rotation: 90 },
        { catalogId: 'chair',  x: 2600, y: 5250, w: 500,  d: 520, rotation: 270 },
        { catalogId: 'chair',  x: 2600, y: 5970, w: 500,  d: 520, rotation: 270 },
        { catalogId: 'chair',  x: 4030, y: 5250, w: 500,  d: 520, rotation: 90 },
        { catalogId: 'chair',  x: 4030, y: 5970, w: 500,  d: 520, rotation: 90 },
        // 4평동 — 기본형과 같음
        { catalogId: 'bedS',   x: 8323, y: 3450, w: 1120, d: 2045, rotation: 90 },
        { catalogId: 'tvstand', x: 7670, y: 8507, w: 2390, d: 465, rotation: 180 },
        { catalogId: 'shelf',  x: 9120, y: 8502, w: 450,  d: 475, rotation: 180 },
      ],
    },
  },
  {
    // 쌍둥이 10평 2층형 — 4평동 위에 6평동을 올림 · 데크에서 외부 계단으로 2층 테라스 → 6평동 (블렌더 모델 기준)
    id: 'twin-10-2f',
    // 온라인 카탈로그(seum-catalog) 대표 사진·모델명 — 카탈로그에 없는 변형이라 3D 렌더 사진
    photo: 'models/thumbs/twin-10-2f.jpg', code: 'FOREST10-BK', codeNote: '2층 변형',
    title: '세움 쌍둥이 10평 2층형 (4평 위 6평 · 외부 계단)',
    category: '농막',
    showroom: '본점',
    tags: ['쌍둥이', '10평', '2층', '복층', '6평', '4평', '데크', '농막'],
    base: {
      name: '세움 쌍둥이 10평 2층형',
      productType: '농막',
      ceilingHeight: 2400,
      wallThickness: 280, wallThicknessInt: 120,
      exterior: { material: 'wood', color: '#a0703f', dir: 'v' },
      roof: { type: 'flat', color: '#2a2b2d' },
      model3d: { url: 'models/twin-10-2f.glb', fit: [9500, 6370], roofType: 'flat', label: '시뮬레이션', ownFurniture: true, floors: 2,
        optionSets: TWIN_OPTS_FLAT, family: 'twin', variant: '2층형', summary: TWIN_SUM.up },
      floors: [
        {
          name: '1층',
          rooms: [
            { key: 'deck',  type: 'deck',    name: '데크',       x: 0,    y: 0, w: 6300, d: 6370 },
            { key: 'B_bed', type: 'bedroom', name: '방(4평동)',  x: 6300, y: 0, w: 3200, d: 6200, wallT: 200 },
          ],
          openings: [
        { roomKey: 'B_bed',  side: 'w', pos: 3100, winType: 'foldSwing', w: 3200, h: 2100 },
        { roomKey: 'B_bed',  side: 'n', pos: 1600, winType: 'fixed',     w: 1800, h: 1400, sill: 700 },
        { roomKey: 'B_bed',  side: 's', pos: 1600, winType: 'fixed',     w: 1800, h: 1400, sill: 700 },
        { roomKey: 'B_bed',  side: 'e', pos: 3100, winType: 'fixed',     w: 2000, h: 600,  sill: 1500 },
          ],
          furniture: [
            // 데크 — 테이블 + 의자 4개 · 2층 테라스로 오르는 외부 계단(남측)
            { catalogId: 'dining4', x: 3300, y: 2900, w: 1430, d: 820, rotation: 90 },
            { catalogId: 'chair',  x: 2590, y: 2540, w: 500,  d: 520, rotation: 270 },
            { catalogId: 'chair',  x: 2590, y: 3260, w: 500,  d: 520, rotation: 270 },
            { catalogId: 'chair',  x: 4020, y: 2540, w: 500,  d: 520, rotation: 90 },
            { catalogId: 'chair',  x: 4020, y: 3260, w: 500,  d: 520, rotation: 90 },
            { catalogId: 'stairs', x: 2390, y: 5450, w: 1000, d: 3960, rotation: 90 },
            // 4평동 — 기본형과 같음
            { catalogId: 'bedS',   x: 8313, y: 740,  w: 1120, d: 2045, rotation: 90 },
            { catalogId: 'tvstand', x: 7660, y: 5797, w: 2390, d: 465, rotation: 180 },
            { catalogId: 'shelf',  x: 9110, y: 5792, w: 450,  d: 475, rotation: 180 },
          ],
        },
        {
          name: '2층',
          rooms: [
            // 6평동(3,200×6,200): 북쪽 거실·주방 / 남쪽 욕실 · 서쪽 2층 테라스(2,000)
            { key: 'A_liv',  type: 'living',  name: '거실·주방(6평동)', x: 6300, y: 0,    w: 3200, d: 4530 },
            { key: 'A_bath', type: 'bath',    name: '욕실',             x: 6300, y: 4530, w: 3200, d: 1670 },
            { key: 'terr',   type: 'balcony', name: '2층 테라스',       x: 4300, y: 200,  w: 2000, d: 5800, rail: ['w', 'n', 's'] },
          ],
          openings: [
            { roomKey: 'A_liv',  side: 'w', pos: 2115, winType: 'sliding',   w: 2000, h: 2100, sill: 0 },
            { roomKey: 'A_liv',  side: 'w', pos: 3960, winType: 'swingDoor', w: 900,  h: 2100 },
            { roomKey: 'A_liv',  side: 'e', pos: 2560, winType: 'double',    w: 1500, h: 900,  sill: 1100 },
            { roomKey: 'A_liv',  side: 'n', pos: 1480, winType: 'double',    w: 900,  h: 600,  sill: 1100 },
            { roomKey: 'A_bath', side: 'e', pos: 735,  winType: 'double',    w: 600,  h: 500,  sill: 1600 },
            { roomKey: 'A_bath', side: 'n', pos: 735,  winType: 'swingDoor', w: 700,  h: 2000 },
          ],
          furniture: [
            // 주방(북쪽 벽) — 인덕션 · 싱크 상판 · 냉장고 / 욕실(남쪽) — 양변기 · 세면대
            { catalogId: 'sink',   x: 7425, y: 435,  w: 1890, d: 570, rotation: 0 },
            { catalogId: 'induction2', x: 6795, y: 465, w: 430, d: 490, rotation: 0 },
            { catalogId: 'fridge', x: 8785, y: 485,  w: 600,  d: 640, rotation: 0 },
            { catalogId: 'toilet', x: 7010, y: 5730, w: 400,  d: 640, rotation: 180 },
            { catalogId: 'basin',  x: 7840, y: 5835, w: 560,  d: 410, rotation: 180 },
          ],
        },
      ],
    },
  },
  {
    // ㈜세움 디자인하우징 실시공도면 1층 평면도 (충북 제천 봉양, 이윤자님, 계약 25.04.26)
    // 외곽 9,000×6,000(벽 280t) + 썬룸 9,000×2,500 + 데크 1,500×8,500(우측)
    // ※ 사진 판독 기반 v2 — 시공 전달 전 치수 검증 필요
    id: 'seum-jc-9x6',
    title: '세움 제천 봉양 단독주택 (9,000×6,000) 1층',
    category: '주택',
    showroom: '제천',
    tags: ['세움도면', '제천', '봉양', '단독주택', '9000x6000', '썬룸'],
    base: {
      name: '세움 제천 봉양 (9,000×6,000)',
      productType: '주택',
      ceilingHeight: 2400,
      // 벽체 280t 메탈사이딩(VS-04-010) / 지붕 T260 징크판넬 처마 400
      exterior: { material: 'metal', color: '#3d4651' },
      roof: { type: 'flat', color: '#4a4a4a' },
      rooms: [
        // 후면(북) 밴드 — 욕실 · 주방/다이닝 · 세탁실
        { key: 'bath', type: 'bath',     name: '욕실',       x: 0,    y: 0,    w: 1600, d: 2000 },
        { key: 'kit',  type: 'kitchen',  name: '주방·다이닝', x: 1600, y: 0,    w: 4400, d: 2000, open: ['s'] },
        { key: 'util', type: 'utility',  name: '세탁실',      x: 6000, y: 0,    w: 3000, d: 2000 },
        // 중앙 밴드 — 거실 · 현관
        { key: 'liv',  type: 'living',   name: '거실',       x: 0,    y: 2000, w: 6000, d: 1400, open: ['n'] },
        { key: 'ent',  type: 'entrance', name: '현관',       x: 6000, y: 2000, w: 3000, d: 1400 },
        // 전면(남) 밴드 — 침실 3
        { key: 'bed1', type: 'bedroom',  name: '침실1',      x: 0,    y: 3400, w: 2900, d: 2600 },
        { key: 'bed2', type: 'bedroom',  name: '침실2',      x: 2900, y: 3400, w: 3200, d: 2600 },
        { key: 'bed3', type: 'bedroom',  name: '침실3',      x: 6100, y: 3400, w: 2900, d: 2600 },
        // 썬룸(하부, 난방없음) · 데크(우측)
        { key: 'sun',  type: 'sunroom',  name: '썬룸',       x: 0,    y: 6000, w: 9000, d: 2500 },
        { key: 'deck', type: 'deck',     name: '데크',       x: 9000, y: 0,    w: 1500, d: 8500 },
      ],
      openings: [
        // 후면 창/문
        { roomKey: 'bath', side: 'n', pos: 800,  winType: 'double',    w: 600,  h: 1600, sill: 600 },
        { roomKey: 'kit',  side: 'n', pos: 1000, winType: 'double',    w: 1800, h: 700,  sill: 1100 },
        { roomKey: 'util', side: 'n', pos: 800,  winType: 'double',    w: 1000, h: 900,  sill: 1100 },
        { roomKey: 'util', side: 's', pos: 2400, winType: 'swingDoor', w: 900,  h: 2000 },
        // 현관 중문(3연동) · 침실 문(3틀)
        { roomKey: 'ent',  side: 'w', pos: 700,  winType: 'slideDoor', w: 1350, h: 2100 },
        { roomKey: 'bed1', side: 'n', pos: 1450, winType: 'swingDoor', w: 900,  h: 2100 },
        { roomKey: 'bed2', side: 'n', pos: 1600, winType: 'swingDoor', w: 900,  h: 2100 },
        { roomKey: 'bed3', side: 'n', pos: 1450, winType: 'swingDoor', w: 900,  h: 2100 },
        // 침실 → 썬룸측 창 (거실 앞 포함)
        { roomKey: 'bed1', side: 's', pos: 1450, winType: 'double',    w: 1500, h: 1000, sill: 1100 },
        { roomKey: 'bed2', side: 's', pos: 1600, winType: 'double',    w: 2000, h: 2100, sill: 0 },
        { roomKey: 'bed3', side: 's', pos: 1450, winType: 'double',    w: 1500, h: 1000, sill: 1100 },
        // 썬룸 전면 대형창 (상부미닫이+하부픽스)
        { roomKey: 'sun',  side: 's', pos: 1450, winType: 'sliding',   w: 2700, h: 2200, sill: 0 },
        { roomKey: 'sun',  side: 's', pos: 4500, winType: 'sliding',   w: 3200, h: 2200, sill: 0 },
        { roomKey: 'sun',  side: 's', pos: 7550, winType: 'sliding',   w: 2700, h: 2200, sill: 0 },
      ],
      furniture: [],
    },
  },
  {
    // 실제 시공 도면(본점19-1 평면도 1:50, 본점19-2 입면도 1:70) 기준
    id: 'seum-bonjeom-19',
    // 온라인 카탈로그(seum-catalog) 대표 사진·모델명
    photo: 'models/thumbs/seum-bonjeom-19.jpg', code: 'STAY19-BK',
    title: '세움 본점 19평 (9,000×7,000) + 포치 7평 · 데크 4평',
    category: '주택',
    showroom: '본점',
    tags: ['세움도면', '본점', '19평', '9000x7000', '포치', '데크', '박공'],
    base: {
      name: '세움 본점 19평 (9,000×7,000)',
      productType: '주택',
      ceilingHeight: 2400,
      // 벽체 280t 세로 메탈사이딩(우드 프린트)+차콜 모서리 / 지붕 T260 징크판넬 박공(용마루 가로), 전체높이 3,700
      //   시공 사진 기준: 차콜 처마 마감판·원목 처마 밑면, 회색 포치 기둥·난간, 포치 원목 루바 천장+다운라이트
      exterior: { material: 'metalV', color: '#b8773e', corner: '#2f3237' },
      roof: { type: 'gable', color: '#3a3f44', ridge: 'x', rise: 1100, fascia: '#34373c', soffit: 'wood', postColor: '#5b6167' },
      // 3D 실물 모델 — 대표님이 디테일 잡은 블렌더 시뮬레이션(가구·조명·소품 포함, 블렌더에선 포치가 +Y 라 180° 돌려 변환)
      model3d: { url: 'models/seum-bonjeom-19.glb', fit: [10500, 9500], roofType: 'gable', ridge: 'x', label: '시뮬레이션', ownFurniture: true,
        optionSets: [
          { key: 'wall', label: '외장 (우드 사이딩)', parts: ['우드_메탈사이딩', '지붕_우드_메탈사이딩'],
            choices: [{ id: 'orig', label: '우드', swatch: '#b8773e' }, ...WALL_CHOICES.wood] },
          { key: 'accent', label: '포인트 (차콜 골강판)', parts: ['차콜_골강판', '지붕_차콜_골강판'],
            choices: [{ id: 'orig', label: '차콜', swatch: '#3e4144' }, ...WALL_CHOICES.metal.filter((c) => c.id !== 'charcoal')] },
          { key: 'roof', label: '지붕 (징크)·후레싱', parts: ['징크판넬', '지붕_징크판넬', '후레싱_차콜', '지붕_후레싱_차콜'],
            choices: pick(['다크그레이', '#4e4f51'], ['black', 'charcoal', 'gray', 'brown', 'green', 'red']) },
          { key: 'window', label: '창틀', parts: ['창호_외부프레임_블랙', '창호프레임', '창호케이싱'],
            choices: pick(['블랙', '#2f2f32'], ['charcoal', 'white', 'gray', 'brown']) },
          { key: 'steel', label: '포치 기둥·난간', parts: ['포치_기둥_다크그레이', '난간_차콜'],
            choices: pick(['다크그레이', '#414446'], ['black', 'charcoal', 'white', 'gray', 'bronze']) },
          { key: 'deck', label: '데크', parts: ['합성데크_X0', '합성데크_X1', '합성데크_X2', '합성데크_Y0', '합성데크_Y1', '합성데크_Y2'],
            choices: [{ id: 'orig', label: '그레이우드', swatch: '#8c8681' }, RM('teak', '티크', '#6b4a2f', '#b98a5c'),
              RM('brown', '브라운', '#3a2a1f', '#7a5b44'), RM('charcoal', '차콜', '#222222', '#4d4b48')] },
        ] },
      foundationHeight: 250,   // 블렌더 시뮬레이션 기준 바닥 높이(기초 블록 위 마루)
      // 2D 도면 — 시공 도면 기준: 외벽 280t · 칸막이 120t
      wallThickness: 280,
      wallThicknessInt: 120,
      rooms: [
        // 본채 9,000×7,000 (x 1500~10500). 치수는 벽 중심 기준(외벽 280·내벽 120) — 블렌더 모델 벽 위치 그대로
        //   가로: 280 | 2,200 | 120 | 4,600 | 120 | 1,400 | 280   세로(좌): 280 | 1,630 | 120 | 1,350 | 120 | 3,220 | 280
        // 주방을 먼저 그려야 2D에서 트인 면(점선)이 다용도실 벽 위에 덮이지 않음
        { key: 'kit',   type: 'kitchen',  name: '주방·식당', x: 4040, y: 0,    w: 4720, d: 3440, open: ['s', 'w', 'e'] },
        { key: 'util',  type: 'utility',  name: '다용도실',  x: 1500, y: 0,    w: 2540, d: 1970 },
        { key: 'ent',   type: 'entrance', name: '현관',      x: 1500, y: 1970, w: 1650, d: 1470 },
        { key: 'hallL', type: 'hall',     name: '복도',      x: 3150, y: 1970, w: 890,  d: 1470, open: ['e'] },
        { key: 'bath',  type: 'bath',     name: '욕실',      x: 8760, y: 0,    w: 1740, d: 2520 },
        { key: 'hallR', type: 'hall',     name: '복도',      x: 8760, y: 2520, w: 780,  d: 920,  open: ['w', 'e'] },
        { key: 'wash',  type: 'utility',  name: '세면',      x: 9540, y: 2520, w: 960,  d: 920,  open: ['w'] },
        // 전면(남) 밴드 — 방1 · 거실(북측 트임) · 방2
        { key: 'bed1',  type: 'bedroom',  name: '방1',       x: 1500, y: 3440, w: 2940, d: 3560 },
        { key: 'liv',   type: 'living',   name: '거실',      x: 4440, y: 3440, w: 3120, d: 3560, open: ['n'] },
        { key: 'bed2',  type: 'bedroom',  name: '방2',       x: 7560, y: 3440, w: 2940, d: 3560 },
        // 포치 7평(9,000×2,500, 낮은 외쪽지붕) · 데크(서측 1,500 폭, 본채 윗면~포치 끝, 주출입구)
        { key: 'porch', type: 'porch',    name: '포치(7평)', x: 1500, y: 7000, w: 9000, d: 2500, rail: ['s', 'e'], railColor: '#46494c', lights: true },
        { key: 'deck',  type: 'deck',     name: '데크(4평)', x: 0,    y: 0,    w: 1500, d: 9500, rail: ['w'], railColor: '#46494c' },
      ],
      openings: [
        // 후면(북) 창 — 다용도실 · 주방 · 욕실
        { roomKey: 'util',  side: 'n', pos: 1450, winType: 'double',    w: 750,  h: 600,  sill: 1040, color: '#2f2f32' },
        { roomKey: 'kit',   side: 'n', pos: 1610, winType: 'double',    w: 1600, h: 650,  sill: 1040, color: '#2f2f32' },
        { roomKey: 'bath',  side: 'n', pos: 540,  winType: 'double',    w: 750,  h: 600,  sill: 1540, color: '#2f2f32' },
        // 현관 단열문(데크 쪽) · 3연동 중문(현관 동측) · 다용도실·욕실 문
        { roomKey: 'ent',   side: 'w', pos: 830,  winType: 'door',       w: 900,  h: 2100, color: '#85878a' },
        { roomKey: 'ent',   side: 'e', pos: 735,  winType: 'glassSlide', w: 1350, h: 2100, color: '#2b2b2c' },
        { roomKey: 'util',  side: 's', pos: 2040, winType: 'swingDoor',  w: 800,  h: 2000, color: '#e3e3e2', flipH: true, flipV: true },
        { roomKey: 'bath',  side: 's', pos: 470,  winType: 'swingDoor',  w: 700,  h: 2000, color: '#e3e3e2', flipV: true },
        // 방 문
        { roomKey: 'bed1',  side: 'n', pos: 2340, winType: 'swingDoor', w: 900,  h: 2100, color: '#e3e3e2' },
        { roomKey: 'bed2',  side: 'n', pos: 650,  winType: 'swingDoor', w: 900,  h: 2100, color: '#e3e3e2', flipH: true },
        // 측면 이중창
        { roomKey: 'bed1',  side: 'w', pos: 1630, winType: 'double',    w: 1640, h: 1060, sill: 1040, color: '#2f2f32' },
        { roomKey: 'bed2',  side: 'e', pos: 1630, winType: 'double',    w: 1640, h: 1060, sill: 1040, color: '#2f2f32' },
        // 포치 쪽 — 방 창 · 거실 이중창(출입)
        { roomKey: 'bed1',  side: 's', pos: 1600, winType: 'double',    w: 1640, h: 1060, sill: 1040, color: '#2f2f32' },
        { roomKey: 'liv',   side: 's', pos: 1560, winType: 'double',    w: 2200, h: 2100, sill: 100,  color: '#2f2f32' },
        { roomKey: 'bed2',  side: 's', pos: 1340, winType: 'double',    w: 1640, h: 1060, sill: 1040, color: '#2f2f32' },
      ],
      // 3D 실물 모델(블렌더 시뮬레이션)의 가구 위치·크기 그대로
      furniture: [
        // 주방(북측) — 일자 하부장·싱크(창 아래) · 인덕션 · 렌지장 · 냉장고
        { catalogId: 'sink',       x: 5600, y: 600,  w: 3000, d: 620, rotation: 0 },
        { catalogId: 'induction',  x: 4650, y: 570,  w: 600,  d: 450, rotation: 0 },
        { catalogId: 'ktall',      x: 7400, y: 570,  w: 600,  d: 560, rotation: 0 },
        { catalogId: 'fridge',     x: 8230, y: 640,  w: 860,  d: 700, rotation: 0 },
        // 식당 — 식탁 + 벤치(북) + 의자 2(남)
        { catalogId: 'dining4',    x: 6350, y: 2200, w: 1360, d: 800, rotation: 0 },
        { catalogId: 'shelf',      x: 6350, y: 1460, w: 1300, d: 445, rotation: 0 },
        { catalogId: 'chair',      x: 6020, y: 2878, w: 442,  d: 468, rotation: 180 },
        { catalogId: 'chair',      x: 6680, y: 2878, w: 442,  d: 468, rotation: 180 },
        // 다용도실 — 세탁기 · 세면대
        { catalogId: 'washer',     x: 2125, y: 1570, w: 650,  d: 650, rotation: 90 },
        { catalogId: 'basin',      x: 2950, y: 520,  w: 520,  d: 460, rotation: 0 },
        // 욕실 — 세면대 · 양변기 / 세면 — 건식 세면대
        { catalogId: 'basin',      x: 9980, y: 1300, w: 520,  d: 460, rotation: 270 },
        { catalogId: 'toilet',     x: 9840, y: 2020, w: 400,  d: 740, rotation: 270 },
        { catalogId: 'shelf',      x: 9940, y: 2980, w: 790,  d: 480, rotation: 270 },
        // 거실 — 소파(서) · TV다이(동) · 실링팬
        { catalogId: 'sofa3',      x: 5010, y: 5125, w: 2170, d: 940, rotation: 270 },
        { catalogId: 'tvstand',    x: 7250, y: 5000, w: 2100, d: 420, rotation: 90 },
        { catalogId: 'ceilfan',    x: 6100, y: 4915, rotation: 0 },
        // 방 — 붙박이장(북) · 침대(머리 남쪽) · 협탁
        { catalogId: 'wardrobe',   x: 2533, y: 3800, w: 1494, d: 600, rotation: 180 },
        { catalogId: 'bedQ',       x: 2570, y: 5660, w: 1750, d: 2080, rotation: 180 },
        { catalogId: 'shelf',      x: 3590, y: 6460, w: 440,  d: 455, rotation: 180 },
        { catalogId: 'wardrobe',   x: 9465, y: 3800, w: 1494, d: 600, rotation: 180 },
        { catalogId: 'bedQ',       x: 9430, y: 5660, w: 1750, d: 2080, rotation: 180 },
        { catalogId: 'shelf',      x: 8390, y: 6460, w: 440,  d: 455, rotation: 180 },
      ],
    },
  },
  {
    // 세움 24평 — 대표님 블렌더 디테일 모델(가구·조명·소품 포함) 기준
    //  · 본채 12,080×7,080 (외벽 280 · 칸막이 120): 북측 욕실 / 다용도실(뒷문) / 주방·식당 / 드레스룸 / 부부욕실
    //    가운데 현관(3연동 중문)·복도, 남측 방1 · 거실(아트월·TV장) · 방2(드레스룸 연결)
    //  · 포치(남측 2,000) · 데크(서측 1,420, 계단) · 현관 캐노피
    id: 'seum-24',
    // 온라인 카탈로그(seum-catalog) 대표 사진·모델명
    photo: 'models/thumbs/seum-24.jpg', code: 'STAY24-WB',
    title: '세움 24평 (12,080×7,080) + 포치 · 데크',
    category: '주택',
    showroom: '본점',
    tags: ['세움도면', '24평', '12080x7080', '포치', '데크', '박공', '드레스룸', '욕실2'],
    base: {
      name: '세움 24평 (12,080×7,080)',
      productType: '주택',
      ceilingHeight: 2400,
      foundationHeight: 250,
      wallThickness: 280, wallThicknessInt: 120,
      exterior: { material: 'metalV', color: '#b8773e', corner: '#2f3237' },
      roof: { type: 'gable', color: '#4e4f51', ridge: 'x' },
      model3d: { url: 'models/seum-24.glb', fit: [13500, 9080], roofType: 'gable', ridge: 'x', label: '시뮬레이션', ownFurniture: true,
        optionSets: [
          { key: 'wall', label: '외장 (우드 사이딩)', parts: ['우드_메탈사이딩', '지붕_우드_메탈사이딩'],
            choices: [{ id: 'orig', label: '우드', swatch: '#b8773e' }, ...WALL_CHOICES.wood] },
          { key: 'accent', label: '포인트 (블랙 사이딩)', parts: ['24_블랙_메탈사이딩', '지붕_24_블랙_메탈사이딩'],
            choices: [{ id: 'orig', label: '블랙', swatch: '#2a2b2e' }, ...WALL_CHOICES.metal.filter((c) => c.id !== 'charcoal')] },
          { key: 'roof', label: '지붕 (징크)·후레싱', parts: ['징크판넬', '지붕_징크판넬', '후레싱_차콜', '지붕_후레싱_차콜'],
            choices: pick(['다크그레이', '#4e4f51'], ['black', 'charcoal', 'gray', 'brown', 'green', 'red']) },
          { key: 'window', label: '창틀', parts: ['창호_외부프레임_블랙', '창호프레임', '창호케이싱'],
            choices: pick(['블랙', '#2f2f32'], ['charcoal', 'white', 'gray', 'brown']) },
          { key: 'steel', label: '포치 기둥·난간', parts: ['24_블랙_무광', '지붕_24_블랙_무광'],
            choices: pick(['블랙', '#1f1f22'], ['charcoal', 'white', 'gray', 'bronze']) },
          { key: 'deck', label: '데크', parts: ['합성데크_X0', '합성데크_X1', '합성데크_X2', '합성데크_Y0', '합성데크_Y1', '합성데크_Y2'],
            choices: [{ id: 'orig', label: '그레이우드', swatch: '#8c8681' }, RM('teak', '티크', '#6b4a2f', '#b98a5c'),
              RM('brown', '브라운', '#3a2a1f', '#7a5b44'), RM('charcoal', '차콜', '#222222', '#4d4b48')] },
        ] },
      rooms: [
        // 본채 x 1,420~13,500 · y 0~7,080 (치수는 벽 중심 기준 — 블렌더 모델 벽 위치 그대로)
        // 트인 공간(주방·식당 · 복도 · 거실)을 먼저 그려야 2D에서 트인 면(점선)이 다른 방 벽을 덮지 않음
        { key: 'kit',   type: 'kitchen',  name: '주방·식당', x: 6760,  y: 0,    w: 4000, d: 3540, open: ['w', 's'] },
        { key: 'hall',  type: 'hall',     name: '복도',      x: 3360,  y: 1840, w: 3400, d: 1700, open: ['e', 's'] },
        { key: 'liv',   type: 'living',   name: '거실',      x: 5060,  y: 3540, w: 4300, d: 3540, open: ['n'] },
        { key: 'bath',  type: 'bath',     name: '욕실',      x: 1420,  y: 0,    w: 2840, d: 1840 },
        { key: 'util',  type: 'utility',  name: '다용도실',  x: 4260,  y: 0,    w: 2500, d: 1840 },
        { key: 'ent',   type: 'entrance', name: '현관',      x: 1420,  y: 1840, w: 1940, d: 1700 },
        { key: 'bath2', type: 'bath',     name: '부부욕실',  x: 10760, y: 0,    w: 2740, d: 1740 },
        { key: 'dress', type: 'utility',  name: '드레스룸',  x: 10760, y: 1740, w: 2740, d: 1800 },
        { key: 'bed1',  type: 'bedroom',  name: '방1',       x: 1420,  y: 3540, w: 3640, d: 3540 },
        { key: 'bed2',  type: 'bedroom',  name: '방2',       x: 9360,  y: 3540, w: 4140, d: 3540 },
        // 포치(남측 2,000) · 데크(서측 1,420, 남쪽 끝 계단)
        { key: 'porch', type: 'porch',    name: '포치',      x: 1420,  y: 7080, w: 12080, d: 2000, rail: ['s', 'e'], railColor: '#1f1f22', lights: true },
        { key: 'deck',  type: 'deck',     name: '데크',      x: 0,     y: 0,    w: 1420, d: 9080 },
      ],
      openings: [
        // 북측 — 다용도실 창 · 뒷문, 주방 창
        { roomKey: 'util',  side: 'n', pos: 800,  winType: 'double',    w: 600,  h: 600,  sill: 1600, color: '#2f2f32' },
        { roomKey: 'util',  side: 'n', pos: 1990, winType: 'door',      w: 900,  h: 2100, color: '#85878a', flipV: true },
        { roomKey: 'kit',   side: 'n', pos: 2740, winType: 'double',    w: 1200, h: 700,  sill: 1100, color: '#2f2f32' },
        // 서측 — 욕실 창 · 현관문(데크 쪽) · 방1 픽스창
        { roomKey: 'bath',  side: 'w', pos: 1200, winType: 'double',    w: 600,  h: 600,  sill: 1600, color: '#2f2f32' },
        { roomKey: 'ent',   side: 'w', pos: 1050, winType: 'door',      w: 900,  h: 2100, color: '#85878a' },
        { roomKey: 'bed1',  side: 'w', pos: 1690, winType: 'fixed',     w: 1500, h: 650,  sill: 1100, color: '#2f2f32' },
        // 동측 — 부부욕실 창 · 드레스룸 창 · 방2 픽스창
        { roomKey: 'bath2', side: 'e', pos: 1200, winType: 'double',    w: 600,  h: 600,  sill: 1600, color: '#2f2f32' },
        { roomKey: 'dress', side: 'e', pos: 890,  winType: 'double',    w: 600,  h: 600,  sill: 1600, color: '#2f2f32' },
        { roomKey: 'bed2',  side: 'e', pos: 1690, winType: 'fixed',     w: 1500, h: 650,  sill: 1100, color: '#2f2f32' },
        // 남측(포치 쪽) — 방1 창 · 거실 이중창 · 방2 창
        { roomKey: 'bed1',  side: 's', pos: 1950, winType: 'double',    w: 1500, h: 1100, sill: 1000, color: '#2f2f32' },
        { roomKey: 'liv',   side: 's', pos: 2160, winType: 'double',    w: 3300, h: 2100, sill: 100,  color: '#2f2f32' },
        { roomKey: 'bed2',  side: 's', pos: 2110, winType: 'double',    w: 1500, h: 1100, sill: 1000, color: '#2f2f32' },
        // 실내 문 — 3연동 중문 · 욕실 · 다용도실 · 방1 · 방2 · 부부욕실 · 드레스룸(개구부)
        { roomKey: 'ent',   side: 'e', pos: 855,  winType: 'glassSlide', w: 1350, h: 2100, color: '#2b2b2c' },
        { roomKey: 'bath',  side: 's', pos: 2300, winType: 'swingDoor', w: 700,  h: 2000, color: '#e3e3e2', flipH: true, flipV: true },
        { roomKey: 'util',  side: 's', pos: 1960, winType: 'swingDoor', w: 800,  h: 2000, color: '#e3e3e2', flipH: true, flipV: true },
        { roomKey: 'bed1',  side: 'n', pos: 3050, winType: 'swingDoor', w: 900,  h: 2100, color: '#e3e3e2', flipH: true },
        { roomKey: 'bed2',  side: 'n', pos: 560,  winType: 'swingDoor', w: 900,  h: 2100, color: '#e3e3e2' },
        { roomKey: 'bath2', side: 's', pos: 2010, winType: 'swingDoor', w: 700,  h: 2000, color: '#e3e3e2', flipH: true, flipV: true },
        { roomKey: 'bed2',  side: 'n', pos: 3360, winType: 'slideDoor', w: 1000, h: 2100, color: '#e3e3e2' },
      ],
      // 3D 실물 모델(블렌더 시뮬레이션)의 가구 위치·크기 그대로
      furniture: [
        // 주방(북측 일자) — 냉장고 · 하부장(인덕션·싱크) / 키큰장 · 렌지장(동측) / 식탁 + 의자 2 + 벤치
        { catalogId: 'fridge',    x: 7320,  y: 620,  w: 860,  d: 690, rotation: 0 },
        { catalogId: 'sink',      x: 9230,  y: 590,  w: 2940, d: 620, rotation: 0 },
        { catalogId: 'induction', x: 8370,  y: 630,  w: 580,  d: 400, rotation: 0 },
        { catalogId: 'ktall',     x: 9775,  y: 2522, w: 650,  d: 585, rotation: 0 },
        { catalogId: 'ktall',     x: 10400, y: 2510, w: 600,  d: 560, rotation: 0 },
        { catalogId: 'dining4',   x: 7320,  y: 2380, w: 1400, d: 800, rotation: 0 },
        { catalogId: 'chair',     x: 6990,  y: 1700, w: 442,  d: 468, rotation: 0 },
        { catalogId: 'chair',     x: 7650,  y: 1700, w: 442,  d: 468, rotation: 0 },
        { catalogId: 'shelf',     x: 7320,  y: 3150, w: 1300, d: 450, rotation: 180 },
        // 욕실 · 부부욕실 — 세면대 · 양변기 / 다용도실 — 세탁기 / 현관 — 신발장
        { catalogId: 'basin',     x: 2900,  y: 520,  w: 520,  d: 460, rotation: 0 },
        { catalogId: 'toilet',    x: 3750,  y: 656,  w: 410,  d: 740, rotation: 0 },
        { catalogId: 'basin',     x: 12030, y: 520,  w: 520,  d: 460, rotation: 0 },
        { catalogId: 'toilet',    x: 12750, y: 656,  w: 410,  d: 740, rotation: 0 },
        { catalogId: 'washer',    x: 4670,  y: 1445, w: 650,  d: 650, rotation: 180 },
        { catalogId: 'shelf',     x: 2463,  y: 2065, w: 1294, d: 330, rotation: 0 },
        // 거실 — TV장(아트월) · 3인 소파
        { catalogId: 'tvstand',   x: 5370,  y: 5140, w: 2100, d: 420, rotation: 270 },
        { catalogId: 'sofa3',     x: 8810,  y: 5135, w: 2190, d: 940, rotation: 90 },
        // 방1 — 붙박이장 · 침대(머리 서쪽) · 협탁 / 방2 — 침대(머리 동쪽) · 협탁 / 드레스룸 붙박이장
        { catalogId: 'wardrobe',  x: 2600,  y: 3905, w: 1800, d: 610, rotation: 0 },
        { catalogId: 'bedQ',      x: 2760,  y: 5530, w: 1680, d: 2080, rotation: 270 },
        { catalogId: 'shelf',     x: 1958,  y: 4460, w: 455,  d: 500, rotation: 270 },
        { catalogId: 'bedQ',      x: 12160, y: 5530, w: 1680, d: 2080, rotation: 90 },
        { catalogId: 'shelf',     x: 12962, y: 6600, w: 455,  d: 500, rotation: 90 },
        { catalogId: 'wardrobe',  x: 11125, y: 2630, w: 1660, d: 610, rotation: 270 },
      ],
    },
  },
];

// 템플릿 목록 (썸네일/표시용 메타)
export function listTemplates() {
  return T.map((t) => ({ id: t.id, title: t.title, tags: t.tags, category: t.category || '주택', showroom: t.showroom || null, real: !!(t.base && t.base.model3d),
    photo: t.photo || null, code: t.code || null, codeNote: t.codeNote || null }));
}

// 템플릿을 실제 편집 가능한 도면 객체로 인스턴스화 (새 id 부여)
//   base.floors 가 있으면 층별(1층·2층…) 도면 — 각 층의 rooms/openings/furniture 를 따로 만들고 1층을 활성으로
export function instantiateTemplate(id) {
  const t = T.find((x) => x.id === id);
  if (!t) return null;
  const b = t.base;
  const mkFloor = (src) => {
    const keyToId = {};
    const rooms = src.rooms.map((r) => {
      const nid = rid();
      keyToId[r.key] = nid;
      const room = { id: nid, type: r.type, name: r.name, x: r.x, y: r.y, w: r.w, d: r.d };
      if (Array.isArray(r.open) && r.open.length) room.open = r.open.slice(); // 개방형 면(벽 생략)
      // 선택 마감 옵션 — 난간(rail)·포치 조명(lights)·아트월(artWall)·색상 지정
      for (const k of ['rail', 'artWall']) if (Array.isArray(r[k]) && r[k].length) room[k] = r[k].slice();
      for (const k of ['lights', 'railColor', 'artColor', 'floorColor', 'deckDir', 'wallT']) if (r[k] != null) room[k] = r[k];
      return room;
    });
    const openings = (src.openings || []).map((o) => ({
      id: 'o' + Math.random().toString(36).slice(2, 9),
      roomId: keyToId[o.roomKey], side: o.side, pos: o.pos, winType: o.winType,
      w: o.w, h: o.h, sill: o.sill, color: o.color || '#4a5560',   // 템플릿에 명시하면 실제 치수·창틀색 사용
      ...(o.trim ? { trim: true } : {}),                            // 창 둘레 두꺼운 마감 몰딩
      ...(o.flipH ? { flipH: true } : {}), ...(o.flipV ? { flipV: true } : {}),   // 문 여는 방향(경첩 좌우·안/밖)
    })).map((o) => fillWin(o));
    // 가구: 위치·회전 + (있으면) 설치 높이·색·크기
    const furniture = (src.furniture || []).map((f) => {
      const o = { id: fid(), catalogId: f.catalogId, x: f.x, y: f.y, rotation: f.rotation || 0 };
      for (const k of ['elev', 'color', 'w', 'd', 'h']) if (f[k] != null) o[k] = f[k];
      return o;
    });
    fitFurnitureInRooms(rooms, furniture, b);
    return { name: src.name, rooms, openings, furniture, outline: null };
  };
  const floors = (b.floors || [b]).map((f, i) => ({ ...mkFloor(f), name: f.name || (i + 1) + '층' }));
  const design = normalize({
    name: b.name,
    productType: b.productType || '',
    ceilingHeight: b.ceilingHeight,
    ...(b.foundationHeight ? { foundationHeight: b.foundationHeight } : {}),   // 기초 높이
    ...(b.wallThickness ? { wallThickness: b.wallThickness } : {}),             // 2D 도면 외벽 두께
    ...(b.wallThicknessInt ? { wallThicknessInt: b.wallThicknessInt } : {}),   // 2D 도면 칸막이 두께
    exterior: { ...b.exterior },
    roof: { ...b.roof },
    ...(b.model3d ? { model3d: JSON.parse(JSON.stringify(b.model3d)) } : {}),   // 3D 실물 모델(블렌더 GLB)
    rooms: floors[0].rooms, openings: floors[0].openings, furniture: floors[0].furniture,
    ...(floors.length > 1 ? { floors, activeFloor: 0 } : {}),
  });
  if (design.model3d) {
    design.model3d.sig = model3dSig(design);   // 원래 창·문 배치 기억 → 바꾸면 자동 모델
    // 모델에 가구가 이미 있는 제품: 도면 기본 가구는 3D에서 숨김 (상담 중 새로 추가한 가구만 3D에 표시)
    if (design.model3d.ownFurniture) design.model3d.baseFurn = design.floors.flatMap((f) => f.furniture.map((x) => x.id));
  }
  return design;
}

// 같은 제품의 형태 묶음(예: 쌍둥이 기본형·ㄱ자형·2층형) — 3D 제품 패널의 '형태' 선택·3종 동시 보기에 사용
export function familyVariants(family) {
  if (!family) return [];
  return T.filter((t) => t.base.model3d && t.base.model3d.family === family)
    .map((t) => ({ id: t.id, variant: t.base.model3d.variant || t.title, summary: t.base.model3d.summary || '' }));
}

// 가구가 벽을 뚫지 않게 — 놓인 방의 벽 안쪽(2D 도면 벽 두께 기준)으로 밀어 넣고, 넘치면 그 방향 크기를 줄임
//   외벽 = 방별 wallT 또는 설계 외벽 두께(안쪽으로 들어감) / 칸막이 = 두께 절반 / 개방면 = 0
//   벽에 거는 소품(wallMount)·데크·포치 위 가구는 그대로
export function fitFurnitureInRooms(rooms, furniture, opt = {}) {
  const T = opt.wallThickness || 150;
  const TI = opt.wallThicknessInt || Math.max(80, Math.min(150, Math.round(T * 0.45 / 10) * 10));
  const indoor = rooms.filter((r) => !OPEN_ROOM_TYPES.includes(r.type));
  const inRoom = (px, py, self) => indoor.find((q) => q !== self && px > q.x && px < q.x + q.w && py > q.y && py < q.y + q.d);
  const moved = [];
  for (const f of furniture) {
    const c = FURNITURE_CATALOG.find((k) => k.id === f.catalogId);
    if (!c || c.wallMount) continue;
    const r = indoor.find((q) => f.x >= q.x && f.x <= q.x + q.w && f.y >= q.y && f.y <= q.y + q.d);
    if (!r) continue;
    const open = Array.isArray(r.open) ? r.open : [];
    const inset = (side, px, py) => open.includes(side) ? 0 : (inRoom(px, py, r) ? TI / 2 : (r.wallT || T));
    const rot = ((Math.round(f.rotation || 0) % 360) + 360) % 360, sw = rot === 90 || rot === 270;
    let w = f.w != null ? f.w : c.w, d = f.d != null ? f.d : c.d;
    let ex = sw ? d : w, ey = sw ? w : d;   // 도면상 가로·세로 크기
    const x0 = r.x + inset('w', r.x - 60, f.y), x1 = r.x + r.w - inset('e', r.x + r.w + 60, f.y);
    const y0 = r.y + inset('n', f.x, r.y - 60), y1 = r.y + r.d - inset('s', f.x, r.y + r.d + 60);
    const before = [f.x, f.y, ex, ey];
    if (ex > x1 - x0) ex = x1 - x0;
    if (ey > y1 - y0) ey = y1 - y0;
    f.x = Math.min(Math.max(f.x, x0 + ex / 2), x1 - ex / 2);
    f.y = Math.min(Math.max(f.y, y0 + ey / 2), y1 - ey / 2);
    if (ex !== before[2] || ey !== before[3]) { if (sw) { f.d = ex; f.w = ey; } else { f.w = ex; f.d = ey; } }
    if (f.x !== before[0] || f.y !== before[1] || ex !== before[2] || ey !== before[3]) moved.push({ f, before });
  }
  return moved;
}

// 창호 기본 치수 채우기 (템플릿에 명시한 w/h/sill 우선, 없으면 WINDOW_TYPES 기본값)
function fillWin(o) {
  const t = WINDOW_TYPES[o.winType] || WINDOW_TYPES.double;
  return { ...o, w: o.w != null ? o.w : t.w, h: o.h != null ? o.h : t.h, sill: o.sill != null ? o.sill : t.sill };
}
