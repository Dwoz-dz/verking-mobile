/**
 * Hero slides + banners service.
 */
import { supabase } from '@/lib/supabase/client';
import type { BannerRow, HeroSlideRow } from '@/types/database';

export async function listHeroSlides(zone: HeroSlideRow['zone'] = 'main'): Promise<HeroSlideRow[]> {
  const { data, error } = await supabase
    .from('hero_slides')
    .select('*')
    .eq('is_active', true)
    .eq('zone', zone)
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []) as HeroSlideRow[];
}

export async function listActiveBanners(bannerType?: string): Promise<BannerRow[]> {
  let query = supabase.from('banners').select('*').eq('is_active', true);
  if (bannerType) query = query.eq('banner_type', bannerType);
  query = query
    .order('priority', { ascending: false, nullsFirst: false })
    .order('sort_order', { ascending: true, nullsFirst: false });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BannerRow[];
}
