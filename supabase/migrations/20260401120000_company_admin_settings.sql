-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Company admin self-management
-- Adds service pricing, currency, and company profile fields
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add price columns to services table
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS price integer DEFAULT 0,                    -- in minor units (cents/kobo)
  ADD COLUMN IF NOT EXISTS price_currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS show_price_on_kiosk boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS description text;

-- 2. Add settings columns to organizations table
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#7c3aed',
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3. Grant company admins RLS access to update their own organization
-- (organizations table should already have RLS; just ensure update policy exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organizations' AND policyname = 'company_admin_update_own_org'
  ) THEN
    CREATE POLICY company_admin_update_own_org ON public.organizations
      FOR UPDATE
      USING (
        id IN (
          SELECT organization_id FROM public.user_roles
          WHERE user_id = auth.uid() AND role IN ('company_admin', 'super_admin')
        )
      );
  END IF;
END $$;

-- 4. Grant company admins RLS access to update services prices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'services' AND policyname = 'company_admin_update_services'
  ) THEN
    CREATE POLICY company_admin_update_services ON public.services
      FOR UPDATE
      USING (
        organization_id IN (
          SELECT organization_id FROM public.user_roles
          WHERE user_id = auth.uid() AND role IN ('company_admin', 'super_admin')
        )
      );
  END IF;
END $$;
