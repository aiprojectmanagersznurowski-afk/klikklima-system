import { NOTIFICATIONS, byId } from "@klikklima/contracts";
import type { MessageTemplate } from "./types";

interface TemplateDefinition {
  templateKey: string;
  subject?: string;
  bodyTemplate: string;
}

const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  // ---- Lejek ----
  {
    templateKey: "funnel.auditor_assigned",
    subject: "KlikKlima — Przydzielono inżyniera do Twojego zgłoszenia",
    bodyTemplate: "Witaj {{first_name}}! Przydzielono inżyniera do Twojego zgłoszenia #{{order_number}}. Wkrótce skontaktujemy się w celu potwierdzenia szczegółów.",
  },
  {
    templateKey: "funnel.audit_reminder_24h",
    subject: "KlikKlima — Przypomnienie o jutrzejszym audycie",
    bodyTemplate: "Witaj {{first_name}}! Przypominamy o jutrzejszym audycie o godzinie {{time}} pod adresem {{address}}. Zmiana terminu: {{link}}",
  },
  {
    templateKey: "funnel.auditor_en_route",
    bodyTemplate: "Witaj {{first_name}}! Inżynier wyruszył w drogę do Ciebie. Szacowany czas dojazdu: ok. {{eta}} min.",
  },
  {
    templateKey: "funnel.quote_ready",
    subject: "KlikKlima — Twoja oferta jest gotowa do akceptacji",
    bodyTemplate: "Witaj {{first_name}}! Przygotowaliśmy ofertę na kwotę {{total_price}}. Możesz ją przejrzeć i zaakceptować pod adresem: {{link}}",
  },
  {
    templateKey: "funnel.shipped",
    subject: "KlikKlima — Sprzęt został wysłany",
    bodyTemplate: "Witaj {{first_name}}! Urządzenia zostały wysłane kurierem. Numer listu przewozowego: {{tracking_id}}.",
  },
  {
    templateKey: "funnel.install_reminder_24h",
    subject: "KlikKlima — Przypomnienie o jutrzejszym montażu",
    bodyTemplate: "Witaj {{first_name}}! Przypominamy o jutrzejszym montażu o godzinie {{time}} pod adresem {{address}}. Szczegóły: {{link}}",
  },
  {
    templateKey: "funnel.crew_en_route",
    bodyTemplate: "Witaj {{first_name}}! Ekipa montażowa jest już w drodze. Szacowany czas dojazdu: ok. {{eta}} min.",
  },
  {
    templateKey: "funnel.install_completed",
    subject: "KlikKlima — Montaż klimatyzacji został zakończony",
    bodyTemplate: "Witaj {{first_name}}! Montaż dla zlecenia #{{order_number}} został zakończony. Dokumenty gwarancyjne i protokół znajdziesz w załącznikach.",
  },
  {
    templateKey: "funnel.install_phase1_completed",
    subject: "KlikKlima — Zakończono etap I montażu",
    bodyTemplate: "Witaj {{first_name}}! Pierwszy etap montażu dla zlecenia #{{order_number}} został pomyślnie ukończony. Zarezerwuj termin na etap II: {{link}}",
  },
  {
    templateKey: "funnel.quote_expired",
    subject: "KlikKlima — Ważność wyceny wygasła",
    bodyTemplate: "Witaj {{first_name}}! Ważność wyceny dla zlecenia #{{order_number}} wygasła. Aby odświeżyć ofertę, skontaktuj się z nami: {{link}}",
  },
  {
    templateKey: "funnel.rollback_rebook",
    subject: "KlikKlima — Wymagana zmiana terminu montażu",
    bodyTemplate: "Witaj {{first_name}}! Zlecenie #{{order_number}} wymaga ponownego wyboru terminu. Prosimy o rezerwację nowego terminu: {{link}}",
  },

  // ---- Serwisy ----
  {
    templateKey: "service.reminder",
    subject: "KlikKlima — Zbliża się roczny przegląd klimatyzacji",
    bodyTemplate: "Witaj {{first_name}}! Zbliża się termin rocznego przeglądu gwarancyjnego (sugerowana data: {{date}}). Zarezerwuj termin wizyty: {{link}}",
  },
  {
    templateKey: "service.technician_assigned",
    subject: "KlikKlima — Przydzielono serwisanta do przeglądu",
    bodyTemplate: "Witaj {{first_name}}! Serwisant został przydzielony do przeglądu instalacji dla zlecenia #{{order_number}}.",
  },
  {
    templateKey: "service.reminder_24h",
    subject: "KlikKlima — Przypomnienie o jutrzejszym przeglądzie",
    bodyTemplate: "Witaj {{first_name}}! Przypominamy o jutrzejszym przeglądzie o godzinie {{time}}. Szczegóły wizyty: {{link}}",
  },
  {
    templateKey: "service.technician_en_route",
    bodyTemplate: "Witaj {{first_name}}! Serwisant wyruszył na wizytę przeglądową. Szacowany czas dojazdu: ok. {{eta}} min.",
  },
  {
    templateKey: "service.completed",
    subject: "KlikKlima — Przegląd serwisowy zakończony",
    bodyTemplate: "Witaj {{first_name}}! Przegląd okresowy dla instalacji #{{order_number}} został zakończony. Protokół serwisowy przesyłamy w załączeniu.",
  },

  // ---- Usterki / reklamacje ----
  {
    templateKey: "incident.received",
    subject: "KlikKlima — Zgłoszenie usterki zostało przyjęte",
    bodyTemplate: "Witaj {{first_name}}! Przyjęliśmy zgłoszenie usterki #{{order_number}}. Prosimy o wybór dogodnego terminu wizyty diagnostycznej: {{link}}",
  },
  {
    templateKey: "incident.technician_assigned",
    subject: "KlikKlima — Przypisano serwisanta do usterki",
    bodyTemplate: "Witaj {{first_name}}! Do zgłoszenia #{{order_number}} został przypisany serwisant.",
  },
  {
    templateKey: "incident.technician_en_route",
    bodyTemplate: "Witaj {{first_name}}! Serwisant jedzie do zgłoszonej usterki. Szacowany czas dojazdu: ok. {{eta}} min.",
  },
  {
    templateKey: "incident.repaired",
    subject: "KlikKlima — Naprawa usterki została zakończona",
    bodyTemplate: "Witaj {{first_name}}! Naprawa w ramach zgłoszenia #{{order_number}} została pomyślnie zrealizowana. Protokół odbioru w załączeniu.",
  },

  // ---- Wewnętrzne ----
  {
    templateKey: "internal.new_lead",
    subject: "KlikKlima — Nowy lead w systemie",
    bodyTemplate: "Nowy lead #{{order_number}} od {{first_name}} pod adresem {{address}}.",
  },
  {
    templateKey: "internal.quote_accepted",
    subject: "KlikKlima — Klient zaakceptował wycenę",
    bodyTemplate: "Klient {{first_name}} zaakceptował wycenę #{{order_number}} na kwotę {{total_price}}. Przypisz ekipę.",
  },
  {
    templateKey: "internal.crew_task_assigned",
    bodyTemplate: "Nowe zadanie montażu: adres {{address}}, data: {{date}} o godzinie {{time}}.",
  },
  {
    templateKey: "internal.rollback",
    subject: "KlikKlima — Lead wycofany do Rollback",
    bodyTemplate: "Lead #{{order_number}} (klient {{first_name}}) został wycofany do bufora Rollback. Zwolniono termin w kalendarzu.",
  },
  {
    templateKey: "internal.auditor_task_assigned",
    bodyTemplate: "Nowe zlecenie audytu dla zlecenia #{{order_number}} pod adresem {{address}} w dniu {{date}}.",
  },
  {
    templateKey: "internal.cert_expiring",
    subject: "KlikKlima — Wygaśnięcie uprawnień pracownika",
    bodyTemplate: "Uprawnienie {{certificate_type}} dla pracownika {{assignee}} wygasa w dniu {{valid_until}}.",
  },
  {
    templateKey: "internal.incident_critical",
    bodyTemplate: "PILNE: Zgłoszono usterkę krytyczną #{{order_number}} u klienta {{first_name}} pod adresem {{address}}. Start zegara SLA 48h.",
  },
];

