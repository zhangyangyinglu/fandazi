-- ============================================================
-- 饭搭子 Supabase 数据库 Schema
-- 创建时间：2026-07-04
-- 用途：家庭数据同步（冰箱/计划/购物/我家版/做饭记录/饭团）
-- ============================================================

-- 1. 家庭空间
create table if not exists households (
  id uuid default gen_random_uuid() primary key,
  name text not null default '我的家',
  invite_code text unique not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- 2. 家庭成员
create table if not exists household_members (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_emoji text default '🍚',
  role text default 'member', -- member / owner
  joined_at timestamptz default now(),
  unique(household_id, user_id)
);

-- 3. 冰箱库存（家庭共享）
create table if not exists pantry_items (
  id text primary key, -- App 端生成的稳定 ID，便于离线优先后同步
  household_id uuid references households(id) on delete cascade,
  ingredient_name text not null,
  category text not null,
  quantity numeric not null default 1,
  unit text not null default '个',
  storage text not null default 'fridge', -- fridge / freezer / room
  bought_at date,
  best_before_at date,
  source text default 'manual_add',
  status text default 'fresh', -- fresh / use_soon / past_best / check_before_use
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. 晚餐计划（家庭共享）
create table if not exists meal_plans (
  id text primary key, -- App 端生成的稳定 ID，便于离线优先后同步
  household_id uuid references households(id) on delete cascade,
  dish_id text not null,
  status text default 'planned', -- planned / cooking / done / cancelled
  plan_date date,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. 购物清单（家庭共享）
create table if not exists shopping_items (
  id text primary key, -- App 端生成的稳定 ID，便于离线优先后同步
  household_id uuid references households(id) on delete cascade,
  name text not null,
  amount text,
  source text, -- 菜名
  checked boolean default false,
  status text default 'pending', -- pending / purchased / stored
  checked_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 6. 我家版菜品（家庭共享）
create table if not exists my_dish_versions (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references households(id) on delete cascade,
  dish_id text not null,
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  cook_time text,
  my_note text,
  created_by uuid references auth.users(id),
  created_at_ms bigint,
  updated_at_ms bigint,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(household_id, dish_id)
);

-- 7. 做饭记录（家庭共享）
create table if not exists cooking_logs (
  id text primary key, -- App 端生成的稳定 ID，便于离线优先后同步
  household_id uuid references households(id) on delete cascade,
  dish_id text not null,
  dish_name text not null,
  cook_date date not null,
  rating text, -- good / ok / bad
  note text,
  mili_reward integer default 0,
  cooked_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- 8. 饭团游戏化（家庭共享进度）
create table if not exists fantuan_state (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references households(id) on delete cascade unique,
  mili integer default 0,
  level integer default 1,
  cooking_streak integer default 0,
  total_cooked integer default 0,
  spicy smallint default 1,
  salty smallint default 1,
  sweet smallint default 1,
  avoid jsonb default '[]'::jsonb,
  taste_note text default '',
  updated_at timestamptz default now()
);

-- 9. 周备餐计划（家庭共享）
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

-- ============================================================
-- 兼容迁移：如果你已经执行过旧版 schema，再执行本段可补齐离线优先同步字段
-- ============================================================
alter table pantry_items alter column id type text using id::text;
alter table meal_plans alter column id type text using id::text;
alter table shopping_items alter column id type text using id::text;
alter table cooking_logs alter column id type text using id::text;
alter table pantry_items add column if not exists note text;
alter table my_dish_versions add column if not exists created_at_ms bigint;
alter table my_dish_versions add column if not exists updated_at_ms bigint;

-- ============================================================
-- RLS 行级安全策略
-- 家庭成员只能读写自己家庭的数据
-- ============================================================

-- 辅助函数：检查当前用户是否属于某个家庭
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

-- pantry_items
alter table pantry_items enable row level security;
create policy "家庭成员可读冰箱" on pantry_items for select using (is_household_member(household_id));
create policy "家庭成员可写冰箱" on pantry_items for all using (is_household_member(household_id));

-- meal_plans
alter table meal_plans enable row level security;
create policy "家庭成员可读计划" on meal_plans for select using (is_household_member(household_id));
create policy "家庭成员可写计划" on meal_plans for all using (is_household_member(household_id));

-- shopping_items
alter table shopping_items enable row level security;
create policy "家庭成员可读购物" on shopping_items for select using (is_household_member(household_id));
create policy "家庭成员可写购物" on shopping_items for all using (is_household_member(household_id));

-- my_dish_versions
alter table my_dish_versions enable row level security;
create policy "家庭成员可读我家版" on my_dish_versions for select using (is_household_member(household_id));
create policy "家庭成员可写我家版" on my_dish_versions for all using (is_household_member(household_id));

-- cooking_logs
alter table cooking_logs enable row level security;
create policy "家庭成员可读记录" on cooking_logs for select using (is_household_member(household_id));
create policy "家庭成员可写记录" on cooking_logs for all using (is_household_member(household_id));

-- fantuan_state
alter table fantuan_state enable row level security;
create policy "家庭成员可读饭团" on fantuan_state for select using (is_household_member(household_id));
create policy "家庭成员可写饭团" on fantuan_state for all using (is_household_member(household_id));

-- weekly_prep_plans
alter table weekly_prep_plans enable row level security;
create policy "家庭成员可读周备餐" on weekly_prep_plans for select using (is_household_member(household_id));
create policy "家庭成员可写周备餐" on weekly_prep_plans for all using (is_household_member(household_id));

-- RPC：创建家庭并把当前用户设为 owner
-- 用数据库函数一次性完成 households / household_members / fantuan_state 初始化，
-- 避免前端多次 insert 在 RLS 下出现“new row violates row-level security policy”。
create or replace function create_household_with_owner(household_name text)
returns table(id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
  new_invite_code text;
  normalized_name text;
begin
  if auth.uid() is null then
    raise exception '请先登录再创建家庭';
  end if;

  normalized_name := nullif(trim(household_name), '');
  if normalized_name is null then
    raise exception '请填写家庭名称';
  end if;

  loop
    new_invite_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from households where households.invite_code = new_invite_code);
  end loop;

  insert into households (name, invite_code, created_by)
  values (normalized_name, new_invite_code, auth.uid())
  returning households.id into new_household_id;

  insert into household_members (household_id, user_id, display_name, role)
  values (new_household_id, auth.uid(), '我', 'owner')
  on conflict (household_id, user_id) do update
    set role = 'owner';

  insert into fantuan_state (household_id, mili, level)
  values (new_household_id, 0, 1)
  on conflict (household_id) do nothing;

  return query
  select households.id, households.name, households.invite_code
  from households
  where households.id = new_household_id;
end;
$$;

grant execute on function create_household_with_owner(text) to authenticated;

-- RPC：通过邀请码加入家庭
-- 为什么不用前端直接 select households.eq(invite_code)：
-- 未加入成员会被 households 的 RLS select policy 拦截，必须由 security definer
-- 在数据库内完成“查邀请码 → 插入 household_members → 返回家庭”。
create or replace function join_household_by_invite(
  target_invite_code text,
  member_display_name text
)
returns table(id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_household households%rowtype;
begin
  if auth.uid() is null then
    raise exception '请先登录再加入家庭';
  end if;

  select * into target_household
  from households
  where households.invite_code = upper(trim(target_invite_code))
  limit 1;

  if target_household.id is null then
    raise exception '邀请码无效';
  end if;

  insert into household_members (household_id, user_id, display_name, role)
  values (target_household.id, auth.uid(), nullif(trim(member_display_name), ''), 'member')
  on conflict (household_id, user_id) do update
    set display_name = excluded.display_name;

  return query
  select target_household.id, target_household.name, target_household.invite_code;
end;
$$;

grant execute on function join_household_by_invite(text, text) to authenticated;

-- household_members
alter table household_members enable row level security;
create policy "成员可读家庭成员" on household_members for select using (
  is_household_member(household_id) or user_id = auth.uid()
);
create policy "成员可加入家庭" on household_members for insert with check (user_id = auth.uid());

-- households
alter table households enable row level security;
create policy "成员可读家庭" on households for select using (is_household_member(id));
create policy "用户可创建家庭" on households for insert with check (created_by = auth.uid());

-- ============================================================
-- 家庭共享设置（AI Key 等）
-- ============================================================
create table if not exists household_settings (
  household_id uuid references households(id) on delete cascade primary key,
  ai_config jsonb,  -- { provider, baseURL, model, apiKey, tested }
  today_chef_id text,  -- 今日掌勺成员 id，跨设备同步
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

alter table household_settings enable row level security;
create policy "成员可读家庭设置" on household_settings for select using (is_household_member(household_id));
create policy "成员可写家庭设置" on household_settings for insert with check (is_household_member(household_id));
create policy "成员可更新家庭设置" on household_settings for update
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

alter publication supabase_realtime add table household_settings;

-- ============================================================
-- 实时订阅
-- ============================================================
alter publication supabase_realtime add table pantry_items;
alter publication supabase_realtime add table meal_plans;
alter publication supabase_realtime add table shopping_items;
alter publication supabase_realtime add table my_dish_versions;
alter publication supabase_realtime add table cooking_logs;
alter publication supabase_realtime add table fantuan_state;
alter publication supabase_realtime add table weekly_prep_plans;
