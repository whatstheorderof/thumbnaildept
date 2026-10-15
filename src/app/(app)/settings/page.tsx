import { requireUser } from "@/lib/auth/session";
import { PageHeader, PageBody } from "@/components/app/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { ActionForm } from "@/components/app/action-form";
import { SubmitButton } from "@/components/app/submit-button";
import { getSettings, CRITIC_DIMENSIONS } from "@/lib/services/settings";
import { OUTGOING_EVENTS } from "@/lib/services/automation";
import { env, integrationModes } from "@/lib/env";
import { saveScoringAction, saveCriticAction, savePricingAction, saveResearchAction } from "./actions";

export const metadata = { title: "Settings" };

const Num = ({ name, value, step = "1", min = "0", max }: { name: string; value: number; step?: string; min?: string; max?: string }) => (
  <Input name={name} type="number" defaultValue={value} step={step} min={min} max={max} className="tabular" />
);

export default async function SettingsPage() {
  const { db } = await requireUser();
  const s = await getSettings(db);
  const modes = integrationModes();
  const w = s.scoring_weights;
  const total = w.velocity + w.recency + w.outperformance + w.relevance + w.novelty;
  return (
    <>
      <PageHeader title="Settings" description="Scoring, critic thresholds, pricing and integrations" />
      <PageBody className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Reference scoring weights" description={`Relative weights (currently sum to ${total}). Components with no data yet — e.g. novelty before vision analysis — are skipped and the rest renormalised.`} />
          <CardBody>
            <ActionForm action={saveScoringAction} className="space-y-4">
              <div className="grid grid-cols-5 gap-3 max-sm:grid-cols-2">
                <Field label="Velocity"><Num name="velocity" value={w.velocity} /></Field>
                <Field label="Recency"><Num name="recency" value={w.recency} /></Field>
                <Field label="Outperformance"><Num name="outperformance" value={w.outperformance} /></Field>
                <Field label="Relevance"><Num name="relevance" value={w.relevance} /></Field>
                <Field label="Novelty"><Num name="novelty" value={w.novelty} /></Field>
              </div>
              <SubmitButton size="sm">Save weights</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Automated critic" description="Score bands and dimension weights (normalised to 100)" />
          <CardBody>
            <ActionForm action={saveCriticAction} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Reject below"><Num name="rejectBelow" value={s.critic.rejectBelow} max="100" /></Field>
                <Field label="Human review from"><Num name="reviewFrom" value={s.critic.reviewFrom} max="100" /></Field>
              </div>
              <div className="grid grid-cols-5 gap-3 max-sm:grid-cols-2">
                {CRITIC_DIMENSIONS.map(([k, label]) => <Field key={k} label={label}><Num name={`w_${k}`} value={s.critic.weights[k] ?? 0} /></Field>)}
              </div>
              <SubmitButton size="sm">Save critic</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Pricing & fees" description="Used for margin estimates on every job" />
          <CardBody>
            <ActionForm action={savePricingAction} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Default sale price"><Num name="defaultSalePrice" value={s.pricing.defaultSalePrice} step="0.01" /></Field>
                <Field label="Currency"><Input name="currency" defaultValue={s.pricing.currency} maxLength={3} className="uppercase" /></Field>
                <Field label="USD → GBP"><Num name="usdToGbp" value={s.pricing.usdToGbp} step="0.001" /></Field>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {(["fiverr", "upwork", "direct", "other"] as const).map((m) => <Field key={m} label={`${m} fee %`}><Num name={`fee_${m}`} value={s.pricing.marketplaceFeePct[m] ?? 0} step="0.1" max="100" /></Field>)}
              </div>
              <SubmitButton size="sm">Save pricing</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Pipeline" description="Research volume and generation defaults" />
          <CardBody>
            <ActionForm action={saveResearchAction} className="space-y-4">
              <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
                <Field label="Search queries"><Num name="queryCount" value={s.research.queryCount} min="3" max="12" /></Field>
                <Field label="Max videos"><Num name="maxVideos" value={s.research.maxVideos} min="10" max="100" /></Field>
                <Field label="Published within (days)"><Num name="publishedWithinDays" value={s.research.publishedWithinDays} min="7" /></Field>
                <Field label="Auto-include top"><Num name="autoIncludeTop" value={s.research.autoIncludeTop} min="4" max="30" /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Candidates / concept"><Num name="candidatesPerConcept" value={s.generation.candidatesPerConcept} min="1" max="8" /></Field>
                <Field label="Gen width"><Num name="width" value={s.generation.width} min="512" step="8" /></Field>
                <Field label="Gen height"><Num name="height" value={s.generation.height} min="512" step="8" /></Field>
              </div>
              <SubmitButton size="sm">Save pipeline</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Integrations" description="Keys live in server environment variables only — never in the browser or the database" />
          <CardBody className="grid gap-6 md:grid-cols-2">
            <ul className="space-y-2 text-[13px]">
              {([["YouTube Data API", modes.youtube], ["Claude", modes.claude], ["Leonardo", modes.leonardo]] as const).map(([k, m]) => (
                <li key={k} className="flex items-center justify-between"><span>{k}</span><Badge className={m === "live" ? "text-foreground" : "border-dashed"}>{m === "live" ? "Live" : "Dev mock"}</Badge></li>
              ))}
              <li className="flex items-center justify-between"><span>Leonardo webhook auth</span><Badge>{env.leonardoWebhookSecret ? "Configured" : "Not set"}</Badge></li>
              <li className="flex items-center justify-between"><span>Automation API key</span><Badge>{env.automationApiKey ? "Configured" : "Not set"}</Badge></li>
              <li className="flex items-center justify-between"><span>Outgoing webhook</span><Badge>{env.outgoingWebhookUrl ? "Sending" : "Recording only"}</Badge></li>
            </ul>
            <div className="space-y-3 text-xs text-muted">
              <div><div className="label-caps mb-1">Leonardo webhook URL</div><code className="text-foreground">{env.appUrl}/api/webhooks/leonardo</code></div>
              <div><div className="label-caps mb-1">Inbound endpoints</div><code className="block text-foreground">POST /api/orders</code><code className="block text-foreground">POST /api/orders/{"{id}"}/start</code><code className="block text-foreground">POST /api/orders/{"{id}"}/revision</code><code className="block text-foreground">POST /api/orders/{"{id}"}/transition</code></div>
              <div><div className="label-caps mb-1">Outgoing events</div><div className="flex flex-wrap gap-1">{OUTGOING_EVENTS.map((e) => <Badge key={e} mono>{e}</Badge>)}</div></div>
            </div>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
