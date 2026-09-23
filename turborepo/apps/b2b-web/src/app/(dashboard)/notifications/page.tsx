import { getCurrentActorRole } from "@/utils/supabase/server";
import { can } from "@klikklima/contracts";
import { getNotificationsListAction } from "./actions";
import { NotificationsClient } from "./notifications-client";

export default async function NotificationsPage() {
  const role = await getCurrentActorRole();

  if (!role || !can(role, "notification_queue", "read")) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Centrum Powiadomień</h1>
        <p className="text-sm text-destructive mt-2">
          Brak uprawnień do przeglądania modułu powiadomień. Wymagana rola: administrator lub dyspozytor.
        </p>
      </div>
    );
  }

  const { items, total } = await getNotificationsListAction();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <NotificationsClient initialItems={items} total={total} />
    </div>
  );
}
