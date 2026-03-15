import { existsSync, copyFileSync } from "fs";
import { join } from "path";

/**
 * In Vercel serverless, the filesystem is read-only except /tmp.
 * Copy the seed database to /tmp so Prisma/SQLite can open it read-write.
 */
export function initDb(): void {
  if (!process.env.VERCEL) return;

  const tmpDb = "/tmp/dev.db";
  if (!existsSync(tmpDb)) {
    // The bundled db is at the project root under prisma/dev.db
    const sourceDb = join(__dirname, "../../prisma/dev.db");
    if (existsSync(sourceDb)) {
      copyFileSync(sourceDb, tmpDb);
      console.log("Copied seed database to /tmp/dev.db");
    } else {
      console.warn("No seed database found at", sourceDb);
    }
  }
}
