const DEMO_RECIPIENT = "sarahcduong@gmail.com";

/** Demo-only: sends a single summary email to Sarah. PRM owner addresses are never emailed. */
export async function sendDataRequestDemoEmail(productName: string): Promise<{ ok: true; id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const subject = `Pathways data request — ${productName || "Style 225G731"}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; color: #1a1a18;">
      <p style="font-size: 13px; color: #6b6b65; margin: 0 0 8px;">Pathways · Carter's Inc.</p>
      <h1 style="font-size: 20px; margin: 0 0 16px;">Lifecycle data request</h1>
      <p style="font-size: 15px; line-height: 1.5;">
        Priya Raghavan at Carter's has opened a Pathways data collection cycle for
        <strong>${productName || "Little Planet™ Organic Sleep & Play (3-Pack)"}</strong>.
      </p>
      <p style="font-size: 14px; line-height: 1.5; color: #444;">
        This demo queued <strong>16 scoped upload forms</strong> (9 internal Carter's teams + 7 external vendor contacts)
        via Salesforce PRM routing — no emails were sent to those contacts. A single summary was sent to the demo recipient only.
      </p>
      <p style="margin: 24px 0;">
        <a href="https://pathways.carters.com/request/demo"
           style="display: inline-block; background: #2C6B45; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Open secure upload portal →
        </a>
      </p>
      <p style="font-size: 12px; color: #9b9b95; margin-top: 32px;">
        Sent from Pathways demo · Link expires in 14 days · Reply to priya.raghavan@carters.com with questions.
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
    const body = await res.text();
    throw new Error(`Resend error (${res.status}): ${body}`);
  }

  const json = (await res.json()) as { id: string };
  return { ok: true, id: json.id };
}
