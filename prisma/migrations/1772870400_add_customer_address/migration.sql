-- Add customerAddress column to orders table
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
