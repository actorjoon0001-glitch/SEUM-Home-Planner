// 세움 홈플래너 - 진입점
// 중요: 로그인/회원가입 게이트는 3D(three.js)·앱 UI 로딩과 '분리'해 항상 먼저 동작하게 한다.
//       (three.js CDN이 늦거나 실패해도 로그인/회원가입 버튼은 정상 반응해야 함)
import { store } from './store.js';
import { Editor2D } from './editor2d.js';
import { buildUI, showDashboard } from './ui.js';
import { cloud } from './cloud.js';

const editor = new Editor2D(document.getElementById('canvas2d'));

let viewer = null;   // 3D 뷰어는 three.js 로드 후 지연 생성
let mode = '2d';
function setMode(m) {
  mode = m;
  document.getElementById('stage-2d').classList.toggle('hidden', m !== '2d');
  document.getElementById('stage-3d').classList.toggle('hidden', m !== '3d');
  document.getElementById('tb-2d').classList.toggle('active', m === '2d');
  document.getElementById('tb-3d').classList.toggle('active', m === '3d');
  document.getElementById('view-presets').classList.toggle('hidden', m !== '3d');
  if (viewer) viewer.setActive(m === '3d');
  if (m === '2d') { editor._resize(); editor.draw(); }
}

// three.js 로드 실패 시 2D는 계속 쓸 수 있게 하는 최소 스텁 뷰어
function makeStubViewer() {
  const noop = () => {};
  return {
    active: false, dirty: false, _needCam: false, wallOpacity: 1, floorOpacity: 1,
    controls: { maxPolarAngle: Math.PI },
    setActive: noop, zoom: noop, resetCamera: noop, toImage: () => null,
  };
}

// ===========================================================================
// 로그인 게이트 (세움 홈플래너 전용 계정) — 아래 리스너는 '동기'로 즉시 연결되어
// three.js/앱 초기화 성공 여부와 무관하게 항상 동작한다.
// ===========================================================================
const gate = document.getElementById('auth-gate');
const authForm = document.getElementById('auth-form');
const authErr = document.getElementById('auth-err');
const authSubmit = document.getElementById('auth-submit');
const authEmail = document.getElementById('auth-email');
const authPass = document.getElementById('auth-pass');
const authKeep = document.getElementById('auth-keep');
const logoutBtn = document.getElementById('tb-logout');

// 로그인 전용 — 계정은 세움 OS(전자계약서)에서 발급된 직원 계정을 그대로 사용(회원가입/이름 없음)

const KEEP_KEY = 'seum_keep_login';   // '0' 이면 자동 로그인 끔
const EMAIL_KEY = 'seum_last_email';  // 마지막 로그인 이메일 (자동 채움)
const keepLogin = () => { try { return localStorage.getItem(KEEP_KEY) !== '0'; } catch { return true; } };
const lastEmail = () => { try { return localStorage.getItem(EMAIL_KEY) || ''; } catch { return ''; } };

let _dashShown = false;
function reflectAuth() {
  const loggedIn = !!cloud.user;
  gate.classList.toggle('hidden', loggedIn);
  logoutBtn.classList.toggle('hidden', !loggedIn);
  if (loggedIn) {
    authPass.value = '';                 // 비밀번호만 비움 (이메일/체크박스는 유지)
    if (!_dashShown) { _dashShown = true; showDashboard(); }  // 로그인 직후 프로젝트 대시보드
  } else {
    _dashShown = false;
  }
}

