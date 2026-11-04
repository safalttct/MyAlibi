-- Expand leave categories to match HR policy types.
-- Renames legacy "Casual Leave" → "Annual Leave".

alter table public.leave_records
  drop constraint if exists leave_records_category_check;

alter table public.leave_allocations
  drop constraint if exists leave_allocations_category_check;

update public.leave_records
set category = 'Annual Leave'
where category = 'Casual Leave';

update public.leave_allocations
set category = 'Annual Leave'
where category = 'Casual Leave';

-- Merge duplicate Annual rows if both Casual and Annual already existed for a period
-- (unlikely; kept for safety). Prefer the row with higher annual_allocation.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, category, period_start, period_end
      order by annual_allocation desc, opening_balance desc, id
    ) as rn
  from public.leave_allocations
  where category = 'Annual Leave'
)
delete from public.leave_allocations a
using ranked r
where a.id = r.id and r.rn > 1;

alter table public.leave_records
  add constraint leave_records_category_check
  check (category in (
    'Work From Home',
    'Annual Leave',
    'Sick Leave',
    'Maternity Leave',
    'Paternity Leave',
    'Emergency Leave',
    'Loss of Pay',
    'Compensatory Leave',
    'Carry Forward Leave',
    'Casual Leave'
  ));

alter table public.leave_allocations
  add constraint leave_allocations_category_check
  check (category in (
    'Work From Home',
    'Annual Leave',
    'Sick Leave',
    'Maternity Leave',
    'Paternity Leave',
    'Emergency Leave',
    'Loss of Pay',
    'Compensatory Leave',
    'Carry Forward Leave',
    'Casual Leave'
  ));

comment on constraint leave_records_category_check on public.leave_records is
  'HR leave types. Casual Leave retained only for legacy import compatibility.';
