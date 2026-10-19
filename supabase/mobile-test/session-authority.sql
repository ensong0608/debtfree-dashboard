-- TEST ONLY. Manager must first verify test project/connection and execute:
-- SET mobile_test.project_ref = 'otggeztwtaklsqwtztgz';
-- Disabled until manager installs the schema and the secure setup command configures credentials.
BEGIN;
DO $guard$
BEGIN
  IF current_setting('mobile_test.project_ref', true) IS DISTINCT FROM 'otggeztwtaklsqwtztgz' THEN
    RAISE EXCEPTION 'Explicit test project confirmation required';
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname IN ('mobile_session_authority_owner','mobile_session_authority_login')) THEN
    RAISE EXCEPTION 'Authority roles already exist; inspect rather than overwrite';
  END IF;
END
$guard$;
CREATE ROLE mobile_session_authority_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE mobile_session_authority_login NOLOGIN PASSWORD NULL CONNECTION LIMIT 4 NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE mobile_session_authority_login SET search_path = '';
ALTER ROLE mobile_session_authority_login SET statement_timeout = '2s';
ALTER ROLE mobile_session_authority_login SET idle_in_transaction_session_timeout = '3s';
-- PostgreSQL 16+ requires SET membership to transfer object ownership.
-- The installer receives it only inside this transaction; never the login.
DO $installer$ BEGIN
  EXECUTE pg_catalog.format('GRANT mobile_session_authority_owner TO %I WITH SET TRUE, INHERIT TRUE', current_user);
END $installer$;
CREATE SCHEMA mobile_session_authority AUTHORIZATION mobile_session_authority_owner;
REVOKE ALL ON SCHEMA mobile_session_authority FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA mobile_session_authority TO mobile_session_authority_login;
-- Hosted auth schema is managed: postgres cannot grant its USAGE onward.
-- Bind the fixed read at installation; execution still checks narrow columns/RLS.
GRANT SELECT (id,user_id,created_at,not_after,refresh_token_counter) ON auth.sessions TO mobile_session_authority_owner;
GRANT SELECT (id,email,email_confirmed_at,banned_until,deleted_at,is_anonymous) ON auth.users TO mobile_session_authority_owner;
GRANT SELECT (user_id,provider,email,identity_data) ON auth.identities TO mobile_session_authority_owner;
-- Legacy sessions require current non-revoked refresh metadata, never token values.
GRANT SELECT (session_id,user_id,revoked) ON auth.refresh_tokens TO mobile_session_authority_owner;
-- These managed Auth tables have RLS enabled. Column grants alone return no rows.
-- Only the NOLOGIN definer owner receives SELECT policies; the network login
-- still has no Auth-table reads and can execute only the fixed private function.
-- Policies do not grant table privileges to API roles or disable RLS.
CREATE POLICY mobile_authority_session_read ON auth.sessions
  FOR SELECT TO mobile_session_authority_owner USING (true);
CREATE POLICY mobile_authority_user_read ON auth.users
  FOR SELECT TO mobile_session_authority_owner USING (true);
CREATE POLICY mobile_authority_identity_read ON auth.identities
  FOR SELECT TO mobile_session_authority_owner USING (true);
CREATE POLICY mobile_authority_refresh_read ON auth.refresh_tokens
  FOR SELECT TO mobile_session_authority_owner USING (true);
-- Application timeout authority persists independently of upstream refresh timestamps.
-- An overdue session cannot be revived by refreshing before the next check.
CREATE TABLE mobile_session_authority.session_policy (
  session_id uuid PRIMARY KEY REFERENCES auth.sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_seen_at timestamptz NOT NULL,
  expired boolean NOT NULL DEFAULT false
);
ALTER TABLE mobile_session_authority.session_policy OWNER TO mobile_session_authority_owner;
REVOKE ALL ON TABLE mobile_session_authority.session_policy FROM PUBLIC, anon, authenticated, service_role, mobile_session_authority_login;
-- SQL-standard body binds exact relation OIDs at installation, without runtime
-- auth-namespace lookup. INVOKER retains owner column grants and RLS checks.
CREATE FUNCTION mobile_session_authority.session_facts(p_subject uuid, p_session uuid)
RETURNS TABLE(created_at timestamptz,not_after timestamptz,email text,email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz,is_anonymous boolean,google_identity boolean,refresh_live boolean)
LANGUAGE SQL SECURITY INVOKER SET search_path = ''
BEGIN ATOMIC
  SELECT s.created_at,s.not_after,u.email::text,u.email_confirmed_at,u.banned_until,u.deleted_at,u.is_anonymous,
    EXISTS (SELECT FROM auth.identities AS i WHERE i.user_id=p_subject AND i.provider='google'
      AND pg_catalog.lower(i.email)=pg_catalog.lower(u.email) AND i.identity_data -> 'email_verified' = 'true'::jsonb),
    CASE WHEN s.refresh_token_counter IS NOT NULL THEN s.refresh_token_counter >= 0
      ELSE EXISTS (SELECT FROM auth.refresh_tokens AS r
        WHERE r.session_id = p_session AND r.user_id = p_subject::text AND r.revoked = false) END
  FROM auth.sessions AS s JOIN auth.users AS u ON u.id=s.user_id
  WHERE s.id=p_session AND s.user_id=p_subject;
