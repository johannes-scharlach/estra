-- The client connector uploads every local write as a PostgREST upsert
-- (INSERT ... ON CONFLICT (id) DO UPDATE SET ...). For a PRE-EXISTING row that
-- is fine, but Postgres applies the *update* policy's WITH CHECK to the new
-- row too, even when nothing conflicts. Two tables failed that for a
-- first-ever list, with 42501 "row-level security policy for table \"lists\"":
--
--   lists        update policy was members-only, and the creator of a brand
--                new list is by definition not a member of it yet server-side
--                (their list_members row sits later in the same upload).
--   list_members had no update policy at all, so every upsert of the
--                creator's own first membership row was denied outright.
--
-- Both update policies stay membership-scoped, not a global open door; they
-- merely stop rejecting the rows the corresponding insert policies already
-- accept.

-- Creators may edit their own list (rename etc.) even if the membership row
-- has not been uploaded yet.
drop policy "members can update lists" on public.lists;
create policy "members or creators can update lists" on public.lists
  for update to authenticated
  using (public.is_list_member(id) or created_by = auth.uid())
  with check (public.is_list_member(id) or created_by = auth.uid());

-- Membership rows are semantically insert-only; the update path here only
-- exists because the connector upserts, and mirrors the insert policy's
-- membership scope (including the creator's own first row).
create policy "members or creators can update memberships" on public.list_members
  for update to authenticated
  using (
    public.is_list_member(list_id)
    or exists (
      select 1 from public.lists l
      where l.id = list_id and l.created_by = auth.uid()
    )
  )
  with check (
    public.is_list_member(list_id)
    or exists (
      select 1 from public.lists l
      where l.id = list_id and l.created_by = auth.uid()
    )
  );
