import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newDb } from "pg-mem";
import request from "supertest";
import type pg from "pg";

test("PostgreSQL module creation, reordering, and deletion", async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ACCESS_KEY = "";
  const memory = newDb();
  const schema = readFileSync("deploy/schema.sql", "utf8").replace(/^CREATE SCHEMA.*$/gm, "").replace(/^REVOKE.*$/gm, "").replace(/devpulse\./g, "");
  memory.public.none(schema);
  memory.public.none(`INSERT INTO settings (key,value,updated_at) VALUES ('project_name','Campus ERP','now'),('stage_weights','{"frontend":30,"backend":30,"integration":20,"testing":20}','now')`);
  const Pg = memory.adapters.createPg();
  const pool = new Pg.Pool();
  const { setPoolForTesting } = await import("./postgres.js");
  setPoolForTesting(pool as unknown as pg.Pool);
  const { app } = await import("./pg-index.js");
  try {
    const one = await request(app).post("/api/modules").send({ name: "Raw Leads", frontend_completed: true }).expect(201);
    const two = await request(app).post("/api/modules").send({ name: "Other" }).expect(201);
    assert.equal(one.body.data.stages.find((stage: any) => stage.stage_type === "frontend").status, "Completed");
    await request(app).put("/api/modules/order").send({ module_ids: [two.body.data.id, one.body.data.id] }).expect(200);
    const ordered = await request(app).get("/api/modules").expect(200);
    assert.deepEqual(ordered.body.data.map((module: any) => module.name), ["Other", "Raw Leads"]);
    await request(app).delete(`/api/modules/${one.body.data.id}`).expect(200);
    const remaining = await request(app).get("/api/modules").expect(200);
    assert.deepEqual(remaining.body.data.map((module: any) => module.name), ["Other"]);
  } finally { await pool.end(); }
});
