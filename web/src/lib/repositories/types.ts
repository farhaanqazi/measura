import type { Project, Measurement } from "@/lib/db/schema";

/**
 * Repository pattern: concrete implementations (Dexie now, Supabase-synced
 * later) plug in behind these interfaces so call sites never depend on the
 * storage layer directly.
 */

export interface ProjectsRepository {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | null>;
  create(input: NewProject): Promise<Project>;
  update(id: string, patch: Partial<Project>): Promise<Project>;
  remove(id: string): Promise<void>;
}

export interface MeasurementsRepository {
  listByProject(projectId: string): Promise<Measurement[]>;
  get(id: string): Promise<Measurement | null>;
  create(input: NewMeasurement): Promise<Measurement>;
  update(id: string, patch: Partial<Measurement>): Promise<Measurement>;
  remove(id: string): Promise<void>;
}

export type NewProject = Pick<Project, "name" | "use_case"> & {
  user_id?: string | null;
};

export type NewMeasurement = Pick<
  Measurement,
  "project_id" | "kind" | "feature"
> & {
  label?: string | null;
  notes?: string | null;
};
