import { SLA } from "@klikklima/contracts"
import { isToday } from "date-fns"

/**
 * @REQ: CRM-INST-AC2 — Dzisiejsze instalacje bez statusu Zakończona po godzinie 16:00
 * podświetlają się na pomarańczowo.
 * Próg godzinowy pochodzi z SLA.INSTALL_DAY_ALERT.hourOfDay, a nie z literału w komponencie.
 */
export function isInstallationLate(
  item: { plannedDate: string | null; status: string },
  currentHour: number = new Date().getHours(),
  isTodayFn: (date: Date) => boolean = isToday
): boolean {
  if (!item.plannedDate) {
    return false;
  }

  const isTodayInstallation = isTodayFn(new Date(item.plannedDate));
  if (!isTodayInstallation) {
    return false;
  }

  if (item.status === "COMPLETED") {
    return false;
  }

  return currentHour >= SLA.INSTALL_DAY_ALERT.hourOfDay;
}
