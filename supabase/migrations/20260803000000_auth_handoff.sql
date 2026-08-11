-- 跨设备二维码登录的短时一次性配对请求。
-- 表只允许 Edge Function 的 service role 访问，前端不能直接读写。
create table if not exists public.auth_handoff_requests (
  id uuid default gen_random_uuid() primary key,
  token_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_handoff_requests_expires_at_idx
  on public.auth_handoff_requests (expires_at);

create index if not exists auth_handoff_requests_user_id_idx
  on public.auth_handoff_requests (user_id);

alter table public.auth_handoff_requests enable row level security;

-- 不授予 anon/authenticated 任何权限；Edge Function 使用 service role 绕过 RLS。
revoke all on table public.auth_handoff_requests from anon, authenticated;

create policy "客户端不可直接访问二维码配对" on public.auth_handoff_requests
  for all to anon, authenticated
  using (false)
  with check (false);
