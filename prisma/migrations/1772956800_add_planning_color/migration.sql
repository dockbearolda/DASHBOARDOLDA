-- Add color column to planning_items table
ALTER TABLE "planning_items" ADD COLUMN IF NOT EXISTS "color" TEXT NOT NULL DEFAULT '';
