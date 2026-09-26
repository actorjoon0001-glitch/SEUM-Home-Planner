// 세움 홈플래너 — ✨ AI 실사 변환 프록시
//   브라우저(사진급 렌더 창) → 이 함수 → 이미지 AI(image-to-image) → 실사 이미지 반환.
//   API 키는 서버(환경변수)에만 두고 프론트에 절대 노출하지 않는다.
//
//   설정: Netlify 대시보드 → Site settings → Environment variables 에
//     · OPENAI_API_KEY            (OpenAI GPT Image — 지금 바로 사용 가능)
//     · (또는) HIGGSFIELD_KEY_ID / HIGGSFIELD_KEY_SECRET  (힉스필드 — img2img 엔드포인트 확정 후 활성화)
//   선택: SEUM_AI_RENDER_SIZE (기본 '1536x1024')

const OPENAI = process.env.OPENAI_API_KEY;
const HF_ID = process.env.HIGGSFIELD_KEY_ID;
const HF_SECRET = process.env.HIGGSFIELD_KEY_SECRET;
const SIZE = process.env.SEUM_AI_RENDER_SIZE || '1536x1024';

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: '잘못된 요청' }) }; }
  const { image, prompt } = body;
  if (!image || !prompt) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: '이미지 또는 설명이 비어 있어요' }) };

  // --- OpenAI GPT Image (image-to-image / edits) ---
  if (OPENAI) {
    try {
      const m = /^data:(image\/\w+);base64,(.+)$/.exec(image);
      if (!m) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: '이미지 형식이 올바르지 않아요' }) };
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
      if (!r.ok) return { statusCode: 200, headers: cors, body: JSON.stringify({ error: (data && data.error && data.error.message) || `AI 오류(${r.status})` }) };
      const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
      if (!b64) return { statusCode: 200, headers: cors, body: JSON.stringify({ error: '결과 이미지를 받지 못했어요' }) };
      return { statusCode: 200, headers: cors, body: JSON.stringify({ image: 'data:image/png;base64,' + b64 }) };
    } catch (e) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ error: 'AI 연결 실패: ' + String((e && e.message) || e) }) };
    }
  }

  // --- 힉스필드 API (image-to-image 엔드포인트 확정 후 활성화 예정) ---
  if (HF_ID && HF_SECRET) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ error: '힉스필드 연동은 준비 중이에요. 우선 OPENAI_API_KEY 로 사용하거나, 힉스필드 img2img 엔드포인트 확정 후 활성화됩니다.' }) };
  }

  return { statusCode: 200, headers: cors, body: JSON.stringify({ error: 'AI 실사 변환이 아직 설정되지 않았어요. (관리자: Netlify 환경변수에 OPENAI_API_KEY 등록 필요 — 또는 힉스필드 키)' }) };
};
