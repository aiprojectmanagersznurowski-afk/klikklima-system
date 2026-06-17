"use server";

import { createSupabaseClient } from "@repo/database";

export async function getFomoSlots() {
  try {
    const supabase = createSupabaseClient();
    
    const { data, error } = await supabase.rpc("get_fomo_available_slots");

    if (error) {
      console.error("Error fetching FOMO slots from RPC:", error);
      return 3; // Fallback
    }

    return data as number;
  } catch (err) {
    console.error("Unexpected error fetching FOMO slots:", err);
    return 3; // Fallback
  }
}
