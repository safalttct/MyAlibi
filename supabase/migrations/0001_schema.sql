-- LeaveFlow schema
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default timezone('utc', now())
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null,
  file_names text[] not null default '{}',
  record_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index import_batches_user_id_idx
  on public.import_batches (user_id);

create table public.leave_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  category text not null
    check (category in (
      'Work From Home',
      'Casual Leave',
      'Sick Leave',
      'Compensatory Leave',
      'Carry Forward Leave'
    )),
  date date not null,
  duration text
    check (duration is null or duration in ('Full Day', 'Half Day')),
  days numeric(4,1) generated always as (
    case
      when duration = 'Full Day' then 1.0
      when duration = 'Half Day' then 0.5
      else null
    end
  ) stored,
  notes text,
  status text not null default 'complete'
    check (status in ('complete', 'needs_review')),
  source_key text,
  import_batch_id uuid references public.import_batches (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint leave_records_complete_requires_duration
    check (status <> 'complete' or duration is not null)
);

create unique index leave_records_user_source_key_uidx
  on public.leave_records (user_id, source_key)
  where source_key is not null;

create index leave_records_user_date_idx
  on public.leave_records (user_id, date desc);

create index leave_records_user_category_idx
  on public.leave_records (user_id, category);

create index leave_records_user_status_idx
  on public.leave_records (user_id, status);

create index leave_records_import_batch_id_idx
  on public.leave_records (import_batch_id);

create trigger leave_records_set_updated_at
before update on public.leave_records
for each row execute function public.set_updated_at();

create table public.leave_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null
    check (category in (
      'Work From Home',
      'Casual Leave',
      'Sick Leave',
      'Compensatory Leave',
      'Carry Forward Leave'
    )),
  period_start date not null,
  period_end date not null,
  opening_balance numeric(6,1) not null default 0 check (opening_balance >= 0),
  annual_allocation numeric(6,1) not null default 0 check (annual_allocation >= 0),
  carry_forward_allocation numeric(6,1) not null default 0 check (carry_forward_allocation >= 0),
  carry_forward_expiry date,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint leave_allocations_period_valid check (period_end >= period_start),
  constraint leave_allocations_unique_period unique (user_id, category, period_start, period_end)
);

create index leave_allocations_user_period_idx
  on public.leave_allocations (user_id, period_start, period_end);

create trigger leave_allocations_set_updated_at
before update on public.leave_allocations
for each row execute function public.set_updated_at();

create table public.comp_off_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_date date not null,
  type text not null check (type in ('earned', 'used', 'adjustment')),
  days numeric(6,1) not null,
  expiry_date date,
  notes text,
  leave_record_id uuid unique references public.leave_records (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint comp_off_days_by_type check (
    (type in ('earned', 'used') and days > 0)
    or (type = 'adjustment' and days <> 0)
  )
);

create index comp_off_transactions_user_date_idx
  on public.comp_off_transactions (user_id, transaction_date desc);

create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint app_settings_user_key_unique unique (user_id, key)
);

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
