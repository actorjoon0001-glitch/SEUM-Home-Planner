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

// 입력 다듬기 — '번지'·쉼표·여러 칸 공백 정리, '산 12' → '산12'
function tidy(addr) {
  return String(addr || '').replace(/번지/g, ' ').replace(/[,()]/g, ' ').replace(/산\s+(\d)/g, '산$1').replace(/\s+/g, ' ').trim();
}
// 주소 → 좌표
//   1) 정확한 주소 변환(지번 → 도로명) 2) 통합검색(지번·도로명 주소 → 장소 이름) — 시·도를 빼거나 일부만 넣어도 찾음
export async function geocode(addr) {
  const key = vworldKey();
  if (!key) throw new Error('VWorld 키가 설정되지 않았습니다 (config.js)');
  const q = tidy(addr);
  const tried = [];
  for (const type of ['PARCEL', 'ROAD']) {
    const url = `https://api.vworld.kr/req/address?service=address&request=getcoord&version=2.0&crs=EPSG:4326&format=json&refine=true&simple=false&type=${type}&key=${key}${domainQ()}&address=${encodeURIComponent(q)}`;
    const j = await jsonp(url);
    const r = j && j.response;
    if (r && r.status === 'OK' && r.result && r.result.point) {
      const refined = (r.refined && r.refined.text) || q;
      return { lng: +r.result.point.x, lat: +r.result.point.y, addr: refined };
    }
    if (r && r.status === 'ERROR') throw new Error('VWorld 오류: ' + ((r.error && (r.error.text || r.error.code)) || '알 수 없음'));
    tried.push(`${type === 'PARCEL' ? '지번' : '도로명'}:${(r && r.status) || '응답없음'}`);
  }
  const searches = [['address', 'parcel', '지번검색'], ['address', 'road', '도로명검색'], ['place', '', '장소검색']];
  for (const [type, cat, label] of searches) {
    const url = `https://api.vworld.kr/req/search?service=search&request=search&version=2.0&crs=EPSG:4326&size=5&page=1&format=json&type=${type}${cat ? `&category=${cat}` : ''}&key=${key}${domainQ()}&query=${encodeURIComponent(q)}`;
    let r = null;
    try { const j = await jsonp(url); r = j && j.response; } catch (e) { tried.push(`${label}:${e.message}`); continue; }
    const items = (r && r.status === 'OK' && r.result && r.result.items) || [];
    if (items.length && items[0].point) {
      const it = items[0], ad = it.address || {};
      const name = ad.parcel || ad.road || it.title || q;
      return { lng: +it.point.x, lat: +it.point.y, addr: name, others: items.slice(1).map((x) => (x.address && (x.address.parcel || x.address.road)) || x.title).filter(Boolean) };
    }
    if (r && r.status === 'ERROR') tried.push(`${label}:오류(${(r.error && (r.error.text || r.error.code)) || ''})`);
    else tried.push(`${label}:${(r && r.status) || '응답없음'}`);
  }
  throw new Error(`주소를 찾지 못했습니다. 시·군·읍면·리와 지번을 넣어 보세요 (예: 김포시 통진읍 마송리 123-4)\n\n입력: ${q}\n시도: ${tried.join(' · ')}`);
}

