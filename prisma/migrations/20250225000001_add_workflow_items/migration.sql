DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkflowType') THEN
    CREATE TYPE "WorkflowType" AS ENUM ('ACHAT', 'STANDARD', 'ATELIER', 'DTF');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "workflow_items" (
    "id"        TEXT NOT NULL,
    "content"   TEXT NOT NULL,
    "type"      "WorkflowType" NOT NULL,
    "position"  INTEGER NOT NULL DEFAULT 0,
    "done"      BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_items_pkey" PRIMARY KEY ("id")
);
