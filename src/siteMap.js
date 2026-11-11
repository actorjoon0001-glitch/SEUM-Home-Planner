// 🛰️ 부지(땅) 불러오기 — 지번 주소 → 위성 사진 + 지적도(필지 경계)를 3D 바닥에 깔기
//   · 서버(프록시) 없이 고객 브라우저에서 바로 호출 — VWorld 는 해외 서버를 막지만 한국에서 여는 브라우저는 통과
//   · 주소·필지: VWorld 오픈API (JSONP)
//   · 위성 사진: VWorld 위성 타일 → 안 되면 Esri 세계 위성 타일로 대신
//   · 필지 경계(빨강) + 이웃 필지 선(흰색) + 지번을 사진에 그려 넣어, 고객이 "내 땅"을 바로 확인

const ZOOM = 19;          // 약 0.24m/픽셀 (위도 37° 기준)
const SIZE = 1280;        // 결과 사진 한 변(px) → 약 300m 범위
const TILE = 256;

function vworldKey() { return (window.SEUM_CONFIG && window.SEUM_CONFIG.vworldKey) || ''; }

// JSONP 호출 (VWorld 는 브라우저 fetch 를 CORS 로 막지만 JSONP 는 허용)
let _jp = 0;
function jsonp(url, timeoutMs = 9000) {
  return new Promise((resolve, reject) => {
    const cb = `__seumVw${Date.now().toString(36)}${_jp++}`;
    const s = document.createElement('script');
    const done = (fn, v) => { clearTimeout(t); try { delete window[cb]; } catch { window[cb] = undefined; } s.remove(); fn(v); };
    const t = setTimeout(() => done(reject, new Error('VWorld 응답이 없습니다 (인터넷 연결 확인)')), timeoutMs);
    window[cb] = (data) => done(resolve, data);
    s.onerror = () => done(reject, new Error('VWorld 에 연결하지 못했습니다'));
    s.src = `${url}${url.includes('?') ? '&' : '?'}callback=${cb}`;
    document.head.appendChild(s);
  });
}
const domainQ = () => `&domain=${encodeURIComponent(location.origin)}`;

// 주소 → 좌표 (지번 먼저, 안 되면 도로명)
export async function geocode(addr) {
  const key = vworldKey();
  if (!key) throw new Error('VWorld 키가 설정되지 않았습니다 (config.js)');
  for (const type of ['PARCEL', 'ROAD']) {
    const url = `https://api.vworld.kr/req/address?service=address&request=getcoord&version=2.0&crs=EPSG:4326&format=json&refine=true&simple=false&type=${type}&key=${key}${domainQ()}&address=${encodeURIComponent(addr)}`;
    const j = await jsonp(url);
    const r = j && j.response;
    if (r && r.status === 'OK' && r.result && r.result.point) {
      const refined = (r.refined && r.refined.text) || addr;
      return { lng: +r.result.point.x, lat: +r.result.point.y, addr: refined };
    }
    if (r && r.status === 'ERROR') throw new Error('VWorld 오류: ' + ((r.error && (r.error.text || r.error.code)) || '알 수 없음'));
  }
  throw new Error('주소를 찾지 못했습니다. 지번까지 넣어 보세요 (예: ○○군 ○○면 ○○리 123-4)');
}

// 연속지적도(필지) — POINT 또는 BOX 로 조회. 반환 [{ jibun, addr, pnu, jiga, rings:[[ [lng,lat], … ]] }]
async function parcels(geomFilter, size = 1000) {
  const key = vworldKey();
  const url = `https://api.vworld.kr/req/data?service=data&request=GetFeature&version=2.0&data=LP_PA_CBND_BUBUN&format=json&geometry=true&attribute=true&crs=EPSG:4326&size=${size}&key=${key}${domainQ()}&geomFilter=${encodeURIComponent(geomFilter)}`;
  const j = await jsonp(url);
  const r = j && j.response;
  if (!r || r.status !== 'OK') return [];
  const feats = (r.result && r.result.featureCollection && r.result.featureCollection.features) || [];
  return feats.map((f) => {
    const p = f.properties || {}, g = f.geometry || {};
    const polys = g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : [];
    return { jibun: p.jibun || '', addr: p.addr || '', pnu: p.pnu || '', jiga: p.jiga || '', rings: polys.map((pl) => pl[0]).filter(Boolean) };
  });
}

