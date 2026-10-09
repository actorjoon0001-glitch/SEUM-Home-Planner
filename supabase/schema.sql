-- 세움 홈플래너 - Supabase 스키마 & 보안 정책(RLS)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.

-- 1) 도면 테이블 --------------------------------------------------------------
create table if not exists public.designs (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users(id) on delete cascade,
  name        text not null default '무제 도면',
  data        jsonb not null,            -- 도면 전체 JSON
  is_shared   boolean not null default false,  -- 영업사원 간 공유 여부
  is_template boolean not null default false,  -- 공용 단지/평형 템플릿 여부
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists designs_owner_idx on public.designs(owner);
create index if not exists designs_shared_idx on public.designs(is_shared) where is_shared;
create index if not exists designs_template_idx on public.designs(is_template) where is_template;

-- 2) RLS 활성화 ---------------------------------------------------------------
alter table public.designs enable row level security;

-- 본인 도면: 전체 권한
drop policy if exists "own designs - all" on public.designs;
create policy "own designs - all" on public.designs
  for all using (auth.uid() = owner) with check (auth.uid() = owner);

-- 로그인 사용자: 공유/템플릿 도면 읽기 (영업사원 간 공유)
drop policy if exists "read shared/templates (auth)" on public.designs;
create policy "read shared/templates (auth)" on public.designs
  for select to authenticated using (is_shared or is_template);

-- 비로그인(고객 링크): 공유/템플릿 도면만 읽기 → 공유 링크로 도면 열람 가능
drop policy if exists "read shared/templates (anon)" on public.designs;
create policy "read shared/templates (anon)" on public.designs
  for select to anon using (is_shared or is_template);

-- 2-1) 관리자: 모든 직원의 도면 열람/관리 -----------------------------------
-- 관리자 이메일로 로그인한 계정은 모두가 만든 도면을 보고(삭제 등) 관리할 수 있습니다.
-- 아래 배열의 이메일 목록을 필요에 맞게 수정하세요. (config.js 의 adminEmails 와 동일하게 유지)
create or replace function public.is_seum_admin()
returns boolean language sql stable as $$
  select coalesce(
    (auth.jwt() ->> 'email') = any (array[
      'actorjoon0001@gmail.com',
      'harold0001@naver.com'
    ]),
    false
  );
$$;

drop policy if exists "admin - all designs" on public.designs;
create policy "admin - all designs" on public.designs
  for all to authenticated
  using (public.is_seum_admin())
  with check (public.is_seum_admin());

-- 3) updated_at 자동 갱신 트리거 ---------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists designs_touch on public.designs;
create trigger designs_touch before update on public.designs
  for each row execute function public.touch_updated_at();

-- 4) 접속·활동 기록 (관리자 전용 조회) ---------------------------------------
-- 세움 OS와 통합된 프로젝트에서 홈플래너 로그인/작업 내역을 남깁니다.
-- (세움 OS의 econtract_ 로그와 충돌 피하려 seum_ 접두어 사용)
create table if not exists public.seum_activity_log (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  user_id  uuid references auth.users(id) on delete set null,
  email    text,
  name     text,
  kind     text not null default 'activity',   -- 'login' | 'activity'
  action   text,                               -- '로그인' | '도면 저장' | '삭제' 등
  detail   text,                               -- '자동 로그인' | 도면 이름 등
  ip       text,
  ua       text
);
create index if not exists seum_log_at_idx on public.seum_activity_log(at desc);
create index if not exists seum_log_kind_idx on public.seum_activity_log(kind, at desc);

alter table public.seum_activity_log enable row level security;

-- 로그인 사용자는 '자기 이벤트'만 기록(insert) 가능
drop policy if exists "seum log insert (self)" on public.seum_activity_log;
create policy "seum log insert (self)" on public.seum_activity_log
  for insert to authenticated with check (auth.uid() = user_id);

-- 관리자만 전체 기록 조회 (is_seum_admin() 은 위 designs 섹션에서 정의됨)
drop policy if exists "seum log read (admin)" on public.seum_activity_log;
create policy "seum log read (admin)" on public.seum_activity_log
  for select to authenticated using (public.is_seum_admin());

-- 5) 모델 영상 (Supabase Storage) ---------------------------------------------
-- 홈플래너 관리자 > 🎬 모델 영상 에서 올리는 드론샷 소개 영상 저장소.
-- 누구나(고객 포함) 재생할 수 있게 공개 읽기, 올리기·바꾸기·지우기는 관리자만.
-- file_size_limit: 파일 하나 최대 크기(바이트). 무료 플랜은 프로젝트 전체 한도가 50MB 라
--   더 큰 파일은 Supabase > Project Settings > Storage 의 'Upload file size limit' 도 함께 올려야 함(Pro 플랜).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('planner-videos', 'planner-videos', true, 524288000,
        array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "planner videos read" on storage.objects;
create policy "planner videos read" on storage.objects
  for select using (bucket_id = 'planner-videos');

drop policy if exists "planner videos insert (admin)" on storage.objects;
create policy "planner videos insert (admin)" on storage.objects
  for insert to authenticated with check (bucket_id = 'planner-videos' and public.is_seum_admin());

drop policy if exists "planner videos update (admin)" on storage.objects;
create policy "planner videos update (admin)" on storage.objects
  for update to authenticated using (bucket_id = 'planner-videos' and public.is_seum_admin());

drop policy if exists "planner videos delete (admin)" on storage.objects;
create policy "planner videos delete (admin)" on storage.objects
  for delete to authenticated using (bucket_id = 'planner-videos' and public.is_seum_admin());
