create index if not exists auth_handoff_requests_user_id_idx
  on public.auth_handoff_requests (user_id);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'auth_handoff_requests'
      and policyname = '客户端不可直接访问二维码配对'
  ) then
    create policy "客户端不可直接访问二维码配对" on public.auth_handoff_requests
      for all to anon, authenticated
      using (false)
      with check (false);
  end if;
end;
$$;
