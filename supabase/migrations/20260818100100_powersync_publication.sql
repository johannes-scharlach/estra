-- PowerSync replication setup, following
-- https://docs.powersync.com/configuration/source-db/setup
--
-- Supabase already runs with wal_level = logical, so nothing else needs
-- enabling on the server side.

-- --------------------------------------------------------------------------
-- Replication role
--
-- PowerSync connects as a dedicated role rather than as `postgres`:
--   REPLICATION  — read the WAL
--   BYPASSRLS    — replication must see every row regardless of policies
--   SELECT only  — it never writes; client writes go through PostgREST
--
-- No password is set here. A LOGIN role without one cannot authenticate, so
-- this is inert until a credential is issued out of band — local dev sets
-- one in seed.sql, production sets its own. Keeps secrets out of git while
-- the structure still lives in migrations and applies to every environment.
-- --------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'powersync_role') then
    create role powersync_role with replication bypassrls login;
  end if;
end
$$;

grant connect on database postgres to powersync_role;
grant usage on schema public to powersync_role;
grant select on all tables in schema public to powersync_role;

-- Cover tables added by later migrations without having to remember this.
alter default privileges in schema public grant select on tables to powersync_role;

-- --------------------------------------------------------------------------
-- Publication
--
-- Must be named exactly `powersync`. Listing tables explicitly rather than
-- FOR ALL TABLES: the service reads every update in the publication whether
-- or not a sync stream references the table, so a wildcard means replicating
-- Supabase's internal churn too.
--
-- A new table needs adding here as well as to sync-config.yaml and the
-- client schema — see docs/decisions/0003-schema-source-of-truth.md.
-- --------------------------------------------------------------------------

create publication powersync for table
  public.categories,
  public.lists,
  public.list_members,
  public.list_items;
