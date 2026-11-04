-- Authoritative balance helpers and views for LeaveFlow

create or replace function public.comp_off_signed_days(
  p_type text,
  p_days numeric,
  p_expiry_date date,
  p_as_of date default current_date
)
returns numeric
language sql
immutable
as $$
  select case
    when p_type = 'earned' and (p_expiry_date is null or p_expiry_date >= p_as_of) then p_days
    when p_type = 'used' then -p_days
    when p_type = 'adjustment' then p_days
    else 0
  end;
$$;

create or replace function public.comp_off_available_balance(
  p_user_id uuid,
  p_as_of date default current_date,
  p_exclude_leave_record_id uuid default null
)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(public.comp_off_signed_days(type, days, expiry_date, p_as_of)), 0)
  from public.comp_off_transactions
  where user_id = p_user_id
    and (p_exclude_leave_record_id is null or leave_record_id is distinct from p_exclude_leave_record_id);
$$;

create or replace function public.sync_comp_off_used_from_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available numeric;
  v_opening numeric;
begin
  if tg_op = 'DELETE' then
    delete from public.comp_off_transactions where leave_record_id = old.id;
    return old;
  end if;

  if new.category <> 'Compensatory Leave' or new.status <> 'complete' or new.days is null then
    delete from public.comp_off_transactions where leave_record_id = new.id;
    return new;
  end if;

  -- Interactive overuse is blocked. Imported historical rows may go negative.
  if new.import_batch_id is null then
    select coalesce(a.opening_balance, 0)
    into v_opening
    from public.leave_allocations a
    where a.user_id = new.user_id
      and a.category = 'Compensatory Leave'
      and new.date between a.period_start and a.period_end
    order by a.period_start desc
    limit 1;

    v_available := coalesce(v_opening, 0)
      + public.comp_off_available_balance(new.user_id, new.date, new.id);

    if v_available < new.days then
      raise exception 'Insufficient compensatory leave balance (available %, requested %)',
        v_available, new.days
        using errcode = 'P0001';
    end if;
  end if;

  insert into public.comp_off_transactions as t (
    user_id, transaction_date, type, days, notes, leave_record_id
  )
  values (
    new.user_id,
    new.date,
    'used',
    new.days,
    coalesce(new.notes, 'Used via leave record'),
    new.id
  )
  on conflict (leave_record_id) do update
    set transaction_date = excluded.transaction_date,
        days = excluded.days,
        notes = excluded.notes;

  return new;
end;
$$;

drop trigger if exists leave_records_sync_comp_off on public.leave_records;
create trigger leave_records_sync_comp_off
after insert or update or delete on public.leave_records
for each row execute function public.sync_comp_off_used_from_leave();

