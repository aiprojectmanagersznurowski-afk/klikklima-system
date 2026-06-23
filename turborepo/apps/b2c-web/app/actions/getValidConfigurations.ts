"use server";

import { unstable_noStore as noStore } from 'next/cache';
import { supabase } from "@/lib/supabaseClient";

export async function getValidConfigurations(seriesName: string, roomCount: number) {
  noStore();
  try {
    const { data: combinations, error } = await supabase
      .from('available_combinations')
      .select('sizes_hash')
      .eq('series_name', seriesName)
      .eq('room_count', roomCount);

    if (error) {
      console.error("Error fetching available_combinations:", error);
      return [];
    }

    // Return an array of valid hashes e.g. ["09", "09-12", "09-09-09"]
    return combinations.map(c => c.sizes_hash);
  } catch (err) {
    console.error("Exception in getValidConfigurations:", err);
    return [];
  }
}