// Supabase 인증 오류 → 사용자 친화 메시지
function authErrorText(e) {
  const m = (e && e.message) || String(e);
  if (/Invalid login credentials/i.test(m))
    return '이메일 또는 비밀번호가 올바르지 않습니다. 세움 OS 직원 계정을 확인해 주세요.';
  if (/User already registered/i.test(m)) return '이미 가입된 이메일입니다. 로그인해 주세요.';
  if (/Password should be at least/i.test(m)) return '비밀번호는 6자 이상이어야 합니다.';
  if (/Email not confirmed/i.test(m)) return '이메일 인증이 완료되지 않았습니다. 받은 편지함의 인증 메일을 확인하세요.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return '네트워크 오류로 처리할 수 없습니다. 인터넷 연결을 확인하세요.';
  return '오류: ' + m;
}

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = authEmail.value.trim();
  const pass = authPass.value;
  if (!email || !pass) { authErr.textContent = '이메일과 비밀번호를 모두 입력하세요.'; return; }
  // 자동 로그인 유지 여부 + 이메일 저장
  const keep = authKeep ? authKeep.checked : true;
  try { localStorage.setItem(KEEP_KEY, keep ? '1' : '0'); localStorage.setItem(EMAIL_KEY, email); } catch { /* noop */ }
  authErr.textContent = '';
  authSubmit.disabled = true; authSubmit.textContent = '로그인 중…';
  try {
    await cloud.signIn(email, pass);   // 성공 시 onChange→reflectAuth 가 게이트를 닫음
    try { cloud.logEvent({ kind: 'login', action: '로그인', detail: '수동 로그인' }); } catch { /* noop */ }
  } catch (err) {
    authErr.textContent = authErrorText(err);
  } finally {
    authSubmit.disabled = false; authSubmit.textContent = '로그인';
  }
});

logoutBtn.onclick = async () => {
  try { await cloud.signOut(); } finally { reflectAuth(); }   // onChange 로도 반영됨
};

async function initAuth() {
  // 클라우드(Supabase) 미설정이면 게이트 없이 사용 (로그인 불가 상태로 잠기지 않도록)
  if (!cloud.configured()) { gate.classList.add('hidden'); logoutBtn.classList.add('hidden'); return; }
  // 지난 로그인 이메일 자동 채움 + '자동 로그인 유지' 상태 복원
  if (lastEmail()) authEmail.value = lastEmail();
  if (authKeep) authKeep.checked = keepLogin();
  authErr.textContent = '로그인 확인 중…';
  try { await cloud.init(); } catch { /* init 실패해도 로그인 폼은 표시 */ }
  authErr.textContent = '';
  // 자동 로그인 꺼짐 → 저장된 세션이 있어도 로그아웃해 매번 로그인하도록
  if (cloud.user && !keepLogin()) { try { await cloud.signOut(); } catch { /* noop */ } }
  // 세션이 복원돼 자동 로그인된 경우 접속 기록 남김(수동 로그인은 submit 핸들러에서 기록)
  if (cloud.user) { try { cloud.logEvent({ kind: 'login', action: '로그인', detail: '자동 로그인' }); } catch { /* noop */ } }
  reflectAuth();
  cloud.onChange(reflectAuth);   // 로그인/로그아웃 시 게이트 자동 표시·숨김
}

// ===========================================================================
// 앱 UI + 3D 뷰어 — three.js 지연 로드. 실패해도 로그인/2D 사용엔 지장 없음.
// (뷰어·UI 준비가 끝난 뒤 세션 복원 initAuth() 를 호출해 대시보드가 안전히 뜨게 함)
// ===========================================================================
(async () => {
  // 3D 뷰어는 three.js(CDN)에 의존한다. CDN이 느리거나 응답이 없더라도
  // 로그인·2D 앱이 절대 막히지 않도록, 최대 대기시간(8초)을 두고 진행한다.
  // (그 안에 로드되면 실제 3D 사용, 늦으면 스텁으로 시작 — 로그인/2D는 항상 동작)
  const loadViewer = (async () => {
    try {
      const { Viewer3D } = await import('./viewer3d.js');
      return new Viewer3D(document.getElementById('view3d'));
    } catch (e) {
      console.error('[app] 3D 뷰어 로드 실패 (2D는 정상 사용 가능):', e);
      return makeStubViewer();
    }
  })();
  const timeout = new Promise((res) => setTimeout(() => res(null), 8000));
  viewer = (await Promise.race([loadViewer, timeout])) || makeStubViewer();

  try {
    buildUI({ editor, viewer, onModeChange: setMode });
    setMode('2d');
  } catch (e) {
    console.error('[app] UI 초기화 실패:', e);
  }
  window.SEUM = { store, editor, viewer, cloud };   // 전역 디버그용
  initAuth();   // 로그인/세션 복원 — 3D 로드와 무관하게 항상 실행
})();
