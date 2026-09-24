import type { EmailSendParams, GatewaySendResult } from "../types";

export const MAILTRAP_DEFAULT_FROM = "powiadomienia@klikklima.pl";
export const MAILTRAP_DEFAULT_FROM_NAME = "KlikKlima";

export async function sendEmail(params: EmailSendParams): Promise<GatewaySendResult> {
  const token = process.env.EMAIL_PROVIDER_KEY;
  const fromEmail = params.from ?? MAILTRAP_DEFAULT_FROM;

  if (!token) {
    return { success: false, error: "Brak skonfigurowanego tokena EMAIL_PROVIDER_KEY" };
  }

  try {
    const payload = {
      from: {
        email: fromEmail,
        name: MAILTRAP_DEFAULT_FROM_NAME,
      },
      to: [
        {
          email: params.to,
        },
      ],
      subject: params.subject,
      html: params.html,
      text: params.text ?? params.html.replace(/<[^>]*>?/gm, ""),
    };

    const response = await fetch("https://send.api.mailtrap.io/api/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Mailtrap error HTTP ${response.status}: ${errText}` };
    }

    const data = (await response.json()) as { success?: boolean; message_ids?: string[] };
    const messageId = data.message_ids?.[0] ?? "ok";
    return { success: true, messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
