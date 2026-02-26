-- Idempotent migration: convert OrderStatus enum values from English to French
-- Safe to re-run: skips entirely if French values are already present (e.g. after a db push)

-- Clean up any leftover "new" type from a previous failed run of this migration
DROP TYPE IF EXISTS "OrderStatus_new";

DO $$
BEGIN
  -- Only run the migration if "OrderStatus" still has the old English value 'PENDING'
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'OrderStatus' AND e.enumlabel = 'PENDING'
  ) THEN
    -- Create the new French enum type
    CREATE TYPE "OrderStatus_new" AS ENUM (
      'COMMANDE_A_TRAITER',
      'COMMANDE_EN_ATTENTE',
      'COMMANDE_A_PREPARER',
      'MAQUETTE_A_FAIRE',
      'PRT_A_FAIRE',
      'EN_ATTENTE_VALIDATION',
      'EN_COURS_IMPRESSION',
      'PRESSAGE_A_FAIRE',
      'CLIENT_A_CONTACTER',
      'CLIENT_PREVENU',
      'ARCHIVES'
    );

    -- Migrate existing rows (English → French)
    UPDATE "orders" SET "status" = 'COMMANDE_A_TRAITER'  WHERE "status"::text = 'PENDING';
    UPDATE "orders" SET "status" = 'COMMANDE_A_PREPARER' WHERE "status"::text = 'PROCESSING';
    UPDATE "orders" SET "status" = 'ARCHIVES'            WHERE "status"::text IN ('SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');

    -- Swap the column type
    ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "orders" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
    ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'COMMANDE_A_TRAITER';

    -- Replace the old enum type
    DROP TYPE "OrderStatus";
    ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
  END IF;
END $$;
