// 세움 홈플래너 — ✨ AI 실사 변환 프록시
//   브라우저(사진급 렌더 창) → 이 함수 → 이미지 AI(image-to-image) → 실사 이미지 반환.
//   API 키는 서버(환경변수)에만 두고 프론트에 절대 노출하지 않는다.
//
//   설정(Netlify → Site settings → Environment variables):
//     [힉스필드 — 권장: Nano Banana 가 건물 형태 보존 img2img 에 적합]
//       · HIGGSFIELD_KEY_ID / HIGGSFIELD_KEY_SECRET   (필수)
//       · HIGGSFIELD_ENDPOINT   (선택) 제출 엔드포인트 전체 URL.
//                               미설정 시 기본값 사용. 힉스필드 콘솔의 모델 'API' 탭에
//                               표시된 submit 경로와 다르면 이 값으로 덮어쓰세요.
//       · HIGGSFIELD_IMAGE_URL  (선택) 입력 이미지 전송 방식: 'data'(기본, base64 data URL)
//                               또는 콘솔 규격에 맞춘 필드. (API가 base64를 거부하면 알려주세요 — 업로드 호스팅 추가)
//     [대안 — OpenAI gpt-image-1 edits: 건축 실사에 안정적]
//       · OPENAI_API_KEY
//   선택: SEUM_AI_RENDER_SIZE (기본 '1536x1024')

const OPENAI = process.env.OPENAI_API_KEY;
const HF_ID = process.env.HIGGSFIELD_KEY_ID;
const HF_SECRET = process.env.HIGGSFIELD_KEY_SECRET;
const HF_ENDPOINT = process.env.HIGGSFIELD_ENDPOINT || 'https://api.higgsfield.ai/v1/image2image/nano-banana';
const HF_BASE = process.env.HIGGSFIELD_BASE || 'https://api.higgsfield.ai';
const SIZE = process.env.SEUM_AI_RENDER_SIZE || '1536x1024';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const msgOf = (o) => (o && (o.message || (o.error && (o.error.message || o.error)) || o.detail || o.reason)) || '';
// 응답 JSON 어디에 있든 결과 이미지 URL 1개 찾아냄
function firstImageUrl(o) {
  if (!o || typeof o !== 'object') return null;
  const cands = [o.images, o.data && o.data.images, o.result && o.result.images, o.output, o.outputs];
  for (const arr of cands) {
    if (Array.isArray(arr) && arr.length) {
      const f = arr[0];
      if (typeof f === 'string' && /^https?:/.test(f)) return f;
      if (f && (f.url || f.image_url)) return f.url || f.image_url;
    }
  }
  if (typeof o.image_url === 'string') return o.image_url;
  if (typeof o.url === 'string' && /^https?:/.test(o.url)) return o.url;
  return null;
}

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  const ok = (obj) => ({ statusCode: 200, headers: cors, body: JSON.stringify(obj) });
  const err = (message) => ok({ error: message });
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: '잘못된 요청' }) }; }
  const { image, prompt } = body;
  if (!image || !prompt) return err('이미지 또는 설명이 비어 있어요');

  // --- 힉스필드 (Nano Banana img2img — 건물 형태 유지에 적합) ---
  if (HF_ID && HF_SECRET) {
    try {
      const auth = `Key ${HF_ID}:${HF_SECRET}`;
      const idem = (globalThis.crypto && globalThis.crypto.randomUUID) ? globalThis.crypto.randomUUID() : String(Date.now()) + Math.random();
      const submit = await fetch(HF_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json', 'Idempotency-Key': idem },
        body: JSON.stringify({
          params: { prompt },
          prompt,                                              // 일부 모델은 최상위 prompt 사용
          input_images: [{ type: 'image_url', image_url: image }],
          image_references: [{ type: 'image_url', image_url: image }],
        }),
      });
      let sub = {};
      try { sub = await submit.json(); } catch { /* noop */ }
      if (!submit.ok) {
        const hint = submit.status === 404 ? ' (엔드포인트가 다를 수 있어요 — Netlify 환경변수 HIGGSFIELD_ENDPOINT 에 콘솔의 submit URL 을 넣어주세요)' : '';
        return err(`힉스필드 제출 오류(${submit.status}): ${msgOf(sub) || ''}${hint}`);
      }
      let url = firstImageUrl(sub);
      const reqId = sub.id || sub.request_id || (sub.data && sub.data.id) || sub.requestId;
      if (!url && reqId) {
        for (let i = 0; i < 40; i++) {              // 최대 ~80초 폴링
          await sleep(2000);
          const st = await fetch(`${HF_BASE}/requests/${reqId}/status`, { headers: { Authorization: auth } });
          let sj = {};
          try { sj = await st.json(); } catch { /* noop */ }
          url = firstImageUrl(sj);
          if (url) break;
          const status = String(sj.status || sj.state || '').toLowerCase();
          if (['failed', 'error', 'canceled', 'cancelled'].includes(status)) return err('힉스필드 생성 실패: ' + (msgOf(sj) || status));
        }
      }
      if (!url) return err('힉스필드 결과 이미지를 받지 못했어요(시간 초과). 모델/엔드포인트 설정을 확인하세요.');
      // 결과 URL → data URL (프론트와 형식 통일 + CORS 회피)
      const imgRes = await fetch(url);
      if (!imgRes.ok) return err('결과 이미지를 내려받지 못했어요 (' + imgRes.status + ')');
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const ct = imgRes.headers.get('content-type') || 'image/png';
      return ok({ image: `data:${ct};base64,` + buf.toString('base64') });
    } catch (e) {
      return err('힉스필드 연결 실패: ' + String((e && e.message) || e));
    }
  }

  // --- OpenAI GPT Image (image-to-image / edits) ---
  if (OPENAI) {
    try {
      const m = /^data:(image\/\w+);base64,(.+)$/.exec(image);
      if (!m) return err('이미지 형식이 올바르지 않아요');
      const buf = Buffer.from(m[2], 'base64');
      const form = new FormData();
      form.append('model', 'gpt-image-1');
      form.append('prompt', prompt);
      form.append('size', SIZE);
      form.append('image', new Blob([buf], { type: m[1] }), 'render.png');
      const r = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST', headers: { Authorization: `Bearer ${OPENAI}` }, body: form,
      });
      const data = await r.json();
      if (!r.ok) return err((data && data.error && data.error.message) || `AI 오류(${r.status})`);
      const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
      if (!b64) return err('결과 이미지를 받지 못했어요');
      return ok({ image: 'data:image/png;base64,' + b64 });
    } catch (e) {
      return err('AI 연결 실패: ' + String((e && e.message) || e));
    }
  }

  return err('AI 실사 변환이 아직 설정되지 않았어요. (관리자: Netlify 환경변수에 HIGGSFIELD_KEY_ID/SECRET 또는 OPENAI_API_KEY 등록 필요)');
};
