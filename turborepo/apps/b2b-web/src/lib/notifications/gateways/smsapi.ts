import type { GatewaySendResult, SmsSendParams } from "../types";

export const SMSAPI_DEFAULT_SENDER = "KlikKlima";

export function normalizePhoneNumber(rawNumber: string): string {
  const digitsOnly = rawNumber.replace(/\D/g, "");
  if (digitsOnly.length === 9) {
    return "+48" + digitsOnly;
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith("48")) {
    return "+" + digitsOnly;
  }
  if (rawNumber.startsWith("+")) {
    return "+" + digitsOnly;
  }
  return "+" + digitsOnly;
}

export async function sendSms(params: SmsSendParams): Promise<GatewaySendResult> {
  const token = process.env.SMS_API_TOKEN;
  const to = normalizePhoneNumber(params.to);
  const from = params.from ?? SMSAPI_DEFAULT_SENDER;

  if (!token) {
    if (process.env.NODE_ENV === "test") {
      return { success: true, messageId: "mock-sms-id" };
    }
    return { success: false, error: "Brak skonfigurowanego tokena SMS_API_TOKEN" };
  }

  try {
    const toParam = to.replace(/^\+/, "");
    const body = new URLSearchParams({
      to: toParam,
      message: params.message,
      from,
      format: "json",
      encoding: "utf-8",
    });

    const response = await fetch("https://api.smsapi.pl/sms.do", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `SMSAPI error HTTP ${response.status}: ${errText}` };
    }

    const data = (await response.json()) as { list?: { id: string }[]; error?: number; message?: string };
    if (data.error) {
      return { success: false, error: `SMSAPI error code ${data.error}: ${data.message ?? ""}` };
    }

    const messageId = data.list?.[0]?.id ?? "ok";
    return { success: true, messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
