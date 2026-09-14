-- pgcrypto provides gen_random_bytes(), used by the invite_code default in
-- the initial schema. The local stack pre-installs it; hosted projects do
-- not, so this must exist before that migration runs. Hosted Supabase only
-- allows extensions in the `extensions` schema. The default calls it
-- schema-qualified: search_path varies per role (CLI connections, the
-- PostgREST API roles) and must not be load-bearing.
create extension if not exists pgcrypto with schema extensions;
