-- ZcashConnect — merchant profile fields, archive support, admin verify path.

-- ============================================================
-- merchants: profile fields + archive flag
-- ============================================================
ALTER TABLE public.merchants
  ADD COLUMN contact_email TEXT,
  ADD COLUMN support_url   TEXT,
  ADD COLUMN brand_color   TEXT,
  ADD COLUMN logo_url      TEXT,
  ADD COLUMN archived_at   TIMESTAMPTZ;

-- brand_color must be #rrggbb if set; URLs/email are validated at the app boundary.
ALTER TABLE public.merchants
  ADD CONSTRAINT merchants_brand_color_hex_check
  CHECK (brand_color IS NULL OR brand_color ~ '^#[0-9a-fA-F]{6}$');

CREATE INDEX idx_merchants_pending_verification
  ON public.merchants(created_at)
  WHERE verified = false AND archived_at IS NULL;
