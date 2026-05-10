"use client";

import Dexie, { type Table } from "dexie";
import type { Project, Measurement, OutboxEntry } from "./schema";

class MeasuraDB extends Dexie {
  projects!: Table<Project, string>;
  measurements!: Table<Measurement, string>;
  outbox!: Table<OutboxEntry, string>;

  constructor() {
    super("measura");

    this.version(1).stores({
      projects: "id, user_id, updated_at, sync_status, deleted_at",
      measurements:
        "id, project_id, kind, updated_at, sync_status, deleted_at",
      outbox: "id, table, row_id, attempts, created_at",
    });
  }
}

let _db: MeasuraDB | null = null;

/** Lazy singleton — Dexie isn't safe to instantiate during SSR. */
export function getDB(): MeasuraDB {
  if (typeof window === "undefined") {
    throw new Error("getDB() must only be called from the browser.");
  }
  if (!_db) _db = new MeasuraDB();
  return _db;
}
