-- Public view-only “Share to HR” links.
-- Snapshot is served via a security-definer RPC so anon never reads tables directly.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;
grant usage on schema private to postgres, service_role;

create table public.hr_share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  label text not null default 'HR review',
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  constraint hr_share_links_token_len check (char_length(token) >= 24)
);

create unique index hr_share_links_token_uidx on public.hr_share_links (token);
create index hr_share_links_user_id_idx on public.hr_share_links (user_id);
create unique index hr_share_links_one_active_per_user_uidx
  on public.hr_share_links (user_id)
  where revoked_at is null;

alter table public.hr_share_links enable row level security;

create policy hr_share_links_select_own on public.hr_share_links
  for select using ((select auth.uid()) = user_id);
create policy hr_share_links_insert_own on public.hr_share_links
  for insert with check ((select auth.uid()) = user_id);
create policy hr_share_links_update_own on public.hr_share_links
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy hr_share_links_delete_own on public.hr_share_links
  for delete using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.hr_share_links to authenticated;

-- Current Apr–Mar fiscal year containing p_as_of.
create or replace function private.fiscal_year_bounds(p_as_of date default current_date)
returns table (period_start date, period_end date)
language sql
immutable
set search_path = public
as $$
  select
    make_date(
      case when extract(month from p_as_of) >= 4
        then extract(year from p_as_of)::int
        else extract(year from p_as_of)::int - 1
      end,
      4,
      1
    ) as period_start,
    make_date(
      case when extract(month from p_as_of) >= 4
        then extract(year from p_as_of)::int + 1
        else extract(year from p_as_of)::int
      end,
      3,
      31
    ) as period_end;
$$;

create or replace function private.build_hr_share_snapshot(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_link public.hr_share_links%rowtype;
  v_start date;
  v_end date;
  v_name text;
begin
  if p_token is null or char_length(trim(p_token)) < 24 then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  end if;

  select * into v_link
  from public.hr_share_links
  where token = trim(p_token)
  limit 1;

  if not found
     or v_link.revoked_at is not null
     or (v_link.expires_at is not null and v_link.expires_at <= timezone('utc', now())) then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  end if;

  update public.hr_share_links
  set last_accessed_at = timezone('utc', now())
  where id = v_link.id;

  select fy.period_start, fy.period_end into v_start, v_end
  from private.fiscal_year_bounds(current_date) fy;

  select coalesce(nullif(trim(p.display_name), ''), split_part(u.email, '@', 1), 'Employee')
  into v_name
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id = v_link.user_id;

  return jsonb_build_object(
    'ok', true,
    'employee_name', coalesce(v_name, 'Employee'),
    'period_start', v_start,
    'period_end', v_end,
    'generated_at', timezone('utc', now()),
    'view_only', true,
    'balances', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'category', b.category,
          'period_start', b.period_start,
          'period_end', b.period_end,
          'total_available', b.total_available,
          'used', b.used,
          'remaining', b.remaining,
          'usage_percent', b.usage_percent,
          'is_negative', b.is_negative,
          'opening_balance', b.opening_balance,
          'annual_allocation', b.annual_allocation,
          'carry_forward_allocation', b.carry_forward_allocation
        )
        order by b.category
      )
      from public.leave_balances b
      where b.user_id = v_link.user_id
        and b.period_start = v_start
        and b.period_end = v_end
    ), '[]'::jsonb),
    'records', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', r.date,
          'title', r.title,
          'category', r.category,
          'duration', r.duration,
          'days', r.days,
          'status', r.status
        )
        order by r.date desc, r.created_at desc
      )
      from public.leave_records r
      where r.user_id = v_link.user_id
        and r.date between v_start and v_end
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function private.build_hr_share_snapshot(text) from public;
revoke all on function private.fiscal_year_bounds(date) from public;

create or replace function public.hr_share_snapshot(p_token text)
returns jsonb
language sql
volatile
security definer
set search_path = public, private
as $$
  select private.build_hr_share_snapshot(p_token);
$$;

revoke all on function public.hr_share_snapshot(text) from public;
grant execute on function public.hr_share_snapshot(text) to anon, authenticated;

create or replace function public.create_hr_share_link(
  p_label text default 'HR review',
  p_expires_in_days integer default null
)
returns public.hr_share_links
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  v_token text;
  v_row public.hr_share_links;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Rotate: revoke any existing active link for this user.
  update public.hr_share_links
  set revoked_at = timezone('utc', now())
  where user_id = uid
    and revoked_at is null;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.hr_share_links (user_id, token, label, expires_at)
  values (
    uid,
    v_token,
    coalesce(nullif(trim(p_label), ''), 'HR review'),
    case
      when p_expires_in_days is null or p_expires_in_days <= 0 then null
      else timezone('utc', now()) + make_interval(days => p_expires_in_days)
    end
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_hr_share_link(text, integer) from public;
grant execute on function public.create_hr_share_link(text, integer) to authenticated;

create or replace function public.revoke_hr_share_link(p_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.hr_share_links
  set revoked_at = timezone('utc', now())
  where id = p_id
    and user_id = uid
    and revoked_at is null;

  return found;
end;
$$;

revoke all on function public.revoke_hr_share_link(uuid) from public;
grant execute on function public.revoke_hr_share_link(uuid) to authenticated;
