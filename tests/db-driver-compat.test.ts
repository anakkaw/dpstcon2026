import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SOURCE_DIRS = ["app", "server"];
const DISALLOWED_PATTERNS = [
  {
    label: "db.transaction is not supported by drizzle-orm/neon-http",
    pattern: /\.transaction\(/,
  },
  {
    label: "transaction-scoped advisory locks do not work without transactions",
    pattern: /pg_advisory_xact_lock/,
  },
];

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      return listSourceFiles(path);
    }

    if (!/\.(ts|tsx)$/.test(entry)) {
      return [];
    }

    return [path];
  });
}

test("database code stays compatible with the Neon HTTP driver", () => {
  const offenders: string[] = [];

  for (const file of SOURCE_DIRS.flatMap(listSourceFiles)) {
    const source = readFileSync(file, "utf8");
    for (const { label, pattern } of DISALLOWED_PATTERNS) {
      if (pattern.test(source)) {
        offenders.push(`${file}: ${label}`);
      }
    }
  }

  assert.deepEqual(offenders, []);
});
