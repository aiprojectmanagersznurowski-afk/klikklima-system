"use server";

import { createSupabaseClient } from "@repo/database";

export async function saveSoftLead(contactInfo: string, partialData: any) {
  try {
    const supabase = createSupabaseClient();
    
    const { data, error } = await supabase
      .from("soft_leady")
      .insert([
        {
          dane_kontaktowe: contactInfo,
          dane_cząstkowe: partialData,
        }
      ]);

    if (error) throw error;
    
    return { success: true };
  } catch (err: any) {
    console.error("Error saving soft lead:", err.message);
    return { success: false, error: err.message };
  }
}

export async function submitFinalTriage(triageData: any, contactData: any, addressData: any) {
  try {
    const supabase = createSupabaseClient();
    
    // First save the main lead
    const { data: leadData, error: leadError } = await supabase
      .from("leady")
      .insert([
        {
          typ_klienta: "B2C",
          status_triage: "Wykonany",
          odpowiedzi_triage: triageData,
          sciezka_koncowa: triageData.sciezka_koncowa || "Path_Expert",
        }
      ])
      .select("id")
      .single();

    if (leadError) throw leadError;

    const leadId = leadData.id;

    // Then save the client info
    const { data: clientData, error: clientError } = await supabase
      .from("klienci")
      .insert([
        {
          imie_nazwisko: contactData.name,
          telefon: contactData.phone,
          email: contactData.email,
        }
      ])
      .select("id")
      .single();

    if (clientError) throw clientError;

    const clientId = clientData.id;

    // Then save the address
    const { error: addressError } = await supabase
      .from("adresy")
      .insert([
        {
          klient_id: clientId,
          ulica_miasto: addressData.fullAddress,
          lat: addressData.lat,
          lng: addressData.lng,
        }
      ]);

    if (addressError) throw addressError;

    // Also link the client to the lead (requires updating the lead)
    const { error: linkError } = await supabase
      .from("leady")
      .update({ klient_id: clientId })
      .eq("id", leadId);

    if (linkError) throw linkError;

    return { success: true, leadId };
  } catch (err: any) {
    console.error("Error submitting final triage:", err.message);
    return { success: false, error: err.message };
  }
}
