-- ============================================================
-- 2026-08-11 综合修复迁移
-- 修复项：
--   P0-1: fantuan_state 加口味档案字段
--   P1-1: shopping_items 加 status 列
--   P1-3: 新建 weekly_prep_plans 表（周备餐云端同步）
--   P1-6: is_household_member 加 search_path
--   P2-3: household_settings update 加 with check
-- ============================================================

-- P0-1: fantuan_state 加口味字段
alter table fantuan_state add column if not exists spicy smallint default 1;
alter table fantuan_state add column if not exists salty smallint default 1;
alter table fantuan_state add column if not exists sweet smallint default 1;
alter table fantuan_state add column if not exists avoid jsonb default '[]'::jsonb;
alter table fantuan_state add column if not exists taste_note text default '';

-- P1-1: shopping_items 加 status 列
alter table shopping_items add column if not exists status text default 'pending';

-- P1-6: is_household_member 加 search_path（必须在使用它的 policy 之前）
create or replace function is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where household_id = target_household_id
    and user_id = auth.uid()
  );
$$;

-- P1-3: 周备餐计划表（家庭共享）
create table if not exists weekly_prep_plans (
  id text primary key,
  household_id uuid references households(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  meals_per_day smallint default 2,
  servings integer default 2,
  status text default 'draft',
  plan_data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(household_id, week_start)
);

alter table weekly_prep_plans enable row level security;
create policy "家庭成员可读周备餐" on weekly_prep_plans for select using (is_household_member(household_id));
create policy "家庭成员可写周备餐" on weekly_prep_plans for all using (is_household_member(household_id));

alter publication supabase_realtime add table weekly_prep_plans;

-- P2-3: household_settings update 加 with check
drop policy if exists "成员可更新家庭设置" on household_settings;
create policy "成员可更新家庭设置" on household_settings for update
  using (is_household_member(household_id))
  with check (is_household_member(household_id));
