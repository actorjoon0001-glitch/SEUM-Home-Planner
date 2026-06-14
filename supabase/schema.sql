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

-- 3) updated_at 자동 갱신 트리거 ---------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists designs_touch on public.designs;
create trigger designs_touch before update on public.designs
  for each row execute function public.touch_updated_at();
