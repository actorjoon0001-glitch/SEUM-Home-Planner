// 세움 홈플래너 - 📸 사진급 렌더 창
// 지금 3D 화면 구도 그대로 패스 트레이싱 렌더를 돌려, 점점 선명해지는 과정을 보여주고 PNG로 저장한다.
// (렌더 계산 자체는 viewer3d.js 의 createPhotoRender 가 담당)

const QUALITY = {
  fast: { label: '빠르게 (약 10초)', samples: 120 },
  normal: { label: '보통 (약 30초)', samples: 350 },
  best: { label: '최고 (1분 이상)', samples: 900 },
};
const SIZES = { 1600: '1600px (보고용)', 2400: '2400px (인쇄·카탈로그)' };

let dlg = null;

function build() {
  dlg = document.createElement('dialog');
  dlg.className = 'dialog photo-dlg';
  dlg.innerHTML = `
    <div class="dialog-head">📸 사진급 렌더 <button type="button" data-act="close" title="닫기">✕</button></div>
    <div class="photo-body">
      <div class="photo-opts">
        <label>품질 <select data-f="q">${Object.entries(QUALITY).map(([k, v]) => `<option value="${k}"${k === 'normal' ? ' selected' : ''}>${v.label}</option>`).join('')}</select></label>
        <label>크기 <select data-f="w">${Object.entries(SIZES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <button type="button" class="photo-btn" data-act="start">렌더 시작</button>
      </div>
      <div class="photo-stage"><p class="photo-hint">지금 3D 화면의 구도 그대로 렌더합니다.<br>원하는 각도로 돌려놓고 <b>렌더 시작</b>을 누르세요.</p></div>
      <div class="photo-bar"><div class="photo-fill"></div></div>
      <div class="photo-foot">
        <span class="photo-status"></span>
        <span class="photo-actions">
          <button type="button" class="photo-btn ghost" data-act="stop" disabled>멈추기</button>
          <button type="button" class="photo-btn" data-act="save" disabled>PNG 저장</button>
        </span>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  return dlg;
}

// viewer: Viewer3D, getName: 파일 이름에 쓸 도면 이름
export function openPhotoRender(viewer, getName) {
  if (!viewer || !viewer.createPhotoRender) return;
  const d = dlg || build();
  const $ = (s) => d.querySelector(s);
  const stage = $('.photo-stage'), fill = $('.photo-fill'), status = $('.photo-status');
  const btnStart = $('[data-act=start]'), btnStop = $('[data-act=stop]'), btnSave = $('[data-act=save]');
  let job = null, timer = 0, t0 = 0, target = 0;

  const finish = (msg) => {
    clearInterval(timer); timer = 0;
    if (job) job.stop();
    btnStop.disabled = true; btnStart.disabled = false; btnStart.textContent = '다시 렌더';
    if (msg) status.textContent = msg;
  };
  const cleanup = () => { finish(); if (job) { job.dispose(); job = null; } };

  btnStart.onclick = async () => {
    cleanup();
    const q = QUALITY[$('[data-f=q]').value] || QUALITY.normal;
    const w = +$('[data-f=w]').value || 1600;
    const r = viewer.renderer.domElement.getBoundingClientRect();
    const aspect = r.width && r.height ? r.width / r.height : 16 / 9;
    const h = Math.round(w / aspect);
    target = q.samples;
    btnStart.disabled = true; btnSave.disabled = true;
    status.textContent = '장면 준비 중… (처음 한 번은 라이브러리를 불러와 몇 초 걸려요)';
    fill.style.width = '0%';
    try {
      job = await viewer.createPhotoRender(w, h);
    } catch (e) {
      console.error('[사진급 렌더] 실패', e);
      status.textContent = '렌더를 시작하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
      btnStart.disabled = false;
      return;
    }
    stage.innerHTML = '';
    stage.appendChild(job.canvas);
    btnStop.disabled = false; btnSave.disabled = false;
    t0 = performance.now();
    timer = setInterval(() => {
      if (!job) return;
      const s = job.samples, pct = Math.min(100, (s / target) * 100);
      fill.style.width = pct.toFixed(1) + '%';
      const sec = Math.round((performance.now() - t0) / 1000);
      status.textContent = `계산 중… ${Math.floor(s)} / ${target} (${sec}초) — 멈춰도 지금까지 결과를 저장할 수 있어요`;
      if (s >= target) finish(`완성! (${sec}초) — PNG로 저장하세요`);
    }, 250);
  };

  btnStop.onclick = () => finish(`멈춤 (${job ? Math.floor(job.samples) : 0} / ${target}) — 지금까지 결과를 저장할 수 있어요`);

  btnSave.onclick = () => {
    if (!job) return;
    const a = document.createElement('a');
    const name = (getName && getName()) || '세움도면';
    a.download = `${name}_사진급렌더.png`;
    a.href = job.toDataURL();
    a.click();
  };

  $('[data-act=close]').onclick = () => d.close();
  d.onclose = () => {
    cleanup();
    stage.innerHTML = '<p class="photo-hint">지금 3D 화면의 구도 그대로 렌더합니다.<br>원하는 각도로 돌려놓고 <b>렌더 시작</b>을 누르세요.</p>';
    fill.style.width = '0%'; status.textContent = '';
    btnStart.textContent = '렌더 시작'; btnSave.disabled = true;
  };
  d.showModal();
}
