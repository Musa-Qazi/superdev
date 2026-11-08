import assert from "node:assert/strict";
import test from "node:test";
import { postgresConnectionOptions, prepareSql } from "./postgres.js";

test("Supabase connections verify TLS against its root certificate", () => {
  const options = postgresConnectionOptions("postgres://user:pass@db.example.supabase.co:5432/postgres?sslmode=require");
  assert.ok(!options.connectionString?.includes("sslmode"));
  assert.equal((options.ssl as { rejectUnauthorized?: boolean }).rejectUnauthorized, true);
  assert.match(String((options.ssl as { ca?: string }).ca), /BEGIN CERTIFICATE/);
  assert.equal(options.max, 1);
});

test("translates placeholders without changing quoted question marks", () => {
  assert.equal(
    prepareSql("SELECT * FROM tasks WHERE title = 'Why?' AND id = ? AND description = ?", false),
    "SELECT * FROM tasks WHERE title = 'Why?' AND id = $1 AND description = $2",
  );
});

test("preserves escaped quotes while translating parameters", () => {
  assert.equal(
    prepareSql("SELECT 'it''s ?' AS label WHERE id = ?", false),
    "SELECT 'it''s ?' AS label WHERE id = $1",
  );
});

test("preserves ignored duplicate inserts and returns inserted IDs", () => {
  assert.equal(
    prepareSql("INSERT OR IGNORE INTO stages (module_id, stage_type) VALUES (?, ?)", true),
    "INSERT INTO stages (module_id, stage_type) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id",
  );
});

test("does not require an ID column for settings inserts", () => {
  assert.equal(
    prepareSql("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", true),
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT DO NOTHING",
  );
});
