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

    let updateData: any = {
      imie_i_nazwisko,
      telefon,
      email,
      adres,
      nazwa_firmy,
      nip,
      certyfikat_fgaz,
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
