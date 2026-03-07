-- Add new columns to orders (idempotent)
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "customerFirstName" TEXT,
  ADD COLUMN IF NOT EXISTS "customerAddress"   TEXT,
  ADD COLUMN IF NOT EXISTS "deadline"          TIMESTAMP(3);

-- Create prt_requests table if it doesn't exist
CREATE TABLE IF NOT EXISTS "prt_requests" (
    "id"             TEXT         NOT NULL,
    "clientName"     TEXT         NOT NULL DEFAULT '',
    "dimensions"     TEXT         NOT NULL DEFAULT '',
    "design"         TEXT         NOT NULL DEFAULT '',
    "designFileLink" TEXT,
    "color"          TEXT         NOT NULL DEFAULT '',
    "quantity"       INTEGER      NOT NULL DEFAULT 1,
    "done"           BOOLEAN      NOT NULL DEFAULT false,
    "position"       INTEGER      NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prt_requests_pkey" PRIMARY KEY ("id")
);

-- Add designFileLink column if table already existed without it
ALTER TABLE "prt_requests"
  ADD COLUMN IF NOT EXISTS "designFileLink" TEXT;
