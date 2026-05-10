"use client";

import { getDB } from "@/lib/db/client";
import type { Project, Measurement } from "@/lib/db/schema";
import type {
  MeasurementsRepository,
  NewMeasurement,
  NewProject,
  ProjectsRepository,
} from "./types";

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

export const dexieProjects: ProjectsRepository = {
  async list() {
    const db = getDB();
    return db.projects
      .filter((p) => p.deleted_at === null)
      .toArray()
      .then((rows) =>
        rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
      );
  },
  async get(id) {
    const row = (await getDB().projects.get(id)) ?? null;
    return row && row.deleted_at === null ? row : null;
  },
  async create(input: NewProject) {
    const project: Project = {
      id: newId(),
      user_id: input.user_id ?? null,
      name: input.name,
      use_case: input.use_case,
      created_at: now(),
      updated_at: now(),
      deleted_at: null,
      sync_status: "pending",
      sync_error: null,
    };
    await getDB().projects.add(project);
    await enqueueOutbox("projects", "insert", project.id, project);
    return project;
  },
  async update(id, patch) {
    const db = getDB();
    const existing = await db.projects.get(id);
    if (!existing) throw new Error(`Project ${id} not found`);
    const updated: Project = {
      ...existing,
      ...patch,
      id: existing.id,
      updated_at: now(),
      sync_status: "pending",
    };
    await db.projects.put(updated);
    await enqueueOutbox("projects", "update", id, updated);
    return updated;
  },
  async remove(id) {
    const db = getDB();
    const existing = await db.projects.get(id);
    if (!existing) return;
    await db.projects.put({ ...existing, deleted_at: now(), updated_at: now(), sync_status: "pending" });
    await enqueueOutbox("projects", "delete", id, { id });
  },
};

export const dexieMeasurements: MeasurementsRepository = {
  async listByProject(projectId) {
    return getDB()
      .measurements.where("project_id")
      .equals(projectId)
      .filter((m) => m.deleted_at === null)
      .toArray();
  },
  async get(id) {
    const row = (await getDB().measurements.get(id)) ?? null;
    return row && row.deleted_at === null ? row : null;
  },
  async create(input: NewMeasurement) {
    const measurement: Measurement = {
      id: newId(),
      project_id: input.project_id,
      kind: input.kind,
      feature: input.feature,
      label: input.label ?? null,
      notes: input.notes ?? null,
      created_at: now(),
      updated_at: now(),
      deleted_at: null,
      sync_status: "pending",
      sync_error: null,
    };
    await getDB().measurements.add(measurement);
    await enqueueOutbox("measurements", "insert", measurement.id, measurement);
    return measurement;
  },
  async update(id, patch) {
    const db = getDB();
    const existing = await db.measurements.get(id);
    if (!existing) throw new Error(`Measurement ${id} not found`);
    const updated: Measurement = {
      ...existing,
      ...patch,
      id: existing.id,
      updated_at: now(),
      sync_status: "pending",
    };
    await db.measurements.put(updated);
    await enqueueOutbox("measurements", "update", id, updated);
    return updated;
  },
  async remove(id) {
    const db = getDB();
    const existing = await db.measurements.get(id);
    if (!existing) return;
    await db.measurements.put({
      ...existing,
      deleted_at: now(),
      updated_at: now(),
      sync_status: "pending",
    });
    await enqueueOutbox("measurements", "delete", id, { id });
  },
};

async function enqueueOutbox(
  table: "projects" | "measurements",
  op: "insert" | "update" | "delete",
  rowId: string,
  payload: unknown,
) {
  await getDB().outbox.add({
    id: newId(),
    table,
    op,
    row_id: rowId,
    payload,
    attempts: 0,
    last_error: null,
    created_at: now(),
  });
}
