import { describe, it, expect } from "vitest";
import { NOTIFICATIONS, NOTIFICATION_IDS } from "@klikklima/contracts";
import { MESSAGE_TEMPLATES, getTemplateByKey } from "../src/lib/notifications/templates";

describe("NTF-CATALOG-PARITY — Parytet katalogu powiadomień i szablonów", () => {
  // @REQ: NTF-CATALOG-PARITY
  it("każde powiadomienie z katalogu NOTIFICATIONS posiada odpowiadający szablon w MESSAGE_TEMPLATES", () => {
    expect(NOTIFICATIONS.length).toBeGreaterThan(0);

    for (const notif of NOTIFICATIONS) {
      const template = getTemplateByKey(notif.templateKey);
      expect(template, "Brak szablonu dla templateKey: " + notif.templateKey + " (powiadomienie: " + notif.id + ")").toBeDefined();
      expect(template.notificationId).toBe(notif.id);
    }
  });

  // @REQ: NTF-CATALOG-PARITY
  it("każdy szablon w MESSAGE_TEMPLATES odpowiada istniejącemu powiadomieniu w katalogu NOTIFICATIONS (brak sierot)", () => {
    const notificationTemplateKeys = new Set(NOTIFICATIONS.map((n) => n.templateKey));
    const allTemplates = Object.values(MESSAGE_TEMPLATES);

    expect(allTemplates.length).toBe(NOTIFICATIONS.length);

    for (const tpl of allTemplates) {
      expect(notificationTemplateKeys.has(tpl.templateKey), "Osierocony szablon: " + tpl.templateKey).toBe(true);
      expect(NOTIFICATION_IDS).toContain(tpl.notificationId);
    }
  });

  // @REQ: NTF-CATALOG-PARITY
  it("brak duplikatów templateKey w katalogu szablonów", () => {
    const allTemplates = Object.values(MESSAGE_TEMPLATES);
    const keys = allTemplates.map((t) => t.templateKey);
    const uniqueKeys = new Set(keys);

    expect(keys.length).toBe(uniqueKeys.size);
  });

  // @REQ: NTF-CATALOG-PARITY
  it("każdy szablon deklaruje i weryfikuje wymagane zmienne zdefiniowane w vars kontraktu", () => {
    for (const notif of NOTIFICATIONS) {
      const template = getTemplateByKey(notif.templateKey);
      for (const v of notif.vars) {
        expect(
          template.requiredVars,
          "Szablon " + notif.templateKey + " nie zawiera wymaganej zmiennej " + v + " zdefiniowanej w kontrakcie dla " + notif.id
        ).toContain(v);
      }
    }
  });

  // @REQ: NTF-CATALOG-PARITY
  it("szablony posiadają treść po polsku oraz zdefiniowany temat dla kanału EMAIL", () => {
    for (const notif of NOTIFICATIONS) {
      const template = getTemplateByKey(notif.templateKey);
      expect(template.bodyTemplate.length).toBeGreaterThan(5);

      if (notif.channels.includes("EMAIL")) {
        expect(template.subject, "Brak subject dla szablonu EMAIL " + notif.templateKey).toBeDefined();
        expect(template.subject?.length).toBeGreaterThan(0);
      }
    }
  });
});
