-- Add archived column to planning_items (idempotent)
ALTER TABLE "planning_items"
  ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;

-- Add archived column to achat_textile (idempotent)
ALTER TABLE "achat_textile"
  ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;
