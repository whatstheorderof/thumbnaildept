import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { PageHeader, PageBody } from "@/components/app/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionForm } from "@/components/app/action-form";
import { SubmitButton } from "@/components/app/submit-button";
import { listChannels } from "@/lib/services/channels";
import { listClients } from "@/lib/services/clients";
import { createChannelAction, lockedAction } from "./actions";
import { formatCompact, formatDate } from "@/lib/utils";

export const metadata = { title: "Channels" };

export default async function ChannelsPage() {
  const { db } = await requireUser();
  const [channels, clients] = await Promise.all([listChannels(db), listClients(db)]);
  return (
    <>
      <PageHeader title="Channels" description="Client channel profiles. Channel DNA analysis arrives in Phase 3; lock mandatory characteristics now." />
      <PageBody className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {channels.length === 0 ? <EmptyState title="No channels">Channels are added here or automatically from an order&apos;s channel URL.</EmptyState> : channels.map((c) => (
            <Card key={c.id}>
              <CardHeader
                title={<a href={c.url} target="_blank" rel="noreferrer" className="hover:underline">{c.title ?? c.handle ?? c.url}</a>}
                description={[c.client ? c.client.name : "No client", c.subscriber_count ? `${formatCompact(c.subscriber_count)} subs` : null, c.last_analysed_at ? `analysed ${formatDate(c.last_analysed_at)}` : "not analysed"].filter(Boolean).join(" · ")}
                action={c.client && <Link href={`/clients/${c.client.id}`} className="text-xs text-muted hover:text-foreground">Client →</Link>}
              />
              <CardBody className="grid gap-5 md:grid-cols-2">
                <div>
                  <div className="label-caps mb-2">Channel DNA</div>
                  {c.channel_dna ? <pre className="overflow-x-auto text-[11px] text-muted">{JSON.stringify(c.channel_dna, null, 2)}</pre> : <p className="text-xs text-subtle">Recurring colours, face framing, type treatment, composition and motifs will be extracted from recent uploads (Phase 3).</p>}
                </div>
                <ActionForm action={lockedAction.bind(null, c.id)} className="space-y-2">
                  <Field label="Locked characteristics" hint="One per line. Every concept for this channel must keep these.">
                    <Textarea name="locked" rows={3} defaultValue={c.locked_characteristics.filter((l) => l.locked).map((l) => l.label).join("\n")} />
                  </Field>
                  <SubmitButton size="sm" variant="secondary">Save</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ))}
        </div>
        <Card className="self-start">
          <CardHeader title="Add channel" />
          <CardBody>
            <ActionForm action={createChannelAction} resetOnSuccess className="space-y-3">
              <Field label="Channel URL"><Input name="url" type="url" required placeholder="https://www.youtube.com/@handle" /></Field>
              <Field label="Title"><Input name="title" /></Field>
              <Field label="Client"><Select name="clientId" defaultValue=""><option value="">None</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
              <SubmitButton size="sm">Add channel</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
