# 📋 Instructions de Migration Prisma

## Changements Apportés au Schéma

### Nouvelles colonnes dans `PRTRequest`:
- `designFileLink` (String, optionnel) - Lien Dropbox vers le fichier de design

### Nouveau modèle `UserProfile`:
```prisma
model UserProfile {
  id              String   @id @default(cuid())
  userId          String   @unique
  profilePhotoLink String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@map("user_profiles")
}
```

## Commandes à Exécuter

### 1️⃣ **Pour un environnement de développement LOCAL** (SQLite):

```bash
npx prisma migrate dev --name add_dropbox_fields
```

Cela va:
- Créer une migration SQL
- Appliquer les changements à votre base de données locale
- Régénérer le Prisma Client

### 2️⃣ **Pour une base de données PostgreSQL (Production)**:

Si vous avez une DATABASE_URL configurée:

```bash
npx prisma migrate deploy
```

Puis synchroniser:

```bash
npx prisma db push
```

### 3️⃣ **Si vous avez des problèmes de migration**:

```bash
# Reset la base de données (supprime les données!)
npx prisma migrate reset

# Ou créer manuellement les colonnes manquantes:
ALTER TABLE prt_requests ADD COLUMN designFileLink VARCHAR(500);
CREATE TABLE user_profiles (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(100) UNIQUE NOT NULL,
  profilePhotoLink VARCHAR(500),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## ✅ Validation

Après la migration, testez:

```bash
npx prisma studio  # Ouvre l'interface Prisma Studio
```

Vous devriez voir:
- La colonne `designFileLink` dans la table `prt_requests`
- La table `user_profiles` créée avec ses colonnes

## 🔄 Synchronisation Automatique

Une fois la migration appliquée:

```bash
npm run build
npm run dev
```

Voilà! ✅
