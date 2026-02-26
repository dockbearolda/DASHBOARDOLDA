-- Add category column to orders table (idempotent — safe to re-run)
-- Stores the product category sent by oldastudio (e.g. 't-shirt', 'mug').
-- Defaults to empty string so existing rows are unaffected.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT '';
