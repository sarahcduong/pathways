import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { sendDataRequestDemoEmail } from "../email.server";

export const sendDataRequestEmails = createServerFn({ method: "POST" })
  .validator(z.object({ productName: z.string().optional() }))
  .handler(async ({ data }) => {
    // Demo sends one email to Sarah only — PRM owner addresses are display-only in the UI.
    const result = await sendDataRequestDemoEmail(data.productName ?? "");
    return { sent: true, emailId: result.id, recipient: "sarahcduong@gmail.com" };
  });
