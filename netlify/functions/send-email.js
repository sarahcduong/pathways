import { errorResponse, jsonResponse, methodNotAllowed, readJsonBody } from "../lib/http.js";

const DEMO_RECIPIENT = "sarahcduong@gmail.com";

export default async (request) => {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return errorResponse("RESEND_API_KEY is not configured", 500);
    }

    const body = await readJsonBody(request);
    const productName = body.productName || "Little Planet™ Organic Sleep & Play (3-Pack)";
    const contact = body.contact ?? {};
    const deliverables = body.deliverables ?? [];
    const contactLabel = contact.name
      ? `${contact.name}${contact.email ? ` (${contact.email})` : ""}`
      : "Priya Raghavan at Carter's";
    const deliverableCount = deliverables.length || 16;

    const subject = `Pathways data request: ${productName}`;
    const deliverableList =
      deliverables.length > 0
        ? `<ul style="margin: 12px 0; padding-left: 20px;">${deliverables
            .map((item) => `<li style="margin-bottom: 6px;">${item.title ?? item.name ?? item}</li>`)
            .join("")}</ul>`
        : "";

    const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; color: #1a1a18;">
      <p style="font-size: 13px; color: #6b6b65; margin: 0 0 8px;">Pathways · Carter's Inc.</p>
      <h1 style="font-size: 20px; margin: 0 0 16px;">Lifecycle data request</h1>
      <p style="font-size: 15px; line-height: 1.5;">
        ${contactLabel} has opened a Pathways data collection cycle for
        <strong>${productName}</strong>.
      </p>
      <p style="font-size: 14px; line-height: 1.5; color: #444;">
        This demo queued <strong>${deliverableCount} scoped upload forms</strong> via Salesforce PRM routing.
        A single summary was sent to the demo recipient only.
      </p>
      ${deliverableList}
      <p style="margin: 24px 0;">
        <a href="https://pathways.carters.com/request/demo"
           style="display: inline-block; background: #2C6B45; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Open secure upload portal →
        </a>
      </p>
      <p style="font-size: 12px; color: #9b9b95; margin-top: 32px;">
        Sent from Pathways demo · Link expires in 14 days.
      </p>
    </div>
  `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Pathways <onboarding@resend.dev>",
        to: [DEMO_RECIPIENT],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return errorResponse(`Resend error (${res.status}): ${text}`, 502);
    }

    const json = await res.json();
    return jsonResponse({ ok: true, id: json.id, recipient: DEMO_RECIPIENT });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed";
    return errorResponse(message);
  }
};
