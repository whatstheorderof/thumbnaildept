"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, ImagePlus } from "lucide-react";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { DEFAULT_CATEGORIES, MARKETPLACES } from "@/lib/domain/categories";
import { createOrderAction } from "../actions";
import { uploadFiles } from "@/lib/upload-client";
import type { AssetKind } from "@/lib/types/db";
import { cn } from "@/lib/utils";

interface ClientOption { id: string; name: string; marketplace: string; channelUrl: string | null; thingsToAvoid: string | null }
type Pending = { file: File; kind: AssetKind };

export function NewOrderForm({ clients, defaultClientId }: { clients: ClientOption[]; defaultClientId?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<string | null>(null);

  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [newClientName, setNewClientName] = useState("");
  const client = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);
  const [marketplace, setMarketplace] = useState(client?.marketplace ?? "fiverr");
  const [channelUrl, setChannelUrl] = useState(client?.channelUrl ?? "");
  const [autoDetect, setAutoDetect] = useState(false);
  const [assets, setAssets] = useState<Pending[]>([]);
  const [refs, setRefs] = useState<File[]>([]);

  function pickClient(id: string) {
    setClientId(id);
    const c = clients.find((x) => x.id === id);
    if (c) { setMarketplace(c.marketplace); if (c.channelUrl) setChannelUrl(c.channelUrl); }
  }

  function submit(fd: FormData) {
    setError(null); setFieldErrors({});
    const deadlineLocal = String(fd.get("deadline") ?? "");
    const referenceUrls = String(fd.get("referenceUrls") ?? "").split(/\s+/).map((s) => s.trim()).filter(Boolean);
    start(async () => {
      const res = await createOrderAction({
        marketplace: marketplace as "fiverr",
        marketplaceOrderId: String(fd.get("marketplaceOrderId") ?? ""),
        clientId: clientId && clientId !== "__new" ? clientId : null,
        clientName: clientId === "__new" ? newClientName : null,
        videoTitle: String(fd.get("videoTitle") ?? ""),
        videoDescription: String(fd.get("videoDescription") ?? ""),
        channelUrl: channelUrl || null,
        requestedText: String(fd.get("requestedText") ?? ""),
        category: autoDetect ? null : String(fd.get("category") ?? "") || null,
        autoDetectCategory: autoDetect,
        clientNotes: String(fd.get("clientNotes") ?? ""),
        thingsToAvoid: String(fd.get("thingsToAvoid") ?? ""),
        deadline: deadlineLocal ? new Date(deadlineLocal).toISOString() : null,
        referenceUrls,
      });
      if (!res.ok) { setError(res.error); setFieldErrors(res.fieldErrors ?? {}); return; }
      const { id, jobId } = res.data;
      try {
        const byKind = new Map<AssetKind, File[]>();
        assets.forEach((a) => byKind.set(a.kind, [...(byKind.get(a.kind) ?? []), a.file]));
        for (const [kind, files] of byKind) await uploadFiles({ scope: "order_asset", orderId: id, kind }, files, (d, t) => setProgress(`Uploading assets ${d}/${t}`));
        if (refs.length) await uploadFiles({ scope: "order_reference", orderId: id }, refs, (d, t) => setProgress(`Uploading references ${d}/${t}`));
      } catch (e) {
        router.push(`/orders/${jobId}?uploadError=${encodeURIComponent(e instanceof Error ? e.message : "Upload failed")}`);
        return;
      }
      router.push(`/orders/${jobId}`);
    });
  }

  const err = (k: string) => fieldErrors[k];

  return (
    <form action={submit} className="grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Card>
          <CardHeader title="Marketplace" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Marketplace" htmlFor="marketplace">
              <Select id="marketplace" value={marketplace} onChange={(e) => setMarketplace(e.target.value)}>
                {MARKETPLACES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </Field>
            <Field label="Marketplace order ID" htmlFor="marketplaceOrderId" error={err("marketplaceOrderId")}>
              <Input id="marketplaceOrderId" name="marketplaceOrderId" placeholder="e.g. FO1A2B3C4D" />
            </Field>
            <Field label="Client" htmlFor="client" className="sm:col-span-2">
              <Select id="client" value={clientId} onChange={(e) => pickClient(e.target.value)}>
                <option value="">No client profile</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__new">+ New client…</option>
              </Select>
            </Field>
            {clientId === "__new" && (
              <Field label="New client name" htmlFor="newClientName" className="sm:col-span-2">
                <Input id="newClientName" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} required />
              </Field>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Video" />
          <CardBody className="space-y-4">
            <Field label="Video title" htmlFor="videoTitle" error={err("videoTitle")}>
              <Input id="videoTitle" name="videoTitle" required placeholder="The exact title the video will publish with" />
            </Field>
            <Field label="Video description" htmlFor="videoDescription">
              <Textarea id="videoDescription" name="videoDescription" rows={3} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Channel URL" htmlFor="channelUrl" error={err("channelUrl")}>
                <Input id="channelUrl" value={channelUrl} onChange={(e) => setChannelUrl(e.target.value)} placeholder="https://www.youtube.com/@handle" />
              </Field>
              <Field label="Requested thumbnail text" htmlFor="requestedText" hint="Optional — the system may recommend no text">
                <Input id="requestedText" name="requestedText" />
              </Field>
            </div>
            <div className="grid items-end gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="category">
                <Select id="category" name="category" disabled={autoDetect} defaultValue="">
                  <option value="">Select…</option>
                  {DEFAULT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </Select>
              </Field>
              <label className="flex h-8 items-center gap-2.5 text-xs text-muted">
                <Switch checked={autoDetect} onCheckedChange={setAutoDetect} />
                Detect category automatically
              </label>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Brief" />
          <CardBody className="space-y-4">
            <Field label="Client notes" htmlFor="clientNotes"><Textarea id="clientNotes" name="clientNotes" rows={3} /></Field>
            <Field label="Things to avoid" htmlFor="thingsToAvoid" hint={client?.thingsToAvoid ? `Client profile: ${client.thingsToAvoid}` : undefined}>
              <Textarea id="thingsToAvoid" name="thingsToAvoid" rows={2} />
            </Field>
            <Field label="Reference URLs" htmlFor="referenceUrls" hint="One per line — YouTube videos, images, anything the client pointed at">
              <Textarea id="referenceUrls" name="referenceUrls" rows={3} className="font-mono text-xs" />
            </Field>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader title="Delivery" />
          <CardBody><Field label="Delivery deadline" htmlFor="deadline"><Input id="deadline" name="deadline" type="datetime-local" /></Field></CardBody>
        </Card>

        <Card>
          <CardHeader title="Client assets" description="Photos of the client, logos, brand files" />
          <CardBody className="space-y-2">
            <FilePicker onPick={(files) => setAssets((a) => [...a, ...files.map((file) => ({ file, kind: (file.type.startsWith("image/") ? "face_photo" : "client_asset") as AssetKind }))])} accept="image/*,.ttf,.otf,.woff,.woff2,.zip,.pdf" />
            {assets.map((a, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
                <span className="min-w-0 flex-1 truncate">{a.file.name}</span>
                <select value={a.kind} onChange={(e) => setAssets((xs) => xs.map((x, j) => (j === i ? { ...x, kind: e.target.value as AssetKind } : x)))} className="rounded border border-border bg-surface px-1 py-0.5 text-[11px]">
                  <option value="face_photo">Face photo</option><option value="logo">Logo</option><option value="client_asset">Asset</option><option value="font">Font</option><option value="brand">Brand</option>
                </select>
                <button type="button" onClick={() => setAssets((xs) => xs.filter((_, j) => j !== i))} className="text-subtle hover:text-foreground"><X className="size-3.5" /></button>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Reference images" description="Client-supplied references (feeds Client DNA)" />
          <CardBody className="space-y-2">
            <FilePicker onPick={(files) => setRefs((r) => [...r, ...files])} accept="image/*" />
            {refs.map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <button type="button" onClick={() => setRefs((xs) => xs.filter((_, j) => j !== i))} className="text-subtle hover:text-foreground"><X className="size-3.5" /></button>
              </div>
            ))}
          </CardBody>
        </Card>

        <div className="sticky bottom-4 space-y-2">
          {error && <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}{pending ? progress ?? "Creating job…" : "Create job"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function FilePicker({ onPick, accept }: { onPick: (f: File[]) => void; accept: string }) {
  const [over, setOver] = useState(false);
  return (
    <label onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onPick([...e.dataTransfer.files]); }}
      className={cn("flex h-16 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border text-xs text-muted hover:border-border-strong hover:text-foreground", over && "border-foreground/60 bg-surface-2")}>
      <ImagePlus className="size-3.5" />Drop or choose files
      <input type="file" multiple accept={accept} className="hidden" onChange={(e) => { onPick([...(e.target.files ?? [])]); e.target.value = ""; }} />
    </label>
  );
}
