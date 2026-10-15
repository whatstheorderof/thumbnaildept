import { Input, Textarea, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/app/submit-button";
import { MARKETPLACES } from "@/lib/domain/categories";
import type { ClientRow } from "@/lib/types/db";

export function ClientFields({ client }: { client?: ClientRow }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name"><Input name="name" defaultValue={client?.name} required /></Field>
        <Field label="Marketplace">
          <Select name="marketplace" defaultValue={client?.marketplace ?? "fiverr"}>{MARKETPLACES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select>
        </Field>
        <Field label="Marketplace username"><Input name="marketplaceUsername" defaultValue={client?.marketplace_username ?? ""} /></Field>
        <Field label="Email"><Input name="email" type="email" defaultValue={client?.email ?? ""} /></Field>
        <Field label="Channel URL" className="sm:col-span-2"><Input name="channelUrl" type="url" defaultValue={client?.channel_url ?? ""} placeholder="https://www.youtube.com/@handle" /></Field>
        <Field label="Brand colours" hint="Hex values, comma-separated"><Input name="brandColours" defaultValue={client?.brand_colours.join(", ")} placeholder="#7CFF4F, #121212" className="font-mono" /></Field>
        <Field label="Preferred fonts" hint="Comma-separated"><Input name="preferredFonts" defaultValue={client?.preferred_fonts.join(", ")} /></Field>
      </div>
      <Field label="Visual preferences"><Textarea name="visualPreferences" defaultValue={client?.visual_preferences ?? ""} rows={2} /></Field>
      <Field label="Things to avoid"><Textarea name="thingsToAvoid" defaultValue={client?.things_to_avoid ?? ""} rows={2} /></Field>
      <Field label="Notes"><Textarea name="notes" defaultValue={client?.notes ?? ""} rows={2} /></Field>
      <SubmitButton pendingLabel="Saving…">{client ? "Save profile" : "Create client"}</SubmitButton>
    </div>
  );
}
