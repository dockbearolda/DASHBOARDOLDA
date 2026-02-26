#!/usr/bin/env node
/**
 * Migration handler that resolves Prisma P3005 and P3009 issues.
 *
 * P3005 occurs when the database schema is not empty but the _prisma_migrations
 * table does not exist (schema was created via db push, not migrate).
 *
 * P3009 occurs when a previous migration run left a failed migration record in
 * the _prisma_migrations table, blocking all subsequent deployments.
 *
 * Strategy:
 * 1. Try prisma migrate deploy normally
 * 2. If P3005: mark the baseline migration as applied via PrismaClient raw SQL
 * 3. Retry prisma migrate deploy (which will now apply the refactor migration)
 * 4. If deploy fails because refactor columns already exist: mark refactor as applied too
 * 5. Final deploy (no-op if everything is now aligned)
 * 6. If P3009: extract failed migration name(s), resolve each as rolled-back, then re-deploy
 */

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CWD = path.join(__dirname, '..');
const MIGRATIONS_DIR = path.join(CWD, 'prisma', 'migrations');

/** Run a command, always printing output, returning {ok, output} */
function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: CWD,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';

  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  return {
    ok: result.status === 0,
    output: stdout + stderr,
  };
}

/** Compute SHA-256 checksum of a file (Prisma's format) */
function fileChecksum(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/** Generate a UUID v4 compatible string */
function newId() {
  const bytes = crypto.randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/** Get sorted list of migration folder names */
function getMigrationFolders() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(
      (f) =>
        fs.statSync(path.join(MIGRATIONS_DIR, f)).isDirectory() &&
        fs.existsSync(path.join(MIGRATIONS_DIR, f, 'migration.sql'))
    )
    .sort();
}

/**
 * Use the `pg` package (production dependency, no code generation needed)
 * to create _prisma_migrations table and register migrations as applied.
 */
async function registerMigrationsAsApplied(migrationNames) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Create the table Prisma uses to track migrations
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id"                  VARCHAR(36)  NOT NULL,
        "checksum"            VARCHAR(64)  NOT NULL,
        "finished_at"         TIMESTAMPTZ,
        "migration_name"      VARCHAR(255) NOT NULL,
        "logs"                TEXT,
        "rolled_back_at"      TIMESTAMPTZ,
        "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY ("id")
      )
    `);

    for (const name of migrationNames) {
      const sqlFile = path.join(MIGRATIONS_DIR, name, 'migration.sql');
      const checksum = fileChecksum(sqlFile);

      // Only insert if not already recorded (no unique constraint on name, so use SELECT first)
      const { rows } = await client.query(
        `SELECT "id" FROM "_prisma_migrations" WHERE "migration_name" = $1 LIMIT 1`,
        [name]
      );

      if (rows.length === 0) {
        await client.query(
          `INSERT INTO "_prisma_migrations"
             ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
           VALUES ($1, $2, NOW(), $3, NULL, NULL, NOW(), 1)`,
          [newId(), checksum, name]
        );
        console.log(`  ✓ Registered as applied: ${name}`);
      } else {
        console.log(`  ✓ Already registered:    ${name}`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  console.log('🔄 Starting Prisma migration...\n');

  const allMigrations = getMigrationFolders();
  const [baseline, ...rest] = allMigrations;

  // ─── Attempt 1: standard deploy ──────────────────────────────────────────
  const attempt1 = run('npx', ['prisma', 'migrate', 'deploy']);
  if (attempt1.ok) {
    console.log('\n✅ Migration complete\n');
    process.exit(0);
  }

  // ─── P3009 recovery: resolve failed migrations ────────────────────────────
  const isP3009 =
    attempt1.output.includes('P3009') ||
    attempt1.output.includes('migrate found failed migrations');

  if (isP3009) {
    // Extract all failed migration names from the error output
    const failedMigrations = [];
    const re = /The `([^`]+)` migration\b[^`]*failed/g;
    let m;
    while ((m = re.exec(attempt1.output)) !== null) {
      failedMigrations.push(m[1]);
    }

    if (failedMigrations.length === 0) {
      console.error('\n❌ P3009 detected but could not extract failed migration name(s)\n');
      process.exit(1);
    }

    console.log(`\n⚠️  P3009 detected — resolving failed migration(s): ${failedMigrations.join(', ')}\n`);

    for (const migrationName of failedMigrations) {
      const resolveResult = run('npx', [
        'prisma', 'migrate', 'resolve', '--rolled-back', migrationName,
      ]);
      if (!resolveResult.ok) {
        console.error(`\n❌ Failed to resolve migration: ${migrationName}\n`);
        process.exit(1);
      }
      console.log(`  ✓ Resolved as rolled-back: ${migrationName}`);
    }

    console.log('\n  Retrying migrate deploy after P3009 resolution...\n');
    const retryResult = run('npx', ['prisma', 'migrate', 'deploy']);
    if (retryResult.ok) {
      console.log('\n✅ Migration complete after P3009 resolution\n');
      process.exit(0);
    }

    console.error('\n❌ Migration failed after P3009 resolution\n');
    process.exit(1);
  }

  const isP3005 =
    attempt1.output.includes('P3005') ||
    attempt1.output.includes('schema is not empty');

  if (!isP3005) {
    console.error('\n❌ Migration failed (unexpected error, not P3005)\n');
    process.exit(1);
  }

  // ─── P3005 recovery: register baseline as applied ────────────────────────
  console.log(`\n⚠️  P3005 detected — establishing baseline: ${baseline}\n`);
  try {
    await registerMigrationsAsApplied([baseline]);
  } catch (err) {
    console.error('\n❌ Failed to register baseline migration:', err.message);
    process.exit(1);
  }

  // ─── Attempt 2: deploy after baseline (applies remaining migrations) ─────
  console.log('\n  Retrying migrate deploy...\n');
  const attempt2 = run('npx', ['prisma', 'migrate', 'deploy']);
  if (attempt2.ok) {
    console.log('\n✅ Migration complete after baseline\n');
    process.exit(0);
  }

  // If attempt 2 fails, the remaining migrations may already be applied
  // (e.g., schema was created with db push using the latest schema).
  // Register ALL migrations as applied and do a final no-op deploy.
  const alreadyApplied =
    attempt2.output.includes('already exists') ||
    attempt2.output.includes('duplicate column') ||
    attempt2.output.includes('42701'); // PostgreSQL "duplicate_column" error code

  if (!alreadyApplied && rest.length > 0) {
    console.error(
      '\n❌ Migration failed after baseline (not a duplicate-column error)\n'
    );
    process.exit(1);
  }

  console.log('\n  Schema appears up-to-date — registering remaining migrations...\n');
  try {
    await registerMigrationsAsApplied(rest);
  } catch (err) {
    console.error('\n❌ Failed to register remaining migrations:', err.message);
    process.exit(1);
  }

  // ─── Attempt 3: final deploy (should be a clean no-op) ───────────────────
  console.log('\n  Final migrate deploy (no-op expected)...\n');
  const attempt3 = run('npx', ['prisma', 'migrate', 'deploy']);
  if (attempt3.ok) {
    console.log('\n✅ Migration complete (all migrations baseline-registered)\n');
    process.exit(0);
  }

  console.error('\n❌ Migration failed after full baseline registration\n');
  process.exit(1);
}

main().catch((err) => {
  console.error('\n❌ Unexpected error:', err.message);
  process.exit(1);
});
