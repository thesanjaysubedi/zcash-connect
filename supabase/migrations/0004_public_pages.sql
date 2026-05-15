-- supabase/migrations/0004_public_pages.sql
-- ZcashConnect — waitlist signups + demo sandbox support.

-- ============================================================
-- waitlist_signups
-- ============================================================
CREATE TABLE public.waitlist_signups (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT NOT NULL,
  source      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX waitlist_signups_email_lower
  ON public.waitlist_signups (lower(email));

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT policy — service-role only. Operator inspection via
-- a future REST endpoint gated by ADMIN_EMAILS (out of scope for this plan).

-- ============================================================
-- merchants: demo flag + expiry
-- ============================================================
ALTER TABLE public.merchants
  ADD COLUMN is_demo          BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN demo_expires_at  TIMESTAMPTZ;

CREATE INDEX idx_merchants_demo_expiring
  ON public.merchants(demo_expires_at)
  WHERE is_demo = true;
