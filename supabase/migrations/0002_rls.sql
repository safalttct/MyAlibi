alter table public.profiles enable row level security;
alter table public.import_batches enable row level security;
alter table public.leave_records enable row level security;
alter table public.leave_allocations enable row level security;
alter table public.comp_off_transactions enable row level security;
alter table public.app_settings enable row level security;

create policy profiles_select_own on public.profiles
  for select using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles
  for insert with check ((select auth.uid()) = id);

create policy import_batches_select_own on public.import_batches
  for select using ((select auth.uid()) = user_id);
create policy import_batches_insert_own on public.import_batches
  for insert with check ((select auth.uid()) = user_id);
create policy import_batches_update_own on public.import_batches
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy import_batches_delete_own on public.import_batches
  for delete using ((select auth.uid()) = user_id);

create policy leave_records_select_own on public.leave_records
  for select using ((select auth.uid()) = user_id);
create policy leave_records_insert_own on public.leave_records
  for insert with check ((select auth.uid()) = user_id);
create policy leave_records_update_own on public.leave_records
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy leave_records_delete_own on public.leave_records
  for delete using ((select auth.uid()) = user_id);

create policy leave_allocations_select_own on public.leave_allocations
  for select using ((select auth.uid()) = user_id);
create policy leave_allocations_insert_own on public.leave_allocations
  for insert with check ((select auth.uid()) = user_id);
create policy leave_allocations_update_own on public.leave_allocations
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy leave_allocations_delete_own on public.leave_allocations
  for delete using ((select auth.uid()) = user_id);

create policy comp_off_transactions_select_own on public.comp_off_transactions
  for select using ((select auth.uid()) = user_id);
create policy comp_off_transactions_insert_own on public.comp_off_transactions
  for insert with check ((select auth.uid()) = user_id);
create policy comp_off_transactions_update_own on public.comp_off_transactions
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy comp_off_transactions_delete_own on public.comp_off_transactions
  for delete using ((select auth.uid()) = user_id);

create policy app_settings_select_own on public.app_settings
  for select using ((select auth.uid()) = user_id);
create policy app_settings_insert_own on public.app_settings
  for insert with check ((select auth.uid()) = user_id);
create policy app_settings_update_own on public.app_settings
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy app_settings_delete_own on public.app_settings
  for delete using ((select auth.uid()) = user_id);
