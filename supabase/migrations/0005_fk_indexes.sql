create index if not exists import_batches_user_id_idx on public.import_batches (user_id);
create index if not exists leave_records_import_batch_id_idx on public.leave_records (import_batch_id);
