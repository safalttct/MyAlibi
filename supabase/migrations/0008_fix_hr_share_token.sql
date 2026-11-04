-- gen_random_bytes lives in extensions on Supabase, not public.
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
