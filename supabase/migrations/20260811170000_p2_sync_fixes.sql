-- P2 迁移：plannedDishIds / rating / todayChefId / pantry status 注释修正
-- 执行方式：Supabase Management API

-- P2-1: pantry_items 新增 planned_dish_ids 列
alter table pantry_items add column if not exists planned_dish_ids jsonb default '[]';

-- P2-2: my_dish_versions 新增 rating 列
alter table my_dish_versions add column if not exists rating text;

-- P2-6: household_settings 新增 today_chef_id 列
alter table household_settings add column if not exists today_chef_id text;

-- P2-5: pantry_items.status 注释修正（枚举值对齐 TS 类型）
comment on column pantry_items.status is 'fresh / use_soon / past_best / check_before_use';
