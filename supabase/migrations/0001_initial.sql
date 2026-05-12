-- ZcashConnect — initial schema + RLS + signup trigger.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- merchants
-- ============================================================
CREATE TABLE public.merchants (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name      TEXT NOT NULL,
  payout_address  TEXT,
  verified        BOOLEAN NOT NULL DEFAULT false,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_merchants_updated_at
  BEFORE UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- api_keys
-- ============================================================
CREATE TABLE public.api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  prefix          TEXT NOT NULL UNIQUE,
  hashed_secret   TEXT NOT NULL,
  last_used_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_merchant_active
  ON public.api_keys(merchant_id) WHERE revoked_at IS NULL;

-- ============================================================
-- invoices  (used by Plan B but schema lives here)
-- ============================================================
CREATE TABLE public.invoices (
  id                TEXT PRIMARY KEY,
  merchant_id       UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  amount_zatoshis   BIGINT NOT NULL CHECK (amount_zatoshis > 0),
  payout_address    TEXT NOT NULL,
  memo_text         TEXT,
  reference         TEXT,
  description       TEXT,
  status            TEXT NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open','paid','expired','void')),
  expires_at        TIMESTAMPTZ NOT NULL,
  paid_at           TIMESTAMPTZ,
  paid_txid         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_merchant ON public.invoices(merchant_id, created_at DESC);
CREATE INDEX idx_invoices_status_expires ON public.invoices(status, expires_at);

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- handle_new_user trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.merchants (id, store_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'store_name', 'New Merchant')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices  ENABLE ROW LEVEL SECURITY;

-- merchants: own row only
CREATE POLICY merchants_select_own ON public.merchants FOR SELECT
  USING (auth.uid() = id);
CREATE POLICY merchants_update_own ON public.merchants FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- api_keys: own rows only
CREATE POLICY api_keys_select_own ON public.api_keys FOR SELECT
  USING (auth.uid() = merchant_id);
CREATE POLICY api_keys_insert_own ON public.api_keys FOR INSERT
  WITH CHECK (auth.uid() = merchant_id);
CREATE POLICY api_keys_update_own ON public.api_keys FOR UPDATE
  USING (auth.uid() = merchant_id) WITH CHECK (auth.uid() = merchant_id);

-- invoices: dashboard reads its own
CREATE POLICY invoices_select_own ON public.invoices FOR SELECT
  USING (auth.uid() = merchant_id);
