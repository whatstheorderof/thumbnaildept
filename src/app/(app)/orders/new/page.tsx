import { requireUser } from "@/lib/auth/session";
import { PageHeader, PageBody } from "@/components/app/page-header";
import { listClients } from "@/lib/services/clients";
import { NewOrderForm } from "./new-order-form";

export const metadata = { title: "New thumbnail job" };

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  const { db } = await requireUser();
  const clients = await listClients(db);
  return (
    <>
      <PageHeader eyebrow="Orders" title="New thumbnail job" description="Everything the research and concept stages need. Files upload straight to storage, scoped to this job." />
      <PageBody>
        <NewOrderForm
          defaultClientId={client}
          clients={clients.map((c) => ({ id: c.id, name: c.name, marketplace: c.marketplace, channelUrl: c.channel_url, thingsToAvoid: c.things_to_avoid }))}
        />
      </PageBody>
    </>
  );
}
