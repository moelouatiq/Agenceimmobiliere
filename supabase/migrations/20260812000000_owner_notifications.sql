-- Notification email propriétaire par établissement (activable/désactivable individuellement)
ALTER TABLE public.proprietes
  ADD COLUMN IF NOT EXISTS owner_email TEXT,
  ADD COLUMN IF NOT EXISTS owner_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE;