// 위경도 → 웹메르카토르 전역 픽셀 (zoom)
const toPx = (lng, lat, z) => {
  const n = TILE * 2 ** z, s = Math.sin(lat * Math.PI / 180);
  return [(lng + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
};
const fromPx = (x, y, z) => {
  const n = TILE * 2 ** z, lng = x / n * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
  return [lng, lat];
};

function loadImg(src) {
  return new Promise((ok, no) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => ok(im); im.onerror = () => no(new Error('tile')); im.src = src; });
}
// 위성 타일을 이어 붙여 cx,cy(전역 픽셀) 중심의 SIZE×SIZE 캔버스
async function stitch(cx, cy, urlOf) {
  const cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
  const ctx = cv.getContext('2d');
  const x0 = cx - SIZE / 2, y0 = cy - SIZE / 2;
  const jobs = [];
  for (let ty = Math.floor(y0 / TILE); ty <= Math.floor((y0 + SIZE) / TILE); ty++) {
    for (let tx = Math.floor(x0 / TILE); tx <= Math.floor((x0 + SIZE) / TILE); tx++) {
      jobs.push(loadImg(urlOf(ZOOM, tx, ty)).then((im) => ctx.drawImage(im, tx * TILE - x0, ty * TILE - y0, TILE, TILE)));
    }
  }
  await Promise.all(jobs);
  cv.getContext('2d').getImageData(0, 0, 1, 1);   // 교차출처 오염(taint)되면 여기서 예외 → 다른 소스로
  return cv;
}
async function satellite(cx, cy) {
  const key = vworldKey();
  const sources = [
    key && { name: 'VWorld', url: (z, x, y) => `https://api.vworld.kr/req/wmts/1.0.0/${key}/Satellite/${z}/${y}/${x}.jpeg` },
    { name: 'Esri', url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}` },
  ].filter(Boolean);
  let last = null;
  for (const s of sources) {
    try { return { canvas: await stitch(cx, cy, s.url), source: s.name }; } catch (e) { last = e; }
  }
  throw new Error('위성 사진을 불러오지 못했습니다' + (last ? ` (${last.message})` : ''));
}

// 필지 면적(m²) — 작은 범위라 평면 근사
function ringArea(ring) {
  if (!ring || ring.length < 3) return 0;
  const lat0 = ring[0][1] * Math.PI / 180, R = 6378137;
  const xy = ring.map(([lng, lat]) => [lng * Math.PI / 180 * R * Math.cos(lat0), lat * Math.PI / 180 * R]);
  let a = 0; for (let i = 0; i < xy.length; i++) { const p = xy[i], q = xy[(i + 1) % xy.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a) / 2;
}
const centroid = (ring) => { let x = 0, y = 0; for (const [a, b] of ring) { x += a; y += b; } return [x / ring.length, y / ring.length]; };

// 지번 주소로 부지 불러오기 → { image, widthM, aspect, addr, parcel, lng, lat, source }
export async function fetchSite(addr, onStep = () => {}) {
  onStep('주소 찾는 중…');
  const g = await geocode(addr);
  onStep('필지(지번) 확인 중…');
  let target = null;
  try { target = (await parcels(`POINT(${g.lng} ${g.lat})`, 10))[0] || null; } catch { /* 지적도 없이 진행 */ }
  // 사진 중심 = 필지 중심 (없으면 주소 좌표)
  const [clng, clat] = target && target.rings[0] ? centroid(target.rings[0]) : [g.lng, g.lat];
  const [cx, cy] = toPx(clng, clat, ZOOM);
  onStep('위성 사진 받는 중…');
  const { canvas, source } = await satellite(cx, cy);
  // 이웃 필지 선 + 내 필지 강조
  let neighbors = [];
  try {
    const [w, n] = fromPx(cx - SIZE / 2, cy - SIZE / 2, ZOOM), [e, s] = fromPx(cx + SIZE / 2, cy + SIZE / 2, ZOOM);
    neighbors = await parcels(`BOX(${w},${s},${e},${n})`, 1000);
  } catch { /* 이웃 선 없이 */ }
  const ctx = canvas.getContext('2d');
  const P = ([lng, lat]) => { const [x, y] = toPx(lng, lat, ZOOM); return [x - (cx - SIZE / 2), y - (cy - SIZE / 2)]; };
  const path = (ring) => { ctx.beginPath(); ring.forEach((pt, i) => { const [x, y] = P(pt); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); };
  ctx.lineJoin = 'round';
  for (const f of neighbors) {
    if (target && f.pnu && f.pnu === target.pnu) continue;
    for (const ring of f.rings) { path(ring); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.6; ctx.stroke(); }
    const r0 = f.rings[0]; if (!r0) continue;
    const [lx, ly] = P(centroid(r0));
    if (lx > 0 && ly > 0 && lx < SIZE && ly < SIZE && f.jibun) {
      ctx.font = '600 13px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(f.jibun, lx, ly);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(f.jibun, lx, ly);
    }
  }
  let parcel = null;
  if (target) {
    for (const ring of target.rings) {
      path(ring); ctx.fillStyle = 'rgba(255,214,0,0.12)'; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = '#ffd600'; ctx.lineWidth = 4; ctx.stroke();
    }
    const area = target.rings.reduce((a, r) => a + ringArea(r), 0);
    parcel = { jibun: target.jibun, addr: target.addr, pnu: target.pnu, jiga: target.jiga, areaM2: Math.round(area) };
    const [lx, ly] = P(centroid(target.rings[0]));
    const label = `${target.jibun}  ${Math.round(area).toLocaleString()}㎡ (${(area / 3.305785).toFixed(0)}평)`;
    ctx.font = '800 20px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width + 20;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(lx - tw / 2, ly - SIZE * 0.06 - 16, tw, 32);
    ctx.fillStyle = '#ffd600'; ctx.fillText(label, lx, ly - SIZE * 0.06);
  }
  // 출처 표기 (사진 구석)
  ctx.font = '11px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(source === 'Esri' ? '위성: Esri, Maxar · 지적: 국토교통부 VWorld' : '위성·지적: 국토교통부 VWorld', SIZE - 8, SIZE - 6);
  const res = 156543.03392 * Math.cos(clat * Math.PI / 180) / 2 ** ZOOM;   // m/픽셀
  return {
    image: canvas.toDataURL('image/jpeg', 0.88), widthM: Math.round(res * SIZE * 10) / 10, aspect: 1,
    addr: parcel && parcel.addr ? parcel.addr : g.addr, parcel, lng: clng, lat: clat, source, rot: 0, dx: 0, dy: 0,
  };
}
