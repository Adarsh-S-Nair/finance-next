/**
 * Re-export of the shared Database types from @zervo/supabase.
 *
 * The canonical generated types live in `packages/supabase/src/database.ts`
 * so both apps consume the same schema. This shim keeps the legacy
 * `@/types/database` import path working — feel free to update individual
 * imports to `@zervo/supabase` over time.
 */
export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
} from "@zervo/supabase";
export { Constants } from "@zervo/supabase";
