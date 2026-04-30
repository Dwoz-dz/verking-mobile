/**
 * Category service.
 */
import { supabase } from '@/lib/supabase/client';
import type { CategoryRow } from '@/types/database';

export async function listCategories(homepageOnly = false): Promise<CategoryRow[]> {
  let query = supabase.from('categories').select('*').eq('is_active', true);
  if (homepageOnly) query = query.eq('show_on_homepage', true);
  query = query.order('sort_order', { ascending: true, nullsFirst: false });

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}

export async function getCategory(id: string): Promise<CategoryRow | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as CategoryRow | null) ?? null;
}
