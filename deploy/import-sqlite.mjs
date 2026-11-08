// Run once against a new DevPulse database, with POSTGRES_URL and SQLITE_PATH
// set in the environment. Data is never written into the repository.
import Database from 'better-sqlite3';
import pg from 'pg';

const connectionString = process.env.POSTGRES_URL;
const sqlitePath = process.env.SQLITE_PATH;
if (!connectionString || !sqlitePath) {
  throw new Error('Set POSTGRES_URL and SQLITE_PATH before importing.');
}

const tables = {
  modules: ['id', 'name', 'description', 'impact_score', 'difficulty_score', 'category', 'active', 'display_order', 'notes', 'created_at', 'updated_at'],
  developers: ['id', 'name', 'initials', 'role_label', 'active', 'created_at', 'updated_at'],
  stages: ['id', 'module_id', 'stage_type', 'status', 'progress', 'assigned_developer_id', 'notes', 'started_at', 'completed_at', 'updated_at'],
  tasks: ['id', 'title', 'description', 'module_id', 'stage_type', 'assigned_developer_id', 'status', 'priority', 'due_date', 'created_at', 'updated_at', 'completed_at'],
  activity: ['id', 'entity_type', 'entity_id', 'action', 'summary', 'timestamp'],
  settings: ['key', 'value', 'updated_at'],
};

const source = new Database(sqlitePath, { readonly: true, fileMustExist: true });
const destination = new pg.Client({ connectionString });
try {
  source.exec('BEGIN');
  await destination.connect();
  await destination.query('BEGIN');
  await destination.query('LOCK TABLE devpulse.modules, devpulse.developers, devpulse.stages, devpulse.tasks, devpulse.activity, devpulse.settings IN EXCLUSIVE MODE');
  for (const table of Object.keys(tables)) {
    const existing = await destination.query(`SELECT 1 FROM devpulse.${table} LIMIT 1`);
    if (existing.rowCount) throw new Error(`Destination table ${table} is not empty; import stopped.`);
  }
  for (const [table, columns] of Object.entries(tables)) {
    const rows = source.prepare(`SELECT ${columns.join(', ')} FROM ${table}`).all();
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    for (const row of rows) {
      await destination.query(
        `INSERT INTO devpulse.${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        columns.map((column) => row[column]),
      );
    }
    if (columns.includes('id')) {
      await destination.query(
        `SELECT setval(pg_get_serial_sequence('devpulse.${table}', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM devpulse.${table}`,
      );
    }
    console.log(`Imported ${rows.length} ${table} records.`);
  }
  await destination.query('COMMIT');
  source.exec('COMMIT');
} catch (error) {
  await destination.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  source.close();
  await destination.end();
}
