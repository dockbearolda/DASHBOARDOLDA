-- Create planning_items table with all columns (including color) if it doesn't exist.
-- This covers the case where the table was never created via a prior migration.
CREATE TABLE IF NOT EXISTS "planning_items" (
    "id"          TEXT             NOT NULL,
    "priority"    TEXT             NOT NULL DEFAULT 'MOYENNE',
    "clientName"  TEXT             NOT NULL DEFAULT '',
    "quantity"    DOUBLE PRECISION NOT NULL DEFAULT 1,
    "designation" TEXT             NOT NULL DEFAULT '',
    "note"        TEXT             NOT NULL DEFAULT '',
    "unitPrice"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deadline"    TIMESTAMP(3),
    "status"      TEXT             NOT NULL DEFAULT 'A_DEVISER',
    "responsible" TEXT             NOT NULL DEFAULT '',
    "color"       TEXT             NOT NULL DEFAULT '',
    "position"    INTEGER          NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

-- Add color column if planning_items already existed without it.
ALTER TABLE "planning_items" ADD COLUMN IF NOT EXISTS "color" TEXT NOT NULL DEFAULT '';
