import React from "react";
import { notFound } from "next/navigation";
import { getClientById } from "../actions";
import { ClientDetailsClient } from "./client-details-client";

export const dynamic = "force-dynamic";

export default async function ClientDetailsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const client = await getClientById(params.id);

  if (!client) {
    return notFound();
  }

  return <ClientDetailsClient client={client} />;
}
