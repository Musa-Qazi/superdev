import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import supertest from "supertest";

const dbFile = path.join(process.cwd(), ".data", `test-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = dbFile;
process.env.NODE_ENV = "test";
process.env.APP_ACCESS_KEY = "";
delete process.env.GEMINI_API_KEY;

const [{ app, validateAIResponse }, database] = await Promise.all([
  import("./index.js"),
  import("./db.js"),
]);
const agent = supertest(app) as any;
async function request<T>(route: string, init?: RequestInit) {
  let call = agent[(init?.method || "GET").toLowerCase()](route);
  if (init?.headers)
    for (const [key, value] of Object.entries(
      init.headers as Record<string, string>,
    ))
      call = call.set(key, value);
  if (init?.body) call = call.send(JSON.parse(String(init.body)));
  const response = await call;
  return { response, data: response.body as T };
}
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

test("core workflows persist and produce accurate calculated state", async () => {
  const first = await request<{ data: any[] }>("/api/modules");
  assert.equal(first.response.status, 200);
  assert.equal(first.data.data.length, 34);
  assert.deepEqual(
    first.data.data.map((module: any) => module.name),
    database.MODULE_NAMES,
  );
  assert.deepEqual(
    first.data.data.map((module: any) => module.category),
    [
      "Workspace",
      "Workspace",
      "Workspace",
      "Campus",
      "Campus",
      "Campus",
      "Campus",
      "Campus",
      "Campus",
      "Learning",
      "Learning",
      "Learning",
      "Learning",
      "Learning",
      "Learning",
      "Learning",
      "Learning",
      "Finance",
      "Finance",
      "People",
      "People",
      "People",
      "Services",
      "Services",
      "Services",
      "Services",
      "Services",
      "Services",
      "Community",
      "Community",
      "Insights",
      "Insights",
      "Insights",
      "Administration",
    ],
  );
  assert.deepEqual(
    first.data.data[0].stages.map((s: any) => s.progress),
    [0, 0, 0, 0],
  );

  database.initializeDatabase();
  assert.equal(database.getModules().length, 34, "seeding is idempotent");
  assert.equal(
    database.getModule(1)?.progress,
    0,
    "reinitializing preserves original progress",
  );

  let result = await request<{ data: any }>(
    "/api/modules/1/stages/frontend",
    json("PATCH", { status: "Completed" }),
  );
  assert.equal(result.data.data.progress, 30);
  result = await request<{ data: any }>(
    "/api/modules/1/stages/backend",
    json("PATCH", { status: "Completed" }),
  );
  assert.equal(result.data.data.status, "Ready for Integration");
  database.initializeDatabase();
  assert.equal(
    database.getModule(1)?.progress,
    60,
    "reinitializing preserves saved development work",
  );
  result = await request<{ data: any }>(
    "/api/modules/1/stages/integration",
    json("PATCH", { status: "In Progress", progress: 50 }),
  );
  assert.equal(result.data.data.status, "In Integration");
  assert.equal(result.data.data.progress, 70);
  result = await request<{ data: any }>(
    "/api/modules/1/stages/integration",
    json("PATCH", { status: "Completed" }),
  );
  assert.equal(result.data.data.status, "Ready for Testing");
  result = await request<{ data: any }>(
    "/api/modules/1/stages/testing",
    json("PATCH", { status: "Completed" }),
  );
  assert.equal(result.data.data.status, "Completed");
  assert.equal(result.data.data.progress, 100);

  for (const stage of ["frontend", "backend", "integration", "testing"])
    await request(
      `/api/modules/3/stages/${stage}`,
      json("PATCH", { status: "Completed" }),
    );
  result = await request<{ data: any }>(
    "/api/modules/3/stages/testing",
    json("PATCH", { progress: 40 }),
  );
  assert.equal(
    result.data.data.stages.find((s: any) => s.stage_type === "testing").status,
    "In Progress",
    "lowering a completed stage reopens it",
  );
  assert.equal(result.data.data.progress, 88);

  result = await request<{ data: any }>(
    "/api/modules/4/stages/frontend",
    json("PATCH", { status: "Blocked", notes: "Waiting for a decision" }),
  );
  assert.equal(result.data.data.status, "Blocked");
  assert.equal(
    result.data.data.stages.find((s: any) => s.stage_type === "frontend").notes,
    "Waiting for a decision",
  );

  const developer = await request<{ data: any }>(
    "/api/developers",
    json("POST", { name: "Test Developer", role_label: "QA" }),
  );
  assert.equal(developer.response.status, 201);
  await request(
    "/api/modules/2/stages/backend",
    json("PATCH", { assigned_developer_id: developer.data.data.id }),
  );
  const assigned = await request<{ data: any }>("/api/modules/2");
  assert.equal(
    assigned.data.data.stages.find((s: any) => s.stage_type === "backend")
      .assigned_developer_id,
    developer.data.data.id,
  );

  const createdTask = await request<{ data: any }>(
    "/api/tasks",
    json("POST", {
      title: "Verify backup restore",
      module_id: 2,
      stage_type: "testing",
      assigned_developer_id: developer.data.data.id,
    }),
  );
  assert.equal(createdTask.response.status, 201);
  await request(
    `/api/tasks/${createdTask.data.data.id}`,
    json("PATCH", { status: "Done" }),
  );
  const taskList = await request<{ data: any[] }>("/api/tasks");
  assert.equal(
    taskList.data.data.find((t: any) => t.id === createdTask.data.data.id)
      .status,
    "Done",
  );

  await request(
    "/api/modules/2",
    json("PATCH", { impact_score: 5, difficulty_score: 4 }),
  );
  const invalid = await request(
    "/api/modules/2",
    json("PATCH", { impact_score: 9 }),
  );
  assert.equal(invalid.response.status, 400);
  const stale = await request(
    "/api/modules/2",
    json("PATCH", { impact_score: 2, expected_updated_at: "stale-revision" }),
  );
  assert.equal(stale.response.status, 409);

  const invalidWeights = await request(
    "/api/settings",
    json("PATCH", {
      stage_weights: {
        frontend: 30,
        backend: 30,
        integration: 20,
        testing: 10,
      },
    }),
  );
  assert.equal(invalidWeights.response.status, 400);
  const validWeights = await request(
    "/api/settings",
    json("PATCH", {
      stage_weights: {
        frontend: 25,
        backend: 25,
        integration: 25,
        testing: 25,
      },
    }),
  );
  assert.equal(validWeights.response.status, 200);
  assert.equal(
    (await request<{ data: any }>("/api/modules/3")).data.data.progress,
    85,
  );

  const csv = await agent.get("/api/export/csv");
  assert.equal(csv.status, 200);
  assert.match(csv.text, /Frontend progress/);
  assert.match(csv.text, /Dashboard/);

  const noAI = await request(
    "/api/ai/ask",
    json("POST", { question: "Which modules are ready for integration?" }),
  );
  assert.equal(noAI.response.status, 503);
  assert.equal((noAI.data as any).code, "AI_NOT_CONFIGURED");
  assert.equal(
    validateAIResponse("{malformed", database.getModules(), []),
    null,
  );
  const parsed = validateAIResponse(
    JSON.stringify({
      type: "module_list",
      title: "Results",
      summary: "Generated",
      module_ids: [1, 999],
      developer_ids: [developer.data.data.id, 999],
      metrics: [],
      insights: [],
      recommendations: [],
      follow_up_questions: [],
    }),
    database.getModules(),
    [{ id: developer.data.data.id }],
  );
  assert.deepEqual(parsed?.module_ids, [1], "unknown module ids are removed");
  assert.deepEqual(
    parsed?.developer_ids,
    [developer.data.data.id],
    "unknown developer ids are removed",
  );

  const backup = await request<any>("/api/export/json");
  assert.equal(
    backup.data.modules.filter((module: any) => module.active === 1).length,
    34,
  );
  assert.equal(backup.data.stages.length, 136);
  const malformedBackup = structuredClone(backup.data);
  malformedBackup.settings.find(
    (item: any) => item.key === "stage_weights",
  ).value = '{"frontend":1}';
  const rejectedBackup = await request(
    "/api/import/json",
    json("POST", malformedBackup),
  );
  assert.equal(rejectedBackup.response.status, 400);
  assert.equal(
    (await request<{ data: any }>("/api/modules/2")).data.data.impact_score,
    5,
    "an invalid backup leaves existing data intact",
  );
  await request("/api/modules/2", json("PATCH", { impact_score: 1 }));
  const restored = await request<{ ok: boolean }>(
    "/api/import/json",
    json("POST", backup.data),
  );
  assert.equal(restored.response.status, 200);
  const afterRestore = await request<{ data: any }>("/api/modules/2");
  assert.equal(afterRestore.data.data.impact_score, 5);
  assert.equal(
    (await request<{ data: any }>("/api/modules/1")).data.data.status,
    "Completed",
  );
});

after(async () => {
  database.db.close();
  for (const suffix of ["", "-shm", "-wal"]) {
    try {
      fs.unlinkSync(`${dbFile}${suffix}`);
    } catch {
      /* Already absent. */
    }
  }
  try {
    fs.rmdirSync(path.dirname(dbFile));
  } catch {
    /* Keep the local data directory if other files use it. */
  }
});
