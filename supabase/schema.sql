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
  id uuid default gen_random_uuid() primary key,
  household_id uuid references households(id) on delete cascade,
  ingredient_name text not null,
  category text not null,
  quantity numeric not null default 1,
  unit text not null default '个',
  storage text not null default 'fridge', -- fridge / freezer / room
  bought_at date,
  best_before_at date,
  source text default 'manual_add',
  status text default 'fresh', -- fresh / use_soon / expired
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. 晚餐计划（家庭共享）
create table if not exists meal_plans (
  id uuid default gen_random_uuid() primary key,
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
  id uuid default gen_random_uuid() primary key,
  household_id uuid references households(id) on delete cascade,
  name text not null,
  amount text,
  source text, -- 菜名
  checked boolean default false,
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
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(household_id, dish_id)
);

-- 7. 做饭记录（家庭共享）
create table if not exists cooking_logs (
  id uuid default gen_random_uuid() primary key,
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
  updated_at timestamptz default now()
);

-- ============================================================
-- RLS 行级安全策略
-- 家庭成员只能读写自己家庭的数据
-- ============================================================

-- 辅助函数：检查当前用户是否属于某个家庭
create or replace function is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
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
-- 实时订阅
-- ============================================================
alter publication supabase_realtime add table pantry_items;
alter publication supabase_realtime add table meal_plans;
alter publication supabase_realtime add table shopping_items;
alter publication supabase_realtime add table my_dish_versions;
alter publication supabase_realtime add table cooking_logs;
alter publication supabase_realtime add table fantuan_state;
