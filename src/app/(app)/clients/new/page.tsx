import { requireUser } from "@/lib/auth/session";
import { PageHeader, PageBody } from "@/components/app/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { ActionForm } from "@/components/app/action-form";
import { ClientFields } from "../client-form";
import { createClientAction } from "../actions";

export const metadata = { title: "New client" };

export default async function NewClientPage() {
  await requireUser();
  return (
    <>
      <PageHeader eyebrow="Clients" title="New client" />
      <PageBody><Card className="max-w-2xl"><CardBody><ActionForm action={createClientAction}><ClientFields /></ActionForm></CardBody></Card></PageBody>
    </>
  );
}