// 연속지적도(필지) — POINT 또는 BOX 로 조회. 반환 [{ jibun, addr, pnu, jiga, rings:[[ [lng,lat], … ]] }]
async function features(data, geomFilter, size = 1000) {
  const key = vworldKey();
  const url = `https://api.vworld.kr/req/data?service=data&request=GetFeature&version=2.0&data=${data}&format=json&geometry=true&attribute=true&crs=EPSG:4326&size=${size}&key=${key}${domainQ()}&geomFilter=${encodeURIComponent(geomFilter)}`;
  const j = await jsonp(url);
  const r = j && j.response;
  if (!r || r.status !== 'OK') return [];
  const feats = (r.result && r.result.featureCollection && r.result.featureCollection.features) || [];
  return feats.map((f) => {
    const g = f.geometry || {};
    const polys = g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : [];
    return { p: f.properties || {}, rings: polys.map((pl) => pl[0]).filter(Boolean) };
  });
}
async function parcels(geomFilter, size = 1000) {
  return (await features('LP_PA_CBND_BUBUN', geomFilter, size)).map(({ p, rings }) =>
    ({ jibun: p.jibun || '', addr: p.addr || '', pnu: p.pnu || '', jiga: p.jiga || '', rings }));
}
// 주변 건물 (도로명주소 건물) — 지상 층수로 높이 어림
async function buildings(geomFilter) {
  return (await features('LT_C_SPBD', geomFilter, 1000)).map(({ p, rings }) => {
    const fl = +(p.gro_flo_co || p.grnd_flr || p.ground_floor || 0);
    return { floors: fl > 0 ? Math.min(fl, 40) : 1, name: p.buld_nm || p.bd_nm || '', rings };
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
// 위성 타일을 이어 붙여 cx,cy(줌19 전역 픽셀) 중심의 SIZE×SIZE 캔버스
//   zs: 타일 줌(19 미만이면 확대해 채움) · 타일 몇 장이 빠져도(85% 이상 성공) 사용
async function stitch(cx, cy, urlOf, zs) {
  const cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#6f7a5e'; ctx.fillRect(0, 0, SIZE, SIZE);
  const f = 2 ** (ZOOM - zs), T = TILE * f;
  const x0 = cx - SIZE / 2, y0 = cy - SIZE / 2;
  const jobs = [];
  let ok = 0, total = 0;
  const tryLoad = async (u) => { try { return await loadImg(u); } catch { return loadImg(u + (u.includes('?') ? '&' : '?') + 'r=1'); } };
  for (let ty = Math.floor(y0 / T); ty <= Math.floor((y0 + SIZE) / T); ty++) {
    for (let tx = Math.floor(x0 / T); tx <= Math.floor((x0 + SIZE) / T); tx++) {
      total++;
      jobs.push(tryLoad(urlOf(zs, tx, ty)).then((im) => { ctx.drawImage(im, tx * T - x0, ty * T - y0, T, T); ok++; }, () => {}));
    }
  }
  await Promise.all(jobs);
  if (ok < total * 0.85) throw new Error(`타일 ${total - ok}/${total}장 실패`);
  ctx.getImageData(0, 0, 1, 1);   // 교차출처 오염(taint)되면 여기서 예외 → 다른 소스로
  // 사진이 아니라 한 가지 색(오류·'자료 없음' 타일)이면 실패로 보고 다음 소스로
  const sm = document.createElement('canvas'); sm.width = sm.height = 48;
  const sx = sm.getContext('2d', { willReadFrequently: true }); sx.drawImage(cv, 0, 0, 48, 48);
  const px = sx.getImageData(0, 0, 48, 48).data; let m = 0, m2 = 0; const N = px.length / 4;
  for (let i = 0; i < px.length; i += 4) { const L = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11; m += L; m2 += L * L; }
  const sd = Math.sqrt(Math.max(0, m2 / N - (m / N) ** 2));
  if (sd < 7) throw new Error(`사진 대신 빈 타일(단색) — 해당 지역 자료 없음 또는 키 권한 문제`);
  return cv;
}
// VWorld 타일이 왜 안 되는지 한 장으로 확인 (CORS 차단 / HTTP 상태)
async function probe(url) {
  try { const r = await fetch(url, { mode: 'cors' }); return r.ok ? `HTTP ${r.status}(이미지 처리 실패)` : `HTTP ${r.status}`; }
  catch { return 'CORS/네트워크 차단'; }
}
// 선명도 — 밝기 라플라시안 평균(2px 간격). 낮은 해상도를 늘려 붙인 흐린 사진은 값이 작음
function sharpness(cv) {
  const W = cv.width, H = cv.height, d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const L = (x, y) => { const i = (y * W + x) * 4; return d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; };
  let sum = 0, n = 0;
  for (let y = 2; y < H - 2; y += 2) for (let x = 2; x < W - 2; x += 2) { sum += Math.abs(4 * L(x, y) - L(x - 1, y) - L(x + 1, y) - L(x, y - 1) - L(x, y + 1)); n++; }
  return n ? sum / n : 0;
}
// 위성 사진 — VWorld·Esri 를 함께 받아 더 또렷한 쪽을 씀 (지역마다 어느 쪽이 좋은지 다름)
async function satellite(cx, cy) {
  const key = vworldKey();
  const vw = (z, x, y) => `https://api.vworld.kr/req/wmts/1.0.0/${key}/Satellite/${z}/${y}/${x}.jpeg`;
  const esri = (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  const notes = [];
  const get = async (name, url, z) => {
    try { const canvas = await stitch(cx, cy, url, z); return { canvas, source: name, zoom: z, sharp: sharpness(canvas) }; }
    catch (e) {
      let why = e.message;
      if (name === 'VWorld' && z === 19) why += ' / ' + await probe(vw(19, Math.floor(cx / TILE), Math.floor(cy / TILE)));
      notes.push(`${name}${z}: ${why}`); return null;
    }
  };
  // 1차: VWorld 19 · Esri 19 동시에
  let got = (await Promise.all([key ? get('VWorld', vw, 19) : null, get('Esri', esri, 19)])).filter(Boolean);
  // 둘 다 실패하면 한 단계 낮은 줌
  if (!got.length) got = (await Promise.all([key ? get('VWorld', vw, 18) : null, get('Esri', esri, 18)])).filter(Boolean);
  if (!got.length) throw new Error('위성 사진을 불러오지 못했습니다 (' + notes.join(' · ') + ')');
  got.sort((p, q) => q.sharp - p.sharp);
  const best = got[0];
  for (const o of got.slice(1)) notes.push(`${o.source}${o.zoom}: 덜 또렷함(${o.sharp.toFixed(1)} < ${best.sharp.toFixed(1)})`);
  return { canvas: best.canvas, source: best.source, zoom: best.zoom, note: notes.join(' · ') };
}

// 언샤프 마스크(3×3) — amount 0~1
function sharpen(cv, amount) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  const src = ctx.getImageData(0, 0, W, H), d = src.data, out = new Uint8ClampedArray(d);
  const k = amount;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v = d[i + c] * (1 + 4 * k) - k * (d[i - 4 + c] + d[i + 4 + c] + d[i - W * 4 + c] + d[i + W * 4 + c]);
        out[i + c] = v;
      }
    }
  }
  src.data.set(out); ctx.putImageData(src, 0, 0);
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
  const { canvas, source, zoom, note } = await satellite(cx, cy);
  sharpen(canvas, 0.55);   // 위성 사진을 살짝 또렷하게 (확대해 볼 때 덜 뭉개지게) — 선·글씨 그리기 전에
  // 이웃 필지·주변 건물 — 사진에 그리지 않고 3D 로 따로 (확대해도 선·글씨가 또렷하게)
  const [w, n] = fromPx(cx - SIZE / 2, cy - SIZE / 2, ZOOM), [e, s] = fromPx(cx + SIZE / 2, cy + SIZE / 2, ZOOM);
  const box = `BOX(${w},${s},${e},${n})`;
  onStep('주변 필지·건물 확인 중…');
  const [neighbors, blds] = await Promise.all([parcels(box, 1000).catch(() => []), buildings(box).catch(() => [])]);
  const ctx = canvas.getContext('2d');
  const res = 156543.03392 * Math.cos(clat * Math.PI / 180) / 2 ** ZOOM;   // m/픽셀
  // 위경도 → 사진 중심 기준 mm (x 동쪽+, y 남쪽+ = 도면 좌표와 같은 방향)
  const MM = ([lng, lat]) => { const [x, y] = toPx(lng, lat, ZOOM); return [Math.round((x - cx) * res * 1000), Math.round((y - cy) * res * 1000)]; };
  const R = SIZE / 2 * res * 1000;
  const inView = (ring) => ring.some(([x, y]) => Math.abs(x) < R && Math.abs(y) < R);
  const vec = { target: [], others: [], labels: [], buildings: [] };
  let parcel = null;
  if (target) {
    vec.target = target.rings.map((r) => r.map(MM));
    const area = target.rings.reduce((a, r) => a + ringArea(r), 0);
    parcel = { jibun: target.jibun, addr: target.addr, pnu: target.pnu, jiga: target.jiga, areaM2: Math.round(area) };
  }
  for (const f of neighbors) {
    if (target && f.pnu && f.pnu === target.pnu) continue;
    const rings = f.rings.map((r) => r.map(MM)).filter(inView);
    if (!rings.length) continue;
    vec.others.push(...rings);
    if (f.jibun) { const c = centroid(rings[0]); vec.labels.push({ t: f.jibun, x: Math.round(c[0]), y: Math.round(c[1]) }); }
  }
  for (const bd of blds) {
    const rings = bd.rings.map((r) => r.map(MM)).filter(inView);
    if (rings.length) vec.buildings.push({ f: bd.floors, r: rings[0] });
  }
  // 출처 표기 (사진 구석)
  ctx.font = '11px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(source === 'Esri' ? '위성: Esri, Maxar · 지적: 국토교통부 VWorld' : '위성·지적: 국토교통부 VWorld', SIZE - 8, SIZE - 6);
  return {
    image: canvas.toDataURL('image/jpeg', 0.92), widthM: Math.round(res * SIZE * 10) / 10, aspect: 1,
    addr: parcel && parcel.addr ? parcel.addr : g.addr, parcel, vec, lng: clng, lat: clat, source, srcZoom: zoom, srcNote: note || '', rot: 0, dx: 0, dy: 0,
  };
}
