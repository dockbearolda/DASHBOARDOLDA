#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  backup-db.sh — Sauvegarde automatique PostgreSQL — OLDA Studio Dashboard
#
#  Usage:
#    bash scripts/backup-db.sh              # sauvegarde manuelle
#    npm run db:backup                      # via npm
#
#  Politique de rétention :
#    · 48 backups horaires (2 derniers jours)
#    · 30 backups quotidiens (dernier mois)   — conservés à minuit
#    · 12 backups mensuels (dernière année)   — conservés le 1er du mois
#
#  Les fichiers sont écrits dans ./backups/
#  Format : backup_YYYYMMDD_HHMMSS.sql.gz
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"

DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_NAME="${PGDATABASE:-dasholda}"
DB_USER="${PGUSER:-dasholda}"
DB_PASS="${PGPASSWORD:-dasholda}"

# ── Prépare le dossier ────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ── Génère le nom du fichier ──────────────────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="backup_${TIMESTAMP}.sql.gz"
FILEPATH="$BACKUP_DIR/$FILENAME"

# ── Dump + compression ────────────────────────────────────────────────────────
echo "[backup] Démarrage : $FILENAME"

PGPASSWORD="$DB_PASS" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  | gzip -9 > "$FILEPATH"

SIZE=$(du -sh "$FILEPATH" | cut -f1)
echo "[backup] ✅ Sauvegardé : $FILEPATH ($SIZE)"

# ── Rotation : garde les 48 derniers backups horaires ────────────────────────
HOURLY_COUNT=$(ls -1 "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | wc -l)
if [ "$HOURLY_COUNT" -gt 48 ]; then
  ls -1t "$BACKUP_DIR"/backup_*.sql.gz | tail -n +49 | while read -r old; do
    # Ne supprime PAS les backups de minuit (conservation quotidienne)
    HOUR=$(echo "$old" | grep -oP '\d{8}_\K\d{2}')
    if [ "$HOUR" != "00" ]; then
      rm -f "$old"
      echo "[backup] 🗑️  Supprimé (rotation horaire) : $(basename "$old")"
    fi
  done
fi

# ── Rotation : garde les 30 derniers backups de minuit (quotidiens) ───────────
DAILY_COUNT=$(ls -1 "$BACKUP_DIR"/backup_*_00*.sql.gz 2>/dev/null | wc -l)
if [ "$DAILY_COUNT" -gt 30 ]; then
  ls -1t "$BACKUP_DIR"/backup_*_00*.sql.gz | tail -n +31 | while read -r old; do
    # Ne supprime PAS les backups du 1er du mois (conservation mensuelle)
    DAY=$(echo "$old" | grep -oP '\d{6}\K\d{2}')
    if [ "$DAY" != "01" ]; then
      rm -f "$old"
      echo "[backup] 🗑️  Supprimé (rotation quotidienne) : $(basename "$old")"
    fi
  done
fi

# ── Rotation : garde les 12 derniers backups mensuels ────────────────────────
MONTHLY_COUNT=$(ls -1 "$BACKUP_DIR"/backup_*01_00*.sql.gz 2>/dev/null | wc -l)
if [ "$MONTHLY_COUNT" -gt 12 ]; then
  ls -1t "$BACKUP_DIR"/backup_*01_00*.sql.gz | tail -n +13 | xargs -r rm -f
  echo "[backup] 🗑️  Rotation mensuelle appliquée"
fi

echo "[backup] Terminé. Backups disponibles : $(ls -1 "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | wc -l)"
