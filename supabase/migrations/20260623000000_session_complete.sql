-- =============================================================
-- Migration complète — session 2026-06-21 / 2026-06-23
-- Toutes les modifications base de données de cette session.
-- Idempotente : sûre à exécuter même si certaines étapes
-- ont déjà été appliquées manuellement.
-- =============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. TABLE proprietes — colonne ordre (drag-and-drop)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.proprietes
  ADD COLUMN IF NOT EXISTS ordre INTEGER;

-- Initialise l'ordre alphabétique pour les lignes sans valeur
UPDATE public.proprietes
SET ordre = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY nom) AS rn
  FROM public.proprietes
) sub
WHERE public.proprietes.id = sub.id
  AND public.proprietes.ordre IS NULL;


-- ─────────────────────────────────────────────────────────────
-- 2. TABLE reservations — colonnes blocage de période
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS is_blocked    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT;


-- ─────────────────────────────────────────────────────────────
-- 3. TABLE virement_reservations — jonction 1 virement → N réservations
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.virement_reservations (
  id_virement    UUID NOT NULL REFERENCES public.virements_proprietaires(id) ON DELETE CASCADE,
  id_reservation UUID NOT NULL REFERENCES public.reservations(id)             ON DELETE CASCADE,
  PRIMARY KEY (id_virement, id_reservation)
);

-- Migre les liens existants (colonne id_reservation sur virements_proprietaires)
-- avant de supprimer cette colonne.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'virements_proprietaires'
      AND column_name  = 'id_reservation'
  ) THEN
    INSERT INTO public.virement_reservations (id_virement, id_reservation)
    SELECT id, id_reservation
    FROM public.virements_proprietaires
    WHERE id_reservation IS NOT NULL
    ON CONFLICT DO NOTHING;

    ALTER TABLE public.virements_proprietaires
      DROP COLUMN id_reservation;
  END IF;
END;
$$;

-- RLS sur la nouvelle table
ALTER TABLE public.virement_reservations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'virement_reservations'
      AND policyname = 'virement_reservations_auth_all'
  ) THEN
    CREATE POLICY virement_reservations_auth_all ON public.virement_reservations
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END;
$$;
