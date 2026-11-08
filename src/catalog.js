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
