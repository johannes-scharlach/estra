-- Local writes go through PowerSync, which uploads every PUT as a PostgREST
-- upsert: INSERT ... ON CONFLICT (id) DO UPDATE SET ... (apps/mobile/src/db/
-- connector.ts). Postgres runs that statement's arbiter-conflict scan under
-- row-level security, so a row being upserted must also be *selectable*, not
-- just insertable. A first-ever list fails that twice:
--
--  lists        the new row violates SELECT's is_list_member(id), because the
--               creator is not a member of their own brand-new list yet ---
--               the same upload also carries their first list_members row
--               first-ever memberships fall away for the same reason, their
--               list_members upsert violates SELECT's is_list_member(list_id)
--               for exactly the same reason.
--
-- Both SELECT policies now also admit the natural "own rows" case: you can
-- always read a list you created, and your own membership rows. Everything
-- else stays membership-scoped as before.
drop policy "members can read lists" on public.lists;
create policy "members can read lists" on public.lists
  for select to authenticated
  using (public.is_list_member(id) or created_by = auth.uid());

drop policy "members can read membership" on public.list_members;
create policy "members can read membership" on public.list_members
  for select to authenticated
  using (public.is_list_member(list_id) or user_id = auth.uid());
