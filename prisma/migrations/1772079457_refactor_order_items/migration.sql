-- ── Nouvelle architecture : colonnes dédiées OrderItem ──
-- Idempotent: uses IF NOT EXISTS / IF EXISTS so it is safe to re-run.

-- Step 1: Ajouter les nouvelles colonnes à order_items
ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "famille"      TEXT,
  ADD COLUMN IF NOT EXISTS "couleur"      TEXT,
  ADD COLUMN IF NOT EXISTS "tailleDTF"    TEXT,
  ADD COLUMN IF NOT EXISTS "positionLogo" TEXT,
  ADD COLUMN IF NOT EXISTS "noteClient"   TEXT,
  ADD COLUMN IF NOT EXISTS "imageAvant"   TEXT,
  ADD COLUMN IF NOT EXISTS "imageArriere" TEXT,
  ADD COLUMN IF NOT EXISTS "reference"    TEXT,
  ADD COLUMN IF NOT EXISTS "taille"       TEXT,
  ADD COLUMN IF NOT EXISTS "collection"   TEXT,
  ADD COLUMN IF NOT EXISTS "prtRef"       TEXT,
  ADD COLUMN IF NOT EXISTS "prtTaille"    TEXT,
  ADD COLUMN IF NOT EXISTS "prtQuantite"  INTEGER,
  ADD COLUMN IF NOT EXISTS "prixUnitaire" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "positionNote" TEXT;

-- Step 2: Migrer les données (price → prixUnitaire) si price existe encore
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'price'
  ) THEN
    UPDATE "order_items" SET "prixUnitaire" = COALESCE("price"::double precision, 0);
  END IF;
END $$;

-- Step 3: Ajouter les nouvelles colonnes à orders
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "customerFirstName" TEXT,
  ADD COLUMN IF NOT EXISTS "deadline"          TIMESTAMP(3);
