-- Reusable bearer links. Existing codes have never been exposed in the app;
-- replace the old short (sometimes list-id-derived) codes before sharing them.
alter table public.lists alter column invite_code
  set default encode(extensions.gen_random_bytes(16), 'hex');
update public.lists set invite_code = encode(extensions.gen_random_bytes(16), 'hex');

-- Generate the real secret on the server, independent of client-generated ids.
-- The mobile sharing screen reads it online, after the household has uploaded.
create function public.set_household_invite_code()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.invite_code := encode(extensions.gen_random_bytes(16), 'hex');
  return new;
end;
$$;
create trigger lists_set_invite_code before insert on public.lists
  for each row execute function public.set_household_invite_code();

create function public.preview_household_invite(code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  household public.lists;
begin
  if auth.uid() is null then
    raise sqlstate '42501' using message = 'Sign in to join a household.';
  end if;
  select l.* into household from public.lists l
    join public.household_profiles p on p.id = l.id
    where l.invite_code = code;
  if not found then
    raise sqlstate 'PT404' using message = 'This invitation is no longer valid. Ask for a new link.';
  end if;
  return jsonb_build_object(
    'list_id', household.id, 'name', household.name,
    'joined', exists (select 1 from public.household_people
      where list_id = household.id and user_id = auth.uid()),
    -- A bearer may see names to identify themselves, not the cooking profile.
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name)
      order by created_at, id) from public.household_people
      where list_id = household.id and user_id is null), '[]'::jsonb)
  );
end;
$$;

create function public.accept_household_invite(code text, person_id uuid default null, person_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  claimed uuid;
  caller uuid := auth.uid();
begin
  if caller is null then
    raise sqlstate '42501' using message = 'Sign in to join a household.';
  end if;
  -- Serialize acceptance and resets, including two requests by the same user.
  select l.id into target from public.lists l
    join public.household_profiles p on p.id = l.id
    where l.invite_code = code for update of l;
  if not found then
    raise sqlstate 'PT404' using message = 'This invitation is no longer valid. Ask for a new link.';
  end if;
  if exists (select 1 from public.household_people where list_id = target and user_id = caller) then
    return target;
  end if;
  if (person_id is null) = (nullif(btrim(person_name), '') is null) then
    raise sqlstate 'PT400' using message = 'Choose yourself or enter your name.';
  end if;
  insert into public.list_members (list_id, user_id) values (target, caller)
    on conflict (list_id, user_id) do nothing;
  if person_id is not null then
    update public.household_people set user_id = caller
      where id = person_id and list_id = target and user_id is null
      returning id into claimed;
    if claimed is null then
      -- The membership insertion rolls back with this exception.
      raise sqlstate 'PT409' using message = 'That person is no longer available. Please choose again.';
    end if;
  else
    insert into public.household_people (id, list_id, user_id, name, meal_times)
      values (gen_random_uuid(), target, caller, btrim(person_name), 'All meals');
  end if;
  return target;
end;
$$;

create function public.reset_household_invite(target_list_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  code text;
begin
  if not public.is_list_member(target_list_id) then
    raise sqlstate '42501' using message = 'Only household members can reset its link.';
  end if;
  update public.lists set invite_code = encode(extensions.gen_random_bytes(16), 'hex')
    where id = target_list_id returning invite_code into code;
  return code;
end;
$$;

revoke all on function public.preview_household_invite(text) from public, anon;
revoke all on function public.accept_household_invite(text, uuid, text) from public, anon;
revoke all on function public.reset_household_invite(uuid) from public, anon;
grant execute on function public.preview_household_invite(text) to authenticated;
grant execute on function public.accept_household_invite(text, uuid, text) to authenticated;
grant execute on function public.reset_household_invite(uuid) to authenticated;
