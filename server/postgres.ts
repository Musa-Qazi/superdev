import { AsyncLocalStorage } from "node:async_hooks";
import pg, { type PoolClient, type QueryResultRow } from "pg";

// Supabase's transaction pooler is shared between serverless instances.
let pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  max: 2,
  idleTimeoutMillis: 5_000,
  connectionTimeoutMillis: 10_000,
});
pg.types.setTypeParser(20, (value) => Number(value));
const transactionClient = new AsyncLocalStorage<PoolClient>();

export function setPoolForTesting(testPool: pg.Pool) {
  if (process.env.NODE_ENV !== "test") throw new Error("Test database injection is disabled.");
  pool = testPool;
}

export function prepareSql(sql: string, returnId: boolean): string {
  let index = 0;
  let converted = "";
  let quoted: "'" | '"' | null = null;
  for (let position = 0; position < sql.length; position++) {
    const character = sql[position];
    if (quoted) {
      converted += character;
      if (character === quoted) {
        if (sql[position + 1] === quoted) converted += sql[++position];
        else quoted = null;
      }
    } else if (character === "'" || character === '"') {
      quoted = character;
      converted += character;
    } else {
      converted += character === "?" ? `$${++index}` : character;
    }
  }
  converted = converted.replace(/name\s+COLLATE\s+NOCASE/gi, "lower(name)");
  const ignoreConflict = /\bINSERT\s+OR\s+IGNORE\s+INTO\b/i.test(converted);
  converted = converted.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i, "INSERT INTO");
  if (ignoreConflict) converted = `${converted.trim().replace(/;$/, "")} ON CONFLICT DO NOTHING`;
  const insert = converted.match(/^\s*INSERT\s+INTO\s+(modules|developers|stages|tasks|activity)\b/i);
  if (returnId && insert && !/\bRETURNING\b/i.test(converted)) {
    converted = `${converted.trim().replace(/;$/, "")} RETURNING id`;
  }
  return converted;
}

async function runQuery(sql: string, params: unknown[]) {
  const current = transactionClient.getStore();
  if (current) return current.query<QueryResultRow>(sql, params);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL search_path TO devpulse, pg_catalog");
    const result = await client.query<QueryResultRow>(sql, params);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export const postgres = {
  prepare(sql: string) {
    return {
      async all(...params: unknown[]) {
        return (await runQuery(prepareSql(sql, false), params)).rows;
      },
      async get(...params: unknown[]) {
        return (await runQuery(prepareSql(sql, false), params)).rows[0];
      },
      async run(...params: unknown[]) {
        const result = await runQuery(prepareSql(sql, true), params);
        return { changes: result.rowCount ?? 0, lastInsertRowid: result.rows[0]?.id };
      },
    };
  },
  async exec(sql: string) {
    await runQuery(sql, []);
  },
  transaction<Args extends unknown[], Result>(fn: (...args: Args) => Promise<Result>) {
    return async (...args: Args): Promise<Result> => {
      if (transactionClient.getStore()) return fn(...args);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL search_path TO devpulse, pg_catalog");
        const result = await transactionClient.run(client, () => fn(...args));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    };
  },
};
