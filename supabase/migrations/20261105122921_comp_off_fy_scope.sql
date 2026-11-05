-- Scope Comp Off balance + availability checks to the allocation financial year.
-- Previously, leave_balances used the latest Comp Off opening but summed every
-- transaction across all years, which mixed FY ledgers (e.g. −2 Available).

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
  with period as (
    select
      coalesce(
        (
          select a.period_start
          from public.leave_allocations a
          where a.user_id = p_user_id
            and a.category = 'Compensatory Leave'
            and p_as_of between a.period_start and a.period_end
          order by a.period_start desc
          limit 1
        ),
        case
          when extract(month from p_as_of) >= 4
            then make_date(extract(year from p_as_of)::int, 4, 1)
          else make_date(extract(year from p_as_of)::int - 1, 4, 1)
        end
      ) as period_start,
      coalesce(
        (
          select a.period_end
          from public.leave_allocations a
          where a.user_id = p_user_id
            and a.category = 'Compensatory Leave'
            and p_as_of between a.period_start and a.period_end
          order by a.period_start desc
          limit 1
        ),
        case
          when extract(month from p_as_of) >= 4
            then make_date(extract(year from p_as_of)::int + 1, 3, 31)
          else make_date(extract(year from p_as_of)::int, 3, 31)
        end
      ) as period_end
  )
  select coalesce(sum(public.comp_off_signed_days(t.type, t.days, t.expiry_date, p_as_of)), 0)
  from public.comp_off_transactions t
  cross join period p
  where t.user_id = p_user_id
    and t.transaction_date between p.period_start and p.period_end
    and (p_exclude_leave_record_id is null or t.leave_record_id is distinct from p_exclude_leave_record_id);
$$;

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
  select
    user_id,
    period_start,
    period_end,
    opening_balance,
    annual_allocation,
    carry_forward_allocation,
    carry_forward_expiry
  from public.leave_allocations
  where category = 'Compensatory Leave'
),
comp_off_balances as (
  select
    a.user_id,
    'Compensatory Leave'::text as category,
    a.period_start,
    a.period_end,
    coalesce(a.opening_balance, 0)
      + coalesce((
          select sum(
            case
              when t.type = 'earned' and (t.expiry_date is null or t.expiry_date >= current_date) then t.days
              when t.type = 'adjustment' and t.days > 0 then t.days
              else 0
            end
          )
          from public.comp_off_transactions t
          where t.user_id = a.user_id
            and t.transaction_date between a.period_start and a.period_end
        ), 0) as total_available,
    coalesce((
      select sum(t.days)
      from public.comp_off_transactions t
      where t.user_id = a.user_id
        and t.type = 'used'
        and t.transaction_date between a.period_start and a.period_end
    ), 0) as used,
    coalesce(a.opening_balance, 0)
      + coalesce((
          select sum(public.comp_off_signed_days(t.type, t.days, t.expiry_date, current_date))
          from public.comp_off_transactions t
          where t.user_id = a.user_id
            and t.transaction_date between a.period_start and a.period_end
        ), 0) as remaining,
    coalesce(a.opening_balance, 0) as opening_balance,
    coalesce(a.annual_allocation, 0) as annual_allocation,
    coalesce(a.carry_forward_allocation, 0) as carry_forward_allocation,
    a.carry_forward_expiry
  from comp_off_alloc a
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

grant select on public.leave_balances to authenticated;
grant execute on function public.comp_off_available_balance(uuid, date, uuid) to authenticated;
