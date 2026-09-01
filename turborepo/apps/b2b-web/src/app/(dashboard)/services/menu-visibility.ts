import type { ServiceSummary } from "./actions";

export function isDeleteMenuItemVisible(service: Pick<ServiceSummary, "source">): boolean {
  return service.source === "service";
}
