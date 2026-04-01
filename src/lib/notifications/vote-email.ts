import { Resend } from "resend";
import { adminAuth } from "@/src/lib/firebase/admin";

const resendApiKey = process.env.RESEND_API_KEY;

export async function notifyOwnerNewVote(input: {
  orgId: string;
  pollTitle: string;
  pollSlug: string;
  voterName: string;
}): Promise<void> {
  if (!resendApiKey) return;

  let ownerEmail: string | undefined;
  try {
    const user = await adminAuth.getUser(input.orgId);
    ownerEmail = user.email;
  } catch {
    return;
  }

  if (!ownerEmail) return;

  const resultsUrl = `https://summareu.app/p/${input.pollSlug}/results`;

  try {
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: "Summa Reu <your-meeting@summareu.app>",
      to: ownerEmail,
      subject: `Nou vot a "${input.pollTitle}"`,
      html: [
        `<p><strong>${escapeHtml(input.voterName)}</strong> ha votat a la teva enquesta <strong>${escapeHtml(input.pollTitle)}</strong>.</p>`,
        `<p><a href="${resultsUrl}">Veure resultats</a></p>`,
      ].join("\n"),
    });
  } catch (error) {
    console.error("vote_email_send_failed", input.orgId, error);
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
