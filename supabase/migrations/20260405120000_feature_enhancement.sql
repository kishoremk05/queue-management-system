-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Full feature enhancement
-- Adds org kiosk/notification settings, token tracking columns,
-- appointments, activity_logs, device_health tables
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Organization kiosk & notification settings
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS kiosk_idle_message text DEFAULT 'Welcome! Tap to get started',
  ADD COLUMN IF NOT EXISTS kiosk_ads jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_print_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_ads jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sms_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_before_turns integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS avg_service_time_minutes integer DEFAULT 5;

-- 2. Token tracking enhancements
ALTER TABLE public.tokens
  ADD COLUMN IF NOT EXISTS staff_notes text,
  ADD COLUMN IF NOT EXISTS served_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS actual_wait_minutes integer,
  ADD COLUMN IF NOT EXISTS notification_sent boolean DEFAULT false;

-- 3. Appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled','checked_in','completed','cancelled','no_show')),
  notes text,
  token_id uuid REFERENCES public.tokens(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Activity / audit log
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 5. Device health monitoring
CREATE TABLE IF NOT EXISTS public.device_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  device_type text NOT NULL CHECK (device_type IN ('kiosk','display','printer')),
  device_name text,
  status text DEFAULT 'online' CHECK (status IN ('online','offline','warning')),
  last_heartbeat timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 6. RLS on new tables
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_health ENABLE ROW LEVEL SECURITY;

-- Appointments: org members can read, company_admin can write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appointments' AND policyname='appointments_select_org') THEN
    CREATE POLICY appointments_select_org ON public.appointments FOR SELECT
      USING (organization_id IN (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appointments' AND policyname='appointments_insert_org') THEN
    CREATE POLICY appointments_insert_org ON public.appointments FOR INSERT
      WITH CHECK (organization_id IN (
        SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('company_admin','super_admin')
      ));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appointments' AND policyname='appointments_update_org') THEN
    CREATE POLICY appointments_update_org ON public.appointments FOR UPDATE
      USING (organization_id IN (
        SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('company_admin','super_admin','staff')
      ));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appointments' AND policyname='appointments_delete_org') THEN
    CREATE POLICY appointments_delete_org ON public.appointments FOR DELETE
      USING (organization_id IN (
        SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('company_admin','super_admin')
      ));
  END IF;
END $$;

-- Activity logs: org members can read, anyone can insert
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activity_logs' AND policyname='activity_logs_select_org') THEN
    CREATE POLICY activity_logs_select_org ON public.activity_logs FOR SELECT
      USING (organization_id IN (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activity_logs' AND policyname='activity_logs_insert_org') THEN
    CREATE POLICY activity_logs_insert_org ON public.activity_logs FOR INSERT
      WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()));
  END IF;
END $$;

-- Device health: org members can read/write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='device_health' AND policyname='device_health_select_org') THEN
    CREATE POLICY device_health_select_org ON public.device_health FOR SELECT
      USING (organization_id IN (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='device_health' AND policyname='device_health_all_org') THEN
    CREATE POLICY device_health_all_org ON public.device_health FOR ALL
      USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

-- Index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_tokens_org_status ON public.tokens (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_tokens_served_at ON public.tokens (served_at) WHERE served_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_org_date ON public.appointments (organization_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_activity_logs_org ON public.activity_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_health_org ON public.device_health (organization_id, device_type);