export const MESSAGE_TEMPLATES: Record<string, MessageTemplate> = {};

for (const notif of NOTIFICATIONS) {
  const custom = TEMPLATE_DEFINITIONS.find((t) => t.templateKey === notif.templateKey);
  if (!custom) {
    throw new Error(`Brak definicji szablonu dla templateKey: ${notif.templateKey}`);
  }

  MESSAGE_TEMPLATES[notif.templateKey] = {
    templateKey: notif.templateKey,
    notificationId: notif.id,
    domain: notif.domain,
    channels: notif.channels,
    recipient: notif.recipient,
    subject: custom.subject,
    bodyTemplate: custom.bodyTemplate,
    requiredVars: notif.vars,
    attachments: notif.attachments,
  };
}

export function getTemplateByKey(templateKey: string): MessageTemplate {
  const found = MESSAGE_TEMPLATES[templateKey];
  if (!found) {
    throw new Error(`Nie znaleziono szablonu dla klucza "${templateKey}"`);
  }
  return found;
}

export function renderMessageTemplate(
  template: MessageTemplate,
  payload: Record<string, unknown>
): { subject?: string; body: string } {
  let body = template.bodyTemplate;
  for (const [key, val] of Object.entries(payload)) {
    const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    body = body.replace(placeholder, String(val ?? ""));
  }

  let subject = template.subject;
  if (subject) {
    for (const [key, val] of Object.entries(payload)) {
      const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
      subject = subject.replace(placeholder, String(val ?? ""));
    }
  }

  return { subject, body };
}