END;
ALTER FUNCTION mobile_session_authority.session_facts(uuid,uuid) OWNER TO mobile_session_authority_owner;
REVOKE ALL ON FUNCTION mobile_session_authority.session_facts(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role, mobile_session_authority_login;
-- Definer is necessary to keep the network login unable to read Auth tables.
-- The non-login function owner has only the column reads above, not BYPASSRLS.
CREATE FUNCTION mobile_session_authority.check_session(p_subject uuid, p_session uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET statement_timeout = '2s'
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_row record;
  v_google boolean := false;
  v_enabled boolean := false;
  v_refresh_live boolean := false;
  v_inactive timestamptz;
  v_absolute timestamptz;
  v_active boolean := false;
  v_policy record;
BEGIN
  IF session_user <> 'mobile_session_authority_login' OR p_subject IS NULL OR p_session IS NULL THEN
    RAISE EXCEPTION 'Authority caller denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM mobile_session_authority.session_facts(p_subject,p_session);
  IF FOUND THEN
    v_google := v_row.google_identity;
    v_enabled := v_row.deleted_at IS NULL AND NOT v_row.is_anonymous
      AND (v_row.banned_until IS NULL OR v_row.banned_until <= v_now);
    v_refresh_live := v_row.refresh_live;
    -- New enrollment requires a fresh session; old sessions must sign in again.
    IF v_row.created_at > v_now - interval '30 minutes' AND v_row.created_at <= v_now THEN
      INSERT INTO mobile_session_authority.session_policy(session_id,user_id,last_seen_at)
        VALUES (p_session,p_subject,v_now) ON CONFLICT (session_id) DO NOTHING;
    END IF;
    SELECT user_id,last_seen_at,expired INTO v_policy
      FROM mobile_session_authority.session_policy WHERE session_id=p_session FOR UPDATE;
    v_now := pg_catalog.clock_timestamp();
    IF FOUND THEN
      v_inactive := v_policy.last_seen_at + interval '30 minutes';
    END IF;
    v_absolute := LEAST(v_row.created_at + interval '12 hours', COALESCE(v_row.not_after, 'infinity'::timestamptz));
    -- Never accept session-row existence alone after legacy family revocation.
    v_active := COALESCE(v_enabled AND v_google AND v_refresh_live
      AND v_row.email_confirmed_at IS NOT NULL
      AND v_row.email IS NOT NULL AND v_row.email <> ''
      AND v_policy.user_id = p_subject AND NOT v_policy.expired
      AND v_row.created_at <= v_now AND v_inactive > v_now AND v_absolute > v_now, false);
    IF v_active THEN
      UPDATE mobile_session_authority.session_policy SET last_seen_at=v_now WHERE session_id=p_session;
      v_inactive := v_now + interval '30 minutes';
    ELSE
      UPDATE mobile_session_authority.session_policy SET expired=true WHERE session_id=p_session;
    END IF;
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'active', v_active, 'subject', p_subject, 'sessionId', p_session,
    'confirmedEmail', CASE WHEN v_active THEN pg_catalog.lower(v_row.email) ELSE '' END,
    'googleIdentity', COALESCE(v_google,false), 'userEnabled', COALESCE(v_enabled,false),
    'policyVersion', 'native-test-v1',
    'checkedAt', pg_catalog.floor(EXTRACT(epoch FROM v_now)*1000),
    'inactiveAt', CASE WHEN v_inactive IS NULL THEN 0 ELSE pg_catalog.floor(EXTRACT(epoch FROM v_inactive)*1000) END,
    'absoluteExpiresAt', CASE WHEN v_absolute IS NULL THEN 0 ELSE pg_catalog.floor(EXTRACT(epoch FROM v_absolute)*1000) END);
END
$function$;
ALTER FUNCTION mobile_session_authority.check_session(uuid,uuid) OWNER TO mobile_session_authority_owner;
REVOKE ALL ON FUNCTION mobile_session_authority.check_session(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION mobile_session_authority.check_session(uuid,uuid) TO mobile_session_authority_login;
REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM mobile_session_authority_login;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA auth FROM mobile_session_authority_login;
ALTER DEFAULT PRIVILEGES FOR ROLE mobile_session_authority_owner IN SCHEMA mobile_session_authority
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
DO $installer$ BEGIN
  EXECUTE pg_catalog.format('REVOKE mobile_session_authority_owner FROM %I', current_user);
END $installer$;
COMMIT;
