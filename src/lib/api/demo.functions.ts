import { postNetlifyFunction } from "./netlify-client";

type SendEmailResult = { ok: true; id: string; recipient: string };

export async function sendDataRequestEmails({
  data,
}: {
  data: {
    productName?: string;
    contact?: { name?: string; email?: string };
    deliverables?: Array<{ title?: string; name?: string } | string>;
  };
}) {
  const result = await postNetlifyFunction<SendEmailResult>("send-email", {
    productName: data.productName ?? "",
    contact: data.contact,
    deliverables: data.deliverables,
  });

  return { sent: true as const, emailId: result.id, recipient: result.recipient };
}
