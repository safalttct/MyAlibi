-- Prefer "Casual Leave" as the user-facing / stored category name.
-- "Annual Leave" remains allowed briefly for any in-flight imports, then remapped.

alter table public.leave_records
  drop constraint if exists leave_records_category_check;

alter table public.leave_allocations
  drop constraint if exists leave_allocations_category_check;

update public.leave_records
set category = 'Casual Leave'
where category = 'Annual Leave';

update public.leave_allocations
set category = 'Casual Leave'
where category = 'Annual Leave';

-- Collapse duplicates if both Annual and Casual existed for the same period.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, category, period_start, period_end
      order by annual_allocation desc, opening_balance desc, id
    ) as rn
  from public.leave_allocations
  where category = 'Casual Leave'
)
delete from public.leave_allocations a
using ranked r
where a.id = r.id and r.rn > 1;

-- Remap enabled category prefs stored as JSON arrays.
update public.app_settings
set value = (
  select coalesce(jsonb_agg(
    case when elem = '"Annual Leave"' then '"Casual Leave"'::jsonb else elem end
  ), '[]'::jsonb)
  from jsonb_array_elements(value) as elem
)
where key = 'enabled_leave_categories'
  and jsonb_typeof(value) = 'array'
  and value @> '"Annual Leave"'::jsonb;

alter table public.leave_records
  add constraint leave_records_category_check
  check (category in (
    'Work From Home',
    'Casual Leave',
    'Sick Leave',
    'Maternity Leave',
    'Paternity Leave',
    'Emergency Leave',
    'Loss of Pay',
    'Compensatory Leave',
    'Carry Forward Leave',
    'Annual Leave'
  ));

alter table public.leave_allocations
  add constraint leave_allocations_category_check
  check (category in (
    'Work From Home',
    'Casual Leave',
    'Sick Leave',
    'Maternity Leave',
    'Paternity Leave',
    'Emergency Leave',
    'Loss of Pay',
    'Compensatory Leave',
    'Carry Forward Leave',
    'Annual Leave'
  ));

comment on constraint leave_records_category_check on public.leave_records is
  'HR leave types. Annual Leave retained only for legacy import compatibility.';
