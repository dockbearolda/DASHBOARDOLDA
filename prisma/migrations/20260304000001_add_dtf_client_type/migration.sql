-- Ajout du champ clientType sur la table dtf_rows
-- Valeurs : 'particulier' | 'pro' | 'association'
ALTER TABLE "dtf_rows" ADD COLUMN "clientType" TEXT NOT NULL DEFAULT 'particulier';
