"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/database";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

// Use service role to bypass RLS for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET_NAME = "audytorzy";

export async function getAudytorzy() {
  try {
    const audytorzy = await prisma.audytorzy.findMany({
      orderBy: { imie_i_nazwisko: 'asc' }
    });

    // For each auditor, generate a signed URL if they have a photo
    const withSignedUrls = await Promise.all(
      audytorzy.map(async (auditor) => {
        let signedUrl = auditor.zdjecie_url;
        if (signedUrl) {
          const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(signedUrl, 60 * 60); // 1 hour expiry
            
          if (data && !error) {
            signedUrl = data.signedUrl;
          }
        }
        return {
          ...auditor,
          avatarUrl: signedUrl, // Maps to the UI prop
        };
      })
    );
    
    return { success: true, data: withSignedUrls };
  } catch (error: any) {
    console.error("Failed to fetch auditors:", error);
    return { success: false, error: "Nie udało się pobrać audytorów" };
  }
}

export async function addAuditor(formData: FormData) {
  try {
    const imie_i_nazwisko = formData.get("name") as string;
    const telefon = formData.get("phone") as string;
    const email = formData.get("email") as string;
    const adres = formData.get("address") as string;
    const nazwa_firmy = formData.get("companyName") as string;
    const nip = formData.get("nip") as string;
    const certyfikat_fgaz = formData.get("fgazCert") as string;
    const photoBase64 = formData.get("photoBase64") as string;
    
    // New fields
    const doswiadczenie_hvac_lata = parseInt(formData.get("hvacExperience") as string) || null;
    const uprawnienia_sep = formData.get("sep") === "true";
    const preferowane_marki = JSON.parse((formData.get("brands") as string) || "[]");
    const kod_pocztowy_bazowy = formData.get("zipCode") as string;
    const max_promien_dojazdu_km = parseInt(formData.get("radius") as string) || null;
    const iban = formData.get("iban") as string;

    if (!imie_i_nazwisko) {
      return { success: false, error: "Imię i nazwisko jest wymagane" };
    }

    let filePath = null;

    if (photoBase64) {
      // Decode Base64
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const ext = photoBase64.split(';')[0].split('/')[1] || 'jpg';
      const fileName = `${uuidv4()}.${ext}`;

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, buffer, {
          contentType: `image/${ext}`,
          upsert: true,
        });

      if (error) {
        console.error("Storage upload error:", error);
        return { success: false, error: "Nie udało się wgrać zdjęcia." };
      }
      
      filePath = fileName;
    }

    await prisma.audytorzy.create({
      data: {
        imie_i_nazwisko,
        telefon,
        email,
        adres,
        nazwa_firmy,
        nip,
        certyfikat_fgaz,
        zdjecie_url: filePath,
        doswiadczenie_hvac_lata,
        uprawnienia_sep,
        preferowane_marki,
        kod_pocztowy_bazowy,
        max_promien_dojazdu_km,
        iban,
      },
    });

    revalidatePath("/auditors");
    revalidatePath("/leads");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to add auditor:", error);
    return { success: false, error: "Nie udało się dodać audytora" };
  }
}

export async function updateAuditor(id: string, formData: FormData) {
  try {
    const imie_i_nazwisko = formData.get("name") as string;
    const telefon = formData.get("phone") as string;
    const email = formData.get("email") as string;
    const adres = formData.get("address") as string;
    const nazwa_firmy = formData.get("companyName") as string;
    const nip = formData.get("nip") as string;
    const certyfikat_fgaz = formData.get("fgazCert") as string;
    const photoBase64 = formData.get("photoBase64") as string;
    
    const doswiadczenie_hvac_lata = parseInt(formData.get("hvacExperience") as string) || null;
    const uprawnienia_sep = formData.get("sep") === "true";
    const preferowane_marki = JSON.parse((formData.get("brands") as string) || "[]");
    const kod_pocztowy_bazowy = formData.get("zipCode") as string;
    const max_promien_dojazdu_km = parseInt(formData.get("radius") as string) || null;
    const iban = formData.get("iban") as string;

    let updateData: any = {
      imie_i_nazwisko,
      telefon,
      email,
      adres,
      nazwa_firmy,
      nip,
      certyfikat_fgaz,
      doswiadczenie_hvac_lata,
      uprawnienia_sep,
      preferowane_marki,
      kod_pocztowy_bazowy,
      max_promien_dojazdu_km,
      iban,
    };

    if (photoBase64) {
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const ext = photoBase64.split(';')[0].split('/')[1] || 'jpg';
      const fileName = `${uuidv4()}.${ext}`;

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, buffer, {
          contentType: `image/${ext}`,
          upsert: true,
        });

      if (error) {
        console.error("Storage upload error:", error);
        return { success: false, error: "Nie udało się wgrać zdjęcia." };
      }
      
      updateData.zdjecie_url = fileName;
      
      // We could ideally delete the old image here, but skipping for simplicity
    }

    await prisma.audytorzy.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/auditors");
    revalidatePath("/leads");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update auditor:", error);
    return { success: false, error: "Nie udało się zaktualizować audytora" };
  }
}

