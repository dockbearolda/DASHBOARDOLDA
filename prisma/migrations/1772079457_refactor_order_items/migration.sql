-- ── Nouvelle architecture : colonnes dédiées OrderItem ──

-- Step 1: Ajouter les nouvelles colonnes à order_items
ALTER TABLE "order_items" ADD COLUMN "famille" TEXT,
ADD COLUMN "couleur" TEXT,
ADD COLUMN "tailleDTF" TEXT,
ADD COLUMN "positionLogo" TEXT,
ADD COLUMN "noteClient" TEXT,
ADD COLUMN "imageAvant" TEXT,
ADD COLUMN "imageArriere" TEXT,
ADD COLUMN "reference" TEXT,
ADD COLUMN "taille" TEXT,
ADD COLUMN "collection" TEXT,
ADD COLUMN "prtRef" TEXT,
ADD COLUMN "prtTaille" TEXT,
ADD COLUMN "prtQuantite" INTEGER,
ADD COLUMN "prixUnitaire" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "positionNote" TEXT;

-- Step 2: Migrer les données (price → prixUnitaire)
UPDATE "order_items" SET "prixUnitaire" = COALESCE("price", 0) WHERE "price" IS NOT NULL;

-- Step 3: Ajouter les nouvelles colonnes à orders
ALTER TABLE "orders" ADD COLUMN "customerFirstName" TEXT,
ADD COLUMN "deadline" TIMESTAMP(3);

-- Step 4: Dropper les anciennes colonnes de order_items
ALTER TABLE "order_items" DROP COLUMN "name",
DROP COLUMN "sku",
DROP COLUMN "quantity",
DROP COLUMN "price",
DROP COLUMN "imageUrl";

-- Step 5: Dropper les anciennes colonnes de orders
ALTER TABLE "orders" DROP COLUMN "shippingAddress",
DROP COLUMN "billingAddress";
