-- Ajoute un email optionnel sur la table clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS email TEXT;
