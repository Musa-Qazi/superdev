import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

test("modules, custom order, pictures, and backups survive database restart", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "devpulse-test-"));
  process.env.DATABASE_PATH = path.join(dir, "data.sqlite");
  process.env.NODE_ENV = "test";
  process.env.APP_ACCESS_KEY = "";
  const { app } = await import("./index.js");
  const { db, initializeDatabase } = await import("./db.js");
  try {
    const created = await request(app).post("/api/modules").send({ name: "Raw Leads", category: "Campus", frontend_completed: true }).expect(201);
    assert.equal(created.body.data.stages.find((stage: any) => stage.stage_type === "frontend").progress, 100);
    const id = created.body.data.id;
    const initial = await request(app).get("/api/modules").expect(200);
    const ids = initial.body.data.map((module: any) => module.id);
    ids.unshift(ids.pop());
    await request(app).put("/api/modules/order").send({ module_ids: ids }).expect(200);
    const developer = await request(app).post("/api/developers").send({ name: "Test User" }).expect(201);
    const picture = "data:image/png;base64,aGVsbG8=";
    await request(app).patch(`/api/developers/${developer.body.data.id}`).send({ photo_url: picture }).expect(200);
    const backup = await request(app).get("/api/export/json").expect(200);
    await request(app).post("/api/import/json").send(backup.body).expect(200);
    initializeDatabase();
    const restored = await request(app).get("/api/modules").expect(200);
    assert.equal(restored.body.data[0].id, id);
    const profiles = await request(app).get("/api/developers").expect(200);
    assert.equal(profiles.body.data[0].photo_url, picture);
    await request(app).delete(`/api/modules/${id}`).expect(200);
    initializeDatabase();
    const afterDelete = await request(app).get("/api/modules").expect(200);
    assert.equal(afterDelete.body.data.some((module: any) => module.id === id), false);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
