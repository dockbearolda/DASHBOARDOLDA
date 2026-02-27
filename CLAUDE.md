# Dashboard OLDA

## Démarrage du serveur de développement

À chaque nouvelle session, lancer dans l'ordre :

```bash
# 1. Démarrer PostgreSQL
service postgresql start

# 2. Vérifier que le .env existe
[ -f .env ] || echo 'DATABASE_URL="postgresql://dasholda:dasholda@localhost:5432/dasholda"' > .env

# 3. Lancer le serveur de dev
npm run dev
```

Le dashboard est accessible sur **http://localhost:3000/dashboard/olda**

## Branches de travail

- `claude/design-improvements` — branche de design actuelle
- Push autorisé sur `claude/fix-dashboard-layout-d4zCv`

## Stack

- Next.js 15 (App Router) + TypeScript
- Prisma ORM + PostgreSQL
- Tailwind CSS + Framer Motion
- Socket.io pour le temps réel
