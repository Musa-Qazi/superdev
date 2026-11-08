import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { newDb } from "pg-mem";
import request from "supertest";
import type pg from "pg";

test("PostgreSQL API reads and updates tracker records", async () => {
  process.env.NODE_ENV = "test";
  const memory = newDb();
  const schema = readFileSync("deploy/schema.sql", "utf8")
    .replace(/^CREATE SCHEMA.*$/gm, "")
    .replace(/^REVOKE.*$/gm, "")
    .replace(/devpulse\./g, "");
  memory.public.none(schema);
  memory.public.none(`
    INSERT INTO modules (id, name, category, display_order, created_at, updated_at)
      VALUES (1, 'Students', 'Campus', 1, '2026-01-01', '2026-01-01');
    INSERT INTO stages (module_id, stage_type, updated_at) VALUES
      (1, 'frontend', '2026-01-01'), (1, 'backend', '2026-01-01'),
      (1, 'integration', '2026-01-01'), (1, 'testing', '2026-01-01');
    INSERT INTO settings (key, value, updated_at) VALUES
      ('project_name', 'Campus ERP', '2026-01-01'),
      ('stage_weights', '{"frontend":30,"backend":30,"integration":20,"testing":20}', '2026-01-01');
  `);
  const Pg = memory.adapters.createPg();
  const pool = new Pg.Pool();
  const { setPoolForTesting } = await import("./postgres.js");
  setPoolForTesting(pool as unknown as pg.Pool);
  const { app } = await import("./pg-index.js");
  const { default: vercelHandler } = await import("../api/index.js");

  try {
    const initial = await request(app).get("/api/modules").expect(200);
    assert.equal(initial.body.data[0].name, "Students");
    assert.equal(initial.body.data[0].progress, 0);
    const routed = await request(vercelHandler).get("/api/index?__devpulse_route=modules").expect(200);
    assert.equal(routed.body.data[0].name, "Students");

    const developer = await request(app).post("/api/developers")
      .send({ name: "A Developer", role_label: "Engineering" }).expect(201);
    assert.equal(developer.body.data.name, "A Developer");
    const developerId = developer.body.data.id;

    const stage = await request(app).patch("/api/modules/1/stages/frontend")
      .send({ status: "In Progress", progress: 50, assigned_developer_id: developerId }).expect(200);
    assert.equal(stage.body.data.progress, 15);
    assert.equal(stage.body.data.stages[0].assigned_developer_id, developerId);
    await request(app).patch("/api/modules/1/stages/frontend")
      .send({ progress: 60, expected_updated_at: "2026-01-01" }).expect(409);

    const bulk = await request(app).patch("/api/modules/bulk-update")
      .send({ module_ids: [1], field: "impact_score", value: 5 }).expect(200);
    assert.equal(bulk.body.data[0].impact_score, 5);

    const task = await request(app).post("/api/tasks")
      .send({ title: "Implement profile", module_id: 1, assigned_developer_id: developerId }).expect(201);
    assert.equal(task.body.data.title, "Implement profile");
    await request(app).patch(`/api/tasks/${task.body.data.id}`)
      .send({ status: "Done" }).expect(200);
    const tasks = await request(app).get("/api/tasks").expect(200);
    assert.equal(tasks.body.data[0].status, "Done");

    const backup = await request(app).get("/api/export/json").expect(200);
    assert.equal(backup.body.modules.length, 1);
    assert.equal(backup.body.tasks.length, 1);
  } finally {
    await pool.end();
  }
});
