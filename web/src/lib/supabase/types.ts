/**
 * Generated types placeholder. Once a Supabase project is wired up, regenerate via:
 *   pnpm dlx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
 *
 * Until then, this loose shape lets the Supabase clients compile.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
