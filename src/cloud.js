// 세움 홈플래너 - Supabase 클라우드 연동
// 계정 로그인 + 서버(DB) 저장 + 영업사원 간 공유 + 고객용 공유 링크.
// 설정값(window.SEUM_CONFIG)이 없으면 비활성화 상태로 동작하고, 앱의 나머지 기능은 정상 사용 가능.

let client = null;
let ready = false;
const subs = new Set();

const cfg = (typeof window !== 'undefined' && window.SEUM_CONFIG) || {};

// 관리자 이메일 — 이 계정으로 로그인하면 '전체 도면'(모두의 도면)을 볼 수 있음.
// config.js 의 adminEmails 로 덮어쓸 수 있음(문자열 배열).
const ADMIN_EMAILS = (Array.isArray(cfg.adminEmails) && cfg.adminEmails.length
  ? cfg.adminEmails
  : ['actorjoon0001@gmail.com', 'harold0001@naver.com']).map((e) => String(e).trim().toLowerCase());

// Supabase 라이브러리를 여러 CDN에서 순차 시도 (한 곳이 막혀도 다음 것으로)
async function loadSupabase() {
  // jsDelivr /+esm 는 단일 번들(요청 1회)이라 가장 견고 → 우선. 실패 시 esm.sh/skypack 폴백.
  const urls = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
    'https://esm.sh/@supabase/supabase-js@2',
    'https://cdn.skypack.dev/@supabase/supabase-js@2',
  ];
  let lastErr;
  for (const u of urls) {
    try {
      const mod = await import(/* @vite-ignore */ u);
      if (mod && typeof mod.createClient === 'function') return mod;
      lastErr = new Error('createClient 없음: ' + u);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Supabase 라이브러리를 불러오지 못했습니다.');
}

export const cloud = {
  configured() { return !!(cfg.supabaseUrl && cfg.supabaseAnonKey); },
  ready() { return ready; },
  user: null,

  lastError: null,

  // Supabase 클라이언트 동적 로드 (CDN ESM) — 여러 CDN 폴백으로 실패에 견고하게
  async init() {
    if (!this.configured()) return false;
    if (client) return true;
    if (this._initPromise) return this._initPromise;   // 동시 호출 시 중복 로드 방지
    this._initPromise = (async () => {
      try {
        const { createClient } = await loadSupabase();
        client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: {
            persistSession: true,     // 세션을 브라우저에 저장 → 재접속 시 자동 로그인
            autoRefreshToken: true,   // 만료 전 토큰 자동 갱신 → 로그인 유지
            detectSessionInUrl: false,
          },
        });
        const { data } = await client.auth.getSession();
        this.user = data?.session?.user || null;
        client.auth.onAuthStateChange((_ev, session) => {
          this.user = session?.user || null;
          this._emit();
        });
        ready = true;
        this.lastError = null;
        this._emit();
        return true;
      } catch (e) {
        console.error('[cloud] init 실패:', e);
        this.lastError = e;
        this._initPromise = null;   // 다음 시도 때 다시 로드할 수 있도록
        return false;
      }
    })();
    return this._initPromise;
  },

  onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
  _emit() { subs.forEach((fn) => fn(this)); },

  // 도면 데이터에 작성자 정보를 남겨 관리자 화면에서 누가 만든지 보이게 함
  _stampAuthor(data) {
    if (!data || !this.user) return;
    const u = this.user;
    const nm = (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || '';
    data.ownerName = nm || u.email || data.ownerName || '';
    data.ownerEmail = u.email || data.ownerEmail || '';
  },

  // --- 인증 ---
  _requireClient() {
    if (!client) {
      const why = this.lastError ? ` (${this.lastError.message || this.lastError})` : '';
      throw new Error('인증 서버에 연결하지 못했습니다. 네트워크를 확인하고 다시 시도하세요.' + why);
    }
  },
  async signIn(email, password) {
    await this.init();
    this._requireClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async signUp(email, password, name) {
    await this.init();
    this._requireClient();
    const opts = name ? { data: { full_name: name, name } } : undefined;
    const { error } = await client.auth.signUp({ email, password, options: opts });
    if (error) throw error;
  },
  async signOut() { if (client) await client.auth.signOut(); },

  // --- 도면 CRUD ---
  // 새로 저장(또는 기존 id 업데이트). data 는 도면 JSON.
  async saveDesign({ id, name, data, isShared = false, isTemplate = false }) {
    await this.init();
    if (!this.user) throw new Error('로그인이 필요합니다.');
    this._stampAuthor(data);
    const row = {
      name, data,
      is_shared: isShared, is_template: isTemplate,
      owner: this.user.id, updated_at: new Date().toISOString(),
    };
    if (id) row.id = id;
    const { data: out, error } = await client.from('designs').upsert(row).select().single();
    if (error) throw error;
    return out;
  },

  // 이미 저장된 도면을 빠르게 갱신 (이름/데이터/썸네일만) — 공유·템플릿 설정은 그대로 유지
  async quickSave({ id, name, data }) {
    await this.init();
    if (!this.user) throw new Error('로그인이 필요합니다.');
    this._stampAuthor(data);
    const row = { name, data, updated_at: new Date().toISOString() };
    const { data: out, error } = await client.from('designs').update(row).eq('id', id).select().single();
    if (error) throw error;
    return out;
  },

  async listMine() {
    await this.init();
    if (!this.user) return [];
    const { data, error } = await client.from('designs')
      .select('id,name,data,is_shared,is_template,updated_at,owner')
      .eq('owner', this.user.id).order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // 현재 로그인 계정이 관리자인지 (전체 도면 열람 권한)
  isAdmin() {
    const email = this.user && this.user.email;
    return !!(email && ADMIN_EMAILS.includes(String(email).trim().toLowerCase()));
  },

  // 관리자 전용: 모두가 만든 모든 도면. (Supabase RLS 가 관리자 SELECT 를 허용해야 실제로 반환됨)
  async listAll() {
    await this.init();
    if (!this.user) return [];
    const { data, error } = await client.from('designs')
      .select('id,name,data,is_shared,is_template,updated_at,owner')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // 영업사원 간 공유된 도면 (본인 것 제외)
  async listShared() {
    await this.init();
    const { data, error } = await client.from('designs')
      .select('id,name,data,is_shared,is_template,updated_at,owner')
      .eq('is_shared', true).order('updated_at', { ascending: false });
    if (error) throw error;
    return (data || []).filter((d) => !this.user || d.owner !== this.user.id);
  },

  // 공용 단지/평형 템플릿 (DB에 등록된 것)
  async listTemplates() {
    await this.init();
    const { data, error } = await client.from('designs')
      .select('id,name,data,updated_at').eq('is_template', true).order('name');
    if (error) throw error;
    return data || [];
  },

  async getDesign(id) {
    await this.init();
    const { data, error } = await client.from('designs').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async removeDesign(id) {
    await this.init();
    const { error } = await client.from('designs').delete().eq('id', id);
    if (error) throw error;
  },

  // 공유 링크 생성 (현재 페이지 + ?id=)
  shareLink(id) {
    const u = new URL(window.location.href);
    u.search = '?id=' + encodeURIComponent(id);
    u.hash = '';
    return u.toString();
  },
};