create or replace view public.leave_balances
with (security_invoker = true)
as
with allocation_rows as (
  select
    a.user_id,
    a.category,
    a.period_start,
    a.period_end,
    a.opening_balance,
    a.annual_allocation,
    a.carry_forward_allocation,
    a.carry_forward_expiry,
    case
      when a.carry_forward_allocation = 0 then 0::numeric
      when a.carry_forward_expiry is null then a.carry_forward_allocation
      when a.carry_forward_expiry >= current_date then a.carry_forward_allocation
      else 0::numeric
    end as effective_carry_forward
  from public.leave_allocations a
  where a.category <> 'Compensatory Leave'
),
usage_rows as (
  select
    r.user_id,
    r.category,
    a.period_start,
    a.period_end,
    coalesce(sum(r.days), 0) as used_days
  from public.leave_records r
  join public.leave_allocations a
    on a.user_id = r.user_id
   and a.category = r.category
   and r.date between a.period_start and a.period_end
  where r.status = 'complete'
    and r.days is not null
    and r.category <> 'Compensatory Leave'
  group by r.user_id, r.category, a.period_start, a.period_end
),
standard_balances as (
  select
    a.user_id,
    a.category,
    a.period_start,
    a.period_end,
    (a.opening_balance + a.annual_allocation + a.effective_carry_forward) as total_available,
    coalesce(u.used_days, 0) as used,
    (a.opening_balance + a.annual_allocation + a.effective_carry_forward)
      - coalesce(u.used_days, 0) as remaining,
    a.opening_balance,
    a.annual_allocation,
    a.effective_carry_forward as carry_forward_allocation,
    a.carry_forward_expiry
  from allocation_rows a
  left join usage_rows u
    on u.user_id = a.user_id
   and u.category = a.category
   and u.period_start = a.period_start
   and u.period_end = a.period_end
),
comp_off_alloc as (
  select distinct on (user_id)
    user_id,
    period_start,
    period_end,
    opening_balance,
    annual_allocation,
    carry_forward_allocation,
    carry_forward_expiry
  from public.leave_allocations
  where category = 'Compensatory Leave'
  order by user_id, period_start desc
),
comp_off_balances as (
  select
    p.id as user_id,
    'Compensatory Leave'::text as category,
    coalesce(c.period_start, make_date(extract(year from current_date)::int, 4, 1)) as period_start,
    coalesce(c.period_end, make_date(extract(year from current_date)::int + 1, 3, 31)) as period_end,
    coalesce(c.opening_balance, 0)
      + coalesce((
          select sum(
            case
              when t.type = 'earned' and (t.expiry_date is null or t.expiry_date >= current_date) then t.days
              when t.type = 'adjustment' and t.days > 0 then t.days
              else 0
            end
          )
          from public.comp_off_transactions t
          where t.user_id = p.id
        ), 0) as total_available,
    coalesce((
      select sum(t.days)
      from public.comp_off_transactions t
      where t.user_id = p.id and t.type = 'used'
    ), 0) as used,
    coalesce(c.opening_balance, 0)
      + coalesce((
          select sum(public.comp_off_signed_days(t.type, t.days, t.expiry_date, current_date))
          from public.comp_off_transactions t
          where t.user_id = p.id
        ), 0) as remaining,
    coalesce(c.opening_balance, 0) as opening_balance,
    coalesce(c.annual_allocation, 0) as annual_allocation,
    coalesce(c.carry_forward_allocation, 0) as carry_forward_allocation,
    c.carry_forward_expiry
  from public.profiles p
  left join comp_off_alloc c on c.user_id = p.id
)
select
  s.user_id,
  s.category,
  s.period_start,
  s.period_end,
  s.total_available,
  s.used,
  s.remaining,
  case
    when s.total_available = 0 then case when s.used = 0 then 0 else 100 end
    else round((s.used / s.total_available) * 100, 1)
  end as usage_percent,
  s.remaining < 0 as is_negative,
  s.opening_balance,
  s.annual_allocation,
  s.carry_forward_allocation,
  s.carry_forward_expiry
from standard_balances s
union all
select
  c.user_id,
  c.category,
  c.period_start,
  c.period_end,
  c.total_available,
  c.used,
  c.remaining,
  case
    when c.total_available = 0 then case when c.used = 0 then 0 else 100 end
    else round((c.used / nullif(c.total_available, 0)) * 100, 1)
  end as usage_percent,
  c.remaining < 0 as is_negative,
  c.opening_balance,
  c.annual_allocation,
  c.carry_forward_allocation,
  c.carry_forward_expiry
from comp_off_balances c;

create or replace function public.monthly_usage(
  p_period_start date,
  p_period_end date
)
returns table (
  month date,
  category text,
  used_days numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    date_trunc('month', r.date)::date as month,
    r.category,
    coalesce(sum(r.days), 0) as used_days
  from public.leave_records r
  where r.user_id = auth.uid()
    and r.status = 'complete'
    and r.days is not null
    and r.date between p_period_start and p_period_end
  group by 1, 2
  order by 1, 2;
$$;

create or replace function public.export_user_backup()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  return jsonb_build_object(
    'version', 1,
    'exported_at', timezone('utc', now()),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'leave_records', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.date, r.created_at)
      from public.leave_records r where r.user_id = uid
    ), '[]'::jsonb),
    'leave_allocations', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.period_start, a.category)
      from public.leave_allocations a where a.user_id = uid
    ), '[]'::jsonb),
    'comp_off_transactions', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.transaction_date, t.created_at)
      from public.comp_off_transactions t
      where t.user_id = uid and t.leave_record_id is null
    ), '[]'::jsonb),
    'app_settings', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.key)
      from public.app_settings s where s.user_id = uid
    ), '[]'::jsonb)
  );
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.leave_balances to authenticated;
grant execute on function public.monthly_usage(date, date) to authenticated;
grant execute on function public.export_user_backup() to authenticated;
grant execute on function public.comp_off_available_balance(uuid, date, uuid) to authenticated;
