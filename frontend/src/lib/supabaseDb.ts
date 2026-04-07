import { supabase } from './supabaseClient'

export async function dbSelect<T>(
  table: string,
  query: (q: any) => any,
): Promise<T> {
  const res = await query(supabase.from(table))
  if (res.error) throw res.error
  return res.data as T
}

export async function dbInsert<T>(
  table: string,
  values: Record<string, any> | Record<string, any>[],
): Promise<T> {
  const res = await supabase.from(table).insert(values).select()
  if (res.error) throw res.error
  return res.data as T
}

export async function dbUpsert<T>(
  table: string,
  values: Record<string, any>,
  options?: { onConflict?: string },
): Promise<T> {
  const res = await supabase.from(table).upsert(values, options).select()
  if (res.error) throw res.error
  return res.data as T
}

