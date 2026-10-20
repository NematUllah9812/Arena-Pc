-- =====================================================================
-- Overseer identities are self-contained (WebAuthn passkey + TOTP), not
-- Supabase Auth users. Decoupling from auth.users keeps the shared
-- project's auth triggers (e.g. handle_new_user → profiles) from firing
-- for vault operators and lets the vault be provisioned atomically.
-- =====================================================================
ALTER TABLE public.admin_vault_users DROP CONSTRAINT IF EXISTS admin_vault_users_id_fkey;
ALTER TABLE public.admin_vault_users ALTER COLUMN id SET DEFAULT gen_random_uuid();
