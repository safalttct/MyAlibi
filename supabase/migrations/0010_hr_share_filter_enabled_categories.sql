-- HR share snapshot: only expose balances for categories the employee has enabled.
-- Historical records remain visible so HR can still reconcile past Comp Off / etc.

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
  v_enabled jsonb;
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

  select s.value into v_enabled
  from public.app_settings s
  where s.user_id = v_link.user_id
    and s.key = 'enabled_leave_categories';

  -- Normalize legacy "Annual Leave" → "Casual Leave" in the enabled list.
  if v_enabled is not null and jsonb_typeof(v_enabled) = 'array' then
    select coalesce(jsonb_agg(
      case when elem = 'Annual Leave' then to_jsonb('Casual Leave'::text) else to_jsonb(elem) end
    ), '[]'::jsonb)
    into v_enabled
    from jsonb_array_elements_text(v_enabled) as elem;
  end if;

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
        and (
          v_enabled is null
          or jsonb_typeof(v_enabled) <> 'array'
          or jsonb_array_length(v_enabled) = 0
          or to_jsonb(
            case when b.category::text = 'Annual Leave' then 'Casual Leave' else b.category::text end
          ) <@ v_enabled
        )
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
