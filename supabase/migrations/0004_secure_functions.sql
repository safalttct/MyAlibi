create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.comp_off_signed_days(
  p_type text,
  p_days numeric,
  p_expiry_date date,
  p_as_of date default current_date
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p_type = 'earned' and (p_expiry_date is null or p_expiry_date >= p_as_of) then p_days
    when p_type = 'used' then -p_days
    when p_type = 'adjustment' then p_days
    else 0
  end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_comp_off_used_from_leave() from public, anon, authenticated;
grant execute on function public.handle_new_user() to postgres, service_role;
grant execute on function public.sync_comp_off_used_from_leave() to postgres, service_role;