export async function deleteAuditor(id: string) {
  try {
    const auditor = await prisma.audytorzy.findUnique({
      where: { id }
    });
    
    if (auditor?.zdjecie_url) {
      await supabase.storage.from(BUCKET_NAME).remove([auditor.zdjecie_url]);
    }

    await prisma.audytorzy.delete({
      where: { id }
    });

    revalidatePath("/auditors");
    revalidatePath("/leads");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete auditor:", error);
    return { success: false, error: "Nie udało się usunąć audytora" };
  }
}

export async function getCrews() {
  try {
    const crews = await prisma.zespoly_monterskie.findMany({
      orderBy: { nazwa: 'asc' }
    });
    return { success: true, data: crews };
  } catch (error: any) {
    console.error("Failed to fetch crews:", error);
    return { success: false, error: "Nie udało się pobrać ekip" };
  }
}

export async function addCrew(formData: FormData) {
  try {
    const nazwa = formData.get("name") as string;
    const telefon_kontaktowy = formData.get("phone") as string;
    const email = formData.get("email") as string;
    const nip = formData.get("nip") as string;
    const koordynator_imie_nazwisko = formData.get("coordinator") as string;
    const certyfikat_fgaz = formData.get("fgazCert") as string;
    const uprawnienia_sep = formData.get("sep") === "true";
    const kod_pocztowy_bazowy = formData.get("zipCode") as string;
    const promien_dzialania_km = parseInt(formData.get("radius") as string) || null;
    const liczba_brygad = parseInt(formData.get("teamsCount") as string) || 1;
    const posiada_wiertnice = formData.get("drillingRig") === "true";
    const iban = formData.get("iban") as string;

    if (!nazwa) {
      return { success: false, error: "Nazwa jest wymagana" };
    }

    await prisma.zespoly_monterskie.create({
      data: {
        nazwa,
        telefon_kontaktowy,
        email,
        nip,
        koordynator_imie_nazwisko,
        certyfikat_fgaz,
        uprawnienia_sep,
        kod_pocztowy_bazowy,
        promien_dzialania_km,
        liczba_brygad,
        posiada_wiertnice,
        iban,
      },
    });

    revalidatePath("/auditors");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to add crew:", error);
    return { success: false, error: "Nie udało się dodać ekipy" };
  }
}

export async function updateCrew(id: string, formData: FormData) {
  try {
    const nazwa = formData.get("name") as string;
    const telefon_kontaktowy = formData.get("phone") as string;
    const email = formData.get("email") as string;
    const nip = formData.get("nip") as string;
    const koordynator_imie_nazwisko = formData.get("coordinator") as string;
    const certyfikat_fgaz = formData.get("fgazCert") as string;
    const uprawnienia_sep = formData.get("sep") === "true";
    const kod_pocztowy_bazowy = formData.get("zipCode") as string;
    const promien_dzialania_km = parseInt(formData.get("radius") as string) || null;
    const liczba_brygad = parseInt(formData.get("teamsCount") as string) || 1;
    const posiada_wiertnice = formData.get("drillingRig") === "true";
    const iban = formData.get("iban") as string;

    await prisma.zespoly_monterskie.update({
      where: { id },
      data: {
        nazwa,
        telefon_kontaktowy,
        email,
        nip,
        koordynator_imie_nazwisko,
        certyfikat_fgaz,
        uprawnienia_sep,
        kod_pocztowy_bazowy,
        promien_dzialania_km,
        liczba_brygad,
        posiada_wiertnice,
        iban,
      },
    });

    revalidatePath("/auditors");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update crew:", error);
    return { success: false, error: "Nie udało się zaktualizować ekipy" };
  }
}

export async function deleteCrew(id: string) {
  try {
    await prisma.zespoly_monterskie.delete({
      where: { id }
    });
    revalidatePath("/auditors");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete crew:", error);
    return { success: false, error: "Nie udało się usunąć ekipy" };
  }
}
