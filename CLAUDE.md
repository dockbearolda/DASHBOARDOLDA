# Dashboard OLDA

## Base de données

**PostgreSQL hébergée sur Railway** — jamais en local.

Le `.env.local` à la racine du projet doit contenir :
```
DATABASE_URL="postgresql://postgres:fOUknOcXFkbDYBtGwHnodjvcCCPwQYpv@mainline.proxy.rlwy.net:49101/railway"
```

Pour appliquer un changement de schéma Prisma :
```bash
DATABASE_URL="postgresql://postgres:fOUknOcXFkbDYBtGwHnodjvcCCPwQYpv@mainline.proxy.rlwy.net:49101/railway" npx prisma db push
```

## Démarrage du serveur de développement

```bash
npm run dev
```

Le dashboard est accessible sur **http://localhost:3000/dashboard/olda**

## Branches de travail

- `claude/zen-ride` — branche active
- Push autorisé sur cette branche

## Stack

- Next.js 15 (App Router) + TypeScript
- Prisma ORM + PostgreSQL (Railway)
- Tailwind CSS + Framer Motion
- Socket.io pour le temps réel
