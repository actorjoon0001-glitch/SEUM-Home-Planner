// 온라인 카탈로그(seum-catalog) 공용 연결 — 360 사진(pano.js) · 실제 취급 외장재(catalogMats.js)
//   카탈로그 Supabase 의 공개(anon) 읽기 키 — 카탈로그 사이트(js/supabase-config.js)에 이미 공개된 키
export const CATALOG_URL = 'https://aypugjvzvwinnmpquguj.supabase.co';
export const CATALOG_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5cHVnanZ6dndpbm5tcHF1Z3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjQ0ODIsImV4cCI6MjA4OTE0MDQ4Mn0.yLBG31-8VGWai9Rpv9RtVxZwwWMsKI_syGs0QN7PkUU';

// 카탈로그 REST 읽기 (6초 넘으면 포기)
export function catalogGet(path) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => { try { ctl && ctl.abort(); } catch { /* noop */ } }, 6000);
  return fetch(`${CATALOG_URL}/rest/v1/${path}`, {
    headers: { apikey: CATALOG_KEY, Authorization: `Bearer ${CATALOG_KEY}` },
    signal: ctl ? ctl.signal : undefined,
  }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
    .finally(() => clearTimeout(timer));
}

// 카탈로그 저장소 사진 → 작은 미리보기(Supabase 이미지 변환)
export function catalogThumb(url, w = 240, h = 120) {
  const m = /\/storage\/v1\/object\/public\/(.+)$/.exec(url || '');
  return m ? `${CATALOG_URL}/storage/v1/render/image/public/${m[1]}?width=${w}&height=${h}&resize=cover&quality=60` : url;
}

// 전시장 목록(카탈로그 표시 순서) + 모델명 → 전시 중인 전시장들
//   { order: ['김포 본사전시장', …], byCode: { 'STAY19-BK': ['김포 본사전시장'] } } · 실패하면 null
let _rooms = null, _roomsLoading = null;
export function loadCatalogShowrooms(force) {
  if (_rooms && !force) return Promise.resolve(_rooms);
  if (_roomsLoading && !force) return _roomsLoading;
  _roomsLoading = Promise.all([
    catalogGet('showrooms?select=name,display_order,is_active&order=display_order.asc'),
    catalogGet('models?select=name,showrooms'),
  ]).then(([srs, models]) => {
    const order = (srs || []).filter((s) => s && s.name && s.is_active !== false).map((s) => s.name.trim());
    const byCode = {};
    for (const m of models || []) {
      const code = String(m.name || '').trim().toUpperCase(); if (!code) continue;
      const set = byCode[code] || (byCode[code] = []);
      for (const r of Array.isArray(m.showrooms) ? m.showrooms : []) { const n = String(r || '').trim(); if (n && !set.includes(n)) set.push(n); }
    }
    _rooms = { order, byCode };
    return _rooms;
  }).catch(() => null).finally(() => { _roomsLoading = null; });
  return _roomsLoading;
}
// 예전 전시장 이름 → 카탈로그 전시장 이름
export const LEGACY_ROOM = { '본점': '김포 본사전시장', '본사': '김포 본사전시장', '본사전시장': '김포 본사전시장' };
