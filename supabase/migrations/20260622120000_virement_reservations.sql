-- Migration: replace single id_reservation FK with a junction table (1 virement → N réservations)
-- Run in Supabase Dashboard → SQL Editor

-- 1. Create junction table
CREATE TABLE IF NOT EXISTS public.virement_reservations (
  id_virement    UUID NOT NULL REFERENCES public.virements_proprietaires(id) ON DELETE CASCADE,
  id_reservation UUID NOT NULL REFERENCES public.reservations(id)             ON DELETE CASCADE,
  PRIMARY KEY (id_virement, id_reservation)
);

-- 2. Migrate existing single-reservation links into the junction table
INSERT INTO public.virement_reservations (id_virement, id_reservation)
SELECT id, id_reservation
FROM public.virements_proprietaires
WHERE id_reservation IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Drop the old column
ALTER TABLE public.virements_proprietaires
  DROP COLUMN IF EXISTS id_reservation;

-- 4. RLS
ALTER TABLE public.virement_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY virement_reservations_auth_all ON public.virement_reservations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
