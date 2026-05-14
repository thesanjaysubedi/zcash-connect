-- ZcashConnect — api_requests table + api_keys rotation columns.

-- ============================================================
-- api_requests: one row per /api/v1/* request
-- ============================================================
CREATE TABLE public.api_requests (
  id           BIGSERIAL PRIMARY KEY,
  merchant_id  UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
  api_key_id   UUID REFERENCES public.api_keys(id)  ON DELETE SET NULL,
  method       TEXT     NOT NULL,
  path         TEXT     NOT NULL,
  status       SMALLINT NOT NULL,
  latency_ms   INTEGER  NOT NULL,
  error_code   TEXT,
  user_agent   TEXT,
  ip           INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_requests_merchant_created
  ON public.api_requests (merchant_id, created_at DESC);
CREATE INDEX idx_api_requests_key_created
  ON public.api_requests (api_key_id, created_at DESC);
CREATE INDEX idx_api_requests_created_for_purge
  ON public.api_requests (created_at);

ALTER TABLE public.api_requests ENABLE ROW LEVEL SECURITY;

-- SELECT scoped to the calling merchant. INSERT happens only via
-- service-role from the api-log wrapper.
CREATE POLICY api_requests_select_own ON public.api_requests FOR SELECT
  USING (auth.uid() = merchant_id);

-- ============================================================
-- api_keys: rotation support
-- ============================================================
ALTER TABLE public.api_keys
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN rotated_to UUID REFERENCES public.api_keys(id);

CREATE INDEX idx_api_keys_expiring
  ON public.api_keys(expires_at) WHERE expires_at IS NOT NULL;
