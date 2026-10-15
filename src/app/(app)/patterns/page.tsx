import { requireUser } from "@/lib/auth/session";
import { PageHeader, PageBody } from "@/components/app/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionForm } from "@/components/app/action-form";
import { SubmitButton } from "@/components/app/submit-button";
import { createPatternAction } from "./actions";
import type { StylePatternRow } from "@/lib/types/db";

export const metadata = { title: "Patterns" };

export default async function PatternsPage() {
  const { db } = await requireUser();
  const [{ data }, { data: usage }] = await Promise.all([
    db.from("style_patterns").select("*").order("name"),
    db.from("concepts").select("style_pattern_id").not("style_pattern_id", "is", null),
  ]);
  const uses = new Map<string, number>();
  for (const u of usage ?? []) uses.set(u.style_pattern_id, (uses.get(u.style_pattern_id) ?? 0) + 1);
  const patterns = (data ?? []) as StylePatternRow[];
  return (
    <>
      <PageHeader title="Patterns" description="Reusable composition mechanics, saved independently of any reference image or creator's artwork" />
      <PageBody className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {patterns.length === 0 ? <EmptyState title="No patterns yet" /> : (
          <div className="grid gap-4 md:grid-cols-2">
            {patterns.map((p) => (
              <Card key={p.id}>
                <div className="border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2"><h3 className="font-mono text-[13px] font-semibold tracking-wider">{p.name}</h3><span className="ml-auto text-[11px] text-subtle">used {uses.get(p.id) ?? 0}×</span></div>
                  {p.description && <p className="mt-1 text-xs text-muted">{p.description}</p>}
                </div>
                <dl className="divide-y divide-border text-[12px]">
                  {([["Subject position", p.subject_position], ["Primary object", p.primary_object], ["Object treatment", p.object_treatment], ["Background", p.background], ["Text", p.text_treatment], ["Curiosity", p.curiosity_mechanism], ["Emotion", p.emotional_mechanism]] as const).map(([k, v]) => v ? (
                    <div key={k} className="grid grid-cols-[120px_1fr] gap-2 px-4 py-1.5"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>
                  ) : null)}
                </dl>
                <div className="flex flex-wrap gap-1 border-t border-border px-4 py-2.5">{[...p.categories, ...p.tags].map((t) => <Badge key={t}>{t}</Badge>)}</div>
              </Card>
            ))}
          </div>
        )}
        <Card className="self-start">
          <CardHeader title="New pattern" description="Describe mechanics, not someone's artwork" />
          <CardBody>
            <ActionForm action={createPatternAction} resetOnSuccess className="space-y-3">
              <Field label="Name"><Input name="name" required placeholder="SCALE SHOCK" className="font-mono uppercase" /></Field>
              <Field label="Description"><Textarea name="description" rows={2} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Subject position"><Input name="subjectPosition" placeholder="left 35%" /></Field>
                <Field label="Primary object"><Input name="primaryObject" placeholder="right 55%" /></Field>
                <Field label="Object treatment"><Input name="objectTreatment" /></Field>
                <Field label="Background"><Input name="background" /></Field>
                <Field label="Text"><Input name="textTreatment" placeholder="none" /></Field>
                <Field label="Emotion"><Input name="emotionalMechanism" /></Field>
              </div>
              <Field label="Curiosity mechanism"><Input name="curiosityMechanism" /></Field>
              <Field label="Categories" hint="Comma-separated"><Input name="categories" /></Field>
              <Field label="Tags" hint="Comma-separated"><Input name="tags" /></Field>
              <SubmitButton size="sm">Save pattern</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
