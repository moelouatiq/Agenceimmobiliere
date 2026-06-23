-- Migration: add blocked period support to reservations
-- Run this once in Supabase Dashboard → SQL Editor

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
