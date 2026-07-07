// 세움 홈플래너 - 진입점
import { store } from './store.js';
import { Editor2D } from './editor2d.js';
import { Viewer3D } from './viewer3d.js';
import { buildUI } from './ui.js';
import { cloud } from './cloud.js';

const editor = new Editor2D(document.getElementById('canvas2d'));
const viewer = new Viewer3D(document.getElementById('view3d'));

let mode = '2d';
function setMode(m) {
  mode = m;
  document.getElementById('stage-2d').classList.toggle('hidden', m !== '2d');
  document.getElementById('stage-3d').classList.toggle('hidden', m !== '3d');
  document.getElementById('tb-2d').classList.toggle('active', m === '2d');
  document.getElementById('tb-3d').classList.toggle('active', m === '3d');
  document.getElementById('view-presets').classList.toggle('hidden', m !== '3d');
  viewer.setActive(m === '3d');
  if (m === '2d') { editor._resize(); editor.draw(); }
}

buildUI({ editor, viewer, onModeChange: setMode });
setMode('2d');

// ---------------------------------------------------------------------------
// 로그인 게이트 (세움 직원 전용) — 로그인해야 홈플래너 사용 가능
// ---------------------------------------------------------------------------
const gate = document.getElementById('auth-gate');
const authForm = document.getElementById('auth-form');
const authErr = document.getElementById('auth-err');
const authSubmit = document.getElementById('auth-submit');
const authEmail = document.getElementById('auth-email');
const authPass = document.getElementById('auth-pass');
const authKeep = document.getElementById('auth-keep');
const logoutBtn = document.getElementById('tb-logout');

const KEEP_KEY = 'seum_keep_login';   // '0' 이면 자동 로그인 끔
const EMAIL_KEY = 'seum_last_email';  // 마지막 로그인 이메일 (자동 채움)
const keepLogin = () => { try { return localStorage.getItem(KEEP_KEY) !== '0'; } catch { return true; } };
const lastEmail = () => { try { return localStorage.getItem(EMAIL_KEY) || ''; } catch { return ''; } };

function reflectAuth() {
  const loggedIn = !!cloud.user;
  gate.classList.toggle('hidden', loggedIn);
  logoutBtn.classList.toggle('hidden', !loggedIn);
  if (loggedIn) authPass.value = '';   // 비밀번호만 비움 (이메일/체크박스는 유지)
}

// Supabase 인증 오류 → 사용자 친화 메시지
function authErrorText(e) {
  const m = (e && e.message) || String(e);
  if (/Invalid login credentials/i.test(m))
    return '이메일 또는 비밀번호가 올바르지 않습니다. (세움OS 계정과 동일한지 확인하세요)';
  if (/Email not confirmed/i.test(m)) return '이메일 인증이 완료되지 않은 계정입니다. 관리자에게 문의하세요.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return '네트워크 오류로 로그인할 수 없습니다. 인터넷 연결을 확인하세요.';
  return '로그인 실패: ' + m;
}

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
  reflectAuth();
  cloud.onChange(reflectAuth);   // 로그인/로그아웃 시 게이트 자동 표시·숨김
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
  } catch (err) {
    authErr.textContent = authErrorText(err);
  } finally {
    authSubmit.disabled = false; authSubmit.textContent = '로그인';
  }
});

logoutBtn.onclick = async () => {
  try { await cloud.signOut(); } finally { reflectAuth(); }   // onChange 로도 반영됨
};

initAuth();

// 전역 디버그용
window.SEUM = { store, editor, viewer, cloud };
