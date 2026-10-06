-- Distinguish sign-outs from OS permission revocation in push_devices.
-- A revoked device still holds a valid Expo token, so without a reason the
-- only observable symptom is phantom "delivered" pushes nobody can see.
drop function public.unregister_push_device(uuid);
create function public.unregister_push_device(
  target_installation_id uuid,
  target_reason text default 'signed_out'
) returns void language sql security definer set search_path = '' as $$
  update public.push_devices
    set disabled_at = now(), disabled_reason = target_reason
    where installation_id = target_installation_id
      and user_id = auth.uid()
      and disabled_at is null;
$$;
revoke all on function public.unregister_push_device(uuid, text) from public;
grant execute on function public.unregister_push_device(uuid, text)
  to authenticated, service_role;
