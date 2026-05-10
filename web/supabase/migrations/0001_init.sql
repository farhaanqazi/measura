-- =====================================================================
-- Measura — initial schema
-- Tables: projects, measurements, sync_log
-- Extensions: postgis (spatial), pgcrypto (uuid v4)
-- RLS: users can only access rows where user_id = auth.uid()
-- =====================================================================

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ── Enums ────────────────────────────────────────────────────────────
do $$ begin
    create type use_case as enum (
        'real_estate', 'construction', 'insurance', 'gis', 'general'
    );
exception when duplicate_object then null; end $$;

do $$ begin
    create type measurement_kind as enum (
        'building', 'polygon', 'linestring', 'point',
        'rectangle', 'distance', 'setback'
    );
exception when duplicate_object then null; end $$;

-- ── projects ─────────────────────────────────────────────────────────
create table if not exists public.projects (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid references auth.users(id) on delete cascade,
    name        text not null,
    use_case    use_case not null default 'general',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    deleted_at  timestamptz
);

create index if not exists projects_user_idx
    on public.projects (user_id) where deleted_at is null;

create index if not exists projects_updated_idx
    on public.projects (updated_at desc);

-- ── measurements ─────────────────────────────────────────────────────
create table if not exists public.measurements (
    id          uuid primary key default gen_random_uuid(),
    project_id  uuid not null references public.projects(id) on delete cascade,
    kind        measurement_kind not null,
    geometry    geography(Geometry, 4326) not null,
    label       text,
    notes       text,
    properties  jsonb not null default '{}'::jsonb,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    deleted_at  timestamptz
);

create index if not exists measurements_project_idx
    on public.measurements (project_id) where deleted_at is null;

create index if not exists measurements_geom_gist
    on public.measurements using gist (geometry);

create index if not exists measurements_updated_idx
    on public.measurements (updated_at desc);

-- ── updated_at trigger ───────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end $$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
    before update on public.projects
    for each row execute function public.set_updated_at();

drop trigger if exists measurements_set_updated_at on public.measurements;
create trigger measurements_set_updated_at
    before update on public.measurements
    for each row execute function public.set_updated_at();

-- ── Row Level Security ───────────────────────────────────────────────
alter table public.projects enable row level security;
alter table public.measurements enable row level security;

-- projects: users see / write their own
drop policy if exists projects_select_own on public.projects;
create policy projects_select_own on public.projects
    for select using (auth.uid() = user_id);

drop policy if exists projects_modify_own on public.projects;
create policy projects_modify_own on public.projects
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- measurements: users see / write rows under their own projects
drop policy if exists measurements_select_own on public.measurements;
create policy measurements_select_own on public.measurements
    for select using (
        exists (
            select 1 from public.projects p
            where p.id = measurements.project_id and p.user_id = auth.uid()
        )
    );

drop policy if exists measurements_modify_own on public.measurements;
create policy measurements_modify_own on public.measurements
    for all using (
        exists (
            select 1 from public.projects p
            where p.id = measurements.project_id and p.user_id = auth.uid()
        )
    ) with check (
        exists (
            select 1 from public.projects p
            where p.id = measurements.project_id and p.user_id = auth.uid()
        )
    );

-- ── Spatial helper: measurements within radius of a point ────────────
create or replace function public.measurements_within_radius(
    in_lng double precision,
    in_lat double precision,
    in_radius_m double precision
)
returns setof public.measurements
language sql stable as $$
    select * from public.measurements
    where deleted_at is null
      and ST_DWithin(
          geometry,
          ST_GeogFromText('SRID=4326;POINT(' || in_lng || ' ' || in_lat || ')'),
          in_radius_m
      );
$$;
